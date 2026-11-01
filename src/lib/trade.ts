// Échange entre joueurs façon WoW (SQL 066). Tout passe par des fonctions serveur ; le direct vient de Realtime (gratuit, sans polling).
import { scenesClient } from "./scenes-supabase";
import type { PresenceChannel } from "./scenes-supabase";

export type TradeStatus = "pending" | "open" | "completed" | "cancelled" | "declined";
export type TradeRow = {
  id: string; user_a: string; user_b: string; char_a: string; char_b: string; name_a: string; name_b: string;
  status: TradeStatus; gold_a: number; gold_b: number; accepted_a: boolean; accepted_b: boolean; note: string | null;
};
export type TradeItem = {
  id: string; trade_id: string; user_id: string; kind: "weapon" | "companion" | "consumable";
  ref_id: string | null; ckind: string | null; qty: number; label: string; image_url: string | null; rarity: string | null; info: string | null;
};
export type TradeState = { trade: TradeRow; me: "a" | "b"; items: TradeItem[] };

const rpc = async <T,>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await scenesClient.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const tradeRequest = (targetCharacterId: string) => rpc<string>("trade_request", { p_target_character_id: targetCharacterId });
export const tradeRespond = (id: string, accept: boolean) => rpc<void>("trade_respond", { p_trade_id: id, p_accept: accept });
export const tradeCancel = (id: string) => rpc<void>("trade_cancel", { p_trade_id: id });
export const tradeSetGold = (id: string, gold: number) => rpc<void>("trade_set_gold", { p_trade_id: id, p_gold: gold });
export const tradeAddItem = (id: string, kind: TradeItem["kind"], ref: string | null, ckind: string | null = null, qty = 1) =>
  rpc<void>("trade_add_item", { p_trade_id: id, p_kind: kind, p_ref: ref, p_ckind: ckind, p_qty: qty });
export const tradeRemoveItem = (id: string, itemId: string) => rpc<void>("trade_remove_item", { p_trade_id: id, p_item_id: itemId });
export const tradeAccept = (id: string, accepted: boolean) => rpc<{ ok: boolean; done?: boolean; reason?: string }>("trade_accept", { p_trade_id: id, p_accepted: accepted });
export const fetchTradeState = (id: string | null) => rpc<TradeState | null>("trade_state", { p_trade_id: id });

/** Écoute en direct les échanges dont je suis l'un des deux joueurs (toute modification d'offre met la ligne « trades » à jour). */
export function subscribeToTrades(userId: string, onChange: () => void): PresenceChannel {
  return scenesClient
    .channel(`trades:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "trades", filter: `user_a=eq.${userId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "trades", filter: `user_b=eq.${userId}` }, () => onChange())
    .subscribe();
}
