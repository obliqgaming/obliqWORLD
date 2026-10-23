// Butin d'expédition (SQL 017) : or partagé + objets joués aux dés.
import { scenesClient, ensureUserId } from "./scenes-supabase";

export type LootRoll = { loot_id: string; character_id: string; wants: boolean | null; roll: number | null };
export type LootItem = {
  id: string;
  combat_id: string | null;
  kind: string;
  weapon_id: string | null;
  item_key: string | null;
  status: "rolling" | "assigned" | "delivered" | "lost";
  roll_deadline: string;
  winner_character_id: string | null;
};
export type LootWeapon = { id: string; name: string; image_url: string; rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"; weapon_type: string; bonus_damage: number; effect_key: string | null };

export async function fetchLoot(expeditionId: string, combatId: string) {
  const [i, r] = await Promise.all([
    scenesClient.from("loot_items").select("id, combat_id, kind, weapon_id, item_key, status, roll_deadline, winner_character_id").eq("expedition_id", expeditionId).eq("combat_id", combatId),
    scenesClient.from("loot_rolls").select("loot_id, character_id, wants, roll").eq("expedition_id", expeditionId),
  ]);
  const items = (i.data ?? []) as LootItem[];
  const ids = items.map((x) => x.weapon_id).filter(Boolean) as string[];
  let weapons: LootWeapon[] = [];
  if (ids.length) {
    const w = await scenesClient.from("weapons").select("id, name, image_url, rarity, weapon_type, bonus_damage, effect_key").in("id", ids);
    weapons = (w.data ?? []) as LootWeapon[];
  }
  return { items, rolls: (r.data ?? []) as LootRoll[], weapons };
}

export async function lootRespond(lootId: string, characterId: string, wants: boolean) {
  const { error } = await scenesClient.rpc("loot_respond", { p_loot_id: lootId, p_character_id: characterId, p_wants: wants });
  if (error) throw error;
}

export async function lootResolve(expeditionId: string): Promise<number> {
  const { data, error } = await scenesClient.rpc("loot_resolve", { p_expedition_id: expeditionId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchMyGold(): Promise<number> {
  try {
    const uid = await ensureUserId();
    const { data } = await scenesClient.from("player_wallets").select("gold").eq("user_id", uid).maybeSingle();
    return Number((data as any)?.gold ?? 0);
  } catch {
    return 0;
  }
}

export function subscribeToLoot(expeditionId: string, onChange: () => void) {
  return scenesClient
    .channel(`loot:${expeditionId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "loot_items", filter: `expedition_id=eq.${expeditionId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "loot_rolls", filter: `expedition_id=eq.${expeditionId}` }, () => onChange())
    .subscribe();
}

export async function fetchForgeCost(): Promise<number> {
  const { data } = await scenesClient.from("game_settings").select("value").eq("key", "forge_cost").maybeSingle();
  return Number((data as any)?.value ?? 0);
}

export async function repairItem(itemId: string): Promise<number> {
  const { data, error } = await scenesClient.rpc("weapon_repair", { p_item_id: itemId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchRepairCosts(): Promise<Record<string, number>> {
  const { data } = await scenesClient.from("game_settings").select("key, value").like("key", "repair_cost_%");
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { key: string; value: number }[]) out[r.key.replace("repair_cost_", "")] = Number(r.value);
  return out;
}
