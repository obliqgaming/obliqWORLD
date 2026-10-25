import { REQUIRE_PROVIDER_LOGIN } from "./alpha-config";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

const SCENES_SUPABASE_URL = "https://xbesddgqhvwcyjnoxtaz.supabase.co";
const SCENES_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gfJOIX_L5Iq1y-4vMFKAHA_x4tCyoXB";

const isBrowser = typeof window !== "undefined";

// Journalise (console F12 + panneau à l'écran) chaque étape de la présence
// temps réel : connexions/reconnexions du canal, contenu de chaque synchro
// reçue. Désactivé par défaut pour ne pas l'imposer à tout le monde (viewers
// du stream inclus) ; activable à la volée en jeu via le bouton discret à
// côté du son, ou en tapant "/debug" dans le tchat. Mémorisé par navigateur.
const DEBUG_PRESENCE_KEY = "auberge-debug-presence";
let debugPresenceEnabled = isBrowser && localStorage.getItem(DEBUG_PRESENCE_KEY) === "1";

export function isPresenceDebugEnabled(): boolean {
  return debugPresenceEnabled;
}

export function setPresenceDebugEnabled(enabled: boolean): void {
  debugPresenceEnabled = enabled;
  if (!isBrowser) return;
  try {
    localStorage.setItem(DEBUG_PRESENCE_KEY, enabled ? "1" : "0");
  } catch {
    // stockage indisponible (navigation privée très restrictive) : tant pis,
    // le réglage ne survivra juste pas à un rechargement.
  }
}

export const scenesClient = createClient(SCENES_SUPABASE_URL, SCENES_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    storageKey: "auberge-auth",
  },
});

export type Point = { x: number; y: number };

// Calibration de la taille du personnage selon sa profondeur dans le décor :
// y80/y100/y120 sont les positions verticales (% de la scène) où le personnage
// doit mesurer respectivement 80%, 100% et 120% de sa taille normale. Entre
// ces trois repères, la taille est interpolée en continu (voir
// computeDepthScale) pour un effet progressif, pas de paliers. null = scène pas
// encore calibrée -> taille fixe à 100% partout.
export type DepthScale = { y80: number; y100: number; y120: number };

export type Scene = {
  id: string;
  name: string;
  image_url: string;
  music_url: string;
  depth_scale: DepthScale | null;
  // La zone marchable est une LISTE de pièces : chaque pièce est son propre
  // polygone. Ça évite d'avoir à dessiner un unique polygone géant qui longe
  // tous les murs d'un étage entier (fastidieux et casse-gueule) — on dessine
  // une pièce à la fois, et le personnage peut marcher dans l'union de toutes
  // les pièces. (Anciennes scènes : un seul polygone à plat, toujours accepté
  // et automatiquement transformé en liste à une seule pièce.)
  walkable_zone: Point[][] | null;
  // Obstacles isolés à l'intérieur d'une pièce (une table au milieu, par ex.) :
  // chaque élément est un petit polygone "trou" que le personnage ne doit pas
  // traverser même s'il est entouré de zone marchable.
  obstacles: Point[][] | null;
  created_at: string;
};

export type SceneExit = {
  id: string;
  from_scene_id: string;
  to_scene_id: string;
  position: Point;
  label: string | null;
  arrow_rotation?: number | null; // SQL 042 : angle de la flèche-curseur (0 = droite), réglé dans /admin
};

export type VisualAsset = {
  id: string;
  type: "character" | "npc" | "monster" | "object";
  name: string;
  image_url: string;
  author_user_id: string | null;
  source: "drawn" | "imported";
  created_at: string;
  // Ancrage optionnel pour une future arme/objet tenu en main (% de l'image,
  // 0-100 sur chaque axe). null si le joueur ne l'a pas placé/désactivé —
  // aucune arme ne s'affichera simplement sur ce personnage, rien d'autre ne
  // dépend de ce champ. Volontairement limité à la main pour l'instant (pas
  // de tête/torse) pour ne pas contraindre le dessin libre.
  hand_anchor: Point | null;
};

export type Character = {
  id: string;
  user_id: string;
  name: string;
  class_id: string | null;
  visual_asset_id: string;
  scene_id: string;
  position: Point;
  image_url: string; // dénormalisé depuis visual_assets
  created_at: string;
};

export type PeerState = {
  characterId: string;
  name: string;
  image_url: string;
  position: Point;
  duration: number;
  walking: boolean;
  pet?: string | null; // image du compagnon qui l'accompagne (SQL 031)
  t?: number; // horloge de l'émetteur (ms) : le récepteur ignore tout état plus ancien que le dernier reçu
  away?: boolean; // true = absent (aucune action depuis 2 min) → "(ABS)" affiché
};

export type ChatMessage = {
  characterId: string;
  name: string;
  text: string;
  ts: number;
};

export type PresenceChannel = RealtimeChannel;

// ---------- Auth anonyme ----------
// NOTE: pour l'instant, connexion anonyme. Le jour où on passe à une vraie connexion
// (Discord / Twitch), c'est cette fonction qui changera — le reste du code n'a pas
// à bouger puisqu'il ne connaît que "un userId".
// Exportée : la page /admin en a aussi besoin pour pouvoir écrire les zones
// (la policy RLS d'update exige un utilisateur connecté, même anonyme).
export async function ensureUserId(): Promise<string> {
  const { data } = await scenesClient.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  // Alpha : plus de session invité automatique, il faut passer par Twitch / Discord.
  if (REQUIRE_PROVIDER_LOGIN) throw new Error("LOGIN_REQUIRED");

  const { data: signIn, error } = await scenesClient.auth.signInAnonymously();
  if (error || !signIn.user) throw error ?? new Error("Anonymous sign-in failed");
  return signIn.user.id;
}

// ---------- Connexion Twitch / Discord (par-dessus le mode invité anonyme) ----------

export type AuthIdentity = {
  isAnonymous: boolean;
  provider: "twitch" | "discord" | null;
  displayName: string | null;
  avatarUrl: string | null;
  // Identifiant Supabase (auth.uid()) de la session en cours — c'est très
  // exactement ce que vérifie une policy RLS, donc c'est l'identifiant le
  // plus fiable pour verrouiller une page comme /admin à un seul compte
  // (plus fiable qu'un nom, qui pourrait changer).
  userId: string | null;
};

