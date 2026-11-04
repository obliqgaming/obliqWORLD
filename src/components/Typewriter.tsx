// Texte qui s'écrit petit à petit, avec un tout petit « tic » discret. Un clic sur le texte l'affiche en entier.
// Le texte complet est réservé en transparence : le cadre ne change pas de taille pendant l'écriture.
import { useEffect, useRef, useState } from "react";
import { uiSound } from "../lib/ui-sounds";

export function Typewriter({ text, cps = 45, className, sound = true }: { text: string; cps?: number; className?: string; sound?: boolean }) {
  const [n, setN] = useState(0);
  const done = n >= text.length;
  const lastTick = useRef(0);

  useEffect(() => {
    lastTick.current = 0;
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* ignore */ }
    if (reduce) { setN(text.length); return; }
    setN(0);
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const k = Math.min(text.length, Math.floor(((performance.now() - t0) / 1000) * cps));
      setN(k);
      if (k >= text.length) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [text, cps]);

  // un tic toutes les 3 lettres visibles
  useEffect(() => {
    if (!sound || n === 0 || n >= text.length) return;
    if (n - lastTick.current >= 3 && text[n - 1] !== " ") {
      lastTick.current = n;
      uiSound("tick");
    }
  }, [n, text, sound]);

  return (
    <div className={`relative ${className ?? ""}`} onClick={() => !done && setN(text.length)} title={done ? undefined : "Clique pour tout afficher"}>
      <span aria-hidden style={{ visibility: "hidden" }}>{text}</span>
      <span className="absolute inset-0" aria-label={text}>{text.slice(0, n)}</span>
    </div>
  );
}
