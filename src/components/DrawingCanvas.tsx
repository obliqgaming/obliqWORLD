// Porté fidèlement depuis ObliqWild (src/components/DrawingModal.tsx).
// Adaptations : plus de <Dialog> (ce composant s'intègre directement dans un onglet
// de CharacterSelect, pas en popup par-dessus le jeu), suppression du système de
// musique contextuelle et du mode "creatures" propres à ObliqWild (ce projet n'a ni
// l'un ni l'autre), boutons/sliders réécrits en HTML simple pour ne dépendre d'aucun
// composant shadcn/ui dont on n'est pas sûr qu'il existe déjà dans ce repo.
// Tout le moteur de dessin (pinceau, gomme, ligne, cercle, spray, remplissage,
// pipette, undo/redo, historique) est identique à l'original.

import React, { useRef, useState, useEffect, useCallback } from "react";
import { hexToRgb, paintStrokeSegment, sprayPaintSegment } from "../lib/drawingTools";
import type { Point } from "../lib/scenes-supabase";
import {
  Pencil,
  Eraser,
  Trash2,
  Undo2,
  Redo2,
  Save,
  Minus,
  Pipette,
  PaintBucket,
  Circle,
  SprayCan,
  Hand,
} from "lucide-react";

const DEFAULT_CANVAS = 512; // personnage : 512 × 512 ; une arme est un canvas plus petit (voir ForgePanel)
const MAX_HISTORY = 30;

// Position par défaut du repère de main (% de l'image) : 2/3 depuis la
// gauche, 2/3 depuis le haut — un point de départ raisonnable pour une main
// qui tiendrait une arme, ajustable par glisser-déposer. Optionnel : le
// joueur peut le désactiver s'il ne veut pas s'en servir (dessin 100% libre).
const DEFAULT_HAND_ANCHOR: Point = { x: (2 / 3) * 100, y: (2 / 3) * 100 };

const PALETTE = [
  "#1a1a1a", "#ffffff", "#6b7280", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#78350f", "#166534",
];

type Tool = "brush" | "eraser" | "line" | "circle" | "eyedropper" | "fill" | "spray";

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function colorsMatch(data: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number, tolerance = 10): boolean {
  return (
    Math.abs(data[i] - r) <= tolerance &&
    Math.abs(data[i + 1] - g) <= tolerance &&
    Math.abs(data[i + 2] - b) <= tolerance &&
    Math.abs(data[i + 3] - a) <= tolerance
  );
}

function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillR: number, fillG: number, fillB: number, fillA: number) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;
  const startIdx = (sy * w + sx) * 4;
  const targetR = data[startIdx]!;
  const targetG = data[startIdx + 1]!;
  const targetB = data[startIdx + 2]!;
  const targetA = data[startIdx + 3]!;
  if (targetA === fillA && Math.abs(targetR - fillR) <= 5 &&
      Math.abs(targetG - fillG) <= 5 && Math.abs(targetB - fillB) <= 5) return;
  const stack: [number, number][] = [[sx, sy]];
  const visited = new Uint8Array(w * h);
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const idx = cy * w + cx;
    if (visited[idx]) continue;
    const pi = idx * 4;
    const isTransparentTarget = targetA < 10;
    const matches = isTransparentTarget
      ? data[pi + 3]! < 10
      : colorsMatch(data, pi, targetR, targetG, targetB, targetA, 30);
    if (!matches) continue;
    visited[idx] = 1;
    data[pi] = fillR;
    data[pi + 1] = fillG;
    data[pi + 2] = fillB;
    data[pi + 3] = fillA;
    if (cx > 0) stack.push([cx - 1, cy]);
    if (cx < w - 1) stack.push([cx + 1, cy]);
    if (cy > 0) stack.push([cx, cy - 1]);
    if (cy < h - 1) stack.push([cx, cy + 1]);
  }
  ctx.putImageData(imageData, 0, 0);
}

