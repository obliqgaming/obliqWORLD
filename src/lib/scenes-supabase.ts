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
};

export type VisualAsset = {
  id: string;
  type: "character" | "npc" | "monster" | "object";
  name: string;
  image_url: string;
  author_user_id: string | null;
  source: "drawn" | "imported";
  created_at: string;
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
  await ensureUserId();
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
  const { data, error } = await scenesClient
    .from("characters")
    .select("*, visual_assets(image_url)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return flattenCharacter(data);
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

// Upload d'un dessin (canvas -> PNG -> bucket `drawings`) puis création de la ligne visual_assets.
export async function uploadDrawingAsCharacterAsset(blob: Blob, name: string): Promise<VisualAsset> {
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

// ---------- Présence + chat temps réel (un seul canal par scène) ----------
export function joinScenePresence(
  sceneId: string,
  userId: string,
  onUpdate: (peers: Record<string, PeerState>) => void,
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
      onUpdate(peers);
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
