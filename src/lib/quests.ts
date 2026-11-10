// Quête quotidienne (SQL 041) : une quête par jour, choisie parmi 5 à un lieu « Quêtes ».
import { scenesClient, ensureUserId } from "./scenes-supabase";
import { useEffect, useState } from "react";

export type Quest = { quest_key: string; title: string; description: string; goal: number; sort: number };
export type MyQuest = { quest_key: string; progress: number; claimed: boolean; claimed_day: string | null };
export type BoosterResult = { xp?: number } & (
  | { type: "gold"; amount: number }
  | { type: "potion"; kind: string }
  | { type: "parchemin"; kind: string }
  | { type: "arme"; name: string; rarity: string; image_url: string }
  | { type: "compagnon"; name: string; tier: string; image_url: string });

export async function fetchQuests(): Promise<{ quests: Quest[]; mine: MyQuest | null }> {
  const uid = await ensureUserId();
  const [q, m] = await Promise.all([
    scenesClient.from("game_quests").select("quest_key, title, description, goal, sort").eq("active", true).order("sort"),
    scenesClient.from("player_quests").select("quest_key, progress, claimed, claimed_day").eq("user_id", uid).maybeSingle(),
  ]);
  if (q.error) throw q.error;
  return { quests: (q.data ?? []) as Quest[], mine: (m.data as MyQuest | null) ?? null };
}

export async function acceptQuest(key: string): Promise<void> {
  const { error } = await scenesClient.rpc("quest_accept", { p_key: key });
  if (error) throw error;
}

export async function claimQuest(): Promise<BoosterResult> {
  const { data, error } = await scenesClient.rpc("quest_claim");
  if (error) throw error;
  return data as BoosterResult;
}

export async function abandonQuest(): Promise<void> {
  const { error } = await scenesClient.rpc("quest_abandon");
  if (error) throw new Error(error.message.includes("quest_abandon") ? "Lance d'abord le SQL 087 dans Supabase." : error.message);
  window.dispatchEvent(new Event("obliq-quest-changed"));
}

/** true quand une quête du jour peut être acceptée (aucune en cours, et pas déjà terminée aujourd'hui). */
export function useQuestAvailable(reloadKey: unknown): boolean {
  const [mine, setMine] = useState<{ has: boolean; mine: MyQuest | null } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchQuests()
        .then((d) => !cancelled && setMine({ has: d.quests.length > 0, mine: d.mine }))
        .catch(() => {});
    };
    load();
    window.addEventListener("obliq-quest-changed", load);
    const t = window.setInterval(() => tick((n) => n + 1), 60000); // simple recalcul local du changement de jour
    return () => {
      cancelled = true;
      window.removeEventListener("obliq-quest-changed", load);
      window.clearInterval(t);
    };
  }, [reloadKey]);
  if (!mine || !mine.has) return false;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const m = mine.mine;
  if (m && !m.claimed) return false; // une quête est déjà en cours
  return !(m?.claimed && (m.claimed_day ?? "") >= today);
}

/** true quand la quête en cours est terminée et attend d'être rendue (récompense à réclamer auprès du PNJ). */
export function useQuestReady(reloadKey: unknown): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchQuests()
        .then((d) => {
          if (cancelled) return;
          const q = d.mine && !d.mine.claimed ? d.quests.find((x) => x.quest_key === d.mine!.quest_key) : undefined;
          setReady(!!q && d.mine!.progress >= q.goal);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("obliq-quest-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("obliq-quest-changed", load);
    };
  }, [reloadKey]);
  return ready;
}
