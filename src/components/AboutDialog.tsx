// « À propos / Soutien » (❤️).
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="w-[min(34rem,96%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-sm leading-relaxed text-[#3a2410] shadow-2xl"
        style={{ fontFamily: "'Baloo 2', cursive" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">À propos / Soutien</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-2 text-sm font-bold">Fermer</button>
        </div>
        <p className="mt-3">Un petit monde à créer ensemble avec des dessins de créatures, d'environnements et de ce qu'on décide d'en faire.</p>
        <p className="mt-2">Je bricole des images, du son, de la narration depuis longtemps et ce projet est une façon d'en rassembler dans un jeu.</p>
        <p className="mt-2">
          Si ça vous plaît, vous pouvez soutenir ici :{" "}
          <a href="https://ko-fi.com/obliqpainting" target="_blank" rel="noreferrer" className="font-bold underline">Ko-fi / obliqpainting</a>
        </p>
        <p className="mt-2">Ça m'aide à continuer et à faire évoluer le projet. Et qui sait : en faire un autre plus ambitieux peut-être.</p>
        <p className="mt-3 font-bold">Merci de rendre ce minuscule univers déjà vivant bande de BG 🙏</p>
      </div>
    </div>
  );
}
