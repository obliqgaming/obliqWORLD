// Tableau « cherche un groupe » (SQL 070). Direct gratuit via Realtime : pas de polling.
import { scenesClient } from "./scenes-supabase";
import type { PresenceChannel } from "./scenes-supabase";

export type GroupAd = {
  id: string; user_id: string; character_id: string; name: string; level: number | null; class_name: string | null;
  text: string; route: "court" | "long" | null; meet_at: string | null; expires_at: string; created_at: string;
};
export type GroupAdSignup = { ad_id: string; user_id: string; character_id: string; name: string; level: number | null; class_name: string | null };
export type AdReminder = { ad_id: string; text: string; meet_at: string; author_name: string; mine: boolean };

export async function fetchGroupAds(): Promise<{ ads: GroupAd[]; signups: GroupAdSignup[] }> {
  const [a, s] = await Promise.all([
    scenesClient.from("group_ads").select("*").order("created_at", { ascending: false }).limit(60),
    scenesClient.from("group_ad_signups").select("ad_id, user_id, character_id, name, level, class_name").limit(500),
  ]);
  if (a.error) throw a.error;
  const ads = (a.data ?? []) as GroupAd[];
  const ids = new Set(ads.map((x) => x.id));
  return { ads, signups: ((s.data ?? []) as GroupAdSignup[]).filter((x) => ids.has(x.ad_id)) };
}

const rpc = async (fn: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await scenesClient.rpc(fn, args);
  if (error) throw error;
  return data;
};
export const postGroupAd = (characterId: string, text: string, route: "court" | "long" | null, meetAt: string | null) =>
  rpc("group_ad_post", { p_character_id: characterId, p_text: text, p_route: route, p_meet_at: meetAt });
export const deleteGroupAd = () => rpc("group_ad_delete");
export const signupGroupAd = (adId: string, characterId: string) => rpc("group_ad_signup", { p_ad_id: adId, p_character_id: characterId });
export const unsignupGroupAd = (adId: string) => rpc("group_ad_unsignup", { p_ad_id: adId });
export async function fetchAdReminders(): Promise<AdReminder[]> {
  return ((await rpc("group_ad_reminders")) ?? []) as AdReminder[];
}

export function subscribeGroupAds(onChange: () => void): PresenceChannel {
  return scenesClient
    .channel(`group-ads:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "group_ads" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "group_ad_signups" }, () => onChange())
    .subscribe();
}

export const meetLabel = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.toDateString() === new Date().toDateString() ? "aujourd'hui" : d.toLocaleDateString("fr-FR", { weekday: "long" });
  return `${day} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

// « Vus aujourd'hui » (SQL 074).
export type SeenPlayer = { character_id: string; name: string; level: number | null; class_name: string | null; last_seen_at: string; is_me: boolean };
export const touchSeen = (characterId: string) => rpc("seen_touch", { p_character_id: characterId });
export async function fetchSeenToday(): Promise<SeenPlayer[]> {
  return ((await rpc("seen_today_list")) ?? []) as SeenPlayer[];
}
export const seenLabel = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 5) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  return `à ${new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

// Joueurs croisés dans un lieu : on les ajoute à « Vus aujourd'hui » (une seule fois par joueur et par session).
export async function touchSeenPeers(characterIds: string[]) {
  if (characterIds.length === 0) return;
  const { error } = await scenesClient.rpc("seen_touch_peers", { p_character_ids: characterIds });
  if (error) throw error;
}
