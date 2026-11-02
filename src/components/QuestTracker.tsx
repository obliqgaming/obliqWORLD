// Suivi discret de la quête du jour (en haut à gauche) : avancement, puis « récompense prête ! » qui attire l'œil.
// Se met à jour sans polling : au changement de lieu, au retour sur l'onglet, et quand le tableau des quêtes change quelque chose.
import { useEffect, useState } from "react";
import { fetchQuests, type MyQuest, type Quest } from "../lib/quests";

const FONT = { fontFamily: "'Baloo 2', cursive" };

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
  const wrap = "pointer-events-none absolute left-5 top-14 z-30 max-w-[15rem] rounded-lg px-2.5 py-1.5 text-xs shadow-lg";
  if (!mine || !q) {
    if (data.quests.length === 0) return null;
    return <div className={`${wrap} bg-black/45 text-[#fff3d6]`} style={FONT}>📜 Une quête du jour t'attend</div>;
  }
  const ready = mine.progress >= q.goal;
  if (ready) {
    return (
      <div className={`${wrap} animate-pulse border-2 border-[#fbbf24] bg-[#78350f]/90 text-[#fef3c7]`} style={FONT}>
        <div className="font-extrabold">✨ Quête accomplie !</div>
        <div>🎁 Ta récompense t'attend au tableau des quêtes.</div>
      </div>
    );
  }
  const pct = Math.max(4, Math.min(100, Math.round((mine.progress / q.goal) * 100)));
  return (
    <div className={`${wrap} bg-black/45 text-[#fff3d6]`} style={FONT} title={q.description}>
      <div className="flex items-center justify-between gap-2"><span className="truncate font-bold">📜 {q.title}</span><span className="font-extrabold">{mine.progress}/{q.goal}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-[#fbbf24]" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
