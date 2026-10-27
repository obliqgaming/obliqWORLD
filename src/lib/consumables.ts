// Objets consommables (SQL 020) : potions et parchemin. Boire/lire en combat prend le tour.
import { scenesClient, ensureUserId } from "./scenes-supabase";

export type ConsumableKind = "potion_soin" | "potion_mana" | "potion_resistance" | "parchemin_degats" | "ration" | "festin" | "larme_vie";

export const CONSUMABLE_INFO: Record<ConsumableKind, { name: string; icon: string; text: string }> = {
  potion_soin: { name: "Potion de soin", icon: "🧪", text: "Rend 20 % des PV max (toi ou un allié)." },
  potion_mana: { name: "Potion de mana", icon: "💧", text: "Rend 20 % des PM max." },
  potion_resistance: { name: "Potion de résistance", icon: "🛡", text: "Dégâts subis réduits de moitié pendant 2 tours." },
  parchemin_degats: { name: "Parchemin de force", icon: "📜", text: "+1 dégât pendant 3 tours." },
  ration: { name: "Ration", icon: "🍖", text: "Au feu de camp : rend 50 % des PV et PM max. Une seule par personne." },
  festin: { name: "Festin", icon: "🍲", text: "Au feu de camp : rend 80 % des PV et PM max à TOUT le groupe. Un seul par camp." },
  larme_vie: { name: "Larme de vie", icon: "💧", text: "Au feu de camp : ressuscite un allié tombé dans cette expédition (50 % de ses PV)." },
};
/** Ce qui peut être utilisé PENDANT un combat (le reste ne sert qu'au feu de camp). */
export const COMBAT_USABLE: ConsumableKind[] = ["potion_soin", "potion_mana", "potion_resistance", "parchemin_degats"];
/** Ce que vend le marchand (la larme de vie ne s'achète ni ne se vend). */
export const MERCHANT_KINDS: ConsumableKind[] = ["potion_soin", "potion_mana", "potion_resistance", "parchemin_degats", "ration", "festin"];
export const CONSUMABLE_ORDER: ConsumableKind[] = ["potion_soin", "potion_mana", "potion_resistance", "parchemin_degats", "ration", "festin", "larme_vie"];

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

// Feu de camp (SQL 049).
export async function campUse(expeditionId: string, characterId: string, kind: ConsumableKind, targetCharacterId: string | null) {
  const { error } = await scenesClient.rpc("camp_use", {
    p_expedition_id: expeditionId,
    p_character_id: characterId,
    p_kind: kind,
    p_target_character_id: targetCharacterId,
  });
  if (error) throw error;
}

export type CampUse = { kind: "ration" | "festin"; character_id: string | null };

export async function fetchCampUses(expeditionId: string): Promise<CampUse[]> {
  const { data } = await scenesClient.from("camp_uses").select("kind, character_id").eq("expedition_id", expeditionId);
  return (data ?? []) as CampUse[];
}

export function subscribeToCampUses(expeditionId: string, onChange: () => void) {
  return scenesClient
    .channel(`camp:${expeditionId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "camp_uses", filter: `expedition_id=eq.${expeditionId}` }, () => onChange())
    .subscribe();
}
