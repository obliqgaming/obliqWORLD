import { setImageFlip, useImageFlips } from "../lib/image-flips";

// Bouton « Miroir » de /admin : inverse le sens de marche de ce dessin.
export function FlipToggle({ imageUrl }: { imageUrl: string }) {
  const flips = useImageFlips();
  const on = flips.has(imageUrl);
  return (
    <button
      type="button"
      title="Inverse le sens de ce dessin (s'il marche à reculons)"
      onClick={() => void setImageFlip(imageUrl, !on).catch((e) => window.alert(e?.message?.includes("image_flips") ? "Lance d'abord le SQL 085 dans Supabase." : (e?.message ?? "Erreur")))}
      className={`rounded px-2 py-1 text-xs font-semibold ${on ? "bg-amber-600" : "bg-neutral-700"}`}
    >
      ⇋ Miroir{on ? " ✔" : ""}
    </button>
  );
}
