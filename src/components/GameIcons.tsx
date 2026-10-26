// Petites icônes du jeu (SVG de Lils dans public/icons) : pièce d'or, sac à dos, parchemin de quêtes.
export function Coin({ size = "1.05em" }: { size?: string }) {
  return <img src="/icons/coin.svg" alt="or" draggable={false} style={{ display: "inline-block", height: size, width: size, verticalAlign: "-0.15em" }} />;
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
