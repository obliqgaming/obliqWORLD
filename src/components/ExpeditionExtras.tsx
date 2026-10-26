// Petits panneaux autour de l'expédition : résultat d'un événement, bandeau de
// fin d'expédition, choix de l'axe au niveau 3.
import type { GameAxis, GamePower } from "../lib/expedition-combat";
import { useEffect } from "react";
import { uiSound } from "../lib/ui-sounds";
import { LootPanel } from "./LootPanel";

const PANEL_FONT = { fontFamily: "'Baloo 2', cursive" };

export type OutcomeInfo = {
  stepIndex: number;
  text: string;
  pvLossPct: number;
  reward: string | null;
  triggersCombat: boolean;
  xp: number;
  /** Étape narrative (rencontre écrite) : réussite/échec, dégâts nommés, potion en jeu. */
  narrative?: {
    stepId: string;
    success: boolean;
    hits: { name: string; lost: number }[];
    potion: boolean;
  } | undefined;
};

export function OutcomePanel({
  outcome,
  myPvMax,
  onClose,
  loot,
}: {
  outcome: OutcomeInfo;
  myPvMax: number | null;
  onClose: () => void;
  loot?: { expeditionId: string; characterId: string; names: Record<string, string> } | undefined;
}) {
  // Points réels pour CE joueur (même arrondi que le serveur, au moins 1 point).
  const pts = myPvMax && outcome.pvLossPct !== 0 ? Math.max(1, Math.round((myPvMax * Math.abs(outcome.pvLossPct)) / 100)) : 0;
  const pv =
    outcome.pvLossPct > 0
      ? { label: pts ? `Tu perds ${pts} PV` : "Le groupe perd des PV", color: "#b91c1c" }
      : outcome.pvLossPct < 0
        ? { label: pts ? `Tu récupères ${pts} PV` : "Le groupe récupère des PV", color: "#047857" }
        : { label: "Aucune perte de PV", color: "#5e3818" };
  const nar = outcome.narrative;
  // Petit son de réussite ou d'échec à l'apparition du résultat d'une rencontre.
  useEffect(() => {
    if (nar) uiSound(nar.success ? "success" : "fail");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome.stepIndex]);
  return (
    <div className="absolute left-1/2 top-[14%] z-40 w-[min(30rem,92%)] -translate-x-1/2 rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6]/97 p-4 text-[#3a2410] shadow-xl" style={PANEL_FONT}>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#7a4a22]">
        {nar ? (nar.success ? "Réussite !" : "Échec…") : "Résultat du vote"}
      </div>
      <div className="text-sm font-semibold leading-snug">{outcome.text}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
        {nar ? (
          nar.hits.length > 0 ? (
            nar.hits.map((h) => (
              <span key={h.name} style={{ color: "#b91c1c" }}>{h.name} perd {h.lost} PV</span>
            ))
          ) : (
            <span style={{ color: "#5e3818" }}>Aucune perte de PV</span>
          )
        ) : (
          <span style={{ color: pv.color }}>{pv.label}</span>
        )}
        {outcome.reward ? <span className="text-[#92400e]">Trouvé : {outcome.reward}</span> : null}
        {outcome.xp > 0 ? <span className="text-[#1d4ed8]">+{outcome.xp} XP</span> : null}
        {outcome.triggersCombat ? <span className="text-[#b91c1c]">⚔ Un combat éclate !</span> : null}
      </div>
      {nar?.potion && loot && (
        <LootPanel expeditionId={loot.expeditionId} stepId={nar.stepId} characterId={loot.characterId} names={loot.names} gold={0} onSettled={() => {}} />
      )}
      <button type="button" onClick={onClose} className="mt-2 rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold text-[#5e3818] hover:bg-[#7a4a22]/15">
        OK
      </button>
    </div>
  );
}

export function EndBanner({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50" style={PANEL_FONT}>
      <div className="w-[min(26rem,90%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-center text-[#3a2410] shadow-xl">
        <div className="text-xl font-extrabold">{title}</div>
        <div className="mt-1 text-sm">{text}</div>
        <button type="button" onClick={onClose} className="mt-3 rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-5 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818]">
          OK
        </button>
      </div>
    </div>
  );
}

export function AxisChoiceModal({
  axes,
  powers,
  busy,
  error,
  onChoose,
}: {
  /** Axes proposés à ce joueur (sa famille, sans les « apprentis »). */
  axes: GameAxis[];
  powers: GamePower[];
  busy: boolean;
  error: string | null;
  onChoose: (axisKey: string) => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3" style={PANEL_FONT}>
      <div className="max-h-full w-[min(44rem,96%)] overflow-y-auto parchment-scroll rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-[#3a2410] shadow-xl">
        <div className="text-center text-xl font-extrabold">Tu as atteint le niveau 3 : choisis ton axe</div>
        <div className="mt-1 text-center text-xs">Ce choix est définitif. Il détermine tes stats et tes pouvoirs.</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {axes.map((a) => {
            const ps = powers.filter((p) => p.kind === "axis" && p.axis_key === a.axis_key && p.unlock_level <= 3);
            return (
              <div key={a.axis_key} className="flex flex-col rounded-lg border border-[#7a4a22]/60 bg-white/40 p-3">
                <div className="text-lg font-extrabold">{a.name}</div>
                <div className="text-[11px] font-bold opacity-80">
                  PV {a.pv} · PM {a.pm} · Force {a.force} · Défense {a.defense} · Vitesse {a.speed}
                </div>
                <div className="mt-1 text-xs">Attaque de base : <b>{a.base_attack_name}</b></div>
                {ps.map((p) => (
                  <div key={p.power_key} className="mt-1 text-xs">
                    <b>{p.name}</b> — {p.description}
                  </div>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onChoose(a.axis_key)}
                  className="mt-3 rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50"
                >
                  Devenir {a.name}
                </button>
              </div>
            );
          })}
        </div>
        {error && <div className="mt-2 text-center text-xs font-bold text-[#b91c1c]">{error}</div>}
      </div>
    </div>
  );
}
