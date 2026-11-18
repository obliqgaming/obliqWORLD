// Présentation commune des trois outils de création (Forge, Ferme, Plumobec) : même ligne d'état, même prix dans le titre, mêmes notes.
import type { ReactNode } from "react";
import { Coin } from "./GameIcons";

/** Prix + solde, affichés à droite du titre. Ex. « Forger coûte 6 flouz · tu as 150 🪙 ». */
export function CreationPrice({ verb, cost, gold }: { verb: string; cost: number; gold: number }) {
  return (
    <span className="ml-2 text-sm text-[#92400e]">
      {cost > 0 ? <>{verb} coûte {cost} flouz · tu as {gold} <Coin /></> : <>Tu as {gold} <Coin /></>}
    </span>
  );
}

/** Ligne d'état. Ex. « ⚒ Forge une arme : une par jour · aujourd'hui 0/1 ». */
export function CreationStatus({ icon, action, one, status, className }: {
  icon: string; action: string; one: "un" | "une";
  status: { done: number; per_day: number } | null; className?: string;
}) {
  if (!status) return null;
  const per = status.per_day;
  return (
    <div className={`${className ?? "mb-2"} text-xs font-bold text-[#92400e]`}>
      {icon} {action} : <b>{per === 1 ? `${one} par jour` : `${per} par jour`}</b> · aujourd'hui {Math.min(status.done, per)}/{per}
      {status.done >= per && <span> — Reviens demain !</span>}
    </div>
  );
}

/** Notes sous l'outil : une ligne par élément, mêmes mises en forme partout. */
export function CreationNotes({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`${className ?? "mt-3"} space-y-1 text-xs`}>{children}</div>;
}
