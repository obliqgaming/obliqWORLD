// Objets consommables (SQL 020) : potions et parchemin. Boire/lire en combat prend le tour.
import { scenesClient, ensureUserId } from "./scenes-supabase";

export type ConsumableKind = "potion_soin" | "potion_mana" | "potion_resistance" | "parchemin_degats";

export const CONSUMABLE_INFO: Record<ConsumableKind, { name: string; icon: string; text: string }> = {
  potion_soin: { name: "Potion de soin", icon: "🧪", text: "Rend 20 % des PV max (toi ou un allié)." },
  potion_mana: { name: "Potion de mana", icon: "💧", text: "Rend 20 % des PM max." },
  potion_resistance: { name: "Potion de résistance", icon: "🛡", text: "Dégâts subis réduits de moitié pendant 2 tours." },
  parchemin_degats: { name: "Parchemin de force", icon: "📜", text: "+1 dégât pendant 3 tours." },
};
export const CONSUMABLE_ORDER: ConsumableKind[] = ["potion_soin", "potion_mana", "potion_resistance", "parchemin_degats"];

export type ConsumableStack = { kind: ConsumableKind; count: number; firstId: string };

export async function fetchMyConsumables(): Promise<ConsumableStack[]> {
  try {
    const uid = await ensureUserId();
    const { data } = await scenesClient.from("consumable_items").select("id, kind").eq("owner_user_id", uid).order("created_at");
    const by = new Map<string, ConsumableStack>();
    for (const r of (data ?? []) as { id: string; kind: ConsumableKind }[]) {
      const s = by.get(r.kind);
      if (s) s.count += 1;
      else by.set(r.kind, { kind: r.kind, count: 1, firstId: r.id });
    }
    return CONSUMABLE_ORDER.filter((k) => by.has(k)).map((k) => by.get(k)!);
  } catch {
    return [];
  }
}

export async function submitCombatItem(combatId: string, characterId: string, itemId: string, targetAllyId: string | null) {
  const { error } = await scenesClient.rpc("combat_submit_item", {
    p_combat_id: combatId,
    p_character_id: characterId,
    p_item_id: itemId,
    p_target_ally_id: targetAllyId,
  });
  if (error) throw error;
}
