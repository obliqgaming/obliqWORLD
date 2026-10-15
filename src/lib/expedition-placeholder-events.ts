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
    typeLabel: "Boss final",
    risk: "eleve",
    situation: "Au bout du sentier, quelque chose d'immense vous attendait depuis longtemps.",
    choices: [
      { key: "attaque", label: "Attaque", outcome: { text: "Vous frappez, le colosse riposte de toute sa masse.", pvLoss: 8 } },
      { key: "competence", label: "Compétence", outcome: { text: "Votre compétence l'ébranle, mais il se relève.", pvLoss: 6 } },
      { key: "defense", label: "Défense", outcome: { text: "Vous tenez bon sous les coups, sans gagner de terrain.", pvLoss: 4 } },
    ],
  },
];
