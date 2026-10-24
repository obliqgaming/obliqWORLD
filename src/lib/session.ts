// Nettoyage à l'ouverture d'un nouvel onglet (SQL 034) : vieilles expéditions abandonnées terminées,
// groupes hors expédition quittés. Un simple rechargement de la page ne refait pas le nettoyage.
import { scenesClient } from "./scenes-supabase";

const FLAG = "obliqworld-session-cleaned";

export async function ensureSessionCleanup(): Promise<void> {
  try {
    if (sessionStorage.getItem(FLAG)) return;
  } catch {
    return; // stockage indisponible : on ne nettoie pas (pas de risque de dissoudre un groupe à chaque rechargement)
  }
  try {
    await scenesClient.rpc("session_cleanup");
  } catch (e) {
    console.warn("session_cleanup indisponible", e);
  }
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    /* ignoré */
  }
}
