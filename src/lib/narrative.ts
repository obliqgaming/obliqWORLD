// Étapes narratives (rencontres écrites par la communauté, SQL 022).
import { scenesClient, type ExpeditionStep } from "./scenes-supabase";

export type NarrativeStepType = "classique" | "danger_imminent" | "epreuve";
export type NarrativeRisk = "faible" | "moyen" | "eleve";

export type NarrativeEvent = {
  id: string;
  step_type: NarrativeStepType;
  risk_level: NarrativeRisk;
  damage_mode: "partage" | "isole";
  situation_text: string | null;
};

export type NarrativeStep = ExpeditionStep & { step_type?: string | null; community_event_id?: string | null };

// Ouvre (ou retrouve) l'étape narrative. Renvoie null s'il n'existe aucune rencontre approuvée :
// le client retombe alors sur l'ancienne étape d'exemple.
export async function openNarrativeStep(expeditionId: string, stepIndex: number): Promise<NarrativeStep | null> {
  const { data, error } = await scenesClient.rpc("expedition_open_narrative_step", {
    p_expedition_id: expeditionId,
    p_step_index: stepIndex,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as NarrativeStep | null;
  return row && row.id && row.community_event_id ? row : null;
}

export async function fetchNarrativeEvent(eventId: string): Promise<NarrativeEvent | null> {
  const { data, error } = await scenesClient
    .from("community_events")
    .select("id, step_type, risk_level, damage_mode, situation_text")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  return (data as NarrativeEvent | null) ?? null;
}
