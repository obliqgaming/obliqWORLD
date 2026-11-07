// « À propos / Soutien » (❤️).
const KOFI = "https://ko-fi.com/obliqpainting";
const DISCORD = "https://discord.gg/MWKhGyZHY9";

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="max-h-[92vh] w-[min(34rem,96%)] overflow-y-auto overflow-x-hidden rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-sm leading-relaxed text-[#3a2410] shadow-2xl parchment-scroll"
        style={{ fontFamily: "'Baloo 2', cursive" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titre */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-extrabold leading-tight">🌱 À propos d'ObliqWorld</div>
            <div className="mt-0.5 text-xs font-bold opacity-70">🧪 encore en alpha, ça évolue petit à petit</div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded border border-[#7a4a22] px-2 text-sm font-bold hover:bg-[#7a4a22]/10">Fermer</button>
        </div>

        {/* Petits paragraphes */}
        <p className="mt-3">🌱 ObliqWorld grandit petit à petit, grâce à l'imagination de ceux qui y jouent.</p>
        <p className="mt-2">🎨 J'aimerais progressivement remplacer les décors provisoires par de véritables illustrations originales.</p>
        <p className="mt-2">🎵 La musique est réalisée par moi et mon ami Wax. Le projet rassemble aussi beaucoup de créations personnelles, de ressources libres et de vestiges de mes précédents jeux réalisés avec assistance.</p>

        {/* Encadré : à quoi sert le soutien */}
        <div className="mt-3 rounded-lg border border-[#7a4a22]/50 bg-white/45 p-3">
          <div className="font-extrabold">🛠️ À quoi sert un soutien ?</div>
          <p className="mt-1">Un soutien sur Ko-fi aide à financer la suite : illustrations, ressources artistiques et développement de nouvelles fonctionnalités.</p>
          <p className="mt-1">☕ Chaque contribution donne un coup de pouce au projet.</p>
        </div>

        {/* Bouton principal Ko-fi */}
        <a
          href={KOFI}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#7a2e14] bg-[#b4532a] px-4 py-2.5 text-center text-base font-extrabold text-[#fff3d6] shadow-md transition hover:bg-[#9c4420] focus:outline-none focus:ring-2 focus:ring-[#7a2e14]/50"
        >
          ❤️ Soutenir ObliqWorld sur Ko-fi
        </a>

        {/* Accès Discord, secondaire */}
        <a
          href={DISCORD}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#7a4a22] bg-transparent px-4 py-1.5 text-center text-sm font-bold text-[#5a3414] transition hover:bg-[#7a4a22]/10"
        >
          💬 Suivre le développement sur Discord
        </a>

        {/* Conclusion */}
        <p className="mt-4 text-center font-bold">🙏 Merci de jouer, de dessiner, d'écrire, de tester, de proposer des idées ou de venir t'chater : chacune de ces contributions aide ce monde à vivre !</p>
      </div>
    </div>
  );
}
