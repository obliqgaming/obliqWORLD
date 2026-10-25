// Noms d'auteurs (armes, rencontres écrites…) : un seul appel groupé, gardé en mémoire
// pour la session. Un joueur peut avoir plusieurs personnages : on prend le plus récent non archivé.
import { scenesClient } from "./scenes-supabase";

const cache = new Map<string, string | null>();

export async function fetchAuthorNames(userIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing = [...new Set(userIds)].filter((id) => !cache.has(id));
  if (missing.length) {
    try {
      const { data } = await scenesClient
        .from("characters")
        .select("user_id, name, created_at")
        .in("user_id", missing)
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      const found: Record<string, string> = {};
      for (const c of (data ?? []) as { user_id: string; name: string }[]) found[c.user_id] = c.name; // le dernier écrase
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
