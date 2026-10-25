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

// Publie le nom Twitch/Discord du joueur (SQL 038) pour que les autres le voient comme « auteur ».
// Une seule fois par onglet ; sans effet pour un compte anonyme.
export async function publishDisplayName(): Promise<void> {
  try {
    const { data } = await scenesClient.auth.getUser();
    const ident = data.user?.identities?.find((i) => i.provider === "twitch" || i.provider === "discord");
    const d = (ident?.identity_data ?? {}) as Record<string, string | undefined>;
    const name = d["preferred_username"] ?? d["user_name"] ?? d["full_name"] ?? d["name"];
    if (ident && name) await scenesClient.rpc("set_my_display_name", { p_name: name, p_provider: ident.provider });
  } catch {
    /* facultatif */
  }
}

// Déconnexion volontaire : on garde un repère pour que le jeu réaffiche l'écran de connexion
// (au lieu de créer en douce un nouveau compte invité à chaque déconnexion).
const LOGOUT_FLAG = "obliqworld-logged-out";
export function markLoggedOut(name?: string | null): void {
  try {
    localStorage.setItem(LOGOUT_FLAG, name ? `1|${name}` : "1");
    sessionStorage.removeItem(FLAG); // le prochain compte refera le nettoyage d'ouverture
  } catch {
    /* ignoré */
  }
}
export function loggedOutInfo(): { loggedOut: boolean; name: string | null } {
  try {
    const v = localStorage.getItem(LOGOUT_FLAG);
    if (!v) return { loggedOut: false, name: null };
    return { loggedOut: true, name: v.includes("|") ? v.split("|").slice(1).join("|") : null };
  } catch {
    return { loggedOut: false, name: null };
  }
}
export function clearLoggedOut(): void {
  try {
    localStorage.removeItem(LOGOUT_FLAG);
  } catch {
    /* ignoré */
  }
}
