// Brouillon de dessin sauvegardé par joueur (sur cet appareil) : on ne perd pas son dessin si on n'a pas assez de flouz.
import { useEffect, useState } from "react";
import { ensureUserId } from "./scenes-supabase";

export function useDraftKey(kind: string): string | null {
  const [k, setK] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    ensureUserId().then((u) => live && setK(`obliq-draft:${kind}:${u}`)).catch(() => live && setK(`obliq-draft:${kind}:anon`));
    return () => {
      live = false;
    };
  }, [kind]);
  return k;
}
export function loadDraft(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function saveDraft(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* stockage plein ou bloqué : tant pis */ }
}
export function clearDraft(key: string | null) {
  if (!key) return;
  try { localStorage.removeItem(key); localStorage.removeItem(`${key}:name`); } catch { /* ignore */ }
}
export function loadDraftName(key: string): string { return loadDraft(`${key}:name`) ?? ""; }
export function saveDraftName(key: string, name: string) { saveDraft(`${key}:name`, name); }
