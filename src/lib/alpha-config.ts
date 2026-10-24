// Réglages de l'alpha privée (côté navigateur).
// REQUIRE_PROVIDER_LOGIN : à true, il faut se connecter avec Twitch ou Discord pour jouer (plus d'invité anonyme).
// À activer seulement après avoir relié ton propre compte à Twitch (bouton « Se connecter avec Twitch » du jeu,
// tant que tu es encore invité : le personnage et l'accès admin sont conservés), puis désactivé les connexions
// anonymes dans Supabase (Authentication > Sign In / Providers > « Allow anonymous sign-ins »).
export const REQUIRE_PROVIDER_LOGIN = false;

// Adresse de contact affichée dans la page de confidentialité (laisse vide pour ne rien afficher).
export const CONTACT_EMAIL = "";
