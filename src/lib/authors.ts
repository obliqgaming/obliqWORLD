// Noms d'auteurs (armes, rencontres écrites…) : un seul appel groupé, gardé en mémoire
// pour la session. Nom Twitch/Discord du joueur (SQL 038), à défaut le nom de son personnage le plus récent.
import { scenesClient } from "./scenes-supabase";

const cache = new Map<string, string | null>();

export async function fetchAuthorNames(userIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing = [...new Set(userIds)].filter((id) => !cache.has(id));
  if (missing.length) {
    try {
      const { data } = await scenesClient.rpc("author_names", { p_ids: missing });
      const found: Record<string, string> = {};
      for (const r of (data ?? []) as { user_id: string; name: string | null }[]) if (r.name) found[r.user_id] = r.name;
      for (const id of missing) cache.set(id, found[id] ?? null);
    } catch {
      /* noms d'auteurs facultatifs : on n'affiche rien */
    }
  }
  for (const id of userIds) {
    const n = cache.get(id);
    if (n) out[id] = n;
  }
  return out;
}
