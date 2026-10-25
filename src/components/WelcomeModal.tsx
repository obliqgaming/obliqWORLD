// Message d'accueil de l'alpha (une seule fois par navigateur).
const FONT = { fontFamily: "'Baloo 2', cursive" };

export function WelcomeModal({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="w-[min(34rem,96%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-[#3a2410] shadow-2xl" style={FONT}>
        <div className="text-xl font-extrabold">Bienvenue, {name} !</div>
        <div className="mt-2 text-base font-extrabold">Accroche-toi bien : ton personnage dessiné peut mourir définitivement !</div>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>Clique sur un autre joueur pour l'inviter dans ton groupe.</li>
          <li>Synchronise-toi avec ton groupe et partez en expédition dans la forêt.</li>
          <li>La forge te permet de dessiner une arme : si les gens l'achètent, ça te rapporte de l'or.</li>
          <li>L'éditeur d'étapes te permet d'écrire des épreuves qui te rapporteront de l'or.</li>
        </ul>
        <div className="mt-3 space-y-1 text-sm">
          <div className="font-extrabold">C'est une version de test.</div>
          <div>Des choses sont encore absentes <i>(les quêtes, par exemple)</i> et l'équilibrage est provisoire.</div>
          <div>🐞 Utilise ce bouton pour <b>signaler tout problème</b> !</div>
        </div>
        <button type="button" onClick={onClose} className="mt-4 rounded-lg border-2 border-[#166534] bg-[#16a34a] px-5 py-1.5 text-sm font-extrabold text-white">
          C'est parti
        </button>
      </div>
    </div>
  );
}
