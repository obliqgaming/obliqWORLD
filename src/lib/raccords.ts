// Phrases de raccord : courte ligne affichée avant une rencontre écrite sur la carte, selon le nœud d'où l'on vient.
// Modifiables dans /admin > Phrases (catégories « raccord: … ») ; sinon ces phrases d'origine sont utilisées.
import { phrasesFor } from "./phrases";

export const RACCORD_LINES: Record<string, string[]> = {
  debut: [
    "Le sentier s'enfonce dans la forêt, et quelque chose attire votre attention.",
    "À peine le portail franchi, vous remarquez du mouvement entre les arbres.",
    "La forêt est étrangement calme. Puis vous entendez quelqu'un approcher.",
  ],
  combat: [
    "Une fois le calme revenu, vous reprenez la route… et le chemin vous réserve une surprise.",
    "Le combat est fini, vous reprenez votre souffle. Mais quelque chose se présente déjà.",
    "Vous essuyez vos armes et repartez. Un peu plus loin, vous tombez sur quelque chose.",
  ],
  elite: [
    "Le monstre est enfin à terre, vos jambes tremblent encore. Et voilà qu'autre chose approche.",
    "Vous vous remettez à peine de cette bataille quand le chemin vous réserve autre chose.",
  ],
  coffre: [
    "Le coffre est vidé et le chemin continue. Un peu plus loin, vous croisez quelque chose.",
    "Vous refermez le coffre, plutôt contents, quand la forêt vous réserve une rencontre.",
  ],
  clairiere: [
    "Vous quittez la clairière reposés. Le sentier vous mène vers autre chose.",
    "Ragaillardis par la pause, vous reprenez la marche. Quelqu'un ou quelque chose vous attend.",
  ],
  rencontre: [
    "Vous poursuivez votre route, et le sentier réserve encore des surprises.",
    "À peine cette histoire réglée, une autre se présente.",
  ],
};

export function raccordCategory(prevType: string | null | undefined): string {
  const t = prevType === "coffre_piege" ? "coffre" : prevType === "boss" || prevType === "sortie" || !prevType ? "debut" : prevType;
  return RACCORD_LINES[t] ? t : "rencontre";
}

/** Une phrase, la même pour tous les joueurs d'une même étape (choisie d'après l'expédition et l'étape). */
export async function raccordFor(prevType: string | null | undefined, seed: string): Promise<string> {
  const cat = raccordCategory(prevType);
  const list = await phrasesFor(`raccord:${cat}`, RACCORD_LINES[cat] ?? []);
  if (!list.length) return "";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length]!;
}
