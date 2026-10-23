// Étape narrative : situation écrite par la communauté + vote.
//  - classique : « En avant ! » / « Retraite ! »
//  - danger imminent : on désigne qui protéger (soi compris) ou on choisit « Se sacrifier »
//  - épreuve : « Voter pour… » (menu des joueurs) ou « Retraite ! »
import { useEffect, useState } from "react";
import type { NarrativeEvent } from "../lib/narrative";

const FONT = { fontFamily: "'Baloo 2', cursive" };
const RISK_LABEL = { faible: "Risque faible", moyen: "Risque moyen", eleve: "Risque élevé" } as const;
const RISK_COLOR = { faible: "#047857", moyen: "#b45309", eleve: "#b91c1c" } as const;
const TYPE_LABEL = { classique: "Rencontre", danger_imminent: "Danger imminent !", epreuve: "Épreuve dangereuse" } as const;

export function NarrativeStepPanel({
  event,
  players,
  myCharacterId,
  myVote,
  votedCount,
  voterCount,
  deadlineMs,
  onVote,
}: {
  event: NarrativeEvent;
  players: { characterId: string; name: string }[];
  myCharacterId: string;
  myVote: string | null;
  votedCount: number;
  voterCount: number;
  deadlineMs: number | null;
  onVote: (choiceKey: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [pick, setPick] = useState<string>(myCharacterId);
  useEffect(() => {
    if (!deadlineMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadlineMs]);
  const left = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : null;
  const t = event.step_type;
  const nameOf = (key: string | null) => {
    if (!key) return null;
    if (key === "en_avant") return "En avant !";
    if (key === "retraite") return "Retraite !";
    if (key === "sacrifice") return "Se sacrifier";
    if (key.startsWith("p:")) return `Voter pour ${players.find((p) => p.characterId === key.slice(2))?.name ?? "?"}`;
    return key;
  };
  const btn = (key: string, label: string, color: string) => (
    <button
      type="button"
      onClick={() => onVote(key)}
      className="rounded-lg border-2 px-4 py-1.5 text-sm font-extrabold text-white shadow"
      style={{ background: color, borderColor: myVote === key ? "#fde047" : "rgba(0,0,0,.35)", outline: myVote === key ? "2px solid #fde047" : "none" }}
    >
      {label}
    </button>
  );
  const voteForPick = `p:${pick}`;
  return (
    <div className="absolute left-1/2 top-[8%] z-30 w-[min(34rem,94%)] -translate-x-1/2 rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6]/97 p-4 text-[#3a2410] shadow-xl" style={FONT}>
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
        <span className="text-[#7a4a22]">{TYPE_LABEL[t]}</span>
        <span style={{ color: RISK_COLOR[event.risk_level] }}>{RISK_LABEL[event.risk_level]}</span>
      </div>
      <div className="whitespace-pre-line text-sm font-semibold leading-snug">{event.situation_text}</div>

      {t === "danger_imminent" && (
        <div className="mt-2 text-xs italic">Qui protéger en priorité ? Se désigner soi-même est permis. Ceux qui se sacrifient se partagent les dégâts.</div>
      )}
      {t === "epreuve" && <div className="mt-2 text-xs italic">Qui doit relever l'épreuve ? Si la retraite l'emporte, le groupe rentre.</div>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {t === "classique" && (
          <>
            {btn("en_avant", "En avant !", "#16a34a")}
            {btn("retraite", "Retraite !", "#b45309")}
          </>
        )}
        {t !== "classique" && (
          <>
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="rounded border-2 border-[#7a4a22] bg-[#fff3d6] px-2 py-1 text-sm font-bold"
            >
              {players.map((p) => (
                <option key={p.characterId} value={p.characterId}>
                  {p.name}
                  {p.characterId === myCharacterId ? " (moi)" : ""}
                </option>
              ))}
            </select>
            {btn(voteForPick, t === "danger_imminent" ? "Protéger" : "Voter pour", "#16a34a")}
            {t === "danger_imminent" && btn("sacrifice", "Se sacrifier", "#7c3aed")}
            {t === "epreuve" && btn("retraite", "Retraite !", "#b45309")}
          </>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-[#5e3818]">
        <span>{myVote ? `Ton vote : ${nameOf(myVote)}` : "Tu n'as pas encore voté"}</span>
        <span>
          {votedCount}/{voterCount} votes{left !== null ? ` · ${left} s` : ""}
        </span>
      </div>
      {t === "classique" && <div className="mt-1 text-[10px] italic text-[#7a4a22]">Un absent à la fin du délai compte comme « Retraite ! ».</div>}
    </div>
  );
}
