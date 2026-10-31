// Curseur « créature » (public/cursors/cursor-creature.png) pour tout ce sur quoi on peut cliquer :
// portails, lieux, autres joueurs, ennemis.
export const CURSOR_DEFAULT = "url('/cursors/cursor-default.png') 1 1, default"; // curseur normal du jeu (🐞, ❤️…)
export const CURSOR_INTERACT = "url('/cursors/cursor-creature.png') 12 12, pointer";


// Curseur « flèche de pierre » (public/cursors/cursor-arrow.png, dessinée pointant vers la DROITE) pour les portails entre
// scènes : on la fait pivoter selon l'angle réglé dans /admin (0° = droite, 90° = bas, 180° = gauche, 270° = haut).
import { useEffect, useState } from "react";

const ARROW_URL = "/cursors/cursor-arrow.png";
const SIZE = 64;
let arrowImg: HTMLImageElement | null = null;
let arrowLoading: Promise<void> | null = null;
const cache = new Map<number, string>();

function loadArrow(): Promise<void> {
  if (arrowImg) return Promise.resolve();
  if (!arrowLoading) {
    arrowLoading = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        arrowImg = img;
        resolve();
      };
      img.onerror = () => resolve(); // repli : curseur « créature »
      img.src = ARROW_URL;
    });
  }
  return arrowLoading;
}

/** CSS `cursor` d'un portail dont la flèche est tournée de `deg` degrés. Repli sur le curseur créature tant que l'image n'est pas chargée. */
export function arrowCursor(deg: number | null | undefined): string {
  if (!arrowImg || typeof document === "undefined") return CURSOR_INTERACT;
  const d = ((Math.round(deg ?? 0) % 360) + 360) % 360;
  let url = cache.get(d);
  if (!url) {
    const c = document.createElement("canvas");
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext("2d");
    if (!ctx) return CURSOR_INTERACT;
    const w = 44;
    const h = (arrowImg.naturalHeight / arrowImg.naturalWidth) * w;
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate((d * Math.PI) / 180);
    ctx.drawImage(arrowImg, -w / 2, -h / 2, w, h);
    url = c.toDataURL("image/png");
    cache.set(d, url);
  }
  return `url('${url}') ${SIZE / 2} ${SIZE / 2}, pointer`;
}

/** À appeler dans un composant qui utilise arrowCursor : le rafraîchit une fois l'image chargée. */
export function useArrowCursorReady(): boolean {
  const [ready, setReady] = useState(!!arrowImg);
  useEffect(() => {
    let off = false;
    void loadArrow().then(() => {
      if (!off) setReady(true);
    });
    return () => {
      off = true;
    };
  }, []);
  return ready;
}
