// Carte d'expédition (SQL 099 / 102) : accès serveur pour le choix du chemin.
// Tout est décidé par des fonctions serveur ; le navigateur affiche, vote et demande la décision quand le temps est écoulé.
import { scenesClient } from "./scenes-supabase";

export type MapNodeType = "combat" | "elite" | "rencontre" | "coffre" | "coffre_piege" | "clairiere" | "sortie" | "boss";

export type MapState = {
  enabled: boolean;
  layer?: number;
  layers_total?: number;
  nodes?: { slot: number; type: MapNodeType }[];
  votes?: { c: string; slot: number }[];
  deadline?: string | null;
  server_now?: string;
  chosen_slot?: number | null;
  tiebreaker?: string | null;
  alive?: string[];
  boucan?: number;
  threshold?: number;
  heal_pct?: number;
  chef_pending?: boolean;
  chef_done?: boolean;
  preview?: { layer: number; nodes: MapNodeType[] }[];
};

export const MAP_NODE_INFO: Record<MapNodeType, { icon: string; label: string; text: string; color: string }> = {
  combat: { icon: "⚔️", label: "Combat", text: "Des monstres barrent la route.", color: "#9a3412" },
  elite: { icon: "💀", label: "Élite", text: "Un monstre redoutable : plus dur, plus de butin.", color: "#7f1d1d" },
  rencontre: { icon: "📜", label: "Rencontre", text: "Un événement : le sort dépend du groupe et de la chance.", color: "#1d4ed8" },
  coffre: { icon: "🧰", label: "Coffre", text: "Un coffre à ouvrir… qui sait ce qu'il y a dedans ?", color: "#a16207" },
  coffre_piege: { icon: "🧨", label: "Coffre piégé", text: "Flouz et potion... mais le piège peut blesser quelqu'un.", color: "#b45309" },
  clairiere: { icon: "🌿", label: "Clairière", text: "Une pause : chacun reprend un peu de peps et de jus.", color: "#15803d" },
  sortie: { icon: "🚪", label: "Sortie", text: "Rentrer au village avec le butin.", color: "#475569" },
  boss: { icon: "👑", label: "Boss final", text: "Le combat final.", color: "#6d28d9" },
};

export async function getExpeditionMap(expeditionId: string, layer: number, open: boolean): Promise<MapState> {
  const { data, error } = await scenesClient.rpc("expedition_map_get", { p_expedition_id: expeditionId, p_layer: layer, p_open: open });
  if (error) throw error;
  return data as MapState;
}

export async function voteExpeditionMap(expeditionId: string, layer: number, slot: number): Promise<void> {
  const { error } = await scenesClient.rpc("expedition_map_vote", { p_expedition_id: expeditionId, p_layer: layer, p_slot: slot });
  if (error) throw error;
}

export async function decideExpeditionMap(expeditionId: string, layer: number): Promise<void> {
  const { error } = await scenesClient.rpc("expedition_map_decide", { p_expedition_id: expeditionId, p_layer: layer });
  if (error) throw error;
}
