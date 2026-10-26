// Musiques « événement » (révélation, réussite, échec) : la page coupe la musique principale, joue le morceau une fois,
// puis relance la musique principale. Jamais deux musiques en même temps (voir index.tsx).
import { scenesClient } from "./scenes-supabase";

export const JINGLE_REVEAL = "Music_Funny.opus";
export const JINGLE_SUCCESS = "Music_Reussite.opus";
export const JINGLE_FAIL = ["Music_Echec1.opus", "Music_Echec2.opus"];

export function musicUrl(fileName: string): string {
  return scenesClient.storage.from("music").getPublicUrl(fileName).data.publicUrl;
}

export function startJingle(fileName: string) {
  window.dispatchEvent(new CustomEvent("obliq-jingle", { detail: { url: musicUrl(fileName) } }));
}

export function stopJingle() {
  window.dispatchEvent(new Event("obliq-jingle-stop"));
}

// Plusieurs morceaux par scène : la colonne music_url contient les adresses séparées par « | ».
export function parseMusicList(s: string | null | undefined): string[] {
  return (s ?? "").split("|").map((x) => x.trim()).filter(Boolean);
}
export function joinMusicList(list: string[]): string {
  return list.join("|");
}
