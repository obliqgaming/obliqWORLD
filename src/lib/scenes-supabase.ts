import { createClient } from "@supabase/supabase-js";

// External project hosting the game data (scenes, characters, visual_assets).
const SCENES_SUPABASE_URL = "https://xbesddgqhvwcyjnoxtaz.supabase.co";
const SCENES_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gfJOIX_L5Iq1y-4vMFKAHA_x4tCyoXB";

const isBrowser = typeof window !== "undefined";

export const scenesClient = createClient(SCENES_SUPABASE_URL, SCENES_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    storageKey: "auberge-auth",
    storage: isBrowser ? window.localStorage : undefined,
  },
});

export type Point = { x: number; y: number };

export interface Scene {
  id: string;
  name: string;
  image_url: string;
  music_url: string;
  walkable_zone: [number, number][] | null;
}

export interface Character {
  id: string;
  user_id: string;
  name: string;
  visual_asset_id: string;
  scene_id: string;
  position: Point;
  image_url?: string;
}

export async function fetchSceneByName(name: string): Promise<Scene> {
  const { data, error } = await scenesClient
    .from("scenes")
    .select("id,name,image_url,music_url,walkable_zone")
    .ilike("name", name)
    .single();
  if (error) throw error;
  return data as Scene;
}

async function ensureUserId(): Promise<string> {
  const { data } = await scenesClient.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signed, error } = await scenesClient.auth.signInAnonymously();
  if (error || !signed.user) throw error ?? new Error("Anonymous sign-in failed");
  return signed.user.id;
}

export async function ensureCharacter(sceneId: string): Promise<Character> {
  const userId = await ensureUserId();

  const { data: existing, error: selErr } = await scenesClient
    .from("characters")
    .select("id,user_id,name,visual_asset_id,scene_id,position")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;

  let character = existing as Character | null;

  if (!character) {
    const { data: assets, error: aErr } = await scenesClient
      .from("visual_assets")
      .select("id")
      .eq("type", "character");
    if (aErr) throw aErr;
    if (!assets?.length) throw new Error("No character assets");
    const asset = assets[Math.floor(Math.random() * assets.length)];

    const { data: created, error: insErr } = await scenesClient
      .from("characters")
      .insert({
        user_id: userId,
        name: "Aventurier",
        visual_asset_id: asset.id,
        scene_id: sceneId,
        position: { x: 50, y: 70 },
      })
      .select("id,user_id,name,visual_asset_id,scene_id,position")
      .single();
    if (insErr) throw insErr;
    character = created as Character;
  }

  const { data: asset } = await scenesClient
    .from("visual_assets")
    .select("image_url")
    .eq("id", character.visual_asset_id)
    .single();

  return { ...character, image_url: asset?.image_url };
}

export async function saveCharacterPosition(id: string, position: Point) {
  const { error } = await scenesClient.from("characters").update({ position }).eq("id", id);
  if (error) console.error("Failed to save position", error);
}

export function pointInPolygon(p: Point, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
