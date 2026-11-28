// Érosion du stock des annonces invendues (SQL 205) : le premier joueur qui ouvre la forge ou la ferme de la journée lance le calcul côté base
// (au plus une fois par jour, quelques lignes). Ici : un seul appel par chargement de page, et jamais d'erreur visible (le SQL peut ne pas être installé).
import { scenesClient } from "./scenes-supabase";

let done: Promise<void> | null = null;

export function runStockDecayOnce(): Promise<void> {
  if (!done) {
    done = (async () => {
      try {
        await scenesClient.rpc("shop_stock_decay_tick");
      } catch {
        /* sans importance */
      }
    })();
  }
  return done;
}
