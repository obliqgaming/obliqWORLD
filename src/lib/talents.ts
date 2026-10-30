// Arbres de talents (SQL 055) : lecture des talents, prise d'un talent, réinitialisation, nom de classe.
import { scenesClient } from "./scenes-supabase";

export type GameTalent = {
  talent_key: string;
  axis_key: string;
  rank: number;
  slot: "A" | "B" | null;
  name: string;
  description: string;
  power_key: string | null;
  implemented: boolean;
};

export type TalentBuild = {
  character_id: string;
  family: "melee" | "magie";
  level: number;
  axis_key: string | null;
  axis_choice_pending: boolean;
  class_name: string | null;
};

export const TREE_ORDER: Record<string, string[]> = { melee: ["guerrier", "trappeur"], magie: ["mage", "pretre"] };
export const AXIS_LABEL: Record<string, string> = { guerrier: "Guerrier", trappeur: "Trappeur", mage: "Mage", pretre: "Prêtre" };
// Points de talent : niveaux 5, 8, 12, 16, 20 (comme le serveur).
export const TALENT_LEVELS = [5, 8, 12, 16, 20];
export const CROSS_MIN_LEVEL = 9;
export const RENAME_SUGGESTIONS: Record<string, string[]> = {
  guerrier: ["Tête-dur", "Brise-élan", "Rempart", "Gardien"],
  trappeur: ["Rôdeur", "Piégeur", "Fine lame", "Ombre"],
  mage: ["Arcaniste", "Pyromancien", "Sorcier", "Invocateur"],
  pretre: ["Soigneur", "Oracle", "Lumineux", "Guérisseur"],
};

let talentsCache: GameTalent[] | null = null;
export async function fetchTalents(): Promise<GameTalent[]> {
  if (talentsCache) return talentsCache;
  const { data, error } = await scenesClient.from("game_talents").select("*").order("rank");
  if (error) throw error;
  talentsCache = (data ?? []) as GameTalent[];
  return talentsCache;
}

export async function fetchMyTalentKeys(characterId: string): Promise<string[]> {
  const { data, error } = await scenesClient.from("character_talents").select("talent_key").eq("character_id", characterId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.talent_key as string);
}

export async function fetchTalentBuild(characterId: string): Promise<TalentBuild | null> {
  const { data, error } = await scenesClient
    .from("character_build")
    .select("character_id, family, level, axis_key, axis_choice_pending, class_name")
    .eq("character_id", characterId)
    .maybeSingle();
  if (error) throw error;
  return (data as TalentBuild | null) ?? null;
}

export async function takeTalent(characterId: string, key: string): Promise<void> {
  const { error } = await scenesClient.rpc("talent_take", { p_character_id: characterId, p_talent_key: key });
  if (error) throw error;
}
export async function resetTalents(characterId: string): Promise<number> {
  const { data, error } = await scenesClient.rpc("talents_reset", { p_character_id: characterId });
  if (error) throw error;
  return Number((data as any)?.cost ?? 0);
}
export async function setClassName(characterId: string, name: string): Promise<void> {
  const { error } = await scenesClient.rpc("character_set_class_name", { p_character_id: characterId, p_name: name });
  if (error) throw error;
}

export function pointsTotal(level: number): number {
  return TALENT_LEVELS.filter((l) => l <= level).length;
}

/** Talents possédés, talent 1 de sa propre classe compris. */
export function ownedWithFree(build: TalentBuild, keys: string[], talents: GameTalent[]): Set<string> {
  const s = new Set(keys);
  if (build.axis_key && !build.axis_choice_pending) {
    for (const t of talents) if (t.axis_key === build.axis_key && t.rank === 1) s.add(t.talent_key);
  }
  return s;
}

/** Peut-on prendre ce talent maintenant ? (le serveur revérifie tout) ; sinon, la raison. */
export function talentStatus(
  t: GameTalent,
  build: TalentBuild,
  owned: Set<string>,
  talents: GameTalent[],
  pointsLeft: number,
): { state: "owned" | "available" | "next" | "locked"; reason?: string } {
  if (owned.has(t.talent_key)) return { state: "owned" };
  if (!t.implemented) return { state: "locked", reason: "Bientôt" };
  if (t.slot && talents.some((o) => o.axis_key === t.axis_key && o.rank === t.rank && o.talent_key !== t.talent_key && owned.has(o.talent_key))) {
    return { state: "locked", reason: "Tu as choisi l'autre option" };
  }
  const cross = t.axis_key !== build.axis_key;
  if (cross && build.level < CROSS_MIN_LEVEL) return { state: "locked", reason: `L'autre arbre s'ouvre au niveau ${CROSS_MIN_LEVEL}` };
  if (cross && t.rank > 3) return { state: "locked", reason: "Hors d'atteinte dans l'autre arbre" };
  if (t.rank > 1 && !talents.some((o) => o.axis_key === t.axis_key && o.rank === t.rank - 1 && owned.has(o.talent_key))) {
    return { state: "locked", reason: "Il te faut le talent précédent" };
  }
  if (pointsLeft <= 0) return { state: "next", reason: "Plus de point disponible" };
  return { state: "available" };
}
