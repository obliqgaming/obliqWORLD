// Miroir par image (SQL 085) : certains dessins regardent à droite au lieu de gauche et marchent « en moonwalk ».
// Réglé dans /admin (bouton « Miroir »), valable partout où le dessin apparaît.
import { useEffect, useState } from "react";
import { scenesClient } from "./scenes-supabase";

let cache: Set<string> = new Set();
let loaded = false;

async function load(): Promise<Set<string>> {
  try {
    const { data } = await scenesClient.from("image_flips").select("image_url");
    cache = new Set((data ?? []).map((r: any) => r.image_url as string));
  } catch {
    /* table absente (SQL 085) : aucun miroir */
  }
  loaded = true;
  return cache;
}

export function useImageFlips(): Set<string> {
  const [flips, setFlips] = useState<Set<string>>(cache);
  useEffect(() => {
    let alive = true;
    const run = () => void load().then((s) => alive && setFlips(new Set(s)));
    if (!loaded) run();
    else setFlips(new Set(cache));
    window.addEventListener("obliq-image-flips", run);
    return () => {
      alive = false;
      window.removeEventListener("obliq-image-flips", run);
    };
  }, []);
  return flips;
}

// Faut-il retourner le dessin ? `wanted` = le sens voulu par la marche ; le réglage admin inverse.
export const shouldMirror = (flips: Set<string>, url: string | null | undefined, wanted: boolean) => wanted !== (!!url && flips.has(url));

export async function setImageFlip(url: string, on: boolean): Promise<void> {
  const q = on
    ? scenesClient.from("image_flips").upsert({ image_url: url }, { onConflict: "image_url" })
    : scenesClient.from("image_flips").delete().eq("image_url", url);
  const { error } = await q;
  if (error) throw error;
  window.dispatchEvent(new Event("obliq-image-flips"));
}
