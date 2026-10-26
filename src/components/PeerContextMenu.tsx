// Menu contextuel affiché au clic sur un autre personnage (§5, revu le
// 2026-10-14) — pour l'instant une seule action : inviter dans son groupe.
// Positionné aux coordonnées écran du clic, se ferme sur tout clic ailleurs.
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function PeerContextMenu({
  peerName,
  x,
  y,
  onInvite,
  onInspect,
  onClose,
}: {
  peerName: string;
  x: number;
  y: number;
  onInvite: () => void;
  onInspect?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // x/y sont des coordonnées écran (clientX/Y). Le menu est positionné dans son
  // parent (le canvas) : on convertit, puis on le recale pour qu'il ne dépasse
  // jamais du canvas (personnage ttout à droite ou tout en bas).
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const pr = parent.getBoundingClientRect();
    const margin = 6;
    const left = Math.max(margin, Math.min(x - pr.left, pr.width - el.offsetWidth - margin));
    const top = Math.max(margin, Math.min(y - pr.top, pr.height - el.offsetHeight - margin));
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Délai d'une frame pour ne pas fermer immédiatement sur le clic qui a
    // ouvert ce menu lui-même (sinon le clic initial se propage et referme
    // avant que le menu soit rendu).
    const t = window.setTimeout(() => window.addEventListener("pointerdown", handleClick), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", handleClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 rounded-md border border-[#7a4a22]/70 bg-[#2b1406]/95 py-1 text-sm text-[#fff3d6]"
      style={{ left: pos?.left ?? x, top: pos?.top ?? y, visibility: pos ? "visible" : "hidden", fontFamily: "'Baloo 2', cursive" }}
    >
      <div className="border-b border-[#7a4a22]/50 px-3 py-1 text-xs font-bold opacity-70">{peerName}</div>
      <button
        type="button"
        onClick={() => {
          onInvite();
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left hover:bg-[#7a4a22]/40"
      >
        Inviter dans le groupe
      </button>
      {onInspect && (
        <button
          type="button"
          onClick={() => {
            onInspect();
            onClose();
          }}
          className="block w-full px-3 py-1.5 text-left hover:bg-[#7a4a22]/40"
        >
          🔍 Inspecter
        </button>
      )}
    </div>
  );
}
