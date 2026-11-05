// Espace de pâture devant la ferme : les compagnons du jour (tirés au hasard, les mêmes pour tout le monde)
// se promènent à petits pas dans la zone dessinée dans /admin. Purement visuel : aucun temps réel, aucune base.
// Chaque animal a son propre rythme (pas de synchronisation) : immobile quelques secondes, puis quelques pas.
import { useEffect, useRef, useState } from "react";
import { shouldMirror, useImageFlips } from "../lib/image-flips";
import { computeDepthScale, pointInPolygon, type DepthScale, type Point } from "../lib/scenes-supabase";
import { fetchPastureAnimals, type PastureAnimal } from "../lib/companions";

const FONT = { fontFamily: "'Baloo 2', cursive" };

// Distance minimale entre deux animaux (en % de la scène ; l'axe vertical compte double car la scène est en perspective).
const SEP_X = 7;
const SEP_Y = 3.5;
type Registry = { current: Record<string, Point> };
const farFromOthers = (p: Point, self: string, reg: Registry) =>
  Object.entries(reg.current).every(([k, o]) => k === self || Math.hypot((p.x - o.x) / SEP_X, (p.y - o.y) / SEP_Y) >= 1);

const inZone = (p: Point, zone: Point[][]) => zone.some((poly) => poly.length >= 3 && pointInPolygon(p, poly));

function randomPointIn(zone: Point[][], rnd: () => number, self?: string, reg?: Registry): Point {
  const pts = zone.flat();
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
  // Si aucun point n'est assez loin des autres, on prend le meilleur essai (le plus éloigné) plutôt qu'un coin fixe.
  let best: Point | null = null, bestD = -1;
  for (let i = 0; i < 120; i++) {
    const p = { x: minX + rnd() * (maxX - minX), y: minY + rnd() * (maxY - minY) };
    if (!inZone(p, zone)) continue;
    if (!reg || !self) return p;
    if (farFromOthers(p, self, reg)) return p;
    const d = Math.min(...Object.entries(reg.current).filter(([k]) => k !== self).map(([, o]) => Math.hypot((p.x - o.x) / SEP_X, (p.y - o.y) / SEP_Y)));
    if (d > bestD) { bestD = d; best = p; }
  }
  return best ?? pts[0]!;
}

function Animal({
  animal, zone, depthScale, boxWidth, startSeed, selected, onSelect, reg,
}: {
  animal: PastureAnimal; zone: Point[][]; depthScale: DepthScale | null; boxWidth: number; startSeed: number; selected: boolean; onSelect: () => void; reg: Registry;
}) {
  const [pos, setPos] = useState<Point>(() => {
    const p = randomPointIn(zone, Math.random, animal.key, reg);   // départ au hasard (la graine donnait des positions presque identiques)
    reg.current[animal.key] = p;
    return p;
  });
  const flips = useImageFlips();
  const [facingRight, setFacingRight] = useState(false);
  const [ms, setMs] = useState(0);
  const zoneKey = JSON.stringify(zone);
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    reg.current[animal.key] = posRef.current;
    const step = () => {
      if (cancelled) return;
      // De temps en temps (1 fois sur 6), l'animal reste simplement là.
      if (Math.random() > 0.85) {
        timer = window.setTimeout(step, 2000 + Math.random() * 2500);
        return;
      }
      const cur = posRef.current;
      for (let k = 0; k < 24; k++) {
        const t = { x: cur.x + (Math.random() * 2 - 1) * 6, y: cur.y + (Math.random() * 2 - 1) * 2.5 };
        if (!inZone(t, zone) || !farFromOthers(t, animal.key, reg)) continue;
        reg.current[animal.key] = t;   // la destination est réservée tout de suite : personne d'autre n'y va
        const dist = Math.hypot(t.x - cur.x, (t.y - cur.y) * 1.5);
        const dur = Math.max(1800, dist * 650)   // lent : environ 2,5 fois plus lent qu'avant;
        setFacingRight(t.x > cur.x);
        setMs(dur);
        setPos(t);
        timer = window.setTimeout(() => { if (!cancelled) setMs(0); }, dur);
        break;
      }
      timer = window.setTimeout(step, 1500 + Math.random() * 2500);   // plus souvent
    };
    timer = window.setTimeout(step, 300 + Math.random() * 2500);
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); delete reg.current[animal.key]; };
  }, [zoneKey]);
  const moving = ms > 0;
  return (
    <div
      className="absolute"
      style={{
        left: `${pos.x}%`, top: `${pos.y}%`, width: boxWidth * 0.045,   // moitié de la taille d'un personnage (comme un compagnon en suivi)
        transformOrigin: "50% 100%",
        transform: `translate(-50%, -100%) scale(${computeDepthScale(pos.y, depthScale)})`,
        transition: moving ? `left ${ms}ms linear, top ${ms}ms linear, transform ${ms}ms linear` : "none",
        zIndex: Math.round(pos.y),
      }}
    >
      {selected && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border-2 border-[#7a4a22] bg-[#f1dfb6] px-2.5 py-1 text-center text-[#3a2410] shadow-lg" style={FONT}>
          <div className="text-sm font-extrabold leading-tight">{animal.name}</div>
          <div className="text-[11px] font-bold leading-tight" style={{ color: "#5e3818" }}>
            <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: animal.color }} />
            {animal.line}
          </div>
        </div>
      )}
      <div style={{ transform: shouldMirror(flips, animal.image_url, facingRight) ? "scaleX(-1)" : "none" }}>
        <img
          src={animal.image_url}
          alt={animal.name}
          draggable={false}
          className="pointer-events-auto block w-full"
          style={{ cursor: "url('/cursors/cursor-creature.png') 12 12, pointer", transformOrigin: "50% 100%", animation: moving ? "auberge-walk 450ms linear infinite" : "none", filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.45))" }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
      </div>
    </div>
  );
}

export function Pasture({ zone, depthScale, boxWidth }: { zone: Point[][]; depthScale: DepthScale | null; boxWidth: number }) {
  const [animals, setAnimals] = useState<PastureAnimal[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const reg = useRef<Record<string, Point>>({});
  useEffect(() => {
    let cancelled = false;
    void fetchPastureAnimals().then((l) => { if (!cancelled) setAnimals(l); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!sel) return;
    const t = window.setTimeout(() => setSel(null), 5000);
    return () => window.clearTimeout(t);
  }, [sel]);
  if (animals.length === 0 || zone.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {animals.map((a, i) => (
        <Animal key={a.key} animal={a} zone={zone} depthScale={depthScale} boxWidth={boxWidth} startSeed={i * 7919 + 13} selected={sel === a.key} reg={reg} onSelect={() => setSel((s) => (s === a.key ? null : a.key))} />
      ))}
    </div>
  );
}
