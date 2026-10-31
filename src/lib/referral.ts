// Parrainage (SQL 062) : « Inviter un joueur ». Lien ?parrain=CODE ou code saisi ; seul le parrain reçoit une surprise.
import { scenesClient } from "./scenes-supabase";
import type { BoosterResult } from "./quests";

const KEY = "obliqworld-parrain";

/** À appeler au démarrage : garde le code du lien (?parrain=…) dans le navigateur (il survit à la connexion Twitch/Discord). */
export function capturePendingReferral(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const c = url.searchParams.get("parrain");
    if (c) {
      localStorage.setItem(KEY, c.trim().toUpperCase().slice(0, 12));
      url.searchParams.delete("parrain");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }
  } catch {
    /* ignoré */
  }
}

/** Envoie le code gardé (une seule tentative) ; sans effet s'il n'y en a pas. */
export async function claimPendingReferral(): Promise<void> {
  let code: string | null = null;
  try {
    code = localStorage.getItem(KEY);
  } catch {
    /* ignoré */
  }
  if (!code) return;
  try {
    await scenesClient.rpc("referral_claim", { p_code: code });
  } catch {
    /* ignoré : le parrainage ne doit jamais gêner la connexion */
  }
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignoré */
  }
}

export async function claimCode(code: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await scenesClient.rpc("referral_claim", { p_code: code });
  if (error) throw error;
  return data as { ok: boolean; reason?: string };
}

export type ReferralStats = { code: string; invited: number; rewarded: number; max: number };
export async function fetchReferralStats(): Promise<ReferralStats> {
  const { data, error } = await scenesClient.rpc("referral_my_stats");
  if (error) throw error;
  return data as ReferralStats;
}

export async function fetchReferralPending(): Promise<BoosterResult[]> {
  const { data, error } = await scenesClient.rpc("referral_pending");
  if (error) throw error;
  return (data ?? []) as BoosterResult[];
}

export async function markReferralSeen(): Promise<void> {
  await scenesClient.rpc("referral_mark_seen");
}
