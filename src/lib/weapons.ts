// Forge v1 (SQL 014) : armes dessinées, équipement, affichage sur les personnages.
import { scenesClient, ensureUserId, type Point } from "./scenes-supabase";

export const WEAPON_W = 170;
export const WEAPON_H = 150;
/** Taille du canvas d'un personnage : sert d'échelle pour afficher l'arme à la bonne taille. */
export const CHARACTER_CANVAS = 512;
export const DEFAULT_HAND: Point = { x: (2 / 3) * 100, y: (2 / 3) * 100 };

export type WeaponType = "magic" | "blunt_slash";
export const WEAPON_TYPES: { key: WeaponType; label: string }[] = [
  { key: "magic", label: "Arme magique (bâton, baguette…)" },
  { key: "blunt_slash", label: "Arme contondante / tranchante (épée, masse…)" },
];

export type Weapon = {
  id: string;
  author_user_id: string;
  name: string;
  weapon_type: WeaponType;
  image_url: string;
  grip_anchor: Point;
  width: number;
  height: number;
  hidden: boolean;
  created_at: string;
};

/** Ce qu'il faut pour dessiner une arme tenue par un personnage. */
export type WornWeapon = {
  imageUrl: string;
  grip: Point;
  width: number;
  height: number;
  hand: Point;
};

export async function fetchMyWeapons(): Promise<Weapon[]> {
  const uid = await ensureUserId();
  const { data, error } = await scenesClient
    .from("weapons")
    .select("*")
    .eq("author_user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Weapon[];
}

export async function createWeapon(blob: Blob, name: string, type: WeaponType, grip: Point): Promise<Weapon> {
  const userId = await ensureUserId();
  const fileName = `weapon_${userId}_${Date.now()}.png`;
  const { error: upErr } = await scenesClient.storage.from("drawings").upload(fileName, blob, { contentType: "image/png", upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = scenesClient.storage.from("drawings").getPublicUrl(fileName);
  const { data, error } = await scenesClient.rpc("weapon_create", {
    p_name: name,
    p_type: type,
    p_image_url: pub.publicUrl,
    p_grip: grip,
    p_width: WEAPON_W,
    p_height: WEAPON_H,
  });
  if (error) throw error;
  return data as Weapon;
}

export async function equipWeapon(characterId: string, weaponId: string | null): Promise<void> {
  const { error } = await scenesClient.rpc("weapon_equip", { p_character_id: characterId, p_weapon_id: weaponId });
  if (error) throw error;
}

export async function deleteMyWeapon(weaponId: string): Promise<void> {
  const { error } = await scenesClient.rpc("weapon_delete_mine", { p_weapon_id: weaponId });
  if (error) throw error;
}

export async function fetchHandAnchor(visualAssetId: string): Promise<Point | null> {
  const { data } = await scenesClient.from("visual_assets").select("hand_anchor").eq("id", visualAssetId).maybeSingle();
  return ((data as { hand_anchor: Point | null } | null)?.hand_anchor) ?? null;
}

/** Armes portées par une liste de personnages (id personnage → arme). Ceux sans arme sont absents. */
export async function fetchWornWeapons(characterIds: string[]): Promise<Record<string, WornWeapon>> {
  const out: Record<string, WornWeapon> = {};
  if (characterIds.length === 0) return out;
  const { data, error } = await scenesClient
    .from("character_build")
    .select("character_id, weapons:equipped_weapon_id(image_url, grip_anchor, width, height, hidden), characters(visual_assets(hand_anchor))")
    .in("character_id", characterIds)
    .not("equipped_weapon_id", "is", null);
  if (error) return out;
  for (const r of (data ?? []) as any[]) {
    const w = r.weapons;
    if (!w || w.hidden) continue;
    out[r.character_id] = {
      imageUrl: w.image_url,
      grip: w.grip_anchor,
      width: w.width,
      height: w.height,
      hand: r.characters?.visual_assets?.hand_anchor ?? DEFAULT_HAND,
    };
  }
  return out;
}

/** Arme au hasard mais stable pour un monstre (même résultat chez tous les joueurs). */
export async function fetchRandomWeaponPool(): Promise<Omit<WornWeapon, "hand">[]> {
  const { data, error } = await scenesClient
    .from("weapons")
    .select("image_url, grip_anchor, width, height")
    .eq("hidden", false)
    .order("id")
    .limit(60);
  if (error) return [];
  return (data ?? []).map((w: any) => ({ imageUrl: w.image_url, grip: w.grip_anchor, width: w.width, height: w.height }));
}

export function pickByHash<T>(pool: T[], key: string): T | null {
  if (pool.length === 0) return null;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return pool[h % pool.length]!;
}

// ---------- Admin ----------
export async function adminFetchAllWeapons(): Promise<Weapon[]> {
  const { data, error } = await scenesClient.from("weapons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Weapon[];
}
export async function adminSetWeaponHidden(id: string, hidden: boolean) {
  const { error } = await scenesClient.rpc("admin_set_weapon_hidden", { p_weapon_id: id, p_hidden: hidden });
  if (error) throw error;
}
export async function adminDeleteWeapon(id: string) {
  const { error } = await scenesClient.rpc("admin_delete_weapon", { p_weapon_id: id });
  if (error) throw error;
}
