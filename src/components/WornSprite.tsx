// Image d'un personnage (ou d'un monstre) avec, si besoin, l'arme qu'il tient.
// L'arme est posée par son « point poignée » sur l'ancrage de la main ; elle est
// dans le même bloc que l'image, donc elle suit le miroir et l'oscillation de marche.
import type { CSSProperties, MouseEventHandler } from "react";
import { CHARACTER_CANVAS, type WornWeapon } from "../lib/weapons";

export function WeaponOverlay({ weapon }: { weapon: WornWeapon }) {
  const wPct = (weapon.width / CHARACTER_CANVAS) * 100;
  const hPct = (weapon.height / CHARACTER_CANVAS) * 100;
  return (
    <img
      src={weapon.imageUrl}
      alt=""
      draggable={false}
      className="pointer-events-none absolute"
      style={{
        width: `${wPct}%`,
        height: `${hPct}%`,
        left: `${weapon.hand.x - (weapon.grip.x / 100) * wPct}%`,
        top: `${weapon.hand.y - (weapon.grip.y / 100) * hPct}%`,
      }}
    />
  );
}

export function WornSprite({
  src,
  alt,
  weapon,
  className = "block w-full",
  style,
  onClick,
}: {
  src: string;
  alt: string;
  weapon?: WornWeapon | null | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  onClick?: MouseEventHandler<HTMLImageElement> | undefined;
}) {
  return (
    <div className="relative" style={style}>
      <img src={src} alt={alt} draggable={false} className={className} onClick={onClick} />
      {weapon && <WeaponOverlay weapon={weapon} />}
    </div>
  );
}
