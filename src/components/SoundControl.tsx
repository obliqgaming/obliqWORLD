import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";

// Petit bouton son + curseur de volume, réutilisé sur l'écran de sélection de
// personnage ET en jeu. Le curseur reste caché par défaut (juste l'icône
// 🔊/🔇) et n'apparaît qu'au clic sur l'icône, pour rester discret — il se
// referme automatiquement dès qu'on clique ailleurs sur la page.
export function SoundControl({
  muted,
  onToggleMute,
  volume,
  onVolumeChange,
  className,
}: {
  muted: boolean;
  onToggleMute: (e: MouseEvent) => void;
  volume: number;
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onClickOutside);
    return () => window.removeEventListener("pointerdown", onClickOutside);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 backdrop-blur-sm ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={(e) => {
          onToggleMute(e);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={muted ? "Activer le son" : "Couper le son"}
        className="flex h-7 w-7 items-center justify-center text-xl text-[#fff3d6]"
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Réglage du volume"
        aria-expanded={open}
        className="flex h-7 w-3 items-center justify-center text-[#fff3d6]/70 hover:text-[#fff3d6]"
      >
        {open ? "‹" : "›"}
      </button>
      {open && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={onVolumeChange}
          aria-label="Volume"
          className="h-1 w-20 cursor-pointer accent-[#fff3d6]"
        />
      )}
    </div>
  );
}
