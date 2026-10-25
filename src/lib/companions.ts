// Ferme et compagnons (SQL 031).
import { scenesClient, ensureUserId } from "./scenes-supabase";

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
