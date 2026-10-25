// Accès au système de jeu côté serveur : PV/PM par expédition, combat, pouvoirs,
// choix de l'axe, issue des événements (SQL 006 à 009). Tout est écrit par des
// fonctions serveur : le navigateur ne fait que lire et envoyer ses choix.
import { scenesClient, type PresenceChannel } from "./scenes-supabase";

// ---------- Données de réglage (lecture seule) ----------
export type GameAxis = {
  axis_key: string;
  family: "melee" | "magie";
  name: string;
  base_attack_name: string;
  pv: number;
  pm: number;
  force: number;
  defense: number;
  speed: number;
};

export type GamePower = {
  power_key: string;
  kind: "common" | "axis" | "upgrade";
  family: "melee" | "magie" | null;
  axis_key: string | null;
  slot: number | null;
  unlock_level: number;
  name: string;
  description: string;
  cost_pm: number;
  recharge: number | null;
  params: Record<string, unknown> | null;
};

let axesCache: GameAxis[] | null = null;
let powersCache: GamePower[] | null = null;

export async function fetchGameAxes(): Promise<GameAxis[]> {
  if (axesCache) return axesCache;
  const { data, error } = await scenesClient.from("game_axes").select("*");
  if (error) throw error;
  axesCache = (data ?? []) as GameAxis[];
  return axesCache;
}

export async function fetchGamePowers(): Promise<GamePower[]> {
  if (powersCache) return powersCache;
  const { data, error } = await scenesClient.from("game_powers").select("*").order("unlock_level");
  if (error) throw error;
  powersCache = (data ?? []) as GamePower[];
  return powersCache;
}

// ---------- Mon personnage : niveau, axe ----------
export type MyBuild = {
  character_id: string;
  family: "melee" | "magie";
  level: number;
  axis_key: string | null;
  axis_choice_pending: boolean;
};

export async function fetchMyBuild(characterId: string): Promise<MyBuild | null> {
  const { data, error } = await scenesClient
    .from("character_build")
    .select("character_id, family, level, axis_key, axis_choice_pending")
    .eq("character_id", characterId)
    .maybeSingle();
  if (error) throw error;
  return (data as MyBuild | null) ?? null;
}

export async function chooseAxis(characterId: string, axisKey: string): Promise<void> {
  const { error } = await scenesClient.rpc("character_choose_axis", {
    p_character_id: characterId,
    p_axis_key: axisKey,
  });
  if (error) throw error;
}

// Pouvoirs disponibles pour un personnage (communs à sa famille + ceux de son axe).
export function powersForBuild(build: MyBuild, powers: GamePower[]): GamePower[] {
  return powers.filter(
    (p) =>
      p.unlock_level <= build.level &&
      ((p.kind === "common" && p.family === build.family) || (p.kind === "axis" && p.axis_key === build.axis_key)),
  );
}

// ---------- PV / PM par expédition ----------
export type RunStat = {
  character_id: string;
  pv_current: number | null;
  pv_max: number | null;
  pm_current: number | null;
  pm_max: number | null;
  left_expedition_at: string | null;
};

export async function fetchRunStats(expeditionId: string): Promise<RunStat[]> {
  const { data, error } = await scenesClient
    .from("expedition_participants")
    .select("character_id, pv_current, pv_max, pm_current, pm_max, left_expedition_at")
    .eq("expedition_id", expeditionId);
  if (error) throw error;
  return (data ?? []) as RunStat[];
}

// ---------- Issue d'une étape (texte, PV, récompense) ----------
export type StepOutcome = {
  step_index: number;
  event_key: string | null;
  winning_choice_key: string | null;
  outcome_text: string | null;
  outcome_pv_loss_pct: number | null;
  outcome_reward: string | null;
  outcome_triggers_combat: boolean;
  outcome_xp: number | null;
  resolved_at: string | null;
  id?: string;
  step_type?: string | null;
  step_outcome?: string | null;
  outcome_data?: { chance?: number; target?: string; hit?: { c: string; n: number }[]; potion?: boolean } | null;
};

