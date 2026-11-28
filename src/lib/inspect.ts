// Inspecter un autre joueur (SQL 046).
import { scenesClient } from "./scenes-supabase";

export type Inspected = {
  name: string;
  image_url: string | null;
  family: "melee" | "magie" | null;
  level: number | null;
  axis: string | null;
  weapon: { name: string; image_url: string; rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"; bonus: number; effect: string | null; prototype: boolean; author_user_id?: string | null } | null;
  weapons_drawn: number;
  companions_drawn?: number;
  events_written?: number;
  class_name?: string | null;
  companions: { name: string; image_url: string; tier: "small" | "medium" | "large"; rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary" | null; is_prototype?: boolean; hp_max?: number; active?: boolean; author_user_id?: string | null }[];
};

export async function inspectCharacter(characterId: string): Promise<Inspected> {
  const { data, error } = await scenesClient.rpc("inspect_character", { p_character_id: characterId });
  if (error) throw error;
  return data as Inspected;
}
