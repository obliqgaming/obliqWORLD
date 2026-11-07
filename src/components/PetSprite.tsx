// Compagnon qui marche devant son maître, deux fois plus petit. À placer DANS le conteneur du personnage :
// il suit donc exactement ses déplacements et l'échelle de profondeur de la scène.
// À l'arrêt, il fait très rarement une petite mini-action (saut, tour sur soi, danse, quelques pas sur le côté).
import { useEffect, useState } from "react";
import { shouldMirror, useImageFlips } from "../lib/image-flips";

// Délai entre deux mini-actions d'un même compagnon (en secondes) : très rare.
const IDLE_MIN_S = 90;
const IDLE_MAX_S = 220;
type IdleAction = "jump" | "spin" | "dance" | "steps";
const ACTIONS: { key: IdleAction; ms: number }[] = [
  { key: "jump", ms: 700 },
  { key: "spin", ms: 900 },
  { key: "dance", ms: 1400 },
  { key: "steps", ms: 2200 },
];

export function PetSprite({ src, facingRight, walking }: { src: string; facingRight: boolean; walking: boolean }) {
  const flips = useImageFlips();
  const [action, setAction] = useState<IdleAction | null>(null);
  useEffect(() => {
    if (walking) {
      setAction(null);
      return;
    }
    let t: number | undefined;
    const schedule = () => {
      t = window.setTimeout(() => {
        const a = ACTIONS[Math.floor(Math.random() * ACTIONS.length)]!;
        setAction(a.key);
        t = window.setTimeout(() => {
          setAction(null);
          schedule();
        }, a.ms + 100);
      }, (IDLE_MIN_S + Math.random() * (IDLE_MAX_S - IDLE_MIN_S)) * 1000);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, [walking]);
  const outward = facingRight ? 1 : -1; // les pas s'éloignent du joueur (jamais sur lui)
  const idleAnim =
    action === "jump" ? "pet-jump 700ms ease-in-out"
    : action === "spin" ? "pet-spin 900ms ease-in-out"
    : action === "dance" ? "pet-dance 1400ms ease-in-out"
    : action === "steps" ? "pet-steps 2200ms ease-in-out"
    : "none";
  return (
    <div
      className="pointer-events-none absolute bottom-0"
      style={{ width: "50%", left: facingRight ? "88%" : "-38%", transition: "left 250ms ease-out" }}
    >
      <div style={{ transform: shouldMirror(flips, src, facingRight) ? "scaleX(-1)" : "none" }}>
        <div style={{ animation: idleAnim, ["--pdx" as string]: `${outward * 30}%` }}>
          <img
            src={src}
            alt=""
            draggable={false}
            className="block w-full"
            style={{ transformOrigin: "50% 100%", animation: walking ? "auberge-walk 250ms linear infinite" : "none" }}
          />
        </div>
      </div>
    </div>
  );
}
