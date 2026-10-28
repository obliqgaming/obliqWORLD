// Outils admin sur les personnages (SQL 013) : liste, résurrection, ancrage de
// la main, niveau. Les écritures passent par des fonctions serveur réservées
// au compte admin.
import { scenesClient, type Point } from "./scenes-supabase";

export type AdminCharacter = {
  id: string;
  name: string;
  visual_asset_id: string;
  image_url: string | null;
  hand_anchor: Point | null;
  family: "melee" | "magie" | null;
  level: number | null;
  xp: number | null;
  axis_key: string | null;
  is_alive: boolean | null;
  death_cause: string | null;
};

export async function fetchAdminCharacters(): Promise<AdminCharacter[]> {
  const [c, b] = await Promise.all([
    scenesClient.from("characters").select("id, name, visual_asset_id, visual_assets(image_url, hand_anchor)").order("name"),
    scenesClient.from("character_build").select("character_id, family, level, xp, axis_key, is_alive, death_cause"),
  ]);
  if (c.error) throw c.error;
  if (b.error) throw b.error;
  const builds = new Map<string, any>((b.data ?? []).map((x: any) => [x.character_id, x]));
  return (c.data ?? []).map((r: any) => {
    const bd = builds.get(r.id);
    return {
      id: r.id,
      name: r.name,
      visual_asset_id: r.visual_asset_id,
      image_url: r.visual_assets?.image_url ?? null,
      hand_anchor: r.visual_assets?.hand_anchor ?? null,
      family: bd?.family ?? null,
      level: bd?.level ?? null,
      xp: bd?.xp ?? null,
      axis_key: bd?.axis_key ?? null,
      is_alive: bd?.is_alive ?? null,
      death_cause: bd?.death_cause ?? null,
    } as AdminCharacter;
  });
}

export async function adminResurrect(characterId: string): Promise<void> {
  const { error } = await scenesClient.rpc("admin_resurrect_character", { p_character_id: characterId });
  if (error) throw error;
}

export async function adminDeleteCharacter(characterId: string): Promise<void> {
  const { error } = await scenesClient.rpc("admin_delete_character", { p_character_id: characterId });
  if (error) throw error;
}

export async function adminSetHandAnchor(visualAssetId: string, p: Point | null): Promise<void> {
  const { error } = await scenesClient.rpc("admin_set_hand_anchor", {
    p_visual_asset_id: visualAssetId,
    p_x: p ? p.x : null,
    p_y: p ? p.y : null,
  });
  if (error) throw error;
}

export async function adminSetLevel(characterId: string, level: number, resetAxis: boolean): Promise<void> {
  const { error } = await scenesClient.rpc("admin_set_character_level", {
    p_character_id: characterId,
    p_level: level,
    p_reset_axis: resetAxis,
  });
  if (error) throw error;
}

export async function adminSetFamily(characterId: string, family: "melee" | "magie"): Promise<void> {
  const { error } = await scenesClient.rpc("admin_set_character_family", { p_character_id: characterId, p_family: family });
  if (error) throw error;
}
