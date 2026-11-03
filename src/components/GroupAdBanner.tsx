// Petit encart « Un groupe est en formation ! » : visible dès qu'une annonce d'un AUTRE joueur existe. Un clic ouvre le tableau.
import { useEffect, useState } from "react";
import { ensureUserId, leaveScenePresence } from "../lib/scenes-supabase";
import { fetchGroupAds, subscribeGroupAds } from "../lib/group-ads";

export function GroupAdBanner({ onOpen }: { onOpen: () => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let me: string | null = null;
    const load = async () => {
      try {
        if (!me) me = await ensureUserId();
        const r = await fetchGroupAds();
        if (!cancelled) setCount(r.ads.filter((a) => a.user_id !== me).length);
      } catch { /* ignoré */ }
    };
    void load();
    // Plusieurs changements d'un coup : une seule relecture.
    const ch = subscribeGroupAds(() => { window.clearTimeout(timer); timer = window.setTimeout(() => void load(), 800); });
    return () => { cancelled = true; window.clearTimeout(timer); leaveScenePresence(ch); };
  }, []);
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="absolute left-1/2 top-3 z-30 -translate-x-1/2 animate-pulse rounded-full border-2 border-[#7a4a22] bg-[#f1dfb6]/95 px-4 py-1 text-sm font-extrabold text-[#3a2410] shadow-lg hover:animate-none hover:bg-[#f6e8c4]"
      style={{ fontFamily: "'Baloo 2', cursive" }}
      title="Ouvrir le tableau « cherche un groupe »"
    >
      📋 Un groupe est en formation !{count > 1 ? ` (${count} annonces)` : ""}
    </button>
  );
}
