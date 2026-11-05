// Armes exposées autour du forgeron : des armes de la boutique, tirées au hasard chaque jour, posées (immobiles) aux points
// placés dans /admin, avec la rotation et la taille choisies. Purement visuel : rien n'est écrit en base.
import { useEffect, useState } from "react";
import type { DisplayPoint } from "../lib/scenes-supabase";
import { fetchDisplayWeapons, type DisplayWeapon } from "../lib/shop";

const FONT = { fontFamily: "'Baloo 2', cursive" };

export function WeaponDisplay({ points, boxWidth }: { points: DisplayPoint[]; boxWidth: number }) {
  const [weapons, setWeapons] = useState<DisplayWeapon[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const n = points.length;
  useEffect(() => {
    let cancelled = false;
    void fetchDisplayWeapons(n)
      .then((l) => {
        if (cancelled) return;
        console.info(`[Armes exposées] ${n} point(s) posé(s), ${l.length} arme(s) tirée(s) parmi celles en stock à la Forge du Manchot.`);
        setWeapons(l);
      })
      .catch((e) => console.warn("[Armes exposées] lecture de la boutique impossible :", e));
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
                <div className="text-[11px] font-bold leading-tight text-[#5e3818]">{w.price} flouz · en vente à la Forge du Manchot</div>
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
                maxWidth: "none",   // Tailwind limite les images à 100 % de leur parent : ici le parent est un point de taille nulle
                transform: `translate(-50%, -50%) rotate(${pt.rot}deg)`,
                cursor: "url('/cursors/cursor-creature.png') 12 12, pointer",
                filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.45))",
              }}
              onLoad={(e) => console.info(`[Armes exposées] « ${w.name} » chargée : image ${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}, affichée ${Math.round(px * w.w / long)}×${Math.round(px * w.h / long)} px, point ${Math.round(pt.x)}/${Math.round(pt.y)} %`)}
              onError={() => { console.warn(`[Armes exposées] image introuvable pour « ${w.name} » : ${w.image_url}`); setBroken((b) => ({ ...b, [w.key]: true })); }}
              onClick={(e) => { e.stopPropagation(); setSel((s) => (s === i ? null : i)); }}
            />
            {broken[w.key] && (
              <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-[#2b1406]/85 px-1.5 py-0.5 text-[10px] font-bold text-[#fff3d6]" style={FONT}>⚔ {w.name}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
