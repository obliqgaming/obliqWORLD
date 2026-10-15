// Événements PLACEHOLDER pour tester le déroulé d'expédition (2026-10-15).
// Un par catégorie, textes provisoires : ils seront remplacés par des
// événements créés dans un éditeur (type d'événement + niveau de risque, à la
// manière du « booster opener » de Trust & Greed), avec la direction
// artistique propre à ObliqWorld. Rien ici n'est repris de Trust & Greed.
export type PlaceholderChoice = { key: string; label: string; risk: "faible" | "moyen" | "eleve" };

export type PlaceholderEvent = {
  id: string;
  kind: "event" | "combat";
  typeLabel: string;
  situation: string;
  choices: PlaceholderChoice[];
};

export const PLACEHOLDER_EVENTS: PlaceholderEvent[] = [
  {
    id: "passage",
    kind: "event",
    typeLabel: "Passage",
    situation: "Le sentier se resserre entre deux rochers couverts de mousse. Un tronc couché barre la moitié de la voie.",
    choices: [
      { key: "escalader", label: "Escalader le tronc", risk: "faible" },
      { key: "forcer", label: "Passer en force", risk: "moyen" },
      { key: "detour", label: "Tenter un détour", risk: "eleve" },
    ],
  },
  {
    id: "rencontre",
    kind: "event",
    typeLabel: "Rencontre",
    situation: "Un voyageur est assis près d'un feu mourant. Il vous fait signe d'approcher sans dire un mot.",
    choices: [
      { key: "partager", label: "Partager son feu", risk: "faible" },
      { key: "questionner", label: "Le questionner", risk: "moyen" },
      { key: "fouiller", label: "Fouiller ses affaires", risk: "eleve" },
    ],
  },
  {
    id: "decouverte",
    kind: "event",
    typeLabel: "Découverte",
    situation: "Quelque chose brille au pied d'un arbre, à demi enfoui dans les racines.",
    choices: [
      { key: "observer", label: "L'observer d'abord", risk: "faible" },
      { key: "deterrer", label: "Le déterrer", risk: "moyen" },
    ],
  },
  {
    id: "traces",
    kind: "event",
    typeLabel: "Traces",
    situation: "Des empreintes fraîches traversent la boue, puis s'arrêtent net au milieu du chemin.",
    choices: [
      { key: "attendre", label: "Se cacher et attendre", risk: "faible" },
      { key: "suivre", label: "Suivre les traces", risk: "moyen" },
    ],
  },
  {
    id: "combat",
    kind: "combat",
    typeLabel: "Confrontation",
    situation: "Une silhouette se dresse devant vous.",
    choices: [],
  },
];
