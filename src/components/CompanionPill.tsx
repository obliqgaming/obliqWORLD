// Pastille de rareté d'un COMPAGNON, identique partout (ferme, boutique, fiches, échange, inspection) : rareté au masculin, ou « Prototype ».
import { RARITY_INFO, type Rarity } from "../lib/weapons";
import { COMPANION_RARITY_LABEL, companionRarity, type Tier } from "../lib/companions";

export function CompanionPill({ rarity, tier, prototype }: { rarity?: Rarity | null | undefined; tier?: Tier | null | undefined; prototype?: boolean | null | undefined }) {
  const r = companionRarity({ rarity, tier });
  const label = prototype ? "Prototype" : COMPANION_RARITY_LABEL[r];
  const color = prototype ? "#f3f4f6" : RARITY_INFO[r].color;
  return <span className="inline-block rounded px-1.5 text-[10px] font-extrabold leading-[15px]" style={{ background: color, color: "#2b1406", border: "1px solid rgba(43,20,6,.35)" }}>{label}</span>;
}