export function DrawingCanvas({
  onExport,
  exporting,
  width,
  height,
  anchorLabel = "Repère de main (pour une future arme)",
  anchorTitle = "Repère de la main — glisse pour le placer (une future arme s'y accrochera)",
  anchorOptional = true,
  exportLabel = "Valider le dessin",
  onPreview,
  initialAnchor,
  noAnchor = false,
}: {
  onExport: (blob: Blob, handAnchor: Point | null) => void;
  exporting?: boolean;
  /** Taille du canvas en pixels (512 × 512 par défaut, comme un personnage). */
  width?: number;
  height?: number;
  anchorLabel?: string;
  anchorTitle?: string;
  /** false = le repère est obligatoire (pas de case pour le désactiver), ex. la poignée d'une arme. */
  anchorOptional?: boolean;
  exportLabel?: string;
  /** Appelé après chaque trait / changement de repère, pour un aperçu en direct. */
  onPreview?: (dataUrl: string, anchor: Point | null) => void;
  initialAnchor?: Point;
  /** true = aucun repère de main (ex. un compagnon) : onExport reçoit null. */
  noAnchor?: boolean;
}) {
  const W = width ?? DEFAULT_CANVAS;
  const H = height ?? DEFAULT_CANVAS;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(W < 300 ? 1 : 4);
  const [opacity, setOpacity] = useState(1);
  const [color, setColor] = useState("#1a1a1a");

  // ---------- Ancrage main (pour une future arme/objet tenu) ----------
  const [handAnchorEnabled, setHandAnchorEnabled] = useState(!noAnchor);
  const [handAnchor, setHandAnchor] = useState<Point>(initialAnchor ?? DEFAULT_HAND_ANCHOR);
  const [draggingAnchor, setDraggingAnchor] = useState(false);
  const previewTimer = useRef<number | undefined>(undefined);
  const anchorRef = useRef<Point | null>(null);
  anchorRef.current = handAnchorEnabled ? handAnchor : null;
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  const schedulePreview = useCallback(() => {
    if (!onPreviewRef.current) return;
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      const c = canvasRef.current;
      if (c && onPreviewRef.current) onPreviewRef.current(c.toDataURL("image/png"), anchorRef.current);
    }, 120);
  }, []);
  useEffect(() => {
    schedulePreview();
  }, [handAnchor, handAnchorEnabled, schedulePreview]);

  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokeMaskRef = useRef<Uint8Array | null>(null);
  const [altHeld, setAltHeld] = useState(false);
  const prevToolRef = useRef<Tool>("brush");

  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, W, H);
    historyRef.current.push(snap);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || historyRef.current.length === 0) return;
    redoRef.current.push(ctx.getImageData(0, 0, W, H));
    const prev = historyRef.current.pop()!;
    ctx.putImageData(prev, 0, 0);
    schedulePreview();
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || redoRef.current.length === 0) return;
    historyRef.current.push(ctx.getImageData(0, 0, W, H));
    const next = redoRef.current.pop()!;
    ctx.putImageData(next, 0, 0);
    schedulePreview();
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if (e.key === "Alt" && !altHeld) {
        e.preventDefault();
        setAltHeld(true);
        prevToolRef.current = tool;
        setTool("eyedropper");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setAltHeld(false);
        setTool(prevToolRef.current);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [undo, redo, tool, altHeld]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const getPaintMode = (activeTool: Tool): "erase" | "paint" => (activeTool === "eraser" ? "erase" : "paint");

  const pickColor = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const pickedAlpha = pixel[3] ?? 0;
    if (pickedAlpha > 0) {
      setColor(rgbToHex(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0));
      setOpacity(Math.round((pickedAlpha / 255) * 100) / 100);
    }
    if (!altHeld) setTool(prevToolRef.current === "eyedropper" ? "brush" : prevToolRef.current);
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getPos(e);

    if (tool === "eyedropper") {
      pickColor(x, y);
      return;
    }

    if (tool === "fill") {
      pushHistory();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const [fr, fg, fb] = hexToRgb(color);
      const fa = Math.round(opacity * 255);
      floodFill(ctx, x, y, fr, fg, fb, fa);
      return;
    }

    pushHistory();
    setIsDrawing(true);
    strokeMaskRef.current = new Uint8Array(W * H);
    lastPointRef.current = { x, y };

    if (tool === "line" || tool === "circle") {
      lineStartRef.current = { x, y };
      return;
    }

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    if (tool === "spray") {
      sprayPaintSegment(ctx, x, y, x, y, brushSize, "paint", hexToRgb(color), opacity, strokeMaskRef.current);
      return;
    }
    paintStrokeSegment(ctx, x, y, x, y, brushSize, getPaintMode(tool), hexToRgb(color), opacity, strokeMaskRef.current);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getPos(e);

    if (tool === "line" || tool === "circle") {
      const oCtx = overlayRef.current?.getContext("2d");
      if (!oCtx || !lineStartRef.current) return;
      oCtx.clearRect(0, 0, W, H);
      oCtx.beginPath();
      oCtx.lineCap = "round";
      // Le trait final est peint avec un diamètre de taille × 2,4 : l'aperçu doit avoir la même épaisseur.
      oCtx.lineWidth = tool === "line" ? Math.max(1, brushSize * 2.4) : brushSize;
      oCtx.strokeStyle = hexToRgba(color, opacity);
      if (tool === "line") {
        oCtx.moveTo(lineStartRef.current.x, lineStartRef.current.y);
        oCtx.lineTo(x, y);
      } else {
        const dx = x - lineStartRef.current.x;
        const dy = y - lineStartRef.current.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        oCtx.arc(lineStartRef.current.x, lineStartRef.current.y, radius, 0, Math.PI * 2);
      }
      oCtx.stroke();
      return;
    }

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPointRef.current) return;
    if (tool === "spray") {
      sprayPaintSegment(ctx, lastPointRef.current.x, lastPointRef.current.y, x, y, brushSize, "paint", hexToRgb(color), opacity, strokeMaskRef.current);
    } else {
      paintStrokeSegment(ctx, lastPointRef.current.x, lastPointRef.current.y, x, y, brushSize, getPaintMode(tool), hexToRgb(color), opacity, strokeMaskRef.current);
    }
    lastPointRef.current = { x, y };
  };

  const stopDraw = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    if ((tool === "line" || tool === "circle") && lineStartRef.current && e) {
      const { x, y } = getPos(e);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        if (tool === "line") {
          paintStrokeSegment(ctx, lineStartRef.current.x, lineStartRef.current.y, x, y, brushSize, "paint", hexToRgb(color), opacity, new Uint8Array(W * H));
        } else {
          ctx.beginPath();
          ctx.lineCap = "round";
          ctx.lineWidth = brushSize;
          ctx.strokeStyle = hexToRgba(color, opacity);
          const dx = x - lineStartRef.current.x;
          const dy = y - lineStartRef.current.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          ctx.arc(lineStartRef.current.x, lineStartRef.current.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const oCtx = overlayRef.current?.getContext("2d");
      if (oCtx) oCtx.clearRect(0, 0, W, H);
      lineStartRef.current = null;
    }

    lastPointRef.current = null;
    strokeMaskRef.current = null;
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!window.confirm("Effacer tout le dessin ? Annulable avec Ctrl+Z.")) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    pushHistory();
    ctx.clearRect(0, 0, W, H);
    schedulePreview();
  };

  const handleExport = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onExport(blob, handAnchorEnabled ? handAnchor : null);
    }, "image/png");
  };

  // ---------- Déplacement du repère de main (glisser-déposer, indépendant du
  // dessin : ne pousse jamais dans l'historique undo/redo) ----------
  const anchorPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingAnchor(true);
  };

  useEffect(() => {
    if (!draggingAnchor) return;
    const move = (e: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      setHandAnchor({ x, y });
    };
    const up = () => setDraggingAnchor(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [draggingAnchor]);

  const toolBtn = (active: boolean) =>
    `flex h-8 w-8 items-center justify-center rounded border ${
      active ? "border-[#4a2408] bg-[#7a4a22] text-[#fff3d6]" : "border-transparent bg-black/10 text-[#3a2210] hover:bg-black/20"
    }`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div
        className="relative w-full overflow-hidden rounded-md border border-[#7a4a22]/70"
        style={{
          // Plus haut que large : on limite la largeur pour que la hauteur reste raisonnable.
          maxWidth: H > W ? Math.round((420 * W) / H) : 420,
          aspectRatio: `${W} / ${H}`,
          backgroundImage: `
            linear-gradient(45deg, #ccc 25%, transparent 25%),
            linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%),
            linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          backgroundColor: "#fff",
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          style={{ touchAction: "none" }}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={(e) => {
            stopDraw(e);
            schedulePreview();
          }}
          onMouseLeave={() => {
            stopDraw();
            schedulePreview();
          }}
          onPointerCancel={(e) => {
            stopDraw(e);
            schedulePreview();
          }}
        />
        <canvas
          ref={overlayRef}
          width={W}
          height={H}
          className="pointer-events-none absolute inset-0 h-full w-full touch-none"
        />
        {handAnchorEnabled && (
          <div
            onPointerDown={anchorPointerDown}
            title={anchorTitle}
            className="absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-dashed border-[#c96a2e] bg-[#c96a2e]/20 active:cursor-grabbing"
            style={{ left: `${handAnchor.x}%`, top: `${handAnchor.y}%` }}
          >
            <Hand className="h-3.5 w-3.5 text-[#7a4a22]" />
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-48">
        <div className="flex flex-wrap gap-1">
          <button type="button" className={toolBtn(tool === "brush")} onClick={() => setTool("brush")} title="Pinceau">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" className={toolBtn(tool === "eraser")} onClick={() => setTool("eraser")} title="Gomme">
            <Eraser className="h-4 w-4" />
          </button>
          <button type="button" className={toolBtn(tool === "line")} onClick={() => setTool("line")} title="Ligne">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" className={toolBtn(tool === "circle")} onClick={() => setTool("circle")} title="Cercle">
            <Circle className="h-4 w-4" />
          </button>
          <button type="button" className={toolBtn(tool === "spray")} onClick={() => setTool("spray")} title="Spray">
            <SprayCan className="h-4 w-4" />
          </button>
          <button type="button" className={toolBtn(tool === "fill")} onClick={() => setTool("fill")} title="Remplissage">
            <PaintBucket className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={toolBtn(tool === "eyedropper")}
            onClick={() => {
              prevToolRef.current = tool === "eyedropper" ? "brush" : tool;
              setTool("eyedropper");
            }}
            title="Pipette (Alt)"
          >
            <Pipette className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" className={toolBtn(false)} onClick={undo} disabled={!canUndo} title="Annuler">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolBtn(false)} onClick={redo} disabled={!canRedo} title="Rétablir">
            <Redo2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolBtn(false)} onClick={clearCanvas} title="Effacer tout">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-[#3a2210]">
          Taille
          <input type="range" min={1} max={W < 300 ? 8 : 24} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="flex-1" />
          <span className="w-4 text-right">{brushSize}</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-[#3a2210]">
          Opacité
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={opacity * 100}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            className="flex-1"
          />
          <span className="w-8 text-right">{Math.round(opacity * 100)}%</span>
        </label>

        <div className="grid grid-cols-6 gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-6 w-6 rounded-sm border-2 ${color === c && tool !== "eraser" ? "border-[#4a2408]" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                setColor(c);
                if (tool === "eraser" || tool === "eyedropper") setTool("brush");
              }}
            />
          ))}
          <label
            className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-sm border-2 border-[#7a4a22]"
            style={{ background: "linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00cc00, #00aaff, #8800ff, #ff00aa)" }}
            title="Couleur personnalisée"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                if (tool === "eraser" || tool === "eyedropper") setTool("brush");
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>

        {noAnchor ? null : anchorOptional ? (
          <label className="flex items-center gap-2 text-xs text-[#3a2210]">
            <input
              type="checkbox"
              checked={handAnchorEnabled}
              onChange={(e) => setHandAnchorEnabled(e.target.checked)}
            />
            {anchorLabel}
          </label>
        ) : (
          <div className="text-xs font-semibold text-[#3a2210]">{anchorLabel}</div>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#7a4a22] py-2 text-sm font-bold text-[#fff3d6] hover:bg-[#8f5a2c] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {exporting ? "Envoi…" : exportLabel}
        </button>
      </div>
    </div>
  );
}
