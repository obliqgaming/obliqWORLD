// Bruitages de combat synthétisés (aucun fichier audio) : pas de poids en plus,
// et le volume suit le réglage général du jeu.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, t0: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(c: AudioContext, t0: number, dur: number, gain: number, freq: number) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

export type CombatSound = "hit" | "heavy" | "heal" | "aoe" | "monster" | "summon" | "info" | "death" | "victory" | "defeat";

export function playCombatSound(kind: CombatSound, volume = 1, muted = false) {
  if (muted || volume <= 0) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const v = Math.min(1, volume) * 0.5;
  switch (kind) {
    case "hit":
      noise(c, t, 0.12, v * 0.9, 1800);
      tone(c, t, 180, 70, 0.14, v * 0.6, "triangle");
      break;
    case "heavy":
      noise(c, t, 0.22, v, 900);
      tone(c, t, 130, 45, 0.28, v * 0.9, "sawtooth");
      break;
    case "monster":
      noise(c, t, 0.14, v * 0.8, 600);
      tone(c, t, 110, 55, 0.2, v * 0.8, "square");
      break;
    case "aoe":
      noise(c, t, 0.6, v, 300);
      tone(c, t, 70, 30, 0.7, v, "sawtooth");
      break;
    case "heal":
      tone(c, t, 520, 780, 0.18, v * 0.5);
      tone(c, t + 0.14, 780, 1040, 0.22, v * 0.45);
      break;
    case "summon":
      tone(c, t, 90, 260, 0.45, v * 0.6, "sawtooth");
      noise(c, t, 0.4, v * 0.4, 500);
      break;
    case "death":
      tone(c, t, 220, 40, 0.5, v * 0.7, "triangle");
      break;
    case "victory":
      [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.13, f, f, 0.3, v * 0.5, "triangle"));
      break;
    case "defeat":
      [392, 330, 262, 196].forEach((f, i) => tone(c, t + i * 0.2, f, f * 0.98, 0.35, v * 0.5, "triangle"));
      break;
    default:
      tone(c, t, 400, 500, 0.08, v * 0.25);
  }
}
