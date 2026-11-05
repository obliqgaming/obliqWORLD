// Écran de chargement aux couleurs du jeu : cache les petits sauts d'image (scène par défaut, PNJ qui changent de taille…)
// pendant que tout se met en place, puis s'efface en douceur.
export function LoadingScreen({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-3"
      style={{
        background: "radial-gradient(ellipse at center, #5e3818 0%, #2b1406 70%, #1a0c03 100%)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 350ms ease-out",
        fontFamily: "'Baloo 2', cursive",
      }}
    >
      <div className="text-4xl font-extrabold tracking-wide" style={{ color: "#fcd34d", textShadow: "0 2px 6px #000" }}>ObliqWorld</div>
      <div className="obw-loading-dots text-base font-bold" style={{ color: "#fff3d6" }}>Ça arrive, patience…</div>
    </div>
  );
}
