// Armes exposées autour du forgeron : des armes de la boutique, tirées au hasard chaque jour, posées (immobiles) aux points
// placés dans /admin, avec la rotation et la taille choisies. Purement visuel : rien n'est écrit en base.
import { useEffect, useState } from "react";
import type { DisplayPoint } from "../lib/scenes-supabase";
import { fetchDisplayWeapons, type DisplayWeapon } from "../lib/shop";

const FONT = { fontFamily: "'Baloo 2', cursive" };

export function WeaponDisplay({ points, boxWidth }: { points: DisplayPoint[]; boxWidth: number }) {
  const [weapons, setWeapons] = useState<DisplayWeapon[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const n = points.length;
  useEffect(() => {
    let cancelled = false;
    void fetchDisplayWeapons(n).then((l) => { if (!cancelled) setWeapons(l); }).catch(() => {});
    return () => { cancelled = true; };
  }, [n]);
  useEffect(() => {
    if (sel === null) return;
    const t = window.setTimeout(() => setSel(null), 5000);
    return () => window.clearTimeout(t);
  }, [sel]);
  if (weapons.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {points.slice(0, weapons.length).map((pt, i) => {
        const w = weapons[i]!;
        const long = Math.max(w.w, w.h, 1);
        const px = boxWidth * 0.09 * pt.size;
        return (
          <div key={w.key + i} className="absolute" style={{ left: `${pt.x}%`, top: `${pt.y}%`, zIndex: Math.round(pt.y) }}>
            {sel === i && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border-2 border-[#7a4a22] bg-[#f1dfb6] px-2.5 py-1 text-center text-[#3a2410] shadow-lg" style={{ ...FONT, marginBottom: px * 0.6 }}>
                <div className="text-sm font-extrabold leading-tight">{w.name}</div>
                <div className="text-[11px] font-bold leading-tight text-[#5e3818]">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: w.color }} />
                  {w.line}
                </div>
                <div className="text-[11px] font-bold leading-tight text-[#5e3818]">{w.price} or · en vente chez le forgeron</div>
              </div>
            )}
            <img
              src={w.image_url}
              alt={w.name}
              draggable={false}
              className="pointer-events-auto absolute block"
              style={{
                width: (px * w.w) / long,
                height: (px * w.h) / long,
                left: 0, top: 0,
                transform: `translate(-50%, -50%) rotate(${pt.rot}deg)`,
                cursor: "url('/cursors/cursor-creature.png') 12 12, pointer",
                filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.45))",
              }}
              onClick={(e) => { e.stopPropagation(); setSel((s) => (s === i ? null : i)); }}
            />
          </div>
        );
      })}
    </div>
  );
}
