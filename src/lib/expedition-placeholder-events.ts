// Événements PLACEHOLDER pour tester le déroulé d'expédition (2026-10-15/16).
// Ce sont des EXEMPLES avec conséquences, pas du vrai contenu : ils seront
// remplacés par des événements créés dans un éditeur (type d'événement + issue
// de chaque choix, à la manière du « booster opener » de Trust & Greed), avec
// la direction artistique propre à ObliqWorld. Rien ici n'est repris de Trust
// & Greed.
//
// Règles décidées par Lils :
//  - chaque choix a SON issue écrite (pas de hasard caché) ;
//  - la perte de PV varie selon l'événement et monte en crescendo jusqu'au
//    boss final ;
//  - à 0 PV le personnage meurt définitivement (permadeath).
//
// IMPORTANT : pour l'instant ces issues ne sont que des DONNÉES. Le moteur ne
// les applique pas encore (ni PV perdus, ni combat déclenché, ni récompense) ;
// ce sera la prochaine étape, une fois le vote partagé testé.
export type Outcome = {
  /** Texte affiché au groupe après le vote. */
  text: string;
  /** PV perdus par CHAQUE membre (négatif = soin). */
  pvLoss: number;
  /** L'issue déclenche une confrontation. */
  triggersCombat?: boolean;
  /** Récompense évoquée (texte libre ; aucun système de butin pour l'instant). */
  reward?: string;
};

export type PlaceholderChoice = { key: string; label: string; outcome: Outcome };

export type PlaceholderEvent = {
  id: string;
  kind: "event" | "combat";
  typeLabel: string;
  /** Conservé dans les données mais plus affiché (décision du 2026-10-15 :
   *  pas de niveaux de risque tant qu'aucun butin n'y est lié). */
  risk: "faible" | "moyen" | "eleve";
  situation: string;
  /** Pour un événement : les choix du vote. Pour un combat : une issue par action. */
  choices: PlaceholderChoice[];
};

