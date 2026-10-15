// Événements PLACEHOLDER pour tester le déroulé d'expédition (2026-10-15).
// Un par catégorie, textes provisoires : ils seront remplacés par des
// événements créés dans un éditeur (type d'événement + niveau de risque, à la
// manière du « booster opener » de Trust & Greed), avec la direction
// artistique propre à ObliqWorld. Rien ici n'est repris de Trust & Greed.
export type PlaceholderChoice = { key: string; label: string };

export type PlaceholderEvent = {
  id: string;
  kind: "event" | "combat";
  typeLabel: string;
  /** Le risque est celui de l'ÉVÉNEMENT (pas de chaque choix). */
  risk: "faible" | "moyen" | "eleve";
  situation: string;
  choices: PlaceholderChoice[];
};

export const PLACEHOLDER_EVENTS: PlaceholderEvent[] = [
  {
    id: "passage",
    risk: "faible",
    kind: "event",
    typeLabel: "Passage",
    situation: "Le sentier se resserre entre deux rochers couverts de mousse. Un tronc couché barre la moitié de la voie.",
    choices: [
      { key: "escalader", label: "Escalader le tronc" },
      { key: "forcer", label: "Passer en force" },
      { key: "detour", label: "Tenter un détour" },
    ],
  },
  {
    id: "rencontre",
    risk: "moyen",
    kind: "event",
    typeLabel: "Rencontre",
    situation: "Un voyageur est assis près d'un feu mourant. Il vous fait signe d'approcher sans dire un mot.",
    choices: [
      { key: "partager", label: "Partager son feu" },
      { key: "questionner", label: "Le questionner" },
      { key: "fouiller", label: "Fouiller ses affaires" },
    ],
  },
  {
    id: "decouverte",
    risk: "faible",
    kind: "event",
    typeLabel: "Découverte",
    situation: "Quelque chose brille au pied d'un arbre, à demi enfoui dans les racines.",
    choices: [
      { key: "observer", label: "L'observer d'abord" },
      { key: "deterrer", label: "Le déterrer" },
    ],
  },
  {
    id: "traces",
    risk: "moyen",
    kind: "event",
    typeLabel: "Traces",
    situation: "Des empreintes fraîches traversent la boue, puis s'arrêtent net au milieu du chemin.",
    choices: [
      { key: "attendre", label: "Se cacher et attendre" },
      { key: "suivre", label: "Suivre les traces" },
    ],
  },
  {
    id: "combat",
    risk: "eleve",
    kind: "combat",
    typeLabel: "Confrontation",
    situation: "Une silhouette se dresse devant vous.",
    choices: [],
  },
];
