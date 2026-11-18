// Évite d'envoyer deux fois la même lecture à Supabase quand plusieurs écrans la demandent presque en même temps.
// Aucune donnée n'est gardée longtemps : on réutilise juste la réponse déjà en route (ou très récente).
const entries = new Map<string, { t: number; p: Promise<unknown> }>();

export function sharedFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const e = entries.get(key);
  if (e && Date.now() - e.t < ttlMs) return e.p as Promise<T>;
  const p = fn();
  entries.set(key, { t: Date.now(), p });
  p.catch(() => { if (entries.get(key)?.p === p) entries.delete(key); });
  return p;
}

export function forgetShared(prefix: string): void {
  for (const k of [...entries.keys()]) if (k.startsWith(prefix)) entries.delete(k);
}