export const PLACEHOLDER_EVENTS: PlaceholderEvent[] = [
  {
    id: "passage-1",
    kind: "event",
    typeLabel: "Passage",
    risk: "faible",
    situation: "Le sentier se resserre entre deux rochers couverts de mousse. Un tronc couché barre la moitié de la voie.",
    choices: [
      {
        key: "escalader",
        label: "Escalader le tronc",
        outcome: { text: "Vous vous écorchez les mains sur l'écorce, mais tout le monde passe.", pvLoss: 1 },
      },
      {
        key: "forcer",
        label: "Passer en force",
        outcome: {
          text: "Le tronc roule dans la pente en emportant quelques bottes, et dégage un champignon luisant.",
          pvLoss: 3,
          reward: "Un champignon luisant",
        },
      },
      {
        key: "detour",
        label: "Tenter un détour",
        outcome: { text: "Le détour est long, et quelque chose vous suit depuis les fourrés.", pvLoss: 0, triggersCombat: true },
      },
    ],
  },
  {
    id: "rencontre",
    kind: "event",
    typeLabel: "Rencontre",
    risk: "moyen",
    situation: "Un voyageur est assis près d'un feu mourant. Il vous fait signe d'approcher sans dire un mot.",
    choices: [
      {
        key: "partager",
        label: "Partager son feu",
        outcome: { text: "Il vous tend une tisane amère. Vous vous sentez mieux.", pvLoss: -2 },
      },
      {
        key: "questionner",
        label: "Le questionner",
        outcome: {
          text: "Il répond par énigmes, puis vous montre un raccourci. Une branche vous fouette au passage.",
          pvLoss: 2,
          reward: "Un raccourci",
        },
      },
      {
        key: "fouiller",
        label: "Fouiller ses affaires",
        outcome: { text: "Il ouvre les yeux d'un coup. Ce n'était pas un voyageur.", pvLoss: 4, triggersCombat: true },
      },
    ],
  },
  {
    id: "decouverte",
    kind: "event",
    typeLabel: "Découverte",
    risk: "faible",
    situation: "Quelque chose brille au pied d'un arbre, à demi enfoui dans les racines.",
    choices: [
      {
        key: "observer",
        label: "L'observer d'abord",
        outcome: { text: "Vous repérez des pointes cachées autour de l'objet et décidez de le laisser.", pvLoss: 0 },
      },
      {
        key: "deterrer",
        label: "Le déterrer",
        outcome: {
          text: "Des pointes jaillissent du sol. Vous récupérez un fragment étrange.",
          pvLoss: 3,
          reward: "Un fragment étrange",
        },
      },
    ],
  },
  {
    id: "traces",
    kind: "event",
    typeLabel: "Traces",
    risk: "moyen",
    situation: "Des empreintes fraîches traversent la boue, puis s'arrêtent net au milieu du chemin.",
    choices: [
      {
        key: "attendre",
        label: "Se cacher et attendre",
        outcome: { text: "Rien ne bouge. Vous perdez du temps et vous refroidissez dans l'humidité.", pvLoss: 2 },
      },
      {
        key: "suivre",
        label: "Suivre les traces",
        outcome: { text: "Elles mènent droit à une tanière occupée.", pvLoss: 4, triggersCombat: true },
      },
    ],
  },
  {
    id: "confrontation",
    kind: "combat",
    typeLabel: "Confrontation",
    risk: "moyen",
    situation: "Une silhouette se dresse devant vous.",
    choices: [
      { key: "attaque", label: "Attaque", outcome: { text: "Vous frappez fort, mais la riposte est rude.", pvLoss: 5 } },
      { key: "competence", label: "Compétence", outcome: { text: "Votre compétence porte, la riposte est moins dure.", pvLoss: 3 } },
      { key: "defense", label: "Défense", outcome: { text: "Vous encaissez presque tout, mais l'ennemi tient bon.", pvLoss: 2 } },
    ],
  },
  {
    id: "passage-2",
    kind: "event",
    typeLabel: "Passage",
    risk: "eleve",
    situation: "Une passerelle de cordes pend au-dessus d'un ravin. Elle craque dans le vent.",
    choices: [
      {
        key: "un-par-un",
        label: "Traverser un par un",
        outcome: { text: "Long et éprouvant, mais personne ne tombe.", pvLoss: 3 },
      },
      {
        key: "tous-ensemble",
        label: "Traverser tous ensemble",
        outcome: { text: "La corde cède à moitié. Vous vous rattrapez de justesse.", pvLoss: 6 },
      },
    ],
  },
  {
    id: "boss-final",
    kind: "combat",
    typeLabel: "Chef-Patron final",
    risk: "eleve",
    situation: "Au bout du sentier, quelque chose d'immense vous attendait depuis longtemps.",
    choices: [
      { key: "attaque", label: "Attaque", outcome: { text: "Vous frappez, le colosse riposte de toute sa masse.", pvLoss: 8 } },
      { key: "competence", label: "Compétence", outcome: { text: "Votre compétence l'ébranle, mais il se relève.", pvLoss: 6 } },
      { key: "defense", label: "Défense", outcome: { text: "Vous tenez bon sous les coups, sans gagner de terrain.", pvLoss: 4 } },
    ],
  },
];

// ---------- Seconde expédition (SQL 040) ----------
// Expédition « long » : 14 étapes. Les étapes « événement » reprennent les exemples ci-dessus (et, quand il en
// existe d'approuvées, les rencontres écrites par la communauté prennent leur place, comme dans la courte).
export type ExpeditionRoute = "court" | "long";

export const CAMP_EVENT: PlaceholderEvent = {
  id: "camp",
  kind: "event",
  typeLabel: "Feu de camp",
  risk: "faible",
  situation: "Un feu de camp brûle encore au creux d'une clairière, abandonné depuis peu. Le moment de souffler.",
  // Camp sûr (SQL 049) : un seul choix ; en attendant le vote, chacun utilise ses objets (voir CampPanel).
  choices: [{ key: "repartir", label: "Reprendre la route", outcome: { text: "Vous laissez le feu derrière vous et reprenez la route.", pvLoss: 0 } }],
};

