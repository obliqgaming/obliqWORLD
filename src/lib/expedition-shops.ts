// Tripot et Marchand itinérant du Grand Safari (SQL 156) : tout est décidé par le serveur.
import { scenesClient } from "./scenes-supabase";

export type TripotOutcome = "perdu" | "rendu" | "triple" | "passe";
export type TripotState = {
  me: string | null;
  gold: number;
  lose_max: number;
  refund_max: number;
  mult: number;
  players: { c: string; n: string; bet: number; roll: number | null; outcome: TripotOutcome; delta: number }[];
  waiting: string[];
};

export async function getTripot(expeditionId: string): Promise<TripotState> {
  const { data, error } = await scenesClient.rpc("tripot_get", { p_expedition_id: expeditionId });
  if (error) throw error;
  return data as TripotState;
}
export async function playTripot(expeditionId: string, bet: number): Promise<TripotState> {
  const { data, error } = await scenesClient.rpc("tripot_play", { p_expedition_id: expeditionId, p_bet: bet });
  if (error) throw error;
  return data as TripotState;
}

export type MerchantOffer = {
  kind: string;
  price: number;
  stock: number;
  mine: number;
  weapon: { id: string; name: string; rarity: string; type: string; image: string | null } | null;
};
export type MerchantState = { gold: number; max_per_player: number; offers: MerchantOffer[] };

export async function getMerchant(expeditionId: string): Promise<MerchantState> {
  const { data, error } = await scenesClient.rpc("merchant_get", { p_expedition_id: expeditionId });
  if (error) throw error;
  return data as MerchantState;
}
export async function buyFromMerchant(expeditionId: string, kind: string): Promise<MerchantState> {
  const { data, error } = await scenesClient.rpc("merchant_buy_expedition", { p_expedition_id: expeditionId, p_kind: kind });
  if (error) throw error;
  return data as MerchantState;
}
