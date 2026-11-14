// Cache local des musiques : chaque morceau n'est téléchargé qu'UNE fois par navigateur (puis relu depuis le disque du joueur).
// Pourquoi : les fichiers pèsent ~2 Mo chacun et étaient retéléchargés à chaque changement de scène / de morceau, ce qui a fait
// dépasser le quota gratuit de bande passante Supabase. En cas de souci (navigateur sans Cache Storage, réseau, etc.), on renvoie
// simplement l'adresse d'origine : la musique joue comme avant.
const CACHE_NAME = "obliq-music-v1";
const blobUrls = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

export function resolveMusicUrl(url: string): Promise<string> {
  const known = blobUrls.get(url);
  if (known) return Promise.resolve(known);
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;
  const p = (async () => {
    try {
      if (typeof caches === "undefined") return url;
      const cache = await caches.open(CACHE_NAME);
      let res = await cache.match(url);
      if (!res) {
        const net = await fetch(url);
        if (!net.ok) return url;
        await cache.put(url, net.clone());
        res = net;
      }
      const obj = URL.createObjectURL(await res.blob());
      blobUrls.set(url, obj);
      return obj;
    } catch {
      return url;
    } finally {
      pending.delete(url);
    }
  })();
  pending.set(url, p);
  return p;
}

// Libère un lecteur audio qu'on n'utilise plus (sinon le navigateur peut continuer à charger le fichier en arrière-plan).
export function releaseAudio(a: HTMLAudioElement | null | undefined) {
  if (!a) return;
  try {
    a.pause();
    a.removeAttribute("src");
    a.load();
  } catch {
    /* sans importance */
  }
}
