// Après une mort : anciennes armes (hors prototypes) et anciens compagnons mis de côté (SQL 094).
// Le joueur en choisit UN de chaque pour son nouveau départ ; tout le reste est perdu.
import { scenesClient, ensureUserId } from "./scenes-supabase";
import type { WeaponItem } from "./weapons";
import type { Companion } from "./companions";

export type LegacyHeld = { weapons: WeaponItem[]; companions: Companion[] };

const WCOLS = "id, weapon_id, is_prototype, durability, durability_max, adjust_dx, adjust_dy, adjust_rot, adjust_scale, weapon:weapons(*)";

/** Vide si le SQL 094 n'est pas lancé ou s'il n'y a rien à choisir. */
export async function fetchLegacyHeld(): Promise<LegacyHeld> {
  const empty: LegacyHeld = { weapons: [], companions: [] };
  try {
    const uid = await ensureUserId();
    const [w, c] = await Promise.all([
      scenesClient.from("weapon_items").select(WCOLS).eq("owner_user_id", uid).eq("legacy_hold", true).order("created_at", { ascending: false }),
      scenesClient.from("companions").select("*").eq("owner_user_id", uid).eq("legacy_hold", true).order("created_at", { ascending: false }),
    ]);
    if (w.error || c.error) return empty;
    return {
      weapons: ((w.data ?? []) as any[]).filter((x) => x.weapon) as WeaponItem[],
      companions: (c.data ?? []) as Companion[],
    };
  } catch {
    return empty;
  }
}

export async function chooseLegacy(weaponItemId: string | null, companionId: string | null): Promise<void> {
  const { error } = await scenesClient.rpc("legacy_choose", { p_weapon: weaponItemId, p_companion: companionId });
  if (error) throw new Error(error.message);
}
