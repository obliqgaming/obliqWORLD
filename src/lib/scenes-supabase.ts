import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

const SCENES_SUPABASE_URL = "https://xbesddgqhvwcyjnoxtaz.supabase.co";
const SCENES_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gfJOIX_L5Iq1y-4vMFKAHA_x4tCyoXB";

const isBrowser = typeof window !== "undefined";

export const scenesClient = createClient(SCENES_SUPABASE_URL, SCENES_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    storageKey: "auberge-auth",
  },
});

export type Point = { x: number; y: number };

export type Scene = {
  id: string;
  name: string;
  image_url: string;
  music_url: string;
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

function normalizeScene(row: any): Scene {
  return {
    ...row,
    walkable_zone: normalizePolygonList(row.walkable_zone),
    obstacles: normalizePolygonList(row.obstacles),
  } as Scene;
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

// Écrit directement les pièces (zone marchable) et les obstacles d'une scène.
// Appelée uniquement depuis la page /admin.
export async function updateSceneZones(sceneId: string, rooms: Point[][], obstacles: Point[][]) {
  const { error } = await scenesClient
    .from("scenes")
    .update({
      walkable_zone: rooms.map(polygonToRaw),
      obstacles: obstacles.map(polygonToRaw),
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
): PresenceChannel {
  const channel = scenesClient.channel(`scene:${sceneId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PeerState>();
      const peers: Record<string, PeerState> = {};
      Object.entries(state).forEach(([key, presences]) => {
        if (key === userId) return; // on ne s'affiche pas soi-même comme "peer"
        const latest = presences[presences.length - 1];
        if (latest) peers[key] = latest as unknown as PeerState;
      });
      onUpdate(peers);
    })
    .on("broadcast", { event: "chat" }, ({ payload }) => {
      if (onChatMessage) onChatMessage(payload as ChatMessage);
    })
    .subscribe();

  return channel;
}

export function leaveScenePresence(channel: PresenceChannel | null) {
  if (channel) scenesClient.removeChannel(channel);
}

export function broadcastChatMessage(channel: PresenceChannel, msg: ChatMessage) {
  channel.send({ type: "broadcast", event: "chat", payload: msg });
}
