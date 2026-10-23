// Rencontres écrites par la communauté (SQL 022) : tirage payant, écriture, boîte aux lettres.
import { scenesClient, ensureUserId } from "./scenes-supabase";
import type { NarrativeRisk, NarrativeStepType } from "./narrative";

export type CommunityEvent = {
  id: string;
  author_user_id: string;
  step_type: NarrativeStepType;
  risk_level: NarrativeRisk;
  damage_mode: "partage" | "isole";
  status: "drafting" | "pending_review" | "approved" | "rejected";
  situation_text: string | null;
  success_text: string | null;
  failure_text: string | null;
  times_played: number;
  author_gold_pending: number;
  created_at: string;
};

const COLS = "id, author_user_id, step_type, risk_level, damage_mode, status, situation_text, success_text, failure_text, times_played, author_gold_pending, created_at";

export async function fetchMyEncounters(): Promise<CommunityEvent[]> {
  const uid = await ensureUserId();
  const { data, error } = await scenesClient.from("community_events").select(COLS).eq("author_user_id", uid).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CommunityEvent[];
}

export async function startEncounterDraw(): Promise<CommunityEvent> {
  const { data, error } = await scenesClient.rpc("community_event_start");
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as CommunityEvent;
}

export async function submitEncounter(id: string, situation: string, success: string, failure: string, damageMode: "partage" | "isole"): Promise<CommunityEvent> {
  const { data, error } = await scenesClient.rpc("community_event_submit", {
    p_event_id: id,
    p_situation: situation,
    p_success: success,
    p_failure: failure,
    p_damage_mode: damageMode,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as CommunityEvent;
}

export async function collectEncounterGold(): Promise<number> {
  const { data, error } = await scenesClient.rpc("community_event_collect");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchEncounterCost(): Promise<number> {
  const { data } = await scenesClient.from("game_settings").select("value").eq("key", "community_event_cost").maybeSingle();
  return Number((data as { value?: number } | null)?.value ?? 6);
}

// Admin
export async function adminFetchEncounters(): Promise<CommunityEvent[]> {
  const { data, error } = await scenesClient.from("community_events").select(COLS).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as CommunityEvent[];
}

export async function adminUpdateEncounter(e: { id: string; situation: string; success: string; failure: string; damageMode: string; risk: string; status: string }) {
  const { error } = await scenesClient.rpc("admin_community_event_update", {
    p_id: e.id,
    p_situation: e.situation,
    p_success: e.success,
    p_failure: e.failure,
    p_damage_mode: e.damageMode,
    p_risk: e.risk,
    p_status: e.status,
  });
  if (error) throw error;
}

export const TYPE_LABEL: Record<NarrativeStepType, string> = { classique: "Rencontre classique", danger_imminent: "Danger imminent", epreuve: "Épreuve dangereuse" };
export const RISK_LABEL: Record<NarrativeRisk, string> = { faible: "Risque faible", moyen: "Risque moyen", eleve: "Risque élevé" };
export const STATUS_LABEL: Record<CommunityEvent["status"], string> = { drafting: "À écrire", pending_review: "En attente", approved: "Approuvée", rejected: "Refusée" };

export const EXAMPLES: Record<NarrativeStepType, { situation: string; success: string; failure: string; hint: string }> = {
  classique: {
    hint: "Le groupe tombe sur quelque chose et choisit d'y aller (« En avant ! ») ou de rentrer (« Retraite ! »).",
    situation: "Un vieux pont de corde enjambe un ravin brumeux. Il grince, mais il tient peut-être encore.",
    success: "Le groupe traverse prudemment, planche après planche, et découvre un sentier caché de l'autre côté.",
    failure: "Une planche cède ! Tout le monde se rattrape de justesse, non sans quelques bleus.",
  },
  danger_imminent: {
    hint: "Un danger leur tombe dessus : le groupe désigne qui protéger en priorité (ou se sacrifie). Pas de retraite possible.",
    situation: "Un arbre mort se fend d'un coup sec : il va s'écrouler sur le groupe !",
    success: "Vous vous jetez de côté à temps. Le tronc s'écrase dans un fracas de poussière.",
    failure: "Le tronc frôle le groupe et en frappe de plein fouet certains d'entre vous.",
  },
  epreuve: {
    hint: "Une épreuve exige un volontaire : le groupe désigne qui s'y colle. Un seul est touché en cas d'échec.",
    situation: "Un esprit des bois barre le chemin : « Que l'un de vous traverse mes ronces, et le passage sera libre. »",
    success: "Le désigné traverse sans une égratignure. L'esprit s'incline et disparaît.",
    failure: "Les ronces déchirent le courageux avant de se refermer derrière lui.",
  },
};
