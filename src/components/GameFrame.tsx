// Cadre en bois posé AUTOUR du décor (jamais par-dessus) : seuls les côtés s'étirent, les coins gardent leurs proportions.
// Image : /ui/game-frame.webp (transparente au centre). Couche décorative : ne bloque aucun clic.
export function GameFrame({ width, height, thickness }: { width: number; height: number; thickness: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-[54] -translate-x-1/2 -translate-y-1/2"
      style={{
        width: width + 2 * thickness,
        height: height + 2 * thickness,
        boxSizing: "border-box",
        borderStyle: "solid",
        borderColor: "transparent",
        borderWidth: thickness,
        borderImageSource: "url('/ui/game-frame.webp')",
        borderImageSlice: "33 34 35 34",
        borderImageWidth: `${thickness}px`,
        borderImageRepeat: "stretch",
      }}
    />
  );
}
