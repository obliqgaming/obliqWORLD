// Écran de mort : le personnage est tombé pour de bon. On en redessine un nouveau (l'or et les armes du compte restent).
export function DeadScreen({ name, cause, summary, busy, error, onNewCharacter }: { name: string; cause: string | null; summary?: { level: number | null; className: string | null; days: number | null } | undefined; busy: boolean; error: string | null; onNewCharacter: () => void }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#120907] p-4 text-[#fff3d6]" style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="w-[min(32rem,100%)] rounded-xl border-2 border-[#7a4a22] bg-[#2b1406] p-6 text-center shadow-xl">
        <div className="text-3xl">🕯️</div>
        <div className="mt-1 text-2xl font-extrabold">{name} est tombé·e</div>
        <p className="mt-3 text-sm">{cause ? `${cause}.` : "L'expédition lui a été fatale."}</p>
        {summary && (summary.level || summary.className || summary.days !== null) && (
          <div className="mt-3 rounded-lg bg-black/25 p-2 text-sm font-bold">
            {[summary.level ? `Niveau ${summary.level}` : null, summary.className, summary.days !== null ? (summary.days === 0 ? "a vécu moins d'une journée" : `a vécu ${summary.days} jour${summary.days > 1 ? "s" : ""}`) : null].filter(Boolean).join(" · ")}
          </div>
        )}
        <p className="mt-2 text-sm">Son esprit rejoint la forêt. Un jour, quelqu'un le croisera peut-être sous la forme d'un monstre… et pourra même le capturer pour en faire un compagnon.</p>
        <p className="mt-2 text-sm">Tout ce qu'il possédait est perdu. Tu repars de zéro, avec un peu d'or et un compagnon à choisir.</p>
        <p className="mt-2 text-sm">Il est temps de dessiner un nouveau personnage.</p>
        <button type="button" disabled={busy} onClick={onNewCharacter} className="mt-4 rounded-lg border-2 border-[#166534] bg-[#16a34a] px-5 py-2 font-extrabold text-white disabled:opacity-50">
          {busy ? "…" : "Dessiner un nouveau personnage"}
        </button>
        {error && <div className="mt-3 rounded bg-[#5e1b1b] p-2 text-sm font-bold">{error}</div>}
      </div>
    </div>
  );
}
