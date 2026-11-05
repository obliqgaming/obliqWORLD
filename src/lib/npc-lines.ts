// Répliques des PNJ (bulle au-dessus de leur tête, jamais dans le tchat).
// Cadence réglable dans /admin > Réglages (npc_speech_min_minutes / npc_speech_max_minutes) : UNE réplique, tous PNJ confondus.
import { useEffect, useRef, useState } from "react";
import { scenesClient } from "./scenes-supabase";

export const NPC_LINES: Record<string, string[]> = {
  forge: [
    "Un coup de tête, un coup de maître !",
    "Et voilà, redressé à coups de tronche !",
    "Le truc c'est que je tape souvent à côté...",
    "C'est pas une bosse, c'est du génie.",
    "J'y vais au pif, ouais, pourquoi ?",
    "Une petite bosse ? Un gros progrès !",
    "Ça tient ? Alors c'est terminé !",
    "J'ai une technique très personnelle.",
  ],
  step_editor: [
    "\"Rodondindon\" mais bien sûr..",
    "\"Rat à touille\", bah oui tout à fait..",
    "\"Nornitrorinque\", et puis quoi encore..",
    "\"Pâte à caisse\", pourquoi pas..",
    "\"Bouille à baisse\", ma foi..",
    "\"Ca perd les popettes\", original..",
    "Je vais faire semblant de comprendre.",
    "Je jurerais qu'il ne s'est pas relu !",
    "Il manque quelque chose. Du talent, peut-être.",
    "C'est très... personnel comme orthographe.",
  ],
  merchant: [
    "J'ai encore de la place pour ton flouz.",
    "Achète ou j'avale tout.",
    "Ta survie, mon business.",
    "J'ai ça en stock buccal.",
    "Zéro scrupule pour les crapules.",
    "Une petite faim pour vous, une grosse marge pour moi.",
    "Concrètement, j'investis dans ta défaite",
    "Ton dernier souffle ? Je le rachète.",
    "J'ai un petit creux dans chaque joue.",
  ],
  farm: [
    "S'ils survivent c'est qu'ils sont mal entraînés",
    "Une recrue qui tombe, ça fertilise !",
    "Genou à terre, le nez dans le fumier, c'est ça la discipline.",
    "Le fouet ? C'est pour ta sécurité, petit.",
    "Pas de cerveau, pas de bobo ! En avant !",
    "Finir en compost, c'est le destin.",
    "Un bon soldat ne rentre jamais entier.",
  ],
  quests: [
    "Hey, m'raconte pas ta vie gribouilli.",
    "Des chaises ? T'veux pas un canapé non plus ?",
    "T'es là pour l'boulot ou la picole ?",
    "Tu viens vider ton sac ou ton flouz ?",
    "Paye toi un godet, brouillon.",
    "Raconte ça au perroquet, moi j'm'en tape.",
    "M'regarde pas comme ça, j'ai pas d'cacahuètes.",
    "Arrête de m'regarder astiquer, ça me met mal à l'aise.",
  ],
};

const BUBBLE_MS = 6500;
const NEXT_KEY = "obliq-npc-next-at";
const LAST_KIND_KEY = "obliq-npc-last-kind";
const deckKey = (kind: string) => `obliq-npc-deck-${kind}`;

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };

// Paquet mélangé : toutes les phrases passent avant de recommencer, jamais deux fois de suite la même (même au changement de tour).
function nextLine(kind: string): string | null {
  const lines = NPC_LINES[kind];
  if (!lines?.length) return null;
  let deck: { remaining: number[]; last: number } = { remaining: [], last: -1 };
  try { const raw = lsGet(deckKey(kind)); if (raw) deck = JSON.parse(raw); } catch { /* paquet neuf */ }
  deck.remaining = (deck.remaining ?? []).filter((i) => i >= 0 && i < lines.length);
  if (deck.remaining.length === 0) {
    const all = lines.map((_, i) => i);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j]!, all[i]!]; }
    if (all.length > 1 && all[all.length - 1] === deck.last) { [all[0], all[all.length - 1]] = [all[all.length - 1]!, all[0]!]; } // la dernière du tableau sort en premier
    deck.remaining = all;
  }
  const idx = deck.remaining.pop()!;
  deck.last = idx;
  lsSet(deckKey(kind), JSON.stringify(deck));
  return lines[idx] ?? null;
}

async function fetchDelays(): Promise<{ min: number; max: number }> {
  try {
    const { data } = await scenesClient.from("game_settings").select("key, value").like("key", "npc_speech_%");
    const m: Record<string, number> = {};
    for (const r of data ?? []) m[(r as any).key] = Number((r as any).value);
    const lo = m["npc_speech_min_minutes"] ?? 0;
    const hi = m["npc_speech_max_minutes"] ?? 0;
    const min = lo > 0 ? lo : 8;
    const max = hi >= min ? hi : Math.max(min, 14);
    return { min, max };
  } catch {
    return { min: 8, max: 14 };
  }
}

/** Répliques en cours : id du lieu → texte. Un seul PNJ parle à la fois, et rarement. */
export function useNpcSpeech(npcs: { id: string; kind: string }[]): Record<string, string> {
  const [speech, setSpeech] = useState<Record<string, string>>({});
  const npcsRef = useRef(npcs);
  npcsRef.current = npcs;
  const delays = useRef<{ min: number; max: number }>({ min: 8, max: 14 });
  useEffect(() => {
    let alive = true;
    void fetchDelays().then((d) => { delays.current = d; });
    let clearT: number | null = null;
    const tick = () => {
      if (!alive || document.visibilityState !== "visible") return;
      const present = npcsRef.current.filter((n) => NPC_LINES[n.kind]);
      if (present.length === 0) return;
      const now = Date.now();
      let nextAt = Number(lsGet(NEXT_KEY));
      if (!nextAt) { nextAt = now + 60_000 + Math.random() * 60_000; lsSet(NEXT_KEY, String(nextAt)); }
      if (now < nextAt) return;
      const lastKind = lsGet(LAST_KIND_KEY);
      const pool = present.length > 1 ? present.filter((n) => n.kind !== lastKind) : present;
      const chosen = pool[Math.floor(Math.random() * pool.length)]!;
      const text = nextLine(chosen.kind);
      // prochaine réplique : délai aléatoire entre les deux réglages (en minutes)
      const { min, max } = delays.current;
      lsSet(NEXT_KEY, String(now + (min + Math.random() * (max - min)) * 60_000));
      lsSet(LAST_KIND_KEY, chosen.kind);
      if (!text) return;
      setSpeech({ [chosen.id]: text });
      if (clearT) window.clearTimeout(clearT);
      clearT = window.setTimeout(() => setSpeech({}), BUBBLE_MS);
    };
    const iv = window.setInterval(tick, 5000);
    return () => { alive = false; window.clearInterval(iv); if (clearT) window.clearTimeout(clearT); };
  }, []);
  // changement de scène : la bulle en cours disparaît
  const idsKey = npcs.map((n) => n.id).join(",");
  useEffect(() => { setSpeech({}); }, [idsKey]);
  return speech;
}
