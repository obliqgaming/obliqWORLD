// Panneau de groupe permanent (§5, revu le 2026-10-14) — nom + jauge de PV
// par membre, à la WoW/Trust & Greed. N'affiche rien si le joueur n'a pas de
// groupe actif (pas de case vide à encombrer l'écran en solo).
import type { PartyMember } from "../lib/scenes-supabase";

export function PartyPanel({
  members,
  myCharacterId,
  isLeader,
  onLeave,
  onKick,
}: {
  members: PartyMember[];
  myCharacterId: string;
  isLeader: boolean;
  onLeave: () => void;
  onKick: (characterId: string) => void;
}) {
  // Les invitations en attente (pas encore acceptées) s'affichent grisées,
  // pour que le groupe voie qui il attend — cohérent avec le portail qui
  // "attend tout le groupe" (§5).
  const joined = members.filter((m) => m.status === "joined");
  const invited = members.filter((m) => m.status === "invited");
  if (joined.length === 0 && invited.length === 0) return null;

  return (
    <div className="absolute left-5 top-20 z-30 flex w-48 flex-col gap-1 rounded-lg bg-black/55 p-2 text-[#fff3d6]" style={{ fontFamily: "'Baloo 2', cursive" }}>
      {joined.map((m) => {
        const pvRatio = m.pv_max && m.pv_max > 0 ? Math.max(0, Math.min(1, (m.pv_current ?? 0) / m.pv_max)) : 1;
        return (
          <div key={m.character_id} className="flex items-center gap-2 text-xs">
            <img src={m.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            <div className="flex-1 overflow-hidden">
              <div className="truncate font-bold">{m.name}{m.character_id === myCharacterId ? " (toi)" : ""}</div>
              {m.pv_max != null && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-[#9effa0] transition-[width]"
                    style={{ width: `${pvRatio * 100}%` }}
                  />
                </div>
              )}
            </div>
            {isLeader && m.character_id !== myCharacterId && (
              <button
                type="button"
                onClick={() => onKick(m.character_id)}
                title="Exclure du groupe"
                className="text-[10px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {invited.map((m) => (
        <div key={m.character_id} className="flex items-center gap-2 text-xs opacity-50">
          <img src={m.image_url} alt="" className="h-6 w-6 rounded-full object-cover grayscale" />
          <div className="flex-1 truncate italic">{m.name} (invité·e…)</div>
        </div>
      ))}

      <button
        type="button"
        onClick={onLeave}
        className="mt-1 self-start text-[10px] uppercase tracking-wide opacity-60 hover:opacity-100"
      >
        Quitter le groupe
      </button>
    </div>
  );
}