export async function fetchStepOutcome(expeditionId: string, stepIndex: number): Promise<StepOutcome | null> {
  const { data, error } = await scenesClient
    .from("expedition_steps")
    .select("id, step_index, event_key, winning_choice_key, outcome_text, outcome_pv_loss_pct, outcome_reward, outcome_triggers_combat, outcome_xp, resolved_at, step_type, step_outcome, outcome_data")
    .eq("expedition_id", expeditionId)
    .eq("step_index", stepIndex)
    .maybeSingle();
  if (error) throw error;
  return (data as StepOutcome | null) ?? null;
}

// ---------- Combat ----------
export type Combat = {
  id: string;
  expedition_id: string;
  status: "active" | "victory" | "party_wipe";
  is_boss: boolean;
  group_size: number;
  turn: number;
  turn_deadline: string;
  aoe_warning: boolean;
  created_at: string;
  xp_reward: number;
  gold_reward?: number;
};

export type CombatEnemyRow = {
  id: string;
  slot: number;
  name: string;
  axis_key: string;
  role: "normal" | "chef" | "boss" | "add";
  pv_current: number;
  pv_max: number;
  announced_target_id: string | null;
  force: number;
  defense: number;
  weapon_id?: string | null;
  visual_asset_id?: string | null;
  status: Record<string, unknown>;
};

export type CombatPlayerRow = {
  character_id: string;
  cooldowns: Record<string, number>;
  status: Record<string, unknown>;
  last_submitted_turn: number;
};

// ev : événement structuré (SQL 010) pour rejouer le tour action par action.
//  t  = dmg | heal | info | summon
//  sk/s = qui agit (p = joueur, e = ennemi, n = personne), dk/d = qui reçoit
//  n  = montant, pw = pouvoir utilisé (base, aoe, poison, monstre, …)
export type CombatEv = {
  t: "dmg" | "heal" | "info" | "summon";
  sk?: "p" | "e" | "n";
  s?: string;
  dk?: "p" | "e";
  d?: string;
  n?: number;
  pw?: string;
};
export type CombatLogRow = { id: number; turn: number; text: string; ev: CombatEv | null };

export type CombatSnapshot = {
  combat: Combat;
  enemies: CombatEnemyRow[];
  players: CombatPlayerRow[];
  log: CombatLogRow[];
};

// Le combat en cours de l'expédition, ou le dernier terminé si on veut son résultat.
export async function fetchLatestCombat(expeditionId: string): Promise<Combat | null> {
  const { data, error } = await scenesClient
    .from("combats")
    .select("*")
    .eq("expedition_id", expeditionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Combat | null) ?? null;
}

export async function fetchCombatSnapshot(combatId: string): Promise<CombatSnapshot | null> {
  const [c, e, p, l] = await Promise.all([
    scenesClient.from("combats").select("*").eq("id", combatId).maybeSingle(),
    scenesClient.from("combat_enemies").select("*").eq("combat_id", combatId).order("slot"),
    scenesClient.from("combat_participants").select("*").eq("combat_id", combatId),
    scenesClient.from("combat_log").select("id, turn, text, ev").eq("combat_id", combatId).order("id").limit(200),
  ]);
  if (c.error) throw c.error;
  if (e.error) throw e.error;
  if (p.error) throw p.error;
  if (l.error) throw l.error;
  if (!c.data) return null;
  return {
    combat: c.data as Combat,
    enemies: (e.data ?? []) as CombatEnemyRow[],
    players: (p.data ?? []) as CombatPlayerRow[],
    log: (l.data ?? []) as CombatLogRow[],
  };
}

export async function startCombat(expeditionId: string, isBoss: boolean, mini = false): Promise<Combat> {
  const { data, error } = await scenesClient.rpc("combat_start", {
    p_expedition_id: expeditionId,
    p_is_boss: isBoss,
    p_mini: mini,
  });
  if (error) throw error;
  return data as Combat;
}

export async function submitCombatAction(
  combatId: string,
  characterId: string,
  powerKey: string | null,
  targetEnemyId: string | null,
  targetAllyId: string | null,
): Promise<void> {
  const { error } = await scenesClient.rpc("combat_submit_action", {
    p_combat_id: combatId,
    p_character_id: characterId,
    p_power_key: powerKey,
    p_target_enemy_id: targetEnemyId,
    p_target_ally_id: targetAllyId,
  });
  if (error) throw error;
}

