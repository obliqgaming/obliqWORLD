// Forge v1 (SQL 014) : armes dessinées, équipement, affichage sur les personnages.
import { scenesClient, ensureUserId, type Point } from "./scenes-supabase";

export const WEAPON_W = 200;
export const WEAPON_H = 320;
/** Taille du canvas d'un personnage : sert d'échelle pour afficher l'arme à la bonne taille. */
export const CHARACTER_CANVAS = 512;
export const DEFAULT_HAND: Point = { x: (2 / 3) * 100, y: (2 / 3) * 100 };

export type WeaponType = "magic" | "blunt_slash";
export const WEAPON_TYPES: { key: WeaponType; label: string }[] = [
  { key: "magic", label: "Arme magique (bâton, baguette…)" },
  { key: "blunt_slash", label: "Arme de mêlée (épée, masse, hache…)" },
];

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const RARITY_INFO: Record<Rarity, { label: string; color: string; chance: string }> = {
  common: { label: "Commune", color: "#4ade80", chance: "72 %" },
  uncommon: { label: "Inhabituelle", color: "#2dd4bf", chance: "—" },
  rare: { label: "Rare", color: "#60a5fa", chance: "22 %" },
  epic: { label: "Épique", color: "#c084fc", chance: "6 %" },
  legendary: { label: "Légendaire", color: "#f87171", chance: "à venir" },
};
export const EFFECT_INFO: Record<string, { name: string; text: string }> = {
  // Inhabituelle
  entrainant: { name: "Entraînant", text: "+1 jus récupéré à chaque attaque de base" },
  vif: { name: "Vif", text: "+2 Vitesse" },
  robuste: { name: "Robuste", text: "+1 Défense" },
  // Rare
  saignement: { name: "Saignement", text: "l'attaque de base empoisonne la cible (1 dégât par tour, 2 tours)" },
  siphon: { name: "Siphon", text: "+1 peps à chaque attaque de base" },
  concentre: { name: "Concentré", text: "tes pouvoirs coûtent 1 jus de moins" },
  perforant: { name: "Perforant", text: "ignore 5 points de Défense de la cible" },
  // Épique
  frappe_lourde: { name: "Frappe lourde", text: "25 % de chance de doubler les dégâts" },
  eclat: { name: "Éclat", text: "+50 % de dégâts sur une cible sous la moitié de ses peps" },
  garde: { name: "Garde", text: "−1 dégât sur les coups de 3 dégâts ou plus que tu reçois" },
  frenesie: { name: "Frénésie", text: "−1 tour de recharge sur ton pouvoir le plus long" },
  // Légendaire
  second_coup: { name: "Second coup", text: "20 % de chance de frapper deux fois" },
  execution: { name: "Exécution", text: "dégâts doublés sur une cible sous 25 % de peps" },
  vol_de_vie: { name: "Vol de vie", text: "tu soignes la moitié des dégâts infligés" },
  echo: { name: "Écho", text: "ton premier pouvoir de chaque combat ne coûte rien et n'a pas de recharge" },
};

export function bonusText(n: number): string {
  return n <= 0 ? "pas de bonus de dégâts" : `+${n} dégât${n > 1 ? "s" : ""}`;
}

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
  no_display?: boolean;
  created_at: string;
  rarity: Rarity;
  bonus_damage: number;
  effect_key: string | null;
};

/** Exemplaire que le joueur porte dans son inventaire. */
export type WeaponItem = {
  id: string;
  weapon_id: string;
  is_prototype: boolean;
  durability: number;
  durability_max: number;
  adjust_dx: number;
  adjust_dy: number;
  adjust_rot: number;
  adjust_scale: number;
  weapon: Weapon;
};

/** Ce qu'il faut pour dessiner une arme tenue par un personnage. */
export type WornWeapon = {
  /** Réglage personnel : décalage en % de l'image du personnage + rotation en degrés. */
  dx?: number;
  dy?: number;
  rot?: number;
  scale?: number; // 80 à 120 (%)
  imageUrl: string;
  grip: Point;
  width: number;
  height: number;
  hand: Point;
};

/** Une arme de mêlée se porte en Mêlée, une arme magique en Magie. */
export function weaponFits(type: WeaponType, family: "melee" | "magie" | null | undefined): boolean {
  if (!family) return true;
  return type === "magic" ? family === "magie" : family === "melee";
}

/** Un prototype est toujours commun (+1 dégât, pas d'effet) : l'effet du modèle se gagne en butin. */
export function itemStats(it: WeaponItem): { rarity: Rarity; bonus: number; effect: string | null } {
  return it.is_prototype
    ? { rarity: "common", bonus: 1, effect: null }
    : { rarity: it.weapon.rarity, bonus: it.weapon.bonus_damage, effect: it.weapon.effect_key };
}

export function itemDisplayName(it: WeaponItem): string {
  return it.weapon.name;
}

const ITEM_COLS = "id, weapon_id, is_prototype, durability, durability_max, adjust_dx, adjust_dy, adjust_rot, adjust_scale, weapon:weapons(*)";

/** Armes du sac (les prototypes rangés à la forge n'y sont pas : SQL 092). */
export async function fetchMyItems(): Promise<WeaponItem[]> {
  const uid = await ensureUserId();
  let r = await scenesClient.from("weapon_items").select(ITEM_COLS).eq("owner_user_id", uid).eq("stored", false).eq("legacy_hold", false).order("created_at", { ascending: false });
  if (r.error) r = await scenesClient.from("weapon_items").select(ITEM_COLS).eq("owner_user_id", uid).eq("stored", false).order("created_at", { ascending: false });
  if (r.error) {
    // colonne « stored » pas encore créée (SQL 092 non lancé) : on lit tout comme avant
    r = await scenesClient.from("weapon_items").select(ITEM_COLS).eq("owner_user_id", uid).order("created_at", { ascending: false });
  }
  if (r.error) throw r.error;
  return ((r.data ?? []) as any[]).filter((x) => x.weapon) as WeaponItem[];
}

