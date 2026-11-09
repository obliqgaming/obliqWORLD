// Suivi discret de la quête du jour (à droite, sous les icônes) : avancement, puis « récompense prête ! » qui attire l'œil.
// Se met à jour sans polling : au changement de lieu, au retour sur l'onglet, et quand le tableau des quêtes change quelque chose.
import { useEffect, useState } from "react";
import { abandonQuest, fetchQuests, type MyQuest, type Quest } from "../lib/quests";

const FONT = { fontFamily: "'Baloo 2', cursive", textShadow: "0 1px 3px #000, 0 0 6px rgba(0,0,0,0.85)" };

export function QuestTracker({ sceneId, refreshKey }: { sceneId: string; refreshKey?: number }) {
  const [data, setData] = useState<{ quests: Quest[]; mine: MyQuest | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => { void fetchQuests().then((d) => { if (!cancelled) setData(d); }).catch(() => {}); };
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("obliq-quest-changed", load);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); window.removeEventListener("obliq-quest-changed", load); };
  }, [sceneId, refreshKey]);
  if (!data) return null;
  const todayParis = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const mine = data.mine && !data.mine.claimed ? data.mine : null;
  const doneToday = !!data.mine?.claimed && (data.mine.claimed_day ?? "") >= todayParis;
  if (doneToday) return null;
  const q = mine ? data.quests.find((x) => x.quest_key === mine.quest_key) : null;
  const wrap = "pointer-events-none absolute right-5 top-44 z-30 max-w-[15rem] px-2.5 py-1.5 text-right text-xs";
  if (!mine || !q) {
    if (data.quests.length === 0) return null;
    return <div className={`${wrap} text-[#fff3d6]`} style={FONT}>📜 Un boulot du jour t'attend</div>;
  }
  const ready = mine.progress >= q.goal;
  if (ready) {
    return (
      <div className={`${wrap} animate-pulse text-[#fde68a]`} style={FONT}>
        <div className="font-extrabold">✨ Boulot accompli !</div>
        <div>🎁 Ta récompense t'attend,<br />demande à Morsoif !</div>
      </div>
    );
  }
  const giveUp = () => {
    if (!window.confirm("Abandonner ce boulot ? Ta progression sera perdue.")) return;
    void abandonQuest().catch((e) => window.alert(e?.message ?? "Impossible d'abandonner."));
  };
  return (
    <div className={`${wrap} text-[#fff3d6]`} style={FONT} title={q.description}>
      <div className="flex items-center justify-between gap-2"><span className="truncate font-bold">📜 {q.title}</span><span className="font-extrabold">{mine.progress}/{q.goal}</span></div>
      <button type="button" onClick={giveUp} className="pointer-events-auto mt-0.5 text-[10px] text-[#fca5a5] underline opacity-80 hover:opacity-100" style={FONT}>✕ Abandonner</button>
    </div>
  );
}
