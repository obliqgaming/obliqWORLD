// Petits sons d'interface synthétisés (aucun fichier) : validation, pièce, erreur, réussite, échec et révélations
// de plus en plus « gagnantes ». Le volume et le mode muet suivent le réglage général (setUiAudio, appelé par la page).
let ctx: AudioContext | null = null;
let vol = 1;
let muted = false;

export function setUiAudio(volume: number, isMuted: boolean) {
  vol = volume;
  muted = isMuted;
}

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

function note(c: AudioContext, t0: number, f: number, dur: number, gain: number, type: OscillatorType = "triangle", f1?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function sparkle(c: AudioContext, t0: number, dur: number, gain: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 5000;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(c.destination);
  s.start(t0);
}

// Notes (Hz) d'une gamme majeure pour les arpèges.
const N = { c5: 523, d5: 587, e5: 659, g5: 784, a5: 880, c6: 1047, e6: 1319, g6: 1568, c7: 2093 };

export type UiSound = "click" | "ok" | "coin" | "error" | "success" | "fail" | "drum";

export function uiSound(kind: UiSound) {
  if (muted || vol <= 0) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const v = Math.min(1, vol) * 0.35;
  switch (kind) {
    case "click":
      note(c, t, 700, 0.05, v * 0.6, "square", 520);
      break;
    case "ok":
      note(c, t, N.e5, 0.1, v, "triangle");
      note(c, t + 0.08, N.a5, 0.16, v, "triangle");
      break;
    case "coin":
      note(c, t, 1318, 0.07, v, "square");
      note(c, t + 0.07, 1760, 0.22, v, "square");
      break;
    case "error":
      note(c, t, 220, 0.14, v, "sawtooth", 150);
      note(c, t + 0.12, 165, 0.2, v, "sawtooth", 110);
      break;
    case "success":
      [N.c5, N.e5, N.g5, N.c6].forEach((f, i) => note(c, t + i * 0.11, f, 0.28, v, "triangle"));
      note(c, t + 0.44, N.e6, 0.5, v * 0.8, "sine");
      break;
    case "fail":
      [392, 349, 311, 262].forEach((f, i) => note(c, t + i * 0.17, f, 0.4, v, "triangle", f * 0.97));
      break;
    case "drum":
      note(c, t, 120, 0.25, v * 1.2, "sine", 50);
      break;
  }
}

/** Révélation (booster, forge…) : plus la valeur est haute (0 à 5), plus le son est long et brillant. */
export function revealSound(tier: number) {
  if (muted || vol <= 0) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const v = Math.min(1, vol) * 0.35;
  const seq = [N.c5, N.e5, N.g5, N.c6, N.e6, N.g6, N.c7];
  const n = Math.min(seq.length, 2 + tier);
  note(c, t, 150, 0.3, v * 1.1, "sine", 60); // « boum » d'ouverture
  for (let i = 0; i < n; i++) note(c, t + 0.1 + i * (tier >= 4 ? 0.08 : 0.1), seq[i]!, 0.3 + tier * 0.06, v * (0.7 + i * 0.05), "triangle");
  if (tier >= 2) sparkle(c, t + 0.15, 0.5 + tier * 0.12, v * 0.25 * tier);
  if (tier >= 3) {
    const t1 = t + 0.1 + n * 0.1;
    [N.c5, N.e5, N.g5, N.c6].forEach((f) => note(c, t1, f, 0.9, v * 0.5, "sine")); // accord final
  }
  if (tier >= 5) {
    const t2 = t + 0.9;
    [N.g5, N.c6, N.e6, N.g6].forEach((f, i) => note(c, t2 + i * 0.05, f, 1.2, v * 0.55, "triangle"));
    sparkle(c, t2, 1.4, v * 0.6);
  }
}
