// Image cliquable : le curseur « créature » au survol, et un clic l'affiche en grand (taille réelle du dessin).
import { useEffect, useState } from "react";
import { CURSOR_INTERACT } from "../lib/cursors";

export function ZoomImage({ src, alt = "", className, style }: { src: string; alt?: string; className?: string; style?: React.CSSProperties | undefined }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
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
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
          style={{ cursor: CURSOR_INTERACT }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <img src={src} alt={alt} draggable={false} className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain drop-shadow-2xl" style={{ background: "repeating-conic-gradient(#3b2a1a 0% 25%, #33241a 0% 50%) 50% / 20px 20px" }} />
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs font-bold text-[#fff3d6]">Clique n'importe où pour fermer</div>
        </div>
      )}
    </>
  );
}
