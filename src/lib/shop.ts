// Boutique du forgeron (SQL 029) : armes forgées par les joueurs, mises en vente.
import { scenesClient, ensureUserId } from "./scenes-supabase";
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
  const names: Record<string, string> = {};
  try {
    const ids = [...new Set(rows.map((r) => r.author_user_id as string))];
    if (ids.length) {
      const { data: chars } = await scenesClient.from("characters").select("user_id, name").in("user_id", ids).is("archived_at", null);
      for (const c of (chars ?? []) as { user_id: string; name: string }[]) names[c.user_id] = c.name;
    }
  } catch {
    /* noms d'auteurs facultatifs */
  }
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
