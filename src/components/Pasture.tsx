// Espace de pâture devant la ferme : les compagnons du jour (tirés au hasard, les mêmes pour tout le monde)
// se promènent à petits pas dans la zone dessinée dans /admin. Purement visuel : aucun temps réel, aucune base.
// Chaque animal a son propre rythme (pas de synchronisation) : immobile quelques secondes, puis quelques pas.
import { useEffect, useRef, useState } from "react";
import { computeDepthScale, pointInPolygon, type DepthScale, type Point } from "../lib/scenes-supabase";
import { fetchPastureAnimals, seededRandom, type PastureAnimal } from "../lib/companions";

const FONT = { fontFamily: "'Baloo 2', cursive" };

const inZone = (p: Point, zone: Point[][]) => zone.some((poly) => poly.length >= 3 && pointInPolygon(p, poly));

function randomPointIn(zone: Point[][], rnd: () => number): Point {
  const pts = zone.flat();
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
  for (let i = 0; i < 80; i++) {
    const p = { x: minX + rnd() * (maxX - minX), y: minY + rnd() * (maxY - minY) };
    if (inZone(p, zone)) return p;
  }
  return pts[0]!;
}

function Animal({
  animal, zone, depthScale, boxWidth, startSeed, selected, onSelect,
}: {
  animal: PastureAnimal; zone: Point[][]; depthScale: DepthScale | null; boxWidth: number; startSeed: number; selected: boolean; onSelect: () => void;
}) {
  const [pos, setPos] = useState<Point>(() => randomPointIn(zone, seededRandom(startSeed)));
  const [facingRight, setFacingRight] = useState(false);
  const [ms, setMs] = useState(0);
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      // Une fois sur trois, l'animal reste simplement là.
      if (Math.random() > 0.66) {
        timer = window.setTimeout(step, 3000 + Math.random() * 5000);
        return;
      }
      const cur = posRef.current;
      for (let k = 0; k < 14; k++) {
        const t = { x: cur.x + (Math.random() * 2 - 1) * 7, y: cur.y + (Math.random() * 2 - 1) * 3 };
        if (!inZone(t, zone)) continue;
        const dist = Math.hypot(t.x - cur.x, (t.y - cur.y) * 1.5);
        const dur = Math.max(700, dist * 260);
        setFacingRight(t.x > cur.x);
        setMs(dur);
        setPos(t);
        timer = window.setTimeout(() => { if (!cancelled) setMs(0); }, dur);
        break;
      }
      timer = window.setTimeout(step, 3500 + Math.random() * 7000);
    };
    timer = window.setTimeout(step, 1500 + Math.random() * 6000);
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [zone]);
  const moving = ms > 0;
  return (
    <div
      className="absolute"
      style={{
        left: `${pos.x}%`, top: `${pos.y}%`, width: boxWidth * 0.075,
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
      <div style={{ transform: facingRight ? "scaleX(-1)" : "none" }}>
        <img
          src={animal.image_url}
          alt={animal.name}
          draggable={false}
          className="pointer-events-auto block w-full"
          style={{ cursor: "url('/cursors/cursor-creature.png') 12 12, pointer", transformOrigin: "50% 100%", animation: moving ? "auberge-walk 250ms linear infinite" : "none", filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.45))" }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
      </div>
    </div>
  );
}

export function Pasture({ zone, depthScale, boxWidth }: { zone: Point[][]; depthScale: DepthScale | null; boxWidth: number }) {
  const [animals, setAnimals] = useState<PastureAnimal[]>([]);
  const [sel, setSel] = useState<string | null>(null);
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
        <Animal key={a.key} animal={a} zone={zone} depthScale={depthScale} boxWidth={boxWidth} startSeed={i * 7919 + 13} selected={sel === a.key} onSelect={() => setSel((s) => (s === a.key ? null : a.key))} />
      ))}
    </div>
  );
}
