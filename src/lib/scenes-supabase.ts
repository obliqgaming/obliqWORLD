import { createClient } from "@supabase/supabase-js";

// External project hosting the "scenes" table (public read access).
const SCENES_SUPABASE_URL = "https://xbesddgqhvwcyjnoxtaz.supabase.co";
const SCENES_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gfJOIX_L5Iq1y-4vMFKAHA_x4tCyoXB";

export const scenesClient = createClient(SCENES_SUPABASE_URL, SCENES_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface Scene {
  id: string;
  name: string;
  image_url: string;
  music_url: string;
}

export async function fetchSceneByName(name: string): Promise<Scene> {
  const { data, error } = await scenesClient
    .from("scenes")
    .select("id,name,image_url,music_url")
    .ilike("name", name)
    .single();
  if (error) throw error;
  return data as Scene;
}
