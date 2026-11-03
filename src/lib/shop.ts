// Boutique du forgeron (SQL 029) : armes forgées par les joueurs, mises en vente.
import { scenesClient, ensureUserId } from "./scenes-supabase";
import { fetchAuthorNames } from "./authors";
import type { Weapon, Rarity } from "./weapons";

export type Listing = {
  weapon_id: string;
  author_user_id: string;
  price: number;
  stock_total: number;
  stock_left: number;
  author_gold_pending: number;
  weapon: Weapon;
  authorName: string | null;
  mine: boolean;
};

export type PriceRange = { min: number; max: number };

export async function fetchShop(): Promise<{ listings: Listing[]; ranges: Record<Rarity, PriceRange>; authorPct: number }> {
  const uid = await ensureUserId();
  const { data, error } = await scenesClient
    .from("weapon_listings")
    .select("weapon_id, author_user_id, price, stock_total, stock_left, author_gold_pending, weapon:weapons(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = ((data ?? []) as any[]).filter((r) => r.weapon);
  const names = await fetchAuthorNames(rows.map((r) => r.author_user_id as string));
  const ranges = {} as Record<Rarity, PriceRange>;
  let authorPct = 20;
  const { data: st } = await scenesClient.from("game_settings").select("key, value").like("key", "shop_%");
  const s: Record<string, number> = {};
  for (const r of (st ?? []) as { key: string; value: number }[]) s[r.key] = Number(r.value);
  authorPct = s["shop_author_pct"] ?? 20;
  for (const k of ["common", "uncommon", "rare", "epic", "legendary"] as Rarity[]) {
    ranges[k] = { min: s[`shop_price_min_${k}`] ?? 6, max: s[`shop_price_max_${k}`] ?? 15 };
  }
  const listings: Listing[] = rows.map((r) => ({ ...r, authorName: names[r.author_user_id] ?? null, mine: r.author_user_id === uid }));
  // En stock d'abord, puis les épuisées.
  listings.sort((a, b) => Number(b.stock_left > 0) - Number(a.stock_left > 0));
  return { listings, ranges, authorPct };
}

export async function shopBuy(weaponId: string): Promise<void> {
  const { error } = await scenesClient.rpc("shop_buy", { p_weapon_id: weaponId });
  if (error) throw error;
}

export async function shopSetPrice(weaponId: string, price: number): Promise<void> {
  const { error } = await scenesClient.rpc("shop_set_price", { p_weapon_id: weaponId, p_price: price });
  if (error) throw error;
}

export async function shopCollect(): Promise<number> {
  const { data, error } = await scenesClient.rpc("shop_collect");
  if (error) throw error;
  return Number(data ?? 0);
}

// ---------- Armes exposées autour du forgeron (SQL 065) ----------
// Armes en stock dans la boutique, tirées au hasard chaque jour (graine = date à Paris, mêmes armes pour tous).
export type DisplayWeapon = { key: string; name: string; image_url: string; w: number; h: number; line: string; color: string; price: number };
let displayCache: { day: string; count: number; list: DisplayWeapon[] } | null = null;

export async function fetchDisplayWeapons(count: number): Promise<DisplayWeapon[]> {
  const day = new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  if (displayCache && displayCache.day === day && displayCache.count === count) return displayCache.list;
  const { data, error } = await scenesClient
    .from("weapon_listings")
    .select("weapon_id, author_user_id, price, stock_left, weapon:weapons(*)")
    .gt("stock_left", 0)
    .limit(300);
  if (error) throw error;
  const rows = ((data ?? []) as any[]).filter((r) => r.weapon && !r.weapon.hidden && !r.weapon.no_display && r.weapon.image_url);
  rows.sort((a, b) => (a.weapon_id < b.weapon_id ? -1 : 1));
  const { seededRandom } = await import("./companions");
  const { RARITY_INFO } = await import("./weapons");
  let h = 2166136261;
  for (const ch of `vitrine:${day}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = seededRandom(h >>> 0);
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  const picked = rows.slice(0, count);
  const names = await fetchAuthorNames(picked.map((r) => r.author_user_id as string)).catch(() => ({} as Record<string, string>));
  const list: DisplayWeapon[] = picked.map((r) => ({
    key: r.weapon_id,
    name: r.weapon.name,
    image_url: r.weapon.image_url,
    w: Number(r.weapon.width) || 1,
    h: Number(r.weapon.height) || 1,
    line: `${RARITY_INFO[r.weapon.rarity as Rarity]?.label ?? ""}${names[r.author_user_id] ? ` · par ${names[r.author_user_id]}` : ""}`,
    color: RARITY_INFO[r.weapon.rarity as Rarity]?.color ?? "#f3f4f6",
    price: Number(r.price),
  }));
  displayCache = { day, count, list };
  return list;
}
