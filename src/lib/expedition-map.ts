// Carte d'expédition (SQL 099 / 102) : accès serveur pour le choix du chemin.
// Tout est décidé par des fonctions serveur ; le navigateur affiche, vote et demande la décision quand le temps est écoulé.
import { scenesClient } from "./scenes-supabase";

export type MapNodeType = "combat" | "elite" | "rencontre" | "coffre" | "coffre_piege" | "clairiere" | "sortie" | "boss" | "camp" | "tripot" | "marchand";

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
  // SQL 175 : le vote du nœud suivant s'ouvre quand tous les joueurs vivants ont fait « OK » sur le résultat précédent.
  ack?: { ready: boolean; done: number; total: number };
};

export const MAP_NODE_INFO: Record<MapNodeType, { icon: string; label: string; text: string; color: string }> = {
  combat: { icon: "⚔️", label: "Combat", text: "Des monstres barrent la route.", color: "#9a3412" },
  elite: { icon: "💀", label: "Élite", text: "Un monstre redoutable : plus dur, plus de butin.", color: "#7f1d1d" },
  rencontre: { icon: "📜", label: "Rencontre", text: "Un événement : le sort dépend du groupe et de la chance.", color: "#1d4ed8" },
  coffre: { icon: "🧰", label: "Coffre", text: "Un coffre à ouvrir… attention, il pourrait être piégé !", color: "#a16207" },
  coffre_piege: { icon: "🧨", label: "Coffre piégé", text: "Flouz et potion... mais le piège peut blesser quelqu'un.", color: "#b45309" },
  clairiere: { icon: "🌿", label: "Clairière", text: "Une pause : chacun reprend un peu de peps et de jus.", color: "#15803d" },
  camp: { icon: "🔥", label: "Feu de camp", text: "On s'arrête : chacun peut manger pour reprendre des forces, puis le groupe repart.", color: "#c2410c" },
  tripot: { icon: "🎲", label: "Tripot", text: "Un tripot clandestin : mise, si tu veux, des flouz de ta bourse.", color: "#7c2d12" },
  marchand: { icon: "🛒", label: "Marchand itinérant", text: "Boursejoufflue vend ses marchandises (prix doublés).", color: "#0f766e" },
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

// SQL 175 : chaque « OK » sur un résultat est enregistré côté serveur. Les échecs sont silencieux (on réessaie un peu) :
// au pire le serveur ouvre la suite après son délai de sécurité.
export async function ackOutcome(expeditionId: string, stepIndex: number): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const { error } = await scenesClient.rpc("expedition_ack_outcome", { p_expedition_id: expeditionId, p_step_index: stepIndex });
    if (!error) return;
    await new Promise((r) => window.setTimeout(r, 2000 * (i + 1)));
  }
}

export async function hasAckedOutcome(expeditionId: string, stepIndex: number, characterId: string): Promise<boolean> {
  const { data, error } = await scenesClient
    .from("expedition_outcome_acks")
    .select("step_index")
    .eq("expedition_id", expeditionId)
    .eq("step_index", stepIndex)
    .eq("character_id", characterId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