// Qui est connecté en ce moment (invité anonyme, ou via Twitch/Discord), pour
// afficher un badge de statut. N'appelle aucune API externe : relit juste la
// session déjà en cache localement.
export async function getAuthIdentity(): Promise<AuthIdentity> {
  const { data } = await scenesClient.auth.getSession();
  const user = data.session?.user;
  if (!user) return { isAnonymous: true, provider: null, displayName: null, avatarUrl: null, userId: null };
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const rawProvider = user.app_metadata?.["provider"];
  const provider = rawProvider === "twitch" || rawProvider === "discord" ? rawProvider : null;
  const pick = (...keys: string[]) => keys.map((k) => meta[k]).find((v) => typeof v === "string") as string | undefined;
  return {
    isAnonymous: !!user.is_anonymous,
    provider,
    userId: user.id,
    // Twitch range le login sous name/slug/nickname/full_name (jamais
    // user_name/preferred_username malgré ce qu'on pourrait attendre) ;
    // Discord utilise plutôt user_name/preferred_username. On couvre les deux.
    displayName: pick("nickname", "slug", "user_name", "preferred_username", "full_name", "name") ?? null,
    avatarUrl: pick("avatar_url", "picture") ?? null,
  };
}

// Connecte le joueur avec Twitch ou Discord. Redirige la page entière vers le
// fournisseur puis revient ici (impossible à tester dans l'aperçu Lovable en
// iframe : il faut tester sur le site publié).
//
// S'il jouait déjà en invité (session anonyme), on RATTACHE ce compte à la
// session en cours (linkIdentity) plutôt que d'en ouvrir une nouvelle : même
// user_id qu'avant, donc le personnage déjà créé est conservé tel quel.
// Exception : si ce compte Twitch/Discord est déjà rattaché à un AUTRE compte
// (reconnexion depuis un nouvel appareil), linkIdentity refuse — on se
// connecte alors normalement à ce compte existant, ce qui abandonne le
// personnage invité actuel de cet appareil (son historique n'est pas perdu,
// juste plus accessible sans se reconnecter en invité avant de lier un autre
// compte).
export async function connectIdentityProvider(provider: "twitch" | "discord"): Promise<void> {
  if (!REQUIRE_PROVIDER_LOGIN) await ensureUserId();
  const { data } = await scenesClient.auth.getSession();
  const redirectTo = window.location.href.split("#")[0];

  if (data.session?.user?.is_anonymous) {
    const { error } = await scenesClient.auth.linkIdentity({ provider, options: { redirectTo } });
    if (!error) return;
  }

  const { error } = await scenesClient.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
}

// Retour au mode invité : ferme la session connectée. Le personnage lié au
// compte Twitch/Discord n'est pas supprimé, juste laissé de côté tant qu'on
// ne se reconnecte pas avec ce compte.
export async function signOutToGuest(): Promise<void> {
  await scenesClient.auth.signOut();
}

// ---------- Scènes ----------
// Un seul polygone a été généré à l'origine sous forme de paires [x, y]
// (sortie brute de l'extraction OpenCV), mais le reste du code (positions de
// personnage, de sorties) utilise des objets {x, y}. On normalise ici une
// polygone à la fois, en acceptant les deux formats.
function normalizePolygon(raw: unknown): Point[] | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0] as unknown;
  if (Array.isArray(first)) {
    return (raw as [number, number][]).map(([x, y]) => ({ x, y }));
  }
  return raw as Point[];
}

// Un point de polygone est soit [x, y] (tuple), soit {x, y} (objet).
function looksLikePoint(v: unknown): boolean {
  if (Array.isArray(v)) return typeof v[0] === "number";
  return !!v && typeof v === "object" && "x" in (v as Record<string, unknown>);
}

// walkable_zone et obstacles ont désormais tous les deux le même format côté
// base : une LISTE de polygones (une pièce ou un obstacle chacun). On accepte
// aussi l'ancien format "un seul polygone à plat" pour ne pas casser les
// scènes pas encore ré-enregistrées, en le remettant dans une liste à un
// élément.
function normalizePolygonList(raw: unknown): Point[][] | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  if (looksLikePoint(raw[0])) {
    const poly = normalizePolygon(raw);
    return poly && poly.length >= 3 ? [poly] : null;
  }
  const polys = (raw as unknown[])
    .map((poly) => normalizePolygon(poly))
    .filter((poly): poly is Point[] => !!poly && poly.length >= 3);
  return polys.length > 0 ? polys : null;
}

function normalizeDepthScale(raw: unknown): DepthScale | null {
  if (!raw || typeof raw !== "object") return null;
  const { y80, y100, y120 } = raw as Record<string, unknown>;
  if (typeof y80 !== "number" || typeof y100 !== "number" || typeof y120 !== "number") return null;
  return { y80, y100, y120 };
}

function normalizeScene(row: any): Scene {
  return {
    ...row,
    walkable_zone: normalizePolygonList(row.walkable_zone),
    obstacles: normalizePolygonList(row.obstacles),
    depth_scale: normalizeDepthScale(row.depth_scale),
  } as Scene;
}

// Taille du personnage (en multiplicateur, 1 = taille normale) selon sa
// position verticale dans le décor. Interpolation continue entre les 3
// repères pour un effet progressif, sans palier visible ("pas de gras").
// Scène pas encore calibrée (depth_scale null) -> toujours 1.
//
// NOTE : les clés y80/y100/y120 sont juste des identifiants internes
// (loin/normal/près) — les échelles réelles associées sont 65%/100%/135% (pas
// besoin de replacer les points si on retouche encore ces valeurs plus tard,
// seuls les multiplicateurs ci-dessous changent).
const DEPTH_FAR_SCALE = 0.65;
const DEPTH_MID_SCALE = 1.0;
const DEPTH_NEAR_SCALE = 1.35;

export function computeDepthScale(y: number, depthScale: DepthScale | null | undefined): number {
  if (!depthScale) return 1;
  const { y80, y100, y120 } = depthScale;
  if (y <= y80) return DEPTH_FAR_SCALE;
  if (y <= y100) return DEPTH_FAR_SCALE + ((y - y80) / (y100 - y80 || 1)) * (DEPTH_MID_SCALE - DEPTH_FAR_SCALE);
  if (y <= y120) return DEPTH_MID_SCALE + ((y - y100) / (y120 - y100 || 1)) * (DEPTH_NEAR_SCALE - DEPTH_MID_SCALE);
  return DEPTH_NEAR_SCALE;
}

