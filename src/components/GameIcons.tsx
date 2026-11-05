import type React from "react";
// Petites icônes du jeu (SVG de Lils dans public/icons) : pièce d'or, sac à dos, parchemin de quêtes.
export function Coin({ size = "1.05em" }: { size?: string }) {
  return <img src="/icons/coin.svg" alt="flouz" draggable={false} style={{ display: "inline-block", height: size, width: size, verticalAlign: "-0.15em" }} />;
}

export function Bag({ size = "1.1em" }: { size?: string }) {
  return <img src="/icons/bag.svg" alt="sac" draggable={false} style={{ display: "inline-block", height: size, width: "auto", verticalAlign: "-0.2em" }} />;
}

export function QuestIcon({ size = "1.1em" }: { size?: string }) {
  return <img src="/icons/quest-permit.svg" alt="" draggable={false} style={{ display: "inline-block", height: size, width: "auto", verticalAlign: "-0.2em" }} />;
}

/** Icône d'un lieu cliquable : une adresse d'image (commence par « / ») ou un simple emoji. */
export function HotspotGlyph({ icon, size = "1.1em" }: { icon: string; size?: string }) {
  if (icon.startsWith("/")) {
    return <img src={icon} alt="" draggable={false} style={{ display: "inline-block", height: size, width: "auto", verticalAlign: "-0.2em" }} />;
  }
  return <>{icon}</>;
}

/** Petite icône en haut à gauche d'un panneau (même image que dans la barre du bas). */
export function PanelIcon({ src, size = "1.3em" }: { src: string; size?: string }) {
  return <img src={src} alt="" draggable={false} style={{ display: "inline-block", height: size, width: size, objectFit: "contain", verticalAlign: "-0.25em", marginRight: "0.35em" }} />;
}

/** Police des noms d'armes (légèrement médiévale). */
export const WEAPON_FONT = "'IM Fell English', 'Baloo 2', cursive";
