// Lieux interactifs d'une scène (SQL 012) : forgeron, éditeur d'étapes… posés
// et déplacés depuis /admin, comme le portail d'expédition.
import { scenesClient, type Point } from "./scenes-supabase";

export type HotspotKind = "forge" | "step_editor";

export const HOTSPOT_KINDS: { kind: HotspotKind; label: string; icon: string; hint: string }[] = [
  { kind: "forge", label: "Forgeron", icon: "⚒", hint: "Dessiner et acheter des armes" },
  { kind: "step_editor", label: "Éditeur d'étapes", icon: "📜", hint: "Écrire des étapes d'expédition" },
];

export function hotspotInfo(kind: string) {
  return HOTSPOT_KINDS.find((k) => k.kind === kind) ?? { kind, label: kind, icon: "★", hint: "" };
}

export type SceneHotspot = {
  id: string;
  scene_id: string;
  kind: string;
  position: Point;
  label: string | null;
  created_at: string;
};

export async function fetchSceneHotspots(sceneId: string): Promise<SceneHotspot[]> {
  const { data, error } = await scenesClient.from("scene_hotspots").select("*").eq("scene_id", sceneId);
  if (error) throw error;
  return (data ?? []) as SceneHotspot[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Pose le lieu, ou le déplace s'il existe déjà dans cette scène.
export async function placeSceneHotspot(sceneId: string, kind: string, position: Point): Promise<SceneHotspot> {
  const pos = { x: round1(position.x), y: round1(position.y) };
  const { data, error } = await scenesClient
    .from("scene_hotspots")
    .upsert({ scene_id: sceneId, kind, position: pos }, { onConflict: "scene_id,kind" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SceneHotspot;
}

export async function deleteSceneHotspot(id: string): Promise<void> {
  const { error } = await scenesClient.from("scene_hotspots").delete().eq("id", id);
  if (error) throw error;
}
