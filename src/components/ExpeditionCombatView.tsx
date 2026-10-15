// Vue de la scène « expédition » : deux phases (§2 événements à vote, §4 combat
// synchrone du GDD) sur le même décor.
// Disposition voulue par Lils (2026-10-14) : le groupe à GAUCHE, les
// adversaires à DROITE, les membres + leurs PV en BAS À GAUCHE, les actions
// en BAS AU CENTRE. Les jauges de PV reprennent le code couleur d'ObliqWild
// (vert, orange sous 30 %, rouge à 0).
//
// Phase « événement » (reprise du principe de Trust & Greed) : texte de la
// situation, 2-3 choix avec leur niveau de risque qualitatif (jamais de %),
// votes en direct, et « Rentrer maintenant » toujours disponible.
//
// Pour l'instant : mise en page + données réelles (groupe, PV de
// character_build), mais pas encore de moteur — les actions se sélectionnent
// sans rien résoudre, l'ennemi est un mannequin d'entraînement.
import { useEffect, useState } from "react";

export type CombatAlly = {
  characterId: string;
  name: string;
  imageUrl: string;
  hpCurrent: number;
  hpMax: number;
  isSelf: boolean;
};

export type CombatEnemy = {
  id: string;
  name: string;
  imageUrl: string | null;
  hpCurrent: number;
  hpMax: number;
};

export type RiskLevel = "faible" | "moyen" | "eleve";

export type EventChoice = {
  key: string;
  label: string;
  votes: number;
};

export type ExpeditionEvent = {
  /** Catégorie affichée au joueur (Passage, Rencontre, Découverte, Traces…). */
  typeLabel: string;
  /** Risque de l'événement (affiché une seule fois, pas par choix). */
  risk: RiskLevel;
  situation: string;
  choices: EventChoice[];
  /** Nombre de membres vivants qui doivent voter. */
  voterCount: number;
};

const RISK_LABEL: Record<RiskLevel, string> = { faible: "Risque faible", moyen: "Risque moyen", eleve: "Risque élevé" };
const RISK_COLOR: Record<RiskLevel, string> = { faible: "#34d399", moyen: "#fbbf24", eleve: "#f87171" };

export type CombatActionId = "attaque" | "competence" | "defense";

const ACTIONS: { id: CombatActionId; label: string; hint: string }[] = [
  { id: "attaque", label: "Attaque", hint: "Attaque de base de ta famille" },
  { id: "competence", label: "Compétence", hint: "Action spéciale liée à un axe" },
  { id: "defense", label: "Défense", hint: "Se protéger pour ce tour" },
];

// Emplacements au sol (en % du décor), du plus proche du centre au plus
// reculé : jusqu'à 4 membres / 4 ennemis, en quinconce pour ne pas se masquer.
const ALLY_SLOTS = [
  { x: 30, y: 74 },
  { x: 20, y: 64 },
  { x: 33, y: 60 },
  { x: 14, y: 78 },
];
const ENEMY_SLOTS = [
  { x: 70, y: 74 },
  { x: 80, y: 64 },
  { x: 67, y: 60 },
  { x: 86, y: 78 },
];

function hpColor(current: number, max: number): string {
  if (current <= 0) return "#b91c1c";
  if (current <= max * 0.3) return "#f97316";
  return "#10b981";
}