// Résout le tour. « Pas encore choisi » n'est pas une vraie erreur : null.
export async function resolveCombatTurn(combatId: string): Promise<Combat | null> {
  const { data, error } = await scenesClient.rpc("combat_resolve_turn", { p_combat_id: combatId });
  if (error) {
    if (String(error.message).includes("pas encore choisi")) return null;
    throw error;
  }
  return data as Combat;
}

// Écoute en direct d'un combat : ennemis, joueurs, journal, tour.
export function subscribeToCombat(combatId: string, onChange: () => void): PresenceChannel {
  return scenesClient
    .channel(`combat:${combatId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "combats", filter: `id=eq.${combatId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "combat_enemies", filter: `combat_id=eq.${combatId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "combat_participants", filter: `combat_id=eq.${combatId}` }, () => onChange())
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "combat_log", filter: `combat_id=eq.${combatId}` }, () => onChange())
    .subscribe();
}

// Écoute des PV/PM du groupe pendant l'expédition.
export function subscribeToRunStats(expeditionId: string, onChange: () => void): PresenceChannel {
  return scenesClient
    .channel(`run-stats:${expeditionId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "expedition_participants", filter: `expedition_id=eq.${expeditionId}` },
      () => onChange(),
    )
    .subscribe();
}

// Images d'ennemis : les dessins des personnages existants, choisis de façon
// DÉTERMINISTE à partir de l'identifiant de l'ennemi, pour que tout le groupe
// voie le même monstre. (Provisoire, en attendant de vrais dessins d'ennemis.)
export type EnemyImage = { name: string; imageUrl: string; handAnchor: { x: number; y: number } | null };

export async function fetchEnemyImagePool(excludeCharacterIds: string[]): Promise<EnemyImage[]> {
  const { data, error } = await scenesClient
    .from("characters")
    .select("id, name, visual_assets(image_url, hand_anchor)")
    .order("id")
    .limit(100);
  if (error) throw error;
  return (data ?? [])
    .filter((r: any) => !excludeCharacterIds.includes(r.id) && r.visual_assets?.image_url)
    .map((r: any) => ({ name: r.name as string, imageUrl: r.visual_assets.image_url as string, handAnchor: (r.visual_assets.hand_anchor ?? null) as { x: number; y: number } | null }));
}

// Dessins des monstres choisis par le serveur (SQL 026) : id du dessin -> image et position de la main.
export async function fetchMonsterAssets(ids: string[]): Promise<Record<string, EnemyImage>> {
  const out: Record<string, EnemyImage> = {};
  if (ids.length === 0) return out;
  const { data, error } = await scenesClient.from("visual_assets").select("id, name, image_url, hand_anchor").in("id", ids);
  if (error) throw error;
  for (const r of (data ?? []) as any[]) {
    out[r.id] = { name: r.name as string, imageUrl: r.image_url as string, handAnchor: (r.hand_anchor ?? null) as { x: number; y: number } | null };
  }
  return out;
}

export function pickEnemyImage(
  pool: EnemyImage[],
  enemyId: string,
): string | null {
  if (pool.length === 0) return null;
  let h = 0;
  for (let i = 0; i < enemyId.length; i++) h = (h * 31 + enemyId.charCodeAt(i)) >>> 0;
  return pool[h % pool.length]!.imageUrl;
}

export function pickEnemyEntry(pool: EnemyImage[], enemyId: string): EnemyImage | null {
  const url = pickEnemyImage(pool, enemyId);
  return pool.find((p) => p.imageUrl === url) ?? null;
}

// Réglages utiles à l'affichage (échelle des PV pour prévoir les dégâts).
let settingsCache: Record<string, number> | null = null;
export async function fetchGameSettings(): Promise<Record<string, number>> {
  if (settingsCache) return settingsCache;
  const { data, error } = await scenesClient.from("game_settings").select("key, value");
  if (error) throw error;
  const o: Record<string, number> = {};
  for (const r of (data ?? []) as { key: string; value: number }[]) o[r.key] = Number(r.value);
  settingsCache = o;
  return o;
}
