// Ferme et compagnons (SQL 031).
import { scenesClient, ensureUserId } from "./scenes-supabase";
import { fetchAuthorNames } from "./authors";
import type { Rarity } from "./weapons";

export type Tier = "small" | "medium" | "large";
export const TIER_INFO: Record<Tier, { label: string; color: string }> = {
  small: { label: "Petit", color: "#cfd8dc" },
  medium: { label: "Moyen", color: "#7cc4ff" },
  large: { label: "Grand", color: "#c58bff" },
};

export type Companion = {
  id: string;
  owner_user_id: string;
  name: string;
  image_url: string;
  tier: Tier;
  hp: number;
  hp_max: number;
  rest_left: number;
  active: boolean;
  loot_expedition_id: string | null;
  created_at: string;
  rarity?: Rarity | null;
  is_prototype?: boolean;
  design_id?: string | null;
};

export async function fetchMyCompanions(): Promise<Companion[]> {
  const uid = await ensureUserId();
  const { data, error } = await scenesClient.from("companions").select("*").eq("owner_user_id", uid).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Companion[];
}

export async function setActiveCompanion(id: string | null): Promise<void> {
  const { error } = await scenesClient.rpc("companion_set_active", { p_companion_id: id });
  if (error) throw error;
}

export async function releaseCompanion(id: string): Promise<void> {
  const { error } = await scenesClient.rpc("companion_release", { p_companion_id: id });
  if (error) throw error;
}

// Compagnon de départ (SQL 043) : un seul, gratuit, une seule fois.
export type StarterCompanion = { id: string; name: string; image_url: string; tier: Tier };

export async function fetchStarterChoices(): Promise<StarterCompanion[]> {
  const { data: ok, error: e1 } = await scenesClient.rpc("starter_companion_available");
  if (e1 || !ok) return [];
  const { data, error } = await scenesClient.from("starter_companions").select("id, name, image_url, tier").order("sort");
  if (error) return [];
  return (data ?? []) as StarterCompanion[];
}

export async function claimStarterCompanion(id: string): Promise<void> {
  const { error } = await scenesClient.rpc("claim_starter_companion", { p_id: id });
  if (error) throw error;
}

// Dessiner un compagnon (SQL 048).
export const COMPANION_W = 512;
export const COMPANION_H = 512;

export type CompanionDesign = { id: string; author_user_id: string; name: string; image_url: string; rarity: Rarity; hidden: boolean; created_at: string };

export type CompanionRules = { cost: number; perDay: number; hp: Record<Rarity, number>; ranges: Record<Rarity, { min: number; max: number }>; authorPct: number };

const RARS: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export async function fetchCompanionRules(): Promise<CompanionRules> {
  const { data } = await scenesClient.from("game_settings").select("key, value").or("key.like.companion_%,key.eq.shop_author_pct");
  const s: Record<string, number> = {};
  for (const r of (data ?? []) as { key: string; value: number }[]) s[r.key] = Number(r.value);
  const hp = {} as CompanionRules["hp"];
  const ranges = {} as CompanionRules["ranges"];
  RARS.forEach((k, i) => {
    hp[k] = s[`companion_hp_${k}`] ?? [8, 12, 16, 24, 30][i]!;
    ranges[k] = { min: s[`companion_price_min_${k}`] ?? 6, max: s[`companion_price_max_${k}`] ?? 15 };
  });
  return { cost: s["companion_draw_cost"] ?? 6, perDay: s["companion_draw_per_day"] ?? 1, hp, ranges, authorPct: s["shop_author_pct"] ?? 20 };
}

export async function createCompanionDesign(blob: Blob, name: string): Promise<{ design: CompanionDesign; companionId: string }> {
  const userId = await ensureUserId();
  const fileName = `companion_${userId}_${Date.now()}.png`;
  const { error: upErr } = await scenesClient.storage.from("drawings").upload(fileName, blob, { contentType: "image/png", upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = scenesClient.storage.from("drawings").getPublicUrl(fileName);
  const { data, error } = await scenesClient.rpc("companion_design_create", { p_name: name, p_image_url: pub.publicUrl });
  if (error) {
    // Le dessin n'a pas été validé : on retire l'image envoyée pour ne pas laisser de fichier orphelin.
    void scenesClient.storage.from("drawings").remove([fileName]);
    throw error;
  }
  const d = data as { design: CompanionDesign; companion_id: string };
  return { design: d.design, companionId: d.companion_id };
}

export type CompanionListing = {
  design_id: string;
  author_user_id: string;
  price: number;
  stock_total: number;
  stock_left: number;
  author_gold_pending: number;
  design: CompanionDesign;
  authorName: string | null;
  mine: boolean;
};

export async function fetchCompanionShop(): Promise<CompanionListing[]> {
  const uid = await ensureUserId();
  const { data, error } = await scenesClient
    .from("companion_listings")
    .select("design_id, author_user_id, price, stock_total, stock_left, author_gold_pending, design:companion_designs(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = ((data ?? []) as any[]).filter((r) => r.design && !r.design.hidden);
  const names = await fetchAuthorNames(rows.map((r) => r.author_user_id as string));
  const list: CompanionListing[] = rows.map((r) => ({ ...r, authorName: names[r.author_user_id] ?? null, mine: r.author_user_id === uid }));
  list.sort((a, b) => Number(b.stock_left > 0) - Number(a.stock_left > 0));
  return list;
}

export async function companionShopBuy(designId: string): Promise<void> {
  const { error } = await scenesClient.rpc("companion_shop_buy", { p_design_id: designId });
  if (error) throw error;
}

export async function companionSetPrice(designId: string, price: number): Promise<void> {
  const { error } = await scenesClient.rpc("companion_set_price", { p_design_id: designId, p_price: price });
  if (error) throw error;
}

// Compagnons actifs des membres du groupe (pour l'expédition) : personnage -> compagnon prêt à combattre.
export type PartyCompanion = { name: string; image_url: string; hp: number; hp_max: number };
export async function fetchPartyCompanions(characterIds: string[]): Promise<Record<string, PartyCompanion>> {
  if (characterIds.length === 0) return {};
  const { data: chars } = await scenesClient.from("characters").select("id, user_id").in("id", characterIds);
  const owners = (chars ?? []).map((c: any) => c.user_id).filter(Boolean);
  if (owners.length === 0) return {};
  const { data: comps } = await scenesClient
    .from("companions")
    .select("owner_user_id, name, image_url, hp, hp_max, rest_left")
    .in("owner_user_id", owners)
    .eq("active", true);
  const out: Record<string, PartyCompanion> = {};
  for (const c of (chars ?? []) as any[]) {
    const k = (comps ?? []).find((x: any) => x.owner_user_id === c.user_id && x.hp > 0 && (x.rest_left ?? 0) === 0);
    if (k) out[c.id] = { name: k.name, image_url: k.image_url, hp: k.hp, hp_max: k.hp_max };
  }
  return out;
}
