import type { CSSProperties } from "react";
// Emotes animées : déformations de l'image entière (saut, tremblement, rotation…) + petit symbole flottant.
// Aucun dessin en plus ; envoyées aux autres joueurs du lieu par le canal temps réel (rien en base).
export type EmoteKey = "saut" | "danse" | "rire" | "salut" | "colere" | "peur" | "triste" | "tourner" | "dormir";

export type EmoteDef = {
  label: string;
  commands: string[];   // sans le « / »
  icon: string;         // emoji du menu
  symbol?: string;      // symbole qui flotte au-dessus de la tête
  ms: number;           // durée
  anim: string;         // nom de l'animation CSS (styles.css)
  iterations: string;   // "2", "infinite"…
  dur: string;          // durée d'un cycle
  hold?: boolean;       // reste dans la dernière pose jusqu'à ce qu'on bouge
  hideWeapon?: boolean; // l'arme est rangée pendant l'emote
};

export const EMOTES: Record<EmoteKey, EmoteDef> = {
  saut:    { label: "Saut",     commands: ["saut", "sauter"],      icon: "⤴️", ms: 1500, anim: "emote-saut",    iterations: "2", dur: "750ms" },
  danse:   { label: "Danse",    commands: ["danse", "danser"],     icon: "💃", symbol: "🎵", ms: 4000, anim: "emote-danse",   iterations: "infinite", dur: "700ms" },
  rire:    { label: "Rire",     commands: ["rire", "rigole"],      icon: "😂", symbol: "😂", ms: 2500, anim: "emote-rire",    iterations: "infinite", dur: "260ms" },
  salut:   { label: "Salut",    commands: ["salut", "saluer"],     icon: "👋", symbol: "👋", ms: 1800, anim: "emote-salut",   iterations: "2", dur: "900ms" },
  colere:  { label: "Colère",   commands: ["colere", "colère"],    icon: "😡", symbol: "💢", ms: 2500, anim: "emote-colere",  iterations: "infinite", dur: "260ms" },
  peur:    { label: "Peur",     commands: ["peur"],                icon: "😱", symbol: "😱", ms: 2500, anim: "emote-peur",    iterations: "infinite", dur: "260ms" },
  triste:  { label: "Triste",   commands: ["triste", "pleure"],    icon: "😢", symbol: "💧", ms: 4000, anim: "emote-triste",  iterations: "1", dur: "1.5s", hold: true },
  tourner: { label: "Tourner",  commands: ["tourner", "tourne"],   icon: "🌀", ms: 1400, anim: "emote-tourner", iterations: "1", dur: "1.4s" },
  dormir:  { label: "Dormir",   commands: ["dormir", "dodo"],      icon: "😴", symbol: "💤", ms: 60000, anim: "emote-dormir", iterations: "1", dur: "1.2s", hold: true, hideWeapon: true },
};

export const EMOTE_KEYS = Object.keys(EMOTES) as EmoteKey[];
export const EMOTE_COOLDOWN_MS = 1500;

export function emoteFromCommand(word: string): EmoteKey | null {
  const w = word.toLowerCase();
  return EMOTE_KEYS.find((k) => EMOTES[k].commands.includes(w)) ?? null;
}

export function emoteStyle(key: EmoteKey | undefined): CSSProperties | undefined {
  if (!key) return undefined;
  const d = EMOTES[key];
  return { transformOrigin: "50% 100%", animation: `${d.anim} ${d.dur} ease-in-out ${d.iterations}${d.hold ? " forwards" : ""}` };
}
