// Écran de mort : le personnage est tombé pour de bon. On en redessine un nouveau (l'or et les armes du compte restent).
export function DeadScreen({ name, cause, busy, error, onNewCharacter }: { name: string; cause: string | null; busy: boolean; error: string | null; onNewCharacter: () => void }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#120907] p-4 text-[#fff3d6]" style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="w-[min(32rem,100%)] rounded-xl border-2 border-[#7a4a22] bg-[#2b1406] p-6 text-center shadow-xl">
        <div className="text-3xl">🕯️</div>
        <div className="mt-1 text-2xl font-extrabold">{name} est tombé·e</div>
        <p className="mt-3 text-sm">{cause ? `${cause}.` : "L'expédition lui a été fatale."} Son souvenir reste dans la forêt.</p>
        <p className="mt-2 text-sm">Tu gardes ton or et tes armes. Il est temps de dessiner un nouveau personnage.</p>
        <button type="button" disabled={busy} onClick={onNewCharacter} className="mt-4 rounded-lg border-2 border-[#166534] bg-[#16a34a] px-5 py-2 font-extrabold text-white disabled:opacity-50">
          {busy ? "…" : "Dessiner un nouveau personnage"}
        </button>
        {error && <div className="mt-3 rounded bg-[#5e1b1b] p-2 text-sm font-bold">{error}</div>}
      </div>
    </div>
  );
}
