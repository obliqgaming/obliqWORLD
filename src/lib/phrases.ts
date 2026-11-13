// Phrases du jeu modifiables dans /admin > Phrases (table game_phrases, SQL 091) : répliques des PNJ et phrases de montée de niveau.
// Si la table est absente ou vide pour une catégorie, le jeu utilise les phrases d'origine écrites dans le code.
import { scenesClient } from "./scenes-supabase";

export const PHRASE_CATEGORIES: { key: string; label: string }[] = [
  { key: "npc:forge", label: "Manchoc (forge)" },
  { key: "npc:step_editor", label: "Plumobec (écrire un passage)" },
  { key: "npc:merchant", label: "Aspiflouz (marchand)" },
  { key: "npc:farm", label: "Bourrebouc (ferme)" },
  { key: "npc:quests", label: "Morsoif (boulot du jour)" },
  { key: "levelup", label: "Montée de niveau" },
  { key: "raccord:debut", label: "Raccord : début de l'expédition" },
  { key: "raccord:combat", label: "Raccord : après un combat" },
  { key: "raccord:elite", label: "Raccord : après un élite" },
  { key: "raccord:coffre", label: "Raccord : après un coffre" },
  { key: "raccord:clairiere", label: "Raccord : après une clairière" },
  { key: "raccord:rencontre", label: "Raccord : après une rencontre" },
];

let cache: Record<string, string[]> | null = null;
let inflight: Promise<Record<string, string[]>> | null = null;

export async function fetchAllPhrases(force = false): Promise<Record<string, string[]>> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const out: Record<string, string[]> = {};
    try {
      const { data } = await scenesClient.from("game_phrases").select("category, text").order("created_at");
      for (const r of data ?? []) {
        const c = (r as any).category as string;
        (out[c] ??= []).push((r as any).text as string);
      }
    } catch {
      /* table absente : phrases d'origine */
    }
    cache = out;
    inflight = null;
    return out;
  })();
  return inflight;
}

/** Phrases d'une catégorie : celles de la base, sinon celles d'origine. */
export async function phrasesFor(category: string, defaults: string[]): Promise<string[]> {
  const all = await fetchAllPhrases();
  const mine = (all[category] ?? []).map((t) => t.trim()).filter(Boolean);
  return mine.length ? mine : defaults;
}
