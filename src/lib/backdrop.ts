// Un clic dans le vide (à côté de la fenêtre) ferme la fenêtre.
// On exige que le bouton de la souris ait aussi été appuyé dans le vide : glisser depuis la fenêtre jusqu'au fond ne la ferme pas.
import type { MouseEvent } from "react";

let pressedOnBackdrop = false;

export function backdropClose(onClose: () => void) {
  return {
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      pressedOnBackdrop = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      if (pressedOnBackdrop && e.target === e.currentTarget) onClose();
      pressedOnBackdrop = false;
    },
  };
}
