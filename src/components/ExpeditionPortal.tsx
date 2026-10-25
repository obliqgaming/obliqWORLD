// Portail d'expédition (§5, revu le 2026-10-14) — halo visuel distinct d'une
// sortie de scène ordinaire (décidé le 2026-10-14 : rien dans le décor ne le
// signale encore, donc un marqueur visible compense en attendant l'art dédié
// de la forêt). Cliquer dessus = se déclarer prêt, pas lancer l'expédition.
import { CURSOR_INTERACT } from "../lib/cursors";
import type { Point } from "../lib/scenes-supabase";

export function ExpeditionPortalMarker({
  position,
  isSelfReady,
  readyCount,
  totalCount,
  label,
  onClick,
}: {
  position: Point;
  isSelfReady: boolean;
  readyCount: number;
  totalCount: number;
  /** Nom affiché sous le portail (ex. « Expédition longue · niv. 5 »). */
  label?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="pointer-events-auto absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${position.x}%`, top: `${position.y}%`, cursor: CURSOR_INTERACT }}
      title={isSelfReady ? "Annuler (ne plus être prêt)" : "Entrer dans le portail — se déclarer prêt"}
    >
      <div
        className="h-16 w-16 rounded-full"
        style={{
          background: isSelfReady
            ? "radial-gradient(circle, rgba(158,255,160,0.55) 0%, rgba(158,255,160,0) 70%)"
            : "radial-gradient(circle, rgba(122,74,34,0.55) 0%, rgba(122,74,34,0) 70%)",
          boxShadow: isSelfReady ? "0 0 18px 6px rgba(158,255,160,0.5)" : "0 0 14px 4px rgba(122,74,34,0.4)",
          animation: "portal-pulse 2.4s ease-in-out infinite",
        }}
      />
      {label && (
        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-[#fde68a]" style={{ fontFamily: "'Baloo 2', cursive" }}>
          {label}
        </span>
      )}
      {totalCount > 1 && (
        <span
          className="rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-[#fff3d6]"
          style={{ fontFamily: "'Baloo 2', cursive" }}
        >
          {readyCount}/{totalCount} prêt·e·s
        </span>
      )}
      <style>{`
        @keyframes portal-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </button>
  );
}
