// Lieu « Quêtes » : une quête par jour parmi 5. Une fois acceptée elle reste jusqu'à être accomplie ; la récompense
// est un booster (or, potion, parchemin, arme, compagnon). Progression automatique (SQL 041).
import { uiSound } from "../lib/ui-sounds";
import { Coin, QuestIcon } from "./GameIcons";
import { useEffect, useRef, useState } from "react";
import { acceptQuest, claimQuest, fetchQuests, type BoosterResult, type MyQuest, type Quest } from "../lib/quests";
import { CONSUMABLE_INFO, type ConsumableKind } from "../lib/consumables";
import { RARITY_INFO, type Rarity } from "../lib/weapons";
import { TIER_INFO } from "../lib/companions";
import { RARITY_TIER, RevealModal } from "./RevealModal";

function boosterTier(r: BoosterResult): number {
  if (r.type === "arme") return RARITY_TIER[r.rarity as string] ?? 1;
  if (r.type === "compagnon") return r.tier === "large" ? 4 : r.tier === "medium" ? 3 : 2;
  return r.type === "gold" ? 0 : 1;
}

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

function BoosterView({ r }: { r: BoosterResult }) {
  if (r.type === "gold") return <div className="text-lg font-extrabold"><Coin /> {r.amount} pièces d'or !</div>;
  if (r.type === "potion" || r.type === "parchemin") {
    const info = CONSUMABLE_INFO[r.kind as ConsumableKind];
    return <div className="text-lg font-extrabold">{info?.icon} {info?.name ?? r.kind}</div>;
  }
  if (r.type === "arme") {
    const rar = RARITY_INFO[r.rarity as Rarity];
    return (
      <div className="flex flex-col items-center gap-1">
        <img src={r.image_url} alt="" className="h-16 object-contain" />
        <div className="text-lg font-extrabold" style={{ color: rar?.color === "#f3f4f6" ? "#3a2410" : rar?.color }}>⚔ {r.name}</div>
        <div className="text-xs"><i>{rar?.label ?? r.rarity}</i></div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <img src={r.image_url} alt="" className="h-16 object-contain" />
      <div className="text-lg font-extrabold">🐾 {r.name}</div>
      <div className="text-xs"><i>Nouveau compagnon ({TIER_INFO[r.tier as keyof typeof TIER_INFO]?.label ?? r.tier}) — à la ferme</i></div>
    </div>
  );
}

export function QuestPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<{ quests: Quest[]; mine: MyQuest | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reward, setReward] = useState<BoosterResult | null>(null);
  const [revealing, setRevealing] = useState(false);

  const reload = async () => {
    try {
      setData(await fetchQuests());
    } catch (e: any) {
      setMsg(e?.message?.includes("game_quests") ? "Les quêtes ne sont pas encore activées (SQL 041)." : (e?.message ?? "Erreur"));
      setData({ quests: [], mine: null });
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  const lock = useRef(false);
  async function act(fn: () => Promise<void>) {
    if (lock.current) return;   // anti double-clic
    lock.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      uiSound("ok");
      await reload();
    } catch (e: any) {
      uiSound("error");
      setMsg(e?.message ?? "Erreur");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const mine = data?.mine && !data.mine.claimed ? data.mine : null;
  const current = mine ? data?.quests.find((q) => q.quest_key === mine.quest_key) : null;
  // « Terminée aujourd'hui » seulement si la récompense a été prise AUJOURD'HUI (heure de Paris, comme le serveur) ; sinon on peut en accepter une nouvelle.
  const todayParis = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const doneToday = !!data?.mine?.claimed && (data.mine.claimed_day ?? "") >= todayParis;
  const ready = !!(mine && current && mine.progress >= current.goal);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto parchment-scroll bg-black/55 p-2" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-full w-[min(34rem,98%)] overflow-y-auto parchment-scroll rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold"><QuestIcon /> Quête du jour</div>
          <button type="button" onClick={onClose} className={BTN}>Fermer</button>
        </div>
        <div className="mt-2 space-y-1 text-sm leading-snug">
          <div><QuestIcon /> <b>Une seule quête par jour</b>, à choisir parmi celles-ci.</div>
          <div>📌 Une fois acceptée, <b>elle reste</b> jusqu'à être accomplie.</div>
          <div>🎁 La récompense est un <b>booster</b> <i>(or, potion, parchemin, arme, compagnon…)</i>.</div>
        </div>
        {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
        {data === null && <div className="mt-3 text-sm">Chargement…</div>}

        {reward && revealing && (
          <RevealModal tier={boosterTier(reward)} title="Ton booster contenait…" onClose={() => setRevealing(false)}>
            <BoosterView r={reward} />
          </RevealModal>
        )}
        {reward && !revealing && (
          <div className="mt-3 rounded-lg border-2 border-[#b45309] bg-[#fde7c8] p-3 text-center">
            <div className="text-xs font-bold uppercase tracking-widest">Ton booster contenait</div>
            <div className="mt-1"><BoosterView r={reward} /></div>
          </div>
        )}

        {mine && current && (
          <div className="mt-3 rounded-lg border-2 border-[#7a4a22] bg-[#fff3d6] p-3">
            <div className="text-sm font-extrabold">En cours : {current.title}</div>
            <div className="text-xs"><i>{current.description}</i></div>
            <div className="mt-1 text-sm font-bold">{Math.min(mine.progress, current.goal)} / {current.goal}</div>
            {ready && (
              <button
                type="button"
                disabled={busy}
                className={`${BTN} mt-2`}
                onClick={() => void act(async () => { const r = await claimQuest(); setReward(r); setRevealing(true); })}
              >
                🎁 Ouvrir mon booster
              </button>
            )}
          </div>
        )}

        {!mine && data && (
          <div className="mt-3">
            {doneToday && !reward && <div className="mb-2 text-sm font-bold">✔ Quête du jour terminée. <i>Reviens demain pour une nouvelle !</i></div>}
            {!doneToday && <div className="mb-1 text-xs font-bold uppercase tracking-widest">Choisis ta quête</div>}
            <div className="space-y-2">
              {data.quests.map((q) => (
                <div key={q.quest_key} className="flex items-center justify-between gap-2 rounded-lg border border-[#b98a54] bg-[#f6e8c4] p-2">
                  <div className="text-sm leading-tight">
                    <div className="font-extrabold">{q.title}</div>
                    <div className="text-xs"><i>{q.description}</i></div>
                  </div>
                  <button type="button" disabled={busy || doneToday} className={BTN} onClick={() => void act(() => acceptQuest(q.quest_key))}>
                    Accepter
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
