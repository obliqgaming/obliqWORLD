// Le marchand (SQL 030) : vend potions et parchemin, rachète tout au quart.
import { scenesClient } from "./scenes-supabase";

export type MerchantSettings = { prices: Record<string, number>; sellPct: number; weaponBase: Record<string, number> };

export async function fetchMerchantSettings(): Promise<MerchantSettings> {
  const { data } = await scenesClient.from("game_settings").select("key, value").or("key.like.merchant_%,key.like.shop_price_min_%");
  const prices: Record<string, number> = {};
  const weaponBase: Record<string, number> = {};
  let sellPct = 25;
  for (const r of (data ?? []) as { key: string; value: number }[]) {
    if (r.key.startsWith("merchant_price_")) prices[r.key.replace("merchant_price_", "")] = Number(r.value);
    else if (r.key === "merchant_sell_pct") sellPct = Number(r.value);
    else if (r.key.startsWith("shop_price_min_")) weaponBase[r.key.replace("shop_price_min_", "")] = Number(r.value);
  }
  return { prices, sellPct, weaponBase };
}

export async function merchantBuy(kind: string, qty = 1) {
  const { error } = await scenesClient.rpc("merchant_buy", { p_kind: kind, p_qty: qty });
  if (error) throw error;
}
export async function merchantSellConsumable(kind: string, qty = 1) {
  const { error } = await scenesClient.rpc("merchant_sell_consumable", { p_kind: kind, p_qty: qty });
  if (error) throw error;
}
export async function merchantSellWeapon(itemId: string) {
  const { error } = await scenesClient.rpc("merchant_sell_weapon", { p_item_id: itemId });
  if (error) throw error;
}
