// Fiches « parchemin » affichées dans le zoom d'une arme ou d'un compagnon.
import type { ReactNode } from "react";
import { RARITY_INFO, EFFECT_INFO, bonusText, weaponKindLabel, type Rarity, type WeaponType } from "../lib/weapons";
import { TIER_INFO, type Tier } from "../lib/companions";
import { AuthorLine } from "./AuthorLine";
import { WEAPON_FONT } from "./GameIcons";

function Pill({ label, color }: { label: string; color: string }) {
  return <span className="rounded px-1.5 py-px text-[11px] font-extrabold" style={{ background: color, color: "#2b1406" }}>{label}</span>;
}

function Title({ name }: { name: string }) {
  return <div className="text-lg font-bold leading-tight" style={{ fontFamily: WEAPON_FONT }}>{name}</div>;
}

export function WeaponSheet({ name, rarity, prototype, weaponType, bonus, effect, authorId, extra }: {
  name: string;
  rarity: Rarity;
  prototype?: boolean | undefined;
  weaponType?: WeaponType | undefined;
  bonus: number;
  effect?: string | null | undefined;
  authorId?: string | null | undefined;
  extra?: ReactNode;
}) {
  const eff = effect ? EFFECT_INFO[effect] : null;
  return (
    <div className="space-y-1 text-sm">
      <Title name={name} />
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill label={prototype ? "Prototype" : RARITY_INFO[rarity].label} color={prototype ? "#f3f4f6" : RARITY_INFO[rarity].color} />
        {weaponType && <span className="text-xs font-bold">{weaponKindLabel(weaponType)}</span>}
      </div>
      <div><span className="rounded bg-[#fde68a] px-1.5 py-px text-xs font-bold">{bonusText(bonus)}</span></div>
      {eff && <div className="text-xs"><b>{eff.name}</b> : <i>{eff.text}</i></div>}
      {extra}
      {authorId && <AuthorLine userId={authorId} label="Dessinée par" className="text-xs" />}
    </div>
  );
}

export function CompanionSheet({ name, rarity, tier, prototype, hp, hpMax, restLeft, authorId, extra }: {
  name: string;
  rarity?: Rarity | null | undefined;
  tier?: Tier | undefined;
  prototype?: boolean | undefined;
  hp?: number | undefined;
  hpMax?: number | undefined;
  restLeft?: number | undefined;
  authorId?: string | null | undefined;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-1 text-sm">
      <Title name={name} />
      <div className="flex flex-wrap items-center gap-1.5">
        {prototype ? <Pill label="Prototype" color="#f3f4f6" /> : rarity ? <Pill label={RARITY_INFO[rarity].label} color={RARITY_INFO[rarity].color} /> : null}
        {tier && <Pill label={TIER_INFO[tier].label} color={TIER_INFO[tier].color} />}
      </div>
      {hp != null && <div className="text-xs font-bold">❤ {hpMax != null ? `${hp}/${hpMax}` : hp} peps</div>}
      <div className="text-xs">Prend <b>la moitié des dégâts</b> que tu reçois.</div>
      {restLeft != null && restLeft > 0 && <div className="text-xs font-bold text-[#7a3a0e]">💤 Se repose encore {restLeft} expédition{restLeft > 1 ? "s" : ""}</div>}
      {extra}
      {authorId && <AuthorLine userId={authorId} label="Dessiné par" className="text-xs" />}
    </div>
  );
}
