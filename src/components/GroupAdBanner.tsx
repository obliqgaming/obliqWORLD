// Petit encart « Un groupe est en formation ! » : visible tant qu'une annonce d'un AUTRE joueur existe, que je n'ai pas déjà rejointe
// et que je n'ai pas fermée avec la croix. Un clic ouvre le tableau.
import { useEffect, useState } from "react";
import { ensureUserId, leaveScenePresence } from "../lib/scenes-supabase";
import { fetchGroupAds, subscribeGroupAds } from "../lib/group-ads";

const DISMISS_KEY = "obliq-dismissed-group-ads";
function readDismissed(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeDismissed(ids: string[]) {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(ids.slice(-100)));
  } catch { /* stockage indisponible : la croix ne vaut alors que pour cette visite */ }
}

export function GroupAdBanner({ onOpen }: { onOpen: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let me: string | null = null;
    const load = async () => {
      try {
        if (!me) me = await ensureUserId();
        const r = await fetchGroupAds();
        const joined = new Set(r.signups.filter((x) => x.user_id === me).map((x) => x.ad_id)); // annonces déjà rejointes
        if (!cancelled) setIds(r.ads.filter((a) => a.user_id !== me && !joined.has(a.id)).map((a) => a.id));
      } catch { /* ignoré */ }
    };
    void load();
    // Plusieurs changements d'un coup : une seule relecture.
    const ch = subscribeGroupAds(() => { window.clearTimeout(timer); timer = window.setTimeout(() => void load(), 800); });
    return () => { cancelled = true; window.clearTimeout(timer); leaveScenePresence(ch); };
  }, []);
  const visible = ids.filter((id) => !dismissed.includes(id));
  const count = visible.length;
  if (count === 0) return null;
  const close = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...dismissed, ...visible];
    setDismissed(next);
    writeDismissed(next);
  };
  return (
    <div
      className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-[#7a4a22] bg-[#f1dfb6]/95 py-1 pl-4 pr-2 text-sm font-extrabold text-[#3a2410] shadow-lg"
      style={{ fontFamily: "'Baloo 2', cursive" }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="animate-pulse hover:animate-none hover:underline"
        title="Ouvrir le Panneau des Aventuriers"
      >
        📋 Un groupe est en formation !{count > 1 ? ` (${count} annonces)` : ""}
      </button>
      <button type="button" onClick={close} className="rounded-full px-1.5 text-xs leading-none opacity-70 hover:bg-[#7a4a22]/20 hover:opacity-100" title="Ne plus afficher pour ces annonces">✕</button>
    </div>
  );
}
