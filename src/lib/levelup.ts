// Écran de montée de niveau : phrases drôles, chiffres avant → après (peps / jus), points de talent, petit jingle.
import { scenesClient } from "./scenes-supabase";
import { fetchMyTalentKeys, pointsTotal } from "./talents";

export const LEVEL_LINES = [
  "Plus de peps, toujours aussi peu de flouz !",
  "Tes genoux craquent un peu moins. Un peu.",
  "Le Chef-Patron a senti un frisson dans le dos.",
  "Plus costaud, même tête.",
  "Tu sens le jus qui monte !",
  "Ça sent la promotion… sans le salaire.",
  "Les monstres te regardent d'un autre œil.",
  "Tu as pris du galon, pas du ventre.",
  "Morsoif a levé un sourcil. C'est énorme.",
  "Encore un peu et on te donnera un titre ronflant !",
];
export const randomLevelLine = () => LEVEL_LINES[Math.floor(Math.random() * LEVEL_LINES.length)]!;

export type LevelUpInfo = { pv: number | null; pm: number | null; pvBefore: number | null; pmBefore: number | null; pointsLeft: number };

const snapKey = (id: string) => `obw-vitals-${id}`;
type Snap = { level: number; pv: number | null; pm: number | null };
const readSnap = (id: string): Snap | null => {
  try { const r = localStorage.getItem(snapKey(id)); return r ? (JSON.parse(r) as Snap) : null; } catch { return null; }
};
export const writeSnap = (id: string, level: number, pv: number | null, pm: number | null) => {
  try { localStorage.setItem(snapKey(id), JSON.stringify({ level, pv, pm })); } catch { /* ignoré */ }
};

async function readVitals(characterId: string): Promise<{ pv: number | null; pm: number | null }> {
  const { data } = await scenesClient.from("character_build").select("*").eq("character_id", characterId).maybeSingle();
  const n = (k: string) => { const v = Number((data as any)?.[k]); return Number.isFinite(v) && v > 0 ? v : null; };
  return { pv: n("pv_max"), pm: n("pm_max") };
}

/** À appeler quand le niveau n'a pas changé : mémorise les max actuels pour pouvoir afficher « avant » au prochain niveau. */
export async function rememberVitals(characterId: string, level: number): Promise<void> {
  const s = readSnap(characterId);
  if (s && s.level === level) return;
  try { const v = await readVitals(characterId); writeSnap(characterId, level, v.pv, v.pm); } catch { /* ignoré */ }
}

export async function fetchLevelUpInfo(characterId: string, level: number): Promise<LevelUpInfo> {
  const [v, keys] = await Promise.all([readVitals(characterId).catch(() => ({ pv: null, pm: null })), fetchMyTalentKeys(characterId).catch(() => [] as string[])]);
  const s = readSnap(characterId);
  const before = s && s.level < level ? s : null;
  return { pv: v.pv, pm: v.pm, pvBefore: before?.pv ?? null, pmBefore: before?.pm ?? null, pointsLeft: Math.max(0, pointsTotal(level) - keys.length) };
}

/** Petit jingle « ta-da » fait avec WebAudio (aucun fichier à héberger). */
export function playLevelUpJingle(volume: number, muted: boolean): void {
  if (muted || volume <= 0) return;
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.11;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25 * Math.min(1, volume), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (i === notes.length - 1 ? 0.7 : 0.18));
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.75);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch { /* son indisponible */ }
}