export const MINI_BOSS_EVENT: PlaceholderEvent = {
  id: "mini-boss",
  kind: "combat",
  typeLabel: "Gardien",
  risk: "eleve",
  situation: "Un gardien colossal se dresse au milieu du chemin, entouré de sa meute.",
  choices: [
    { key: "attaque", label: "Attaque", outcome: { text: "Vous frappez fort, mais la riposte est rude.", pvLoss: 5 } },
    { key: "competence", label: "Compétence", outcome: { text: "Votre compétence porte, la riposte est moins dure.", pvLoss: 3 } },
    { key: "defense", label: "Défense", outcome: { text: "Vous encaissez presque tout, mais l'ennemi tient bon.", pvLoss: 2 } },
  ],
};

const byId = (id: string) => PLACEHOLDER_EVENTS.find((e) => e.id === id)!;
// 14 étapes : 0-2 événements, 3 combat, 4-5 événements, 6 MINI-BOSS, 7 FEU DE CAMP, 8 événement, 9 combat, 10 événement,
// 11 combat, 12 événement, 13 BOSS final. (5 combats dont mini-boss et boss, contre 2 dans la courte.)
export const LONG_ROUTE: PlaceholderEvent[] = [
  byId("passage-1"), byId("rencontre"), byId("decouverte"),
  byId("confrontation"),
  byId("traces"), byId("passage-2"),
  MINI_BOSS_EVENT,
  CAMP_EVENT,
  byId("rencontre"),
  byId("confrontation"),
  byId("decouverte"),
  byId("confrontation"),
  byId("traces"),
  byId("boss-final"),
];

export function routeEvents(route: ExpeditionRoute | null | undefined): PlaceholderEvent[] {
  return route === "long" ? LONG_ROUTE : PLACEHOLDER_EVENTS;
}

// ---------- Longueur et déroulé tirés au hasard (1er nov) ----------
// Chaque expédition tire sa longueur (courte 7-10, longue 14-20) et place ses combats, son camp et son
// mini-boss au hasard. Le boss final est TOUJOURS la dernière étape et c'est lui qui annonce la fin :
// les joueurs ne savent donc pas à l'avance combien d'étapes il reste. Le tirage est déterministe à
// partir de l'identifiant de l'expédition : tous les joueurs du groupe obtiennent le même déroulé,
// sans rien stocker en base (aucun SQL).
// Combats ordinaires : 1 en courte, 3 en longue, quelle que soit la longueur (les simulations du 1er nov montrent qu'un
// combat de plus — 2 en courte, 4 en longue — rend les groupes beaucoup trop mortels). Pour en ajouter à partir d'une
// certaine longueur, baisser extraCombatFromLength (ex. 19 = un combat de plus à partir de 19 étapes).
export const ROUTE_LENGTHS = {
  court: { min: 7, max: 10, combatsBase: 1, extraCombatFromLength: 99 },
  long: { min: 14, max: 20, combatsBase: 3, extraCombatFromLength: 99, miniBoss: [5, 8] as const, camp: [6, 12] as const },
} as const;

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const layoutCache = new Map<string, PlaceholderEvent[]>();

