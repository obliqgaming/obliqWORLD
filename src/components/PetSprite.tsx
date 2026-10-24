// Compagnon qui marche devant son maître, deux fois plus petit. À placer DANS le conteneur du personnage :
// il suit donc exactement ses déplacements et l'échelle de profondeur de la scène.
export function PetSprite({ src, facingRight, walking }: { src: string; facingRight: boolean; walking: boolean }) {
  return (
    <div
      className="pointer-events-none absolute bottom-0"
      style={{ width: "50%", left: facingRight ? "88%" : "-38%", transition: "left 250ms ease-out" }}
    >
      <div style={{ transform: facingRight ? "scaleX(-1)" : "none" }}>
        <img
          src={src}
          alt=""
          draggable={false}
          className="block w-full"
          style={{ transformOrigin: "50% 100%", animation: walking ? "auberge-walk 250ms linear infinite" : "none" }}
        />
      </div>
    </div>
  );
}
