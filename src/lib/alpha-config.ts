// Réglages de l'alpha privée (côté navigateur).
// REQUIRE_PROVIDER_LOGIN : à true, il faut se connecter avec Twitch ou Discord pour jouer (plus d'invité anonyme).
// Un joueur déjà invité (session anonyme) qui se connecte garde son personnage (le compte est rattaché à la session).
// Côté Supabase, désactive aussi « Allow anonymous sign-ins » (Authentication > Sign In / Providers) : c'est lui qui
// empêche vraiment la création de nouveaux invités (le réglage ci-dessous ne fait que masquer le jeu dans le navigateur).
export const REQUIRE_PROVIDER_LOGIN = true;

// Cadre en bois autour du décor (essai réversible). true = cadre affiché (/ui/game-frame.webp) et chat accroché au décor ;
// false = affichage d'avant, strictement identique. C'est la SEULE valeur à changer pour revenir en arrière.
export const ENABLE_GAME_FRAME = true;
// Épaisseur du bois, en part de la largeur du décor (0.022 ≈ 40 px sur un écran 1920 ; 0.016 = plus fin).
export const GAME_FRAME_SIZE = 0.022;

// Compte administrateur : jamais bloqué par l'écran de connexion, même s'il n'est pas encore lié à Twitch/Discord.
export const ADMIN_USER_ID = "03fcd13f-b0a1-4092-ba83-0469c035b09c";

// Adresse de contact affichée dans la page de confidentialité (laisse vide pour ne rien afficher).
export const CONTACT_EMAIL = "contact@obliqproduction.com";