export function buildLayout(route: ExpeditionRoute, seed: string): PlaceholderEvent[] {
  const key = `${route}:${seed}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const rnd = mulberry32(hashSeed(key));
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const cfg = ROUTE_LENGTHS[route];
  const L = int(cfg.min, cfg.max);
  const slots: (PlaceholderEvent | null)[] = Array.from({ length: L }, () => null);
  slots[L - 1] = byId("boss-final");
  const free = (i: number) => i >= 0 && i < L - 1 && slots[i] === null;
  if (route === "long") {
    const lc = ROUTE_LENGTHS.long;
    slots[int(lc.miniBoss[0], lc.miniBoss[1])] = MINI_BOSS_EVENT;
    let c = int(lc.camp[0], lc.camp[1]);
    for (let g = 0; g < 20 && !free(c); g++) c = int(lc.camp[0], lc.camp[1]);
    if (free(c)) slots[c] = CAMP_EVENT;
  }
  // Combats ordinaires : jamais deux de suite, jamais juste avant le boss, ni collés au mini-boss.
  const nCombats = cfg.combatsBase + (L >= cfg.extraCombatFromLength ? 1 : 0);
  const combatEv = byId("confrontation");
  let placed = 0;
  for (let g = 0; g < 200 && placed < nCombats; g++) {
    const i = int(2, L - 3);
    const near = (j: number) => slots[j] !== null && slots[j] !== CAMP_EVENT;
    if (!free(i) || near(i - 1) || near(i + 1)) continue;
    slots[i] = combatEv;
    placed++;
  }
  // Complète avec les événements (les rencontres écrites par la communauté prennent leur place côté serveur).
  const pool = ["passage-1", "rencontre", "decouverte", "traces", "passage-2"];
  let k = 0;
  const out = slots.map((e) => e ?? byId(pool[k++ % pool.length]!));
  layoutCache.set(key, out);
  return out;
}

/** Longueur réelle d'une expédition (à ne PAS montrer aux joueurs avant la fin). */
export function expeditionLength(route: ExpeditionRoute | null | undefined, seed: string): number {
  const m = route === "long" ? undefined : mapRegistry.get(seed);
  if (m?.enabled && m.layers > 0) return m.layers;
  return buildLayout(route === "long" ? "long" : "court", seed).length;
}

// ---------- Carte d'expédition (lot 2) ----------
// Quand la carte est active (P'tite Balade, SQL 102), le déroulé ne vient plus du tirage ci-dessus mais du chemin choisi
// par le groupe à chaque pas. Ce registre garde, pour chaque expédition : si la carte est active (null = pas encore su),
// le nombre de pas, et le type de nœud choisi pour chaque pas.
type MapReg = { enabled: boolean | null; layers: number; chosen: Record<number, string> };
const mapRegistry = new Map<string, MapReg>();
export function mapRegGet(expeditionId: string | null | undefined): MapReg | undefined {
  return expeditionId ? mapRegistry.get(expeditionId) : undefined;
}
export function mapRegSet(expeditionId: string, patch: Partial<MapReg> & { choose?: [number, string] }): void {
  const cur = mapRegistry.get(expeditionId) ?? { enabled: null, layers: 0, chosen: {} };
  const next: MapReg = { enabled: patch.enabled ?? cur.enabled, layers: patch.layers ?? cur.layers, chosen: { ...cur.chosen } };
  if (patch.choose) next.chosen[patch.choose[0]] = patch.choose[1];
  mapRegistry.set(expeditionId, next);
}
/** Clé courte de l'état de la carte pour un pas (à mettre dans les dépendances des effets). */
export function mapRegKey(expeditionId: string | null | undefined, idx: number): string {
  const m = mapRegGet(expeditionId);
  if (!m || m.enabled === null) return "wait";
  if (!m.enabled) return "off";
  return m.chosen[idx] ?? "choice";
}
const MAP_WAIT_EVENT: PlaceholderEvent = { id: "map-wait", kind: "event", typeLabel: "…", risk: "faible", situation: "", choices: [] };
const MAP_CHOICE_EVENT: PlaceholderEvent = { id: "map-choice", kind: "event", typeLabel: "Embranchement", risk: "faible", situation: "", choices: [] };

export function eventForStep(route: ExpeditionRoute | null | undefined, idx: number, seed?: string | null): PlaceholderEvent {
  if (seed && route !== "long") {
    const m = mapRegistry.get(seed);
    if (!m || m.enabled === null) return MAP_WAIT_EVENT;
    if (m.enabled) {
      const t = m.chosen[idx];
      if (t === "combat" || t === "elite") return byId("confrontation");
      if (t === "boss") return byId("boss-final");
      if (t === "rencontre") return byId("rencontre");
      return MAP_CHOICE_EVENT;
    }
  }
  if (seed) {
    const list = buildLayout(route === "long" ? "long" : "court", seed);
    return list[Math.min(idx, list.length - 1)]!;
  }
  const list = routeEvents(route);
  return list[idx % list.length]!;
}
