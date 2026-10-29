// Quête quotidienne (SQL 041) : une quête par jour, choisie parmi 5 à un lieu « Quêtes ».
import { scenesClient, ensureUserId } from "./scenes-supabase";

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
