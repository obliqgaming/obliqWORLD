// Vocabulaire du jeu (noms choisis par Lils, novembre 2026). Un seul endroit pour retrouver / changer un nom.
export const VOCAB = {
  courte: "P'tite balade dans la forêt",
  longue: "Grand Safari Sylvestre",
  boss: "Chef-Patron",
  forge: "La Forge du Manchot",
  ferme: "La Ferme des Jetés en Pâture",
  marchand: "L'Épicerie Grâce",
  annonces: "Le Panneau des Aventuriers",
  quetes: "Le Boulot du Jour",
} as const;

/** Montant de monnaie en texte : « 12 flouz », ou « pas de flouz » quand il n'y en a plus. */
export function flouz(n: number, zero = "pas de flouz"): string {
  return n > 0 ? `${n} flouz` : zero;
}

const keepCase = (from: string, to: string) => (from[0] !== from[0]!.toLowerCase() ? to[0]!.toUpperCase() + to.slice(1) : to);

/**
 * Réécrit avec le vocabulaire du jeu un texte venu du SERVEUR (messages d'erreur, journal de combat,
 * descriptions de pouvoirs, noms de monstres) : PV → peps, PM → jus, or → flouz, boss → Chef-Patron, etc.
 * À n'utiliser que sur des textes écrits par le jeu, pas sur ceux écrits par les joueurs.
 */
export function vocabText(s: string): string {
  if (!s) return s;
  let t = s;
  // Monnaie
  t = t.replace(/^Il te faut (\d+) or/, "Pas assez de flouz ! Il te faut $1 flouz");
  t = t.replace(/(\d+)\s*or\b/g, "$1 flouz");
  t = t.replace(/\bpièces? d['’]or\b/gi, "flouz");
  t = t.replace(/\bde l['’]or\b/gi, "du flouz");
  t = t.replace(/\bd['’]or\b/gi, "de flouz");
  t = t.replace(/\b(l['’])or\b/g, (_m, a: string) => (a === "L'" || a === "L’" ? "Le flouz" : "le flouz"));
  // Points de vie / de magie
  t = t.replace(/\bdes PV\b/g, "du peps").replace(/\bdes PM\b/g, "du jus");
  t = t.replace(/(^|[.!?:]\s+)PV\b/g, "$1Peps").replace(/(^|[.!?:]\s+)PM\b/g, "$1Jus");
  t = t.replace(/\bPV\b/g, "peps").replace(/\bPM\b/g, "jus");
  // Boss
  t = t.replace(/\bmini-boss\b/gi, "mini Chef-Patron");
  t = t.replace(/\bboss\b/gi, () => "Chef-Patron");
  // Ration → casse-croûte (masculin)
  t = t.replace(/\b(ta|Ta|une|Une|la|La) ration\b/g, (_m, a: string) => keepCase(a, a.toLowerCase() === "ta" ? "ton" : a.toLowerCase() === "une" ? "un" : "le") + " casse-croûte");
  t = t.replace(/\brations\b/gi, (m) => keepCase(m, "casse-croûtes"));
  t = t.replace(/\bration\b/gi, (m) => keepCase(m, "casse-croûte"));
  // Marchand, ferme, quêtes
  t = t.replace(/\b([Ll])e marchand\b/g, (_m, l: string) => (l === "L" ? "L'Épicerie Grâce" : "l'Épicerie Grâce"));
  t = t.replace(/\b(ta|Ta|la|La) ferme\b/g, (_m, a: string) => `${a} Ferme des Jetés en Pâture`);
  t = t.replace(/\b(Cette|cette) quête\b/g, (_m, a: string) => keepCase(a, "ce boulot"));
  t = t.replace(/\b(ta|Ta|une|Une|la|La|ma|Ma) quête\b/g, (_m, a: string) => keepCase(a, { ta: "ton", une: "un", la: "le", ma: "mon" }[a.toLowerCase() as "ta"]) + " boulot");
  t = t.replace(/\bquêtes\b/gi, (m) => keepCase(m, "boulots"));
  t = t.replace(/\bquête\b/gi, (m) => keepCase(m, "boulot"));
  return t;
}
