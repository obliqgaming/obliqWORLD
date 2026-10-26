// Lieux interactifs d'une scène (SQL 012) : forgeron, éditeur d'étapes… posés
// et déplacés depuis /admin, comme le portail d'expédition.
import { useEffect, useState } from "react";
import { ensureUserId, scenesClient, type Point } from "./scenes-supabase";

export type HotspotKind = "forge" | "step_editor" | "merchant" | "farm" | "gold" | "quests";

export const HOTSPOT_KINDS: { kind: HotspotKind; label: string; icon: string; hint: string; multi?: boolean; bare?: boolean }[] = [
  { kind: "gold", label: "Tas d'or (quotidien)", icon: "/icons/coin.svg", hint: "Ramasser de l'or une fois par jour", multi: true, bare: true },
  { kind: "forge", label: "Forgeron", icon: "⚒", hint: "Dessiner et acheter des armes" },
  { kind: "merchant", label: "Marchand", icon: "🛍", hint: "Acheter des potions, revendre des objets" },
  { kind: "farm", label: "Ferme", icon: "🐾", hint: "Tes compagnons" },
  { kind: "quests", label: "Quêtes (quotidienne)", icon: "/icons/quest-permit.svg", hint: "Accepter la quête du jour" },
  { kind: "step_editor", label: "Éditeur d'étapes", icon: "📜", hint: "Écrire des étapes d'expédition" },
];

export function hotspotInfo(kind: string) {
  const base = kind.split(":")[0];
  return HOTSPOT_KINDS.find((k) => k.kind === base) ?? { kind, label: kind, icon: "★", hint: "" };
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

// Lieux « multiples » (tas d'or) : chaque exemplaire a un kind unique « gold:1 », « gold:2 »…
export async function addMultiHotspot(sceneId: string, base: string, position: Point, existingKinds: string[]): Promise<SceneHotspot> {
  let n = 1;
  while (existingKinds.includes(`${base}:${n}`)) n += 1;
  return placeSceneHotspot(sceneId, `${base}:${n}`, position);
}

export async function claimDailyGold(hotspotId: string): Promise<number> {
  const { data, error } = await scenesClient.rpc("daily_gold_claim", { p_hotspot_id: hotspotId });
  window.dispatchEvent(new Event("obliq-gold-claimed"));
  if (error) throw error;
  return Number(data ?? 0);
}

// Tas d'or déjà ramassés AUJOURD'HUI par ce joueur (ils disparaissent pour lui seul jusqu'au lendemain, jour UTC comme la base).
export function useClaimedGoldToday(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const uid = await ensureUserId();
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await scenesClient.from("gold_claims").select("hotspot_id, day").eq("user_id", uid).eq("day", today);
        if (alive) setIds(new Set((data ?? []).map((r: any) => r.hotspot_id as string)));
      } catch {
        /* SQL 032 absent : rien n'est masqué */
      }
      // Prochain minuit UTC : les tas réapparaissent.
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 5);
      if (alive) timer = window.setTimeout(() => void load(), Math.max(1000, next - now.getTime()));
    };
    const reload = () => {
      window.clearTimeout(timer);
      void load();
    };
    void load();
    window.addEventListener("obliq-gold-claimed", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener("obliq-gold-claimed", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, []);
  return ids;
}

export async function deleteSceneHotspot(id: string): Promise<void> {
  const { error } = await scenesClient.from("scene_hotspots").delete().eq("id", id);
  if (error) throw error;
}