/** Prototypes rangés à la forge. */
export async function fetchStoredPrototypes(): Promise<WeaponItem[]> {
  const uid = await ensureUserId();
  const { data, error } = await scenesClient.from("weapon_items").select(ITEM_COLS).eq("owner_user_id", uid).eq("stored", true).order("created_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as any[]).filter((x) => x.weapon) as WeaponItem[];
}

export async function storePrototype(itemId: string, stored: boolean): Promise<void> {
  const { error } = await scenesClient.rpc("prototype_store", { p_item: itemId, p_stored: stored });
  if (error) throw new Error(error.message.includes("prototype_store") && error.message.includes("function") ? "Lance d'abord le SQL 092 dans Supabase." : error.message.includes("prototype_equipe") ? "Ce prototype est équipé : change d'arme avant de le ranger." : error.message);
}

/** Range tous les prototypes non équipés du sac. Renvoie combien ont été rangés. */
export async function storeAllPrototypes(): Promise<number> {
  const { data, error } = await scenesClient.rpc("prototype_store_all");
  if (error) throw new Error(error.message.includes("prototype_store_all") && error.message.includes("function") ? "Lance d'abord le SQL 092 dans Supabase." : error.message);
  return Number(data ?? 0);
}

export async function createWeapon(blob: Blob, name: string, type: WeaponType, grip: Point): Promise<{ weapon: Weapon; itemId: string }> {
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
  const d = data as { weapon: Weapon; item_id: string };
  return { weapon: d.weapon, itemId: d.item_id };
}

export async function equipItem(characterId: string, itemId: string | null): Promise<void> {
  const { error } = await scenesClient.rpc("weapon_equip", { p_character_id: characterId, p_item_id: itemId });
  if (error) throw error;
}

export async function deleteMyItem(itemId: string): Promise<void> {
  const { error } = await scenesClient.rpc("weapon_item_delete", { p_item_id: itemId });
  if (error) throw error;
}

export async function fetchEquippedItemId(characterId: string): Promise<string | null> {
  const { data } = await scenesClient.from("character_build").select("equipped_item_id").eq("character_id", characterId).maybeSingle();
  return ((data as { equipped_item_id: string | null } | null)?.equipped_item_id) ?? null;
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
    .select("character_id, item:equipped_item_id(adjust_dx, adjust_dy, adjust_rot, adjust_scale, weapon:weapons(image_url, grip_anchor, width, height, hidden)), characters(visual_assets(hand_anchor))")
    .in("character_id", characterIds)
    .not("equipped_item_id", "is", null);
  if (error) return out;
  for (const r of (data ?? []) as any[]) {
    const w = r.item?.weapon;
    if (!w || w.hidden) continue;
    out[r.character_id] = {
      imageUrl: w.image_url,
      grip: w.grip_anchor,
      width: w.width,
      height: w.height,
      hand: r.characters?.visual_assets?.hand_anchor ?? DEFAULT_HAND,
      dx: Number(r.item.adjust_dx ?? 0),
      dy: Number(r.item.adjust_dy ?? 0),
      rot: Number(r.item.adjust_rot ?? 0),
      scale: Number(r.item.adjust_scale ?? 100),
    };
  }
  return out;
}

export async function adjustItem(itemId: string, dx: number, dy: number, rot: number, scale: number): Promise<void> {
  const { error } = await scenesClient.rpc("weapon_item_adjust", { p_item_id: itemId, p_dx: dx, p_dy: dy, p_rot: rot, p_scale: scale });
  if (error) throw error;
}

export function weaponKindLabel(t: WeaponType): string {
  return t === "magic" ? "magique" : "mêlée";
}

/** Arme au hasard mais stable pour un monstre (même résultat chez tous les joueurs). */
/** Armes (modèles) visibles, indexées par id : le serveur choisit l'arme de chaque monstre (combat_enemies.weapon_id). */
export async function fetchWeaponsById(): Promise<Record<string, Omit<WornWeapon, "hand">>> {
  const { data, error } = await scenesClient
    .from("weapons")
    .select("id, image_url, grip_anchor, width, height")
    .eq("hidden", false)
    .limit(500);
  if (error) return {};
  const out: Record<string, Omit<WornWeapon, "hand">> = {};
  for (const w of (data ?? []) as any[]) out[w.id] = { imageUrl: w.image_url, grip: w.grip_anchor, width: w.width, height: w.height };
  return out;
}

export function hashOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Un monstre porte-t-il une arme ? Les boss toujours, les autres 1 fois sur 10 (stable pour tout le groupe). */
export function monsterHasWeapon(role: string, enemyId: string): boolean {
  return role === "boss" || hashOf(enemyId + "w") % 10 === 0;
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
export async function adminSetWeaponType(id: string, type: WeaponType) {
  const { error } = await scenesClient.rpc("admin_set_weapon_type", { p_weapon_id: id, p_type: type });
  if (error) throw error;
}
export async function adminSetWeaponHidden(id: string, hidden: boolean) {
  const { error } = await scenesClient.rpc("admin_set_weapon_hidden", { p_weapon_id: id, p_hidden: hidden });
  if (error) throw error;
}
export async function adminSetWeaponNoDisplay(id: string, value: boolean) {
  const { error } = await scenesClient.rpc("admin_set_weapon_no_display", { p_weapon_id: id, p_value: value });
  if (error) throw error;
}
export async function adminDeleteWeapon(id: string) {
  const { error } = await scenesClient.rpc("admin_delete_weapon", { p_weapon_id: id });
  if (error) throw error;
}
