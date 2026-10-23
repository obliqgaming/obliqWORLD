// Porté depuis ObliqWild (src/lib/drawingTools.ts) — moteur de dessin pixel par pixel,
// aucune dépendance au reste d'ObliqWild, copié tel quel.

export type PaintMode = 'paint' | 'erase';

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function markIndex(mask: Uint8Array | null | undefined, width: number, x: number, y: number): boolean {
  if (!mask) return true;
  const idx = y * width + x;
  if (mask[idx]) return false;
  mask[idx] = 1;
  return true;
}

function writePixel(
  data: Uint8ClampedArray,
  offset: number,
  mode: PaintMode,
  color: [number, number, number],
  alphaByte: number,
  baseData?: Uint8ClampedArray | null,
) {
  if (mode === 'erase') {
    data[offset + 3] = 0;
    return;
  }

  if (alphaByte <= 0) return;

  const sourceAlpha = alphaByte / 255;
  const baseR = baseData ? baseData[offset]! : data[offset]!;
  const baseG = baseData ? baseData[offset + 1]! : data[offset + 1]!;
  const baseB = baseData ? baseData[offset + 2]! : data[offset + 2]!;
  const baseA = (baseData ? baseData[offset + 3]! : data[offset + 3]!) / 255;

  const outA = sourceAlpha + baseA * (1 - sourceAlpha);
  if (outA <= 0) {
    data[offset + 3] = 0;
    return;
  }

  data[offset] = clampByte(((color[0] * sourceAlpha) + (baseR * baseA * (1 - sourceAlpha))) / outA);
  data[offset + 1] = clampByte(((color[1] * sourceAlpha) + (baseG * baseA * (1 - sourceAlpha))) / outA);
  data[offset + 2] = clampByte(((color[2] * sourceAlpha) + (baseB * baseA * (1 - sourceAlpha))) / outA);
  data[offset + 3] = clampByte(outA * 255);
}

function getEffectiveDiameter(size: number): number {
  return Math.max(1, size * 2.4);
}

export function stampCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  diameter: number,
  mode: PaintMode,
  color: [number, number, number],
  opacity: number,
  strokeMask?: Uint8Array | null,
  baseData?: Uint8ClampedArray | null,
) {
  const effectiveDiameter = getEffectiveDiameter(diameter);
  const radius = Math.max(0.5, effectiveDiameter / 2);
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxX = Math.min(ctx.canvas.width - 1, Math.ceil(cx + radius + 1));
  const maxY = Math.min(ctx.canvas.height - 1, Math.ceil(cy + radius + 1));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width <= 0 || height <= 0) return;

  const image = ctx.getImageData(minX, minY, width, height);
  const data = image.data;
  const alphaByte = clampByte(opacity * 255);
  const rSq = radius * radius;

  for (let y = 0; y < height; y += 1) {
    const py = minY + y + 0.5;
    const dy = py - cy;
    for (let x = 0; x < width; x += 1) {
      const px = minX + x + 0.5;
      const dx = px - cx;
      if ((dx * dx) + (dy * dy) <= rSq) {
        const globalX = minX + x;
        const globalY = minY + y;
        if (!markIndex(strokeMask, ctx.canvas.width, globalX, globalY)) continue;
        const offset = (y * width + x) * 4;
        writePixel(data, offset, mode, color, alphaByte, baseData);
      }
    }
  }

  ctx.putImageData(image, minX, minY);
}

export function paintStrokeSegment(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  diameter: number,
  mode: PaintMode,
  color: [number, number, number],
  opacity: number,
  strokeMask?: Uint8Array | null,
  baseData?: Uint8ClampedArray | null,
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt((dx * dx) + (dy * dy));
  const effectiveDiameter = getEffectiveDiameter(diameter);
  const step = Math.max(0.5, effectiveDiameter * 0.12);
  const steps = Math.max(1, Math.ceil(distance / step));

  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = fromX + dx * t;
    const y = fromY + dy * t;
    stampCircle(ctx, x, y, diameter, mode, color, opacity, strokeMask, baseData);
  }
}

export function paintCircleOutline(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  diameter: number,
  mode: PaintMode,
  color: [number, number, number],
  opacity: number,
  strokeMask?: Uint8Array | null,
  baseData?: Uint8ClampedArray | null,
) {
  const effectiveDiameter = getEffectiveDiameter(diameter);
  const circumference = Math.max(1, 2 * Math.PI * radius);
  const step = Math.max(0.5, effectiveDiameter * 0.12);
  const steps = Math.max(24, Math.ceil(circumference / step));

  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * Math.PI * 2;
    const x = centerX + Math.cos(theta) * radius;
    const y = centerY + Math.sin(theta) * radius;
    stampCircle(ctx, x, y, diameter, mode, color, opacity, strokeMask, baseData);
  }
}

export function sprayPaintAt(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  diameter: number,
  mode: PaintMode,
  color: [number, number, number],
  opacity: number,
  strokeMask?: Uint8Array | null,
  baseData?: Uint8ClampedArray | null,
) {
  const effectiveDiameter = getEffectiveDiameter(diameter);
  const radius = Math.max(1, effectiveDiameter * 0.8);
  const density = Math.max(8, Math.round(effectiveDiameter * 1.8));
  const alphaByte = clampByte(opacity * 255);
  const minX = Math.max(0, Math.floor(centerX - radius - 2));
  const minY = Math.max(0, Math.floor(centerY - radius - 2));
  const maxX = Math.min(ctx.canvas.width - 1, Math.ceil(centerX + radius + 2));
  const maxY = Math.min(ctx.canvas.height - 1, Math.ceil(centerY + radius + 2));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width <= 0 || height <= 0) return;

  const image = ctx.getImageData(minX, minY, width, height);
  const data = image.data;

  for (let i = 0; i < density; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const px = Math.round(centerX + Math.cos(angle) * r);
    const py = Math.round(centerY + Math.sin(angle) * r);
    if (px < minX || px > maxX || py < minY || py > maxY) continue;
    if (!markIndex(strokeMask, ctx.canvas.width, px, py)) continue;
    const localX = px - minX;
    const localY = py - minY;
    const offset = (localY * width + localX) * 4;
    writePixel(data, offset, mode, color, alphaByte, baseData);
  }

  ctx.putImageData(image, minX, minY);
}

export function sprayPaintSegment(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  diameter: number,
  mode: PaintMode,
  color: [number, number, number],
  opacity: number,
  strokeMask?: Uint8Array | null,
  baseData?: Uint8ClampedArray | null,
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt((dx * dx) + (dy * dy));
  const effectiveDiameter = getEffectiveDiameter(diameter);
  const step = Math.max(3.5, effectiveDiameter * 0.95);
  const steps = Math.max(1, Math.ceil(distance / step));

  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = fromX + dx * t;
    const y = fromY + dy * t;
    sprayPaintAt(ctx, x, y, diameter, mode, color, opacity, strokeMask, baseData);
  }
}
