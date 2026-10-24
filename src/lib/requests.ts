// Signalements de bugs et demandes de suppression de compte (SQL 027).
import { scenesClient } from "./scenes-supabase";

export type PlayerRequest = {
  id: string;
  user_id: string;
  character_id: string | null;
  kind: "bug" | "deletion";
  message: string;
  expedition_id: string | null;
  step_id: string | null;
  status: "open" | "done";
  created_at: string;
};

export async function submitPlayerRequest(kind: "bug" | "deletion", message: string, expeditionId?: string | null, stepId?: string | null) {
  const { error } = await scenesClient.rpc("player_request_submit", {
    p_kind: kind,
    p_message: message,
    p_expedition_id: expeditionId ?? null,
    p_step_id: stepId ?? null,
  });
  if (error) throw error;
}

export async function adminFetchRequests(): Promise<PlayerRequest[]> {
  const { data, error } = await scenesClient.from("player_requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as PlayerRequest[];
}

export async function adminSetRequestStatus(id: string, status: "open" | "done") {
  const { error } = await scenesClient.rpc("admin_request_update", { p_id: id, p_status: status });
  if (error) throw error;
}