function HpBar({ current, max, className = "" }: { current: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-black/50 ${className}`}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: hpColor(current, max) }}
      />
    </div>
  );
}

// Silhouette provisoire d'un ennemi sans dessin.
function PlaceholderEnemy() {
  return (
    <svg viewBox="0 0 100 120" className="h-full w-auto drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]">
      <ellipse cx="50" cy="112" rx="30" ry="6" fill="rgba(0,0,0,0.35)" />
      <path d="M18 100 C10 60 28 18 50 18 C72 18 90 60 82 100 Z" fill="#3b2a4a" stroke="#1a1024" strokeWidth="3" />
      <circle cx="38" cy="58" r="7" fill="#f5e9b8" />
      <circle cx="62" cy="58" r="7" fill="#f5e9b8" />
      <circle cx="38" cy="59" r="3" fill="#1a1024" />
      <circle cx="62" cy="59" r="3" fill="#1a1024" />
      <path d="M36 82 Q50 92 64 82" fill="none" stroke="#1a1024" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ExpeditionCombatView({
  sceneImageUrl,
  eventNumber,
  phase,
  event,
  myVote,
  onVote,
  allies,
  enemies,
  turn,
  onAction,
  voteDeadlineMs,
  votedCount,
}: {
  sceneImageUrl: string;
  /** Position dans l'expédition (1, 2, 3…). */
  eventNumber: number;
  phase: "event" | "combat";
  event: ExpeditionEvent;
  myVote: string | null;
  onVote?: (choiceKey: string) => void;
  allies: CombatAlly[];
  enemies: CombatEnemy[];
  turn: number;
  /** Absent tant que le moteur de combat n'est pas branché : les boutons restent sélectionnables mais ne valident rien. */
  onAction?: (action: CombatActionId) => void;
  /** Fin du délai de vote (ms epoch) : sert au compte à rebours affiché. */
  voteDeadlineMs?: number | null;
  /** Nombre de joueurs qui ont déjà voté / choisi leur action. */
  votedCount: number;
}) {
  // Compte à rebours purement local (aucun appel serveur).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!voteDeadlineMs) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [voteDeadlineMs]);
  const secondsLeft = voteDeadlineMs ? Math.max(0, Math.ceil((voteDeadlineMs - now) / 1000)) : null;
  const countdownLabel = secondsLeft !== null ? ` · ${secondsLeft} s` : "";

  return (
    // Recouvre les personnages « de marche » de la scène : en combat, tout le
    // monde est placé par cette vue (groupe à gauche, ennemis à droite).
    <div
      className="absolute inset-0 z-20 select-none overflow-hidden"
      style={{ fontFamily: "'Baloo 2', cursive" }}
      onClick={(e) => e.stopPropagation()}
    >
      <img src={sceneImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />

      {/* Tour */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-xs font-bold uppercase tracking-widest text-[#fff3d6]">
        {phase === "combat" ? `Événement ${eventNumber} · Combat · tour ${turn}` : `Événement ${eventNumber}`}
      </div>

      {/* Groupe à gauche */}
      {allies.slice(0, ALLY_SLOTS.length).map((a, i) => {
        const slot = ALLY_SLOTS[i]!;
        const dead = a.hpCurrent <= 0;
        return (
          <div
            key={a.characterId}
            className="absolute"
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, height: "26%", transform: "translate(-50%, -100%)", zIndex: Math.round(slot.y) }}
          >
            <div style={{ transform: "scaleX(-1)", height: "100%" }}>
              <img
                src={a.imageUrl}
                alt={a.name}
                draggable={false}
                className="h-full w-auto object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
                style={{ filter: dead ? "grayscale(1) brightness(0.5)" : undefined }}
              />
            </div>
            <div
              className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-[#fff3d6]"
              style={{ textShadow: "0 1px 3px #000" }}
            >
              {a.name}
            </div>
          </div>
        );
      })}

      {/* Adversaires à droite */}
      {phase === "combat" && enemies.slice(0, ENEMY_SLOTS.length).map((en, i) => {
        const slot = ENEMY_SLOTS[i]!;
        const dead = en.hpCurrent <= 0;
        return (
          <div
            key={en.id}
            className="absolute"
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, height: "26%", transform: "translate(-50%, -100%)", zIndex: Math.round(slot.y) }}
          >
            <div
              className="absolute -top-9 left-1/2 w-28 -translate-x-1/2 text-center text-[11px] font-bold text-[#fff3d6]"
              style={{ textShadow: "0 1px 3px #000" }}
            >
              {en.name}
              <HpBar current={en.hpCurrent} max={en.hpMax} className="mt-0.5" />
            </div>
            <div className="h-full" style={{ filter: dead ? "grayscale(1) brightness(0.5)" : undefined }}>
              {en.imageUrl ? (
                <img src={en.imageUrl} alt={en.name} draggable={false} className="h-full w-auto object-contain" />
              ) : (
                <PlaceholderEnemy />
              )}
            </div>
          </div>
        );
      })}

      {/* Membres du groupe + PV : bas gauche */}
      <div className="absolute bottom-[7.5rem] left-4 z-30 flex w-60 flex-col gap-1.5 rounded-lg border border-[#7a4a22]/60 bg-[#2b1406]/90 p-2.5 text-[#fff3d6]">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Groupe</div>
        {allies.map((a) => (
          <div key={a.characterId} className="flex items-center gap-2 text-xs">
            <img src={a.imageUrl} alt="" className="h-8 w-8 rounded-full bg-black/30 object-cover" />
            <div className="flex-1 overflow-hidden">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-bold">
                  {a.name}
                  {a.isSelf ? " (toi)" : ""}
                </span>
                <span className="shrink-0 text-[11px] font-bold" style={{ color: hpColor(a.hpCurrent, a.hpMax) }}>
                  {a.hpCurrent}/{a.hpMax}
                </span>
              </div>
              <HpBar current={a.hpCurrent} max={a.hpMax} />
            </div>
          </div>
        ))}
      </div>

      {phase === "event" && (
        <>
          {/* Situation : à droite, là où apparaît l'adversaire en combat */}
          <div className="absolute right-[7%] top-[24%] z-30 w-[min(26rem,38%)] rounded-lg border-2 border-[#7a4a22]/70 bg-[#f1dfb6]/95 px-5 py-4 text-sm leading-snug text-[#3a2410] shadow-lg">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#7a4a22]">
              <span>{event.typeLabel}</span>
              <span style={{ color: RISK_COLOR[event.risk] }}>{RISK_LABEL[event.risk]}</span>
            </div>
            <div className="font-semibold">{event.situation}</div>
          </div>

          {/* Choix + votes : bas centre */}
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
            <div className="rounded-full bg-black/60 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#fff3d6]/80">
              {myVote ? `Vote enregistré — ${votedCount}/${event.voterCount} ont voté${countdownLabel}` : `Votez : le groupe décide ensemble${countdownLabel}`}
            </div>
            <div className="flex gap-2 rounded-xl border border-[#7a4a22]/60 bg-[#2b1406]/90 p-2">
              {[...event.choices, { key: "rentrer_maintenant", label: "Rentrer maintenant", votes: 0 }].map(
                (c) => {
                  const active = myVote === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => onVote?.(c.key)}
                      className="flex min-w-32 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-sm font-bold text-[#fff3d6] transition-colors hover:bg-[#7a4a22]/60"
                      style={{
                        borderColor: active ? "#9effa0" : "rgba(122,74,34,0.7)",
                        background: active ? "rgba(158,255,160,0.18)" : "rgba(0,0,0,0.25)",
                      }}
                    >
                      <span>{c.label}</span>
                      <span className="text-[10px] opacity-70">
                        {c.key === "rentrer_maintenant" ? "Retour avec le butin" : `${c.votes}/${event.voterCount} vote${c.votes > 1 ? "s" : ""}`}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </>
      )}

      {phase === "combat" && (
        <>
      <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <div className="rounded-full bg-black/60 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#fff3d6]/80">
          {myVote ? `Action choisie — ${votedCount}/${event.voterCount} prêts${countdownLabel}` : `Choisis ton action${countdownLabel}`}
        </div>
        <div className="flex gap-2 rounded-xl border border-[#7a4a22]/60 bg-[#2b1406]/90 p-2">
          {ACTIONS.map((act) => {
            const active = myVote === act.id;
            return (
              <button
                key={act.id}
                type="button"
                title={act.hint}
                onClick={() => {
                  onAction?.(act.id);
                }}
                className="min-w-24 rounded-lg border px-4 py-2 text-sm font-bold text-[#fff3d6] transition-colors hover:bg-[#7a4a22]/60"
                style={{
                  borderColor: active ? "#9effa0" : "rgba(122,74,34,0.7)",
                  background: active ? "rgba(158,255,160,0.18)" : "rgba(0,0,0,0.25)",
                }}
              >
                {act.label}
              </button>
            );
          })}
        </div>
      </div>

        </>
      )}
    </div>
  );
}