export async function fetchSceneByName(name: string): Promise<Scene> {
  const { data, error } = await scenesClient
    .from("scenes")
    .select("*")
    .ilike("name", name)
    .single();
  if (error) throw error;
  return normalizeScene(data);
}

export async function fetchScene(id: string): Promise<Scene> {
  const { data, error } = await scenesClient.from("scenes").select("*").eq("id", id).single();
  if (error) throw error;
  return normalizeScene(data);
}

// Pour la page /admin : liste de toutes les scènes, pour le sélecteur.
export async function fetchAllScenes(): Promise<Scene[]> {
  const { data, error } = await scenesClient.from("scenes").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeScene);
}

export type MusicFile = { name: string; url: string };

// Liste les morceaux déjà présents dans le bucket de stockage `music`, pour
// les proposer dans un menu déroulant depuis /admin plutôt que de devoir
// copier-coller une URL à la main (source d'erreur : URL mal collée, lien
// expiré, etc.).
export async function listMusicFiles(): Promise<MusicFile[]> {
  const { data, error } = await scenesClient.storage.from("music").list("", {
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  return (data ?? [])
    .filter((f) => f.name && !f.name.endsWith("/")) // ignore les sous-dossiers éventuels
    .map((f) => ({
      name: f.name,
      url: scenesClient.storage.from("music").getPublicUrl(f.name).data.publicUrl,
    }));
}

// Change la musique d'une scène existante.
export async function updateSceneMusic(sceneId: string, musicUrl: string): Promise<void> {
  const { error } = await scenesClient.from("scenes").update({ music_url: musicUrl }).eq("id", sceneId);
  if (error) throw error;
}

// Crée une nouvelle scène (ex: un étage supplémentaire de l'auberge) depuis
// /admin : upload de l'image de fond dans le bucket de stockage `scenes`
// (public en lecture, écriture réservée à l'admin — voir le SQL fourni), puis
// insertion de la ligne. walkable_zone/obstacles/depth_scale démarrent vides :
// on les dessine ensuite normalement dans /admin comme pour toute scène.
export async function createScene(name: string, imageFile: File, musicUrl: string | null): Promise<Scene> {
  const userId = await ensureUserId();
  const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
  const fileName = `scene_${userId}_${Date.now()}.${ext}`;

  const { error: uploadError } = await scenesClient.storage
    .from("scenes")
    .upload(fileName, imageFile, { contentType: imageFile.type || "image/png", upsert: false });
  if (uploadError) throw uploadError;

  const { data: pub } = scenesClient.storage.from("scenes").getPublicUrl(fileName);

  const { data, error } = await scenesClient
    .from("scenes")
    .insert({
      name,
      image_url: pub.publicUrl,
      music_url: musicUrl || "",
      // La colonne est NOT NULL en base : une scène toute neuve démarre avec
      // des listes vides (pas de pièce/obstacle dessiné·e encore), pas null.
      walkable_zone: [],
      obstacles: [],
      depth_scale: null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeScene(data);
}

function polygonToRaw(poly: Point[]): [number, number][] {
  return poly.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
}

// Écrit directement les pièces (zone marchable), les obstacles et la
// calibration de profondeur d'une scène. Appelée uniquement depuis /admin.
export async function updateSceneZones(
  sceneId: string,
  rooms: Point[][],
  obstacles: Point[][],
  depthScale: DepthScale | null,
) {
  const { error } = await scenesClient
    .from("scenes")
    .update({
      walkable_zone: rooms.map(polygonToRaw),
      obstacles: obstacles.map(polygonToRaw),
      depth_scale: depthScale,
    })
    .eq("id", sceneId);
  if (error) throw error;
}

export async function fetchSceneExits(sceneId: string): Promise<SceneExit[]> {
  const { data, error } = await scenesClient
    .from("scene_exits")
    .select("*")
    .eq("from_scene_id", sceneId);
  if (error) throw error;
  return (data ?? []) as SceneExit[];
}

export async function updateSceneExitPosition(exitId: string, position: Point): Promise<void> {
  const { error } = await scenesClient
    .from("scene_exits")
    .update({ position: { x: Math.round(position.x * 10) / 10, y: Math.round(position.y * 10) / 10 } })
    .eq("id", exitId);
  if (error) throw error;
}

// Crée un nouveau portail sur la scène courante (fromSceneId), posé au point
// cliqué, vers la destination choisie. Le label est optionnel (ex: "Étage" /
// "Rez-de-chaussée") — purement informatif, affiché en info-bulle dans /admin.
export async function createSceneExit(
  fromSceneId: string,
  toSceneId: string,
  position: Point,
  label: string | null,
): Promise<SceneExit> {
  const { data, error } = await scenesClient
    .from("scene_exits")
    .insert({
      from_scene_id: fromSceneId,
      to_scene_id: toSceneId,
      position: { x: Math.round(position.x * 10) / 10, y: Math.round(position.y * 10) / 10 },
      label,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SceneExit;
}

// Change la destination et/ou le libellé d'un portail existant — c'est ce qui
// permet de choisir "ce portail renvoie vers telle scène" depuis /admin, sans
// toucher au SQL.
export async function updateSceneExitDestination(
  exitId: string,
  changes: { to_scene_id?: string; label?: string | null; arrow_rotation?: number },
): Promise<void> {
  const { error } = await scenesClient.from("scene_exits").update(changes).eq("id", exitId);
  if (error) throw error;
}

export async function deleteSceneExit(exitId: string): Promise<void> {
  const { error } = await scenesClient.from("scene_exits").delete().eq("id", exitId);
  if (error) throw error;
}

// ---------- Portail d'expédition (§5, revu le 2026-10-14) ----------
// Distinct d'un scene_exit ordinaire : ne change pas de scène, déclenche la
// logique de groupe/expédition (voir handleEnterPortal côté index.tsx). Même
// pattern de pose/déplacement que les scene_exits dans /admin, par cohérence
// avec l'existant.

export type ExpeditionPortal = {
  id: string;
  scene_id: string;
  position: Point;
  label: string | null;
  route: "court" | "long"; // SQL 040 : expédition courte (7 étapes) ou longue (14, niveau minimum)
  created_at: string;
};

// Les portails d'une scène (un par route : courte et longue).
export async function fetchScenePortals(sceneId: string): Promise<ExpeditionPortal[]> {
  const { data, error } = await scenesClient
    .from("expedition_portals")
    .select("*")
    .eq("scene_id", sceneId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ExpeditionPortal[]).map((p) => ({ ...p, route: p.route ?? "court" }));
}

export async function createExpeditionPortal(sceneId: string, position: Point, label: string | null, route: "court" | "long" = "court"): Promise<ExpeditionPortal> {
  const { data, error } = await scenesClient
    .from("expedition_portals")
    .insert({
      scene_id: sceneId,
      position: { x: Math.round(position.x * 10) / 10, y: Math.round(position.y * 10) / 10 },
      label,
      route,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ExpeditionPortal;
}

export async function updateExpeditionPortalPosition(portalId: string, position: Point): Promise<void> {
  const { error } = await scenesClient
    .from("expedition_portals")
    .update({ position: { x: Math.round(position.x * 10) / 10, y: Math.round(position.y * 10) / 10 } })
    .eq("id", portalId);
  if (error) throw error;
}

export async function deleteExpeditionPortal(portalId: string): Promise<void> {
  const { error } = await scenesClient.from("expedition_portals").delete().eq("id", portalId);
  if (error) throw error;
}

// ---------- Entrée dans le portail = "prêt" (§5, revu le 2026-10-14) ----------
// Cliquer sur le portail ne lance PAS l'expédition directement : ça marque
// "ce personnage est prêt" (entered_portal_at). L'expédition passe de
// 'lobby' à 'active' dès que TOUS les membres joined du groupe ont cliqué —
// décidé explicitement le 2026-10-14 : "cliquer sur le bouton revient à
// faire prêt, ça lance une fois que tout le monde l'a fait", pas au premier
// clic. N'importe quel membre du groupe peut déclencher la création de la
// ligne expeditions (pas seulement le créateur du groupe) : le premier à
// cliquer crée, les suivants rejoignent la même ligne.

export type Expedition = {
  id: string;
  status: "lobby" | "active" | "completed_returned" | "completed_wipe";
  party_id: string;
  created_by_character_id: string;
  portal_scene_id: string;
  route?: "court" | "long";
  current_step_index: number;
  loot_secured: boolean;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type ExpeditionParticipant = {
  expedition_id: string;
  character_id: string;
  entered_portal_at: string | null;
  joined_at: string;
  left_expedition_at: string | null;
};

// Expédition en lobby déjà ouverte pour ce groupe à ce portail, s'il y en a
// une (créée par un autre membre qui a déjà cliqué) — évite de créer deux
// lignes expeditions concurrentes pour le même groupe/portail.
export async function fetchOpenExpeditionForParty(partyId: string, portalSceneId: string): Promise<Expedition | null> {
  const { data, error } = await scenesClient
    .from("expeditions")
    .select("*")
    .eq("party_id", partyId)
    .eq("portal_scene_id", portalSceneId)
    .eq("status", "lobby")
    .maybeSingle();
  if (error) throw error;
  return (data as Expedition | null) ?? null;
}

export async function fetchExpeditionParticipants(expeditionId: string): Promise<ExpeditionParticipant[]> {
  const { data, error } = await scenesClient
    .from("expedition_participants")
    .select("*")
    .eq("expedition_id", expeditionId);
  if (error) throw error;
  return (data ?? []) as ExpeditionParticipant[];
}

// Marque CE personnage comme prêt (entré dans le portail). Crée la ligne
// expeditions si c'est le premier du groupe à cliquer, sinon rejoint celle
// déjà ouverte. Ne fait jamais passer le statut à 'active' elle-même — ça
// reste un calcul séparé (voir computeExpeditionReadiness côté appelant),
// pour que la logique "tout le monde prêt" soit testable indépendamment de
// l'écriture en base.
export async function enterExpeditionPortal(
  myCharacterId: string,
  partyId: string,
  createdByCharacterId: string,
  portalSceneId: string,
  route: "court" | "long" = "court",
): Promise<Expedition> {
  // Tout passe par une fonction serveur (SQL 024) : le navigateur n'écrit plus directement
  // dans expeditions / expedition_participants.
  const { data, error } = await scenesClient.rpc("expedition_enter_portal", {
    p_character_id: myCharacterId,
    p_party_id: partyId,
    p_created_by: createdByCharacterId,
    p_portal_scene_id: portalSceneId,
    p_route: route,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as Expedition;
}

// Annule le "prêt" de ce personnage (reclique sur le portail pour se retirer,
// avant que l'expédition parte) — simple commodité, pas dans le GDD
// explicitement mais cohérent avec "le portail attend tout le groupe" : si on
// peut attendre, on doit pouvoir changer d'avis pendant l'attente.
export async function leaveExpeditionPortal(expeditionId: string, myCharacterId: string): Promise<void> {
  const { error } = await scenesClient.rpc("expedition_leave_portal", {
    p_expedition_id: expeditionId,
    p_character_id: myCharacterId,
  });
  if (error) throw error;
}

// Fait passer l'expédition en 'active' — appelée côté client uniquement
// lorsque computeExpeditionReadiness (index.tsx) détecte que tous les
// membres joined du groupe ont entered_portal_at rempli. Plusieurs clients
// peuvent tenter cet appel en même temps (tous les membres du groupe
// observent le même état) ; l'update conditionné sur status='lobby' rend ça
// sans danger — un seul des appels concurrents a un effet, les autres sont
// des no-op silencieux.
export async function startExpedition(expeditionId: string): Promise<void> {
  const { error } = await scenesClient.rpc("expedition_start", { p_expedition_id: expeditionId });
  if (error) throw error;
}

// Expédition en cours (status 'active') du groupe, quelle que soit la scène :
// sert à téléporter un membre qui (re)charge la page pendant l'expédition.
export async function fetchActiveExpeditionForParty(partyId: string): Promise<Expedition | null> {
  const { data, error } = await scenesClient
    .from("expeditions")
    .select("*")
    .eq("party_id", partyId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as Expedition | undefined) ?? null;
}

// Termine l'expédition (retour à l'auberge pour l'instant : le vrai déroulé
// d'étapes et le butin viendront ensuite).
export async function endExpedition(
  expeditionId: string,
  status: "completed_returned" | "completed_wipe" = "completed_returned",
): Promise<void> {
  const { error } = await scenesClient
    .from("expeditions")
    .update({ status, ended_at: new Date().toISOString() })
    .eq("id", expeditionId);
  if (error) throw error;
}

function normalizeSceneName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

// Vrai pour la scène de combat/expédition (nommée "expedition" ou
// "expédition" dans /admin, accents et casse ignorés).
export function isExpeditionSceneName(name: string | null | undefined): boolean {
  return !!name && normalizeSceneName(name) === "expedition";
}

export async function fetchExpeditionScene(): Promise<Scene | null> {
  const { data, error } = await scenesClient.from("scenes").select("*");
  if (error) throw error;
  const row = (data ?? []).find((r: any) => isExpeditionSceneName(r.name));
  return row ? normalizeScene(row) : null;
}

// Adversaire PLACEHOLDER : un personnage existant pris au hasard (le but est
// qu'à terme les personnages déjà créés alimentent la forêt). Remplacé plus
// tard par les ennemis choisis ou dessinés dans l'éditeur.
export async function fetchRandomCharacterAsEnemy(
  excludeIds: string[] = [],
): Promise<{ name: string; imageUrl: string } | null> {
  const { data, error } = await scenesClient
    .from("characters")
    .select("id, name, visual_assets(image_url)")
    .limit(50);
  if (error) throw error;
  const pool = (data ?? []).filter((r: any) => !excludeIds.includes(r.id) && r.visual_assets?.image_url);
  if (pool.length === 0) return null;
  const pick: any = pool[Math.floor(Math.random() * pool.length)];
  return { name: pick.name, imageUrl: pick.visual_assets.image_url };
}

// ---------- Vote partagé de l'expédition ----------
// Adapté de Trust & Greed (cast_vote / begin_resolution), règles ObliqWorld :
// tout passe par des fonctions serveur (voir 004_vote_partage_expedition.sql).
export type StepVote = { character_id: string; choice_key: string };
export type ExpeditionStep = {
  id: string;
  expedition_id: string;
  step_index: number;
  kind: "event" | "combat";
  resolved: boolean;
  winning_choice_key: string | null;
  vote_deadline: string | null;
  event_key?: string | null;
  outcome_text?: string | null;
  outcome_pv_loss_pct?: number | null;
  outcome_reward?: string | null;
  outcome_triggers_combat?: boolean;
};

// Retrouve (ou crée) l'étape `stepIndex`. Chaque client l'appelle en arrivant.
export async function ensureExpeditionStep(
  expeditionId: string,
  stepIndex: number,
  kind: "event" | "combat",
  situationText: string,
): Promise<ExpeditionStep> {
  const { data, error } = await scenesClient.rpc("expedition_ensure_step", {
    p_expedition_id: expeditionId,
    p_step_index: stepIndex,
    p_kind: kind,
    p_situation: situationText,
  });
  if (error) throw error;
  return data as ExpeditionStep;
}

export async function fetchStepVotes(stepId: string): Promise<StepVote[]> {
  const { data, error } = await scenesClient
    .from("expedition_step_votes")
    .select("character_id, choice_key")
    .eq("step_id", stepId);
  if (error) throw error;
  return (data ?? []) as StepVote[];
}

export async function castStepVote(stepId: string, characterId: string, choiceKey: string): Promise<void> {
  const { error } = await scenesClient.rpc("expedition_cast_vote", {
    p_step_id: stepId,
    p_character_id: characterId,
    p_choice: choiceKey,
  });
  if (error) throw error;
}

// Tente de résoudre l'étape. « Le vote n'est pas terminé » n'est pas une
// vraie erreur (un autre client réessaiera) : on renvoie null dans ce cas.
export async function resolveExpeditionStep(stepId: string): Promise<ExpeditionStep | null> {
  const { data, error } = await scenesClient.rpc("expedition_resolve_step", { p_step_id: stepId });
  if (error) {
    if (/pas terminé|Combat en cours/.test(String(error.message))) return null;
    throw error;
  }
  return data as ExpeditionStep;
}

export async function fetchExpeditionById(expeditionId: string): Promise<Expedition | null> {
  const { data, error } = await scenesClient.from("expeditions").select("*").eq("id", expeditionId).maybeSingle();
  if (error) throw error;
  return (data as Expedition | null) ?? null;
}

// Écoute en direct, pendant l'expédition : changement d'étape / de statut, et
// votes de l'étape courante (le canal est recréé à chaque changement d'étape).
export function subscribeToExpeditionRun(
  expeditionId: string,
  stepId: string | null,
  onExpeditionChange: () => void,
  onVotesChange: () => void,
): PresenceChannel {
  let channel = scenesClient
    .channel(`expedition-run:${expeditionId}:${stepId ?? "none"}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "expeditions", filter: `id=eq.${expeditionId}` },
      () => onExpeditionChange(),
    );
  if (stepId) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "expedition_step_votes", filter: `step_id=eq.${stepId}` },
      () => onVotesChange(),
    );
  }
  return channel.subscribe();
}

export function subscribeToExpeditionChanges(expeditionId: string, onChange: () => void): PresenceChannel {
  const channel = scenesClient
    .channel(`expedition:${expeditionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "expedition_participants", filter: `expedition_id=eq.${expeditionId}` },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "expeditions", filter: `id=eq.${expeditionId}` },
      () => onChange(),
    )
    .subscribe();
  return channel;
}

// ---------- Personnages / assets visuels ----------
function flattenCharacter(row: any): Character {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    class_id: row.class_id,
    visual_asset_id: row.visual_asset_id,
    scene_id: row.scene_id,
    position: row.position,
    created_at: row.created_at,
    image_url: row.visual_assets?.image_url ?? "",
  };
}

// Renvoie le personnage existant de l'utilisateur courant, ou null s'il n'en a pas
// encore (ne crée plus rien automatiquement — c'était le comportement précédent
// à corriger : un personnage n'existe qu'après un choix explicite de l'utilisateur).
export async function fetchMyCharacter(): Promise<Character | null> {
  const userId = await ensureUserId();
  // Personnage vivant ou mort, mais pas archivé (SQL 025) ; le plus récent si plusieurs.
  const { data, error } = await scenesClient
    .from("characters")
    .select("*, visual_assets(image_url)")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return flattenCharacter(row);
}

// Mort définitive : le personnage est-il tombé ? (SQL 007/010 : character_build.is_alive)
export async function fetchMyDeath(characterId: string): Promise<{ dead: boolean; cause: string | null; inExpedition: boolean }> {
  const { data, error } = await scenesClient
    .from("character_build")
    .select("is_alive, death_cause")
    .eq("character_id", characterId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { is_alive: boolean | null; death_cause: string | null } | null;
  const dead = row?.is_alive === false;
  let inExpedition = false;
  if (dead) {
    // Un mort reste spectateur de l'expédition en cours (une résurrection est possible plus tard).
    const { data: parts } = await scenesClient
      .from("expedition_participants")
      .select("expedition_id, expeditions(status)")
      .eq("character_id", characterId)
      .is("left_expedition_at", null);
    inExpedition = ((parts ?? []) as any[]).some((p) => p.expeditions?.status === "active");
  }
  return { dead, cause: row?.death_cause ?? null, inExpedition };
}

// Archive les personnages morts du compte (jamais supprimés) pour pouvoir en dessiner un nouveau.
export async function archiveDeadCharacter(): Promise<void> {
  const { error } = await scenesClient.rpc("character_archive_dead");
  if (error) throw error;
}

export async function fetchCharacterAssets(): Promise<VisualAsset[]> {
  const { data, error } = await scenesClient
    .from("visual_assets")
    .select("*")
    .eq("type", "character")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VisualAsset[];
}

export async function createCharacterWithAsset(
  sceneId: string,
  visualAssetId: string,
  name: string,
): Promise<Character> {
  const userId = await ensureUserId();
  const { data, error } = await scenesClient
    .from("characters")
    .insert({
      user_id: userId,
      name: name || "Aventurier·ère",
      visual_asset_id: visualAssetId,
      scene_id: sceneId,
      position: { x: 50, y: 70 },
    })
    .select("*, visual_assets(image_url)")
    .single();
  if (error) throw error;
  return flattenCharacter(data);
}

export type CharacterFamily = "melee" | "magie";

// Enregistre la famille (définitive) du personnage et ses PV de départ (20/20,
// valeurs par défaut de la table). Une seule fois par personnage.
export async function createCharacterBuild(characterId: string, family: CharacterFamily): Promise<void> {
  const { error } = await scenesClient.from("character_build").insert({ character_id: characterId, family });
  if (error) throw error;
}

// Upload d'un dessin (canvas -> PNG -> bucket `drawings`) puis création de la ligne visual_assets.
// handAnchor : position choisie par le joueur pour tenir une future arme/objet
// (% de l'image 512x512) ; null s'il n'a pas touché au repère ou l'a désactivé.
export async function uploadDrawingAsCharacterAsset(
  blob: Blob,
  name: string,
  handAnchor: Point | null,
): Promise<VisualAsset> {
  const userId = await ensureUserId();
  const fileName = `character_${userId}_${Date.now()}.png`;

  const { error: uploadError } = await scenesClient.storage
    .from("drawings")
    .upload(fileName, blob, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;

  const { data: pub } = scenesClient.storage.from("drawings").getPublicUrl(fileName);

  const { data, error } = await scenesClient
    .from("visual_assets")
    .insert({
      type: "character",
      name: name || "Personnage",
      image_url: pub.publicUrl,
      author_user_id: userId,
      source: "drawn",
      hand_anchor: handAnchor,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as VisualAsset;
}

export async function saveCharacterPosition(id: string, position: Point) {
  const { error } = await scenesClient.from("characters").update({ position }).eq("id", id);
  if (error) console.error("saveCharacterPosition failed", error);
}

export async function moveCharacterToScene(id: string, sceneId: string, position: Point) {
  const { error } = await scenesClient
    .from("characters")
    .update({ scene_id: sceneId, position })
    .eq("id", id);
  if (error) console.error("moveCharacterToScene failed", error);
}

// ---------- Géométrie ----------
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export type MovePayload = { userId: string; state: PeerState };

// ---------- Présence + déplacement + chat temps réel (un seul canal par scène) ----------
//
// IMPORTANT — pourquoi deux canaux logiques différents sur le même objet
// `channel` : Supabase Realtime limite chaque connexion à 5 mises à jour de
// Presence (track()) par tranche de 30 secondes ; au-delà, le SERVEUR ferme
// le canal lui-même (erreur ClientPresenceRateLimitReached). Un trajet à
// plusieurs étapes dépasse cette limite en quelques secondes, ce qui
// expliquait les fermetures en boucle observées en test. Depuis ce correctif :
// - Presence (track(), via trackPresenceSnapshot ci-dessous) : réservée aux
//   événements RARES — arrivée à destination, (re)connexion, passage
//   absent/de retour. Large marge sous la limite.
// - Broadcast (send(), via broadcastMove ci-dessous) : pour CHAQUE étape
//   intermédiaire d'un trajet. Pas de limite de ce type, car Broadcast ne
//   maintient aucun état synchronisé côté serveur, juste un relais de
//   message vers les autres abonnés du canal.
export function joinScenePresence(
  sceneId: string,
  userId: string,
  // isFullRoster=true pour un instantané complet (sync Presence, recalage
  // périodique) où un pair absent de `peers` a vraiment quitté la scène ;
  // false pour la position d'un seul pair reçue via Broadcast, où tous les
  // AUTRES pairs ne sont simplement pas concernés par ce message précis et ne
  // doivent surtout pas être traités comme partis.
  onUpdate: (peers: Record<string, PeerState>, isFullRoster: boolean) => void,
  onChatMessage?: (msg: ChatMessage) => void,
  // Appelé à CHAQUE changement d'état du canal ("joining", "SUBSCRIBED",
  // "CLOSED", "CHANNEL_ERROR", "TIMED_OUT"...) — pas seulement au premier
  // succès. C'est le seul endroit fiable pour savoir "je dois republier ma
  // position maintenant" (sur "SUBSCRIBED", y compris après une RECONNEXION
  // suite à une coupure) : le socket Supabase se reconnecte tout seul en
  // interne, mais il ne renvoie jamais automatiquement le dernier track()
  // envoyé — si personne ne le refait, on reste invisible pour les autres
  // après une coupure, même quand tout a l'air normal de notre côté.
  onStatusChange?: (status: string, err?: Error) => void,
): PresenceChannel {
  const channel = scenesClient.channel(`scene:${sceneId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const peers = readPeersFromChannel(channel, userId);
      if (isPresenceDebugEnabled()) {
        console.debug(`[presence] sync scene=${sceneId} peers=${Object.keys(peers).length}`, Object.keys(peers));
      }
      onUpdate(peers, true);
    })
    .on("broadcast", { event: "move" }, ({ payload }) => {
      const { userId: senderId, state } = payload as MovePayload;
      if (senderId === userId) return; // jamais notre propre écho
      onUpdate({ [senderId]: state }, false);
    })
    .on("broadcast", { event: "chat" }, ({ payload }) => {
      if (onChatMessage) onChatMessage(payload as ChatMessage);
    })
    .subscribe((status, err) => {
      if (isPresenceDebugEnabled()) console.debug(`[presence] channel status=${status} scene=${sceneId}`, err ?? "");
      onStatusChange?.(status, err);
    });

  return channel;
}

// Position à haute fréquence PENDANT une marche — voir l'explication Presence
// vs Broadcast ci-dessus. Pas de limite de débit de ce type sur Broadcast.
export function broadcastMove(channel: PresenceChannel, userId: string, state: PeerState): boolean {
  if (!isChannelReady(channel)) return false;
  channel.send({ type: "broadcast", event: "move", payload: { userId, state } satisfies MovePayload });
  return true;
}

// Vrai seulement quand le canal est confirmé ouvert par le serveur
// ("joined"). Sert de garde avant chaque track()/send() : si ce n'est pas
// encore le cas, la bibliothèque Supabase peut basculer en douce sur une
// requête REST de secours au lieu du WebSocket temps réel — un comportement
// que la bibliothèque annonce elle-même comme bientôt supprimé, et qui ne
// remet pas forcément à jour l'état de présence partagé de la même façon
// qu'un vrai message WebSocket. On préfère sauter cet envoi et laisser la
// reconnexion suivante (onSubscribed) republier l'état correct, plutôt que
// risquer cette voie de secours peu fiable.
export function isChannelReady(channel: PresenceChannel | null): boolean {
  return channel?.state === "joined";
}

// Relit l'état de présence connu du navigateur pour cette scène (aucun appel
// réseau : c'est un cache local déjà tenu à jour par le client Supabase).
// Utilisé à la fois par le "sync" ci-dessus et par un recalage périodique
// côté appelant, en filet de sécurité si jamais un événement "sync" est
// manqué (micro-accroc réseau).
export function readPeersFromChannel(channel: PresenceChannel, selfUserId: string): Record<string, PeerState> {
  const state = channel.presenceState<PeerState>();
  const peers: Record<string, PeerState> = {};
  Object.entries(state).forEach(([key, presences]) => {
    if (key === selfUserId) return;
    const latest = presences[presences.length - 1];
    if (latest) peers[key] = latest as unknown as PeerState;
  });
  return peers;
}

export function leaveScenePresence(channel: PresenceChannel | null) {
  if (channel) scenesClient.removeChannel(channel);
}

// Renvoie true si le message est parti, false s'il a été sauté faute de
// canal ouvert (voir isChannelReady) — l'appelant peut alors prévenir le
// joueur plutôt que de le laisser croire que le message est parti.
export function broadcastChatMessage(channel: PresenceChannel, msg: ChatMessage): boolean {
  if (!isChannelReady(channel)) return false;
  channel.send({ type: "broadcast", event: "chat", payload: msg });
  return true;
}

// ---------- Groupe (party) — invitation directe à la WoW (§5, revu le
// 2026-10-14), indépendante de toute expédition. Un groupe se forme par clic
// sur un personnage n'importe où dans le monde, puis se déplace à pied
// jusqu'au portail en forêt qui déclenche l'expédition une fois tout le
// monde entré (§5). Voir supabase/migrations_proposed/001_*.sql pour le
// schéma (tables parties / party_members). ----------

export type PartyMemberStatus = "invited" | "joined" | "left";

export type PartyMember = {
  party_id: string;
  character_id: string;
  status: PartyMemberStatus;
  invited_at: string;
  joined_at: string | null;
  left_at: string | null;
  // Dénormalisé depuis characters/character_build pour affichage direct dans
  // le panneau de groupe, sans aller rechercher ailleurs à chaque rendu.
  name: string;
  image_url: string;
  pv_current: number | null;
  pv_max: number | null;
};

export type Party = {
  id: string;
  created_by_character_id: string;
  created_at: string;
  disbanded_at: string | null;
};

function flattenPartyMember(row: any): PartyMember {
  return {
    party_id: row.party_id,
    character_id: row.character_id,
    status: row.status,
    invited_at: row.invited_at,
    joined_at: row.joined_at,
    left_at: row.left_at,
    name: row.characters?.name ?? "???",
    image_url: row.characters?.visual_assets?.image_url ?? "",
    pv_current: row.characters?.character_build?.[0]?.pv_current ?? null,
    pv_max: row.characters?.character_build?.[0]?.pv_max ?? null,
  };
}

// Groupe actif (non dissous) dont le personnage courant est membre
// invited/joined, s'il y en a un. Un personnage n'est jamais dans deux
// groupes actifs à la fois (règle appliquée côté appelant — voir
// inviteToParty ci-dessous — pas de contrainte SQL portable pour ça).
export async function fetchMyActiveParty(characterId: string): Promise<{ party: Party; members: PartyMember[] } | null> {
  // Un personnage peut avoir plusieurs lignes « invited / joined » (anciens groupes, invitations
  // non répondues) : on prend le groupe non dissous le plus pertinent (joined d'abord, puis le plus récent).
  const { data: memberRows, error: memberError } = await scenesClient
    .from("party_members")
    .select("party_id, status, invited_at")
    .eq("character_id", characterId)
    .in("status", ["invited", "joined"])
    .order("invited_at", { ascending: false });
  if (memberError) throw memberError;
  if (!memberRows || memberRows.length === 0) return null;

  const { data: partyRows, error: partyError } = await scenesClient
    .from("parties")
    .select("*")
    .in("id", memberRows.map((m: any) => m.party_id))
    .is("disbanded_at", null);
  if (partyError) throw partyError;
  const alive = new Set((partyRows ?? []).map((p: any) => p.id));
  const pick =
    memberRows.find((m: any) => m.status === "joined" && alive.has(m.party_id)) ??
    memberRows.find((m: any) => alive.has(m.party_id));
  if (!pick) return null;
  const partyRow = (partyRows ?? []).find((p: any) => p.id === pick.party_id);
  if (!partyRow) return null;

  const members = await fetchPartyMembers(partyRow.id);
  return { party: partyRow as Party, members };
}

export async function fetchPartyMembers(partyId: string): Promise<PartyMember[]> {
  const { data, error } = await scenesClient
    .from("party_members")
    .select("*, characters(name, visual_assets(image_url), character_build(pv_current, pv_max))")
    .eq("party_id", partyId)
    .order("invited_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(flattenPartyMember);
}

// Crée un groupe (si le personnage n'en a pas déjà un actif) et invite
// directement la cible — couvre le cas le plus courant (clic sur un perso →
// "Inviter" alors qu'on n'a pas encore de groupe). Si un groupe actif existe
// déjà pour ce personnage, utiliser inviteToParty ci-dessous à la place.
export async function createPartyAndInvite(myCharacterId: string, targetCharacterId: string): Promise<Party> {
  const { data: party, error: partyError } = await scenesClient
    .from("parties")
    .insert({ created_by_character_id: myCharacterId })
    .select("*")
    .single();
  if (partyError) throw partyError;

  // Le créateur rejoint directement son propre groupe (status 'joined'),
  // pas la peine de s'auto-inviter.
  const { error: selfError } = await scenesClient
    .from("party_members")
    .insert({ party_id: party.id, character_id: myCharacterId, status: "joined", joined_at: new Date().toISOString() });
  if (selfError) throw selfError;

  const { error: inviteError } = await scenesClient
    .from("party_members")
    .insert({ party_id: party.id, character_id: targetCharacterId, status: "invited" });
  if (inviteError) throw inviteError;

  return party as Party;
}

// Groupe d'une seule personne : expeditions.party_id est obligatoire, donc un
// joueur qui entre seul dans le portail (avertissement affiché côté UI, pas
// de blocage, §5 revu le 2026-10-14) obtient un groupe solo pour que toute
// la suite (participants, votes) fonctionne sans cas particulier.
export async function createSoloParty(myCharacterId: string): Promise<Party> {
  const { data: party, error: partyError } = await scenesClient
    .from("parties")
    .insert({ created_by_character_id: myCharacterId })
    .select("*")
    .single();
  if (partyError) throw partyError;
  const { error: selfError } = await scenesClient
    .from("party_members")
    .insert({ party_id: party.id, character_id: myCharacterId, status: "joined", joined_at: new Date().toISOString() });
  if (selfError) throw selfError;
  return party as Party;
}

export async function inviteToParty(partyId: string, targetCharacterId: string): Promise<void> {
  const { error } = await scenesClient
    .from("party_members")
    .insert({ party_id: partyId, character_id: targetCharacterId, status: "invited" });
  if (error) throw error;
}

export async function acceptPartyInvite(partyId: string, myCharacterId: string): Promise<void> {
  const { error } = await scenesClient
    .from("party_members")
    .update({ status: "joined", joined_at: new Date().toISOString() })
    .eq("party_id", partyId)
    .eq("character_id", myCharacterId);
  if (error) throw error;
}

export async function declinePartyInvite(partyId: string, myCharacterId: string): Promise<void> {
  const { error } = await scenesClient
    .from("party_members")
    .update({ status: "left", left_at: new Date().toISOString() })
    .eq("party_id", partyId)
    .eq("character_id", myCharacterId);
  if (error) throw error;
}

// Quitter un groupe qu'on a déjà rejoint (pas une invitation en attente —
// voir declinePartyInvite pour ce cas). Même opération côté données (passer
// à 'left'), distingué seulement pour la clarté des appels côté UI.
export async function leaveParty(partyId: string, myCharacterId: string): Promise<void> {
  const { error } = await scenesClient
    .from("party_members")
    .update({ status: "left", left_at: new Date().toISOString() })
    .eq("party_id", partyId)
    .eq("character_id", myCharacterId);
  if (error) throw error;
}

// Expulsion par le créateur du groupe — RLS vérifie côté serveur que
// l'appelant est bien created_by_character_id, pas la peine de le revérifier
// ici (voir la policy "changer son propre statut, ou expulser si créateur").
export async function kickFromParty(partyId: string, targetCharacterId: string): Promise<void> {
  const { error } = await scenesClient
    .from("party_members")
    .update({ status: "left", left_at: new Date().toISOString() })
    .eq("party_id", partyId)
    .eq("character_id", targetCharacterId);
  if (error) throw error;
}

// Abonnement temps réel aux changements du groupe (postgres_changes, pas
// Presence/Broadcast : party_members est une vraie table persistante — un
// joueur hors-ligne doit quand même voir, à sa reconnexion, qu'il a été
// invité ou expulsé entre-temps, ce que Presence ne garantit pas). Appelle
// onChange sur tout insert/update touchant ce groupe ; l'appelant refait un
// fetchPartyMembers pour avoir l'état à jour plutôt que de essayer de
// reconstruire le diff ligne par ligne.
export function subscribeToPartyChanges(partyId: string, onChange: () => void): PresenceChannel {
  const channel = scenesClient
    .channel(`party:${partyId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "party_members", filter: `party_id=eq.${partyId}` },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "parties", filter: `id=eq.${partyId}` },
      () => onChange(),
    )
    .subscribe();
  return channel;
}

// Un personnage peut recevoir une invitation AVANT d'avoir de groupe actif
// connu côté UI — il faut donc aussi écouter party_members sans connaître de
// partyId à l'avance, pour détecter "on vient de m'inviter". Scope large
// (pas de filtre serveur possible sur character_id ici sans dupliquer une
// query par ligne insérée) : on filtre côté client dans le callback.
export function subscribeToIncomingInvites(myCharacterId: string, onInvite: (partyId: string) => void): PresenceChannel {
  const channel = scenesClient
    .channel(`party-invites:${myCharacterId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "party_members", filter: `character_id=eq.${myCharacterId}` },
      (payload: { new: unknown }) => {
        const row = payload.new as { status: PartyMemberStatus; party_id: string };
        if (row.status === "invited") onInvite(row.party_id);
      },
    )
    .subscribe();
  return channel;
}
