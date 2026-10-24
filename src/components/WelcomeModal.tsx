// Message d'accueil de l'alpha (une seule fois par navigateur).
const FONT = { fontFamily: "'Baloo 2', cursive" };

export function WelcomeModal({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="w-[min(34rem,96%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-[#3a2410] shadow-2xl" style={FONT}>
        <div className="text-xl font-extrabold">Bienvenue, {name} !</div>
        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-[#7a4a22]">Alpha privée</div>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>Clique dans l'auberge pour te déplacer ; clique sur un autre joueur pour l'inviter dans ton groupe.</li>
          <li>Le portail de la forêt lance une expédition : tout le groupe doit être prêt. On peut y aller seul, mais c'est plus dangereux.</li>
          <li>Pendant l'expédition, vous votez ensemble à chaque étape, vous combattez, et vous tirez le butin aux dés.</li>
          <li>La forge te permet de dessiner une arme ; l'éditeur d'étapes, d'écrire des rencontres pour les autres.</li>
        </ul>
        <div className="mt-3 rounded border border-[#b98a54] bg-[#f6e8c4] p-2 text-xs">
          C'est une version de test : des choses sont encore absentes (ferme, marchand, quêtes) et l'équilibrage est provisoire. Utilise le bouton 🐞 pour signaler tout problème.
          Le jeu se joue en direct : retrouvez-vous à plusieurs aux mêmes horaires.
        </div>
        <button type="button" onClick={onClose} className="mt-4 rounded-lg border-2 border-[#166534] bg-[#16a34a] px-5 py-1.5 text-sm font-extrabold text-white">
          C'est parti
        </button>
      </div>
    </div>
  );
}
