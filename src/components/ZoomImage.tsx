// Image cliquable : curseur « créature » au survol ; un clic ouvre une petite fiche parchemin
// (image + détails). Un clic n'importe où la ferme. `scale` = fraction de la taille réelle du dessin.
import { isValidElement, useEffect, useState, type ReactNode } from "react";
import { RARITY_INFO } from "../lib/weapons";
import { CURSOR_INTERACT } from "../lib/cursors";

export function ZoomImage({ src, alt = "", className, style, details, scale = 1 }: {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties | undefined;
  details?: ReactNode;
  scale?: number;
}) {
  const [open, setOpen] = useState(false);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  // Contour de la fiche selon la rareté (lue sur la fiche passée en `details`).
  const dp = isValidElement(details) ? (details.props as { rarity?: keyof typeof RARITY_INFO | null; prototype?: boolean }) : null;
  const rc = dp?.rarity && !dp.prototype ? RARITY_INFO[dp.rarity]?.color : undefined;
  const size = nat ? { width: Math.round(nat.w * scale), height: Math.round(nat.h * scale) } : {};
  return (
    <>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={className}
        style={{ ...style, cursor: CURSOR_INTERACT }}
        title="Voir en grand"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      />
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4"
          style={{ cursor: CURSOR_INTERACT }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div className="flex max-h-[92vh] max-w-[94vw] flex-col items-center gap-3 overflow-auto rounded-xl border-4 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-2xl" style={{ fontFamily: "'Baloo 2', cursive", minWidth: "min(18rem, 90vw)", ...(rc ? { borderColor: rc, boxShadow: `0 0 18px ${rc}99, 0 10px 30px #0008` } : {}) }}>
            <div className="flex items-center justify-center rounded-lg bg-white/40 p-2">
              <img
                src={src}
                alt={alt}
                draggable={false}
                onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className="object-contain"
                style={{ ...size, maxWidth: "min(80vw, 100%)", maxHeight: "55vh" }}
              />
            </div>
            {details && <div className="w-full">{details}</div>}
            <div className="text-[11px] font-bold opacity-60">Clique n'importe où pour fermer</div>
          </div>
        </div>
      )}
    </>
  );
}
