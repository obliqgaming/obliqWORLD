// Bandeau flottant « cherche un groupe » : aperçu discret du tableau d'annonces,
// un clic ouvre le tableau complet (GroupBoard). Style parchemin identique au reste.
import { useEffect, useState } from "react";
import { fetchGroupAds } from "../lib/group-ads";

const FONT = { fontFamily: "'Baloo 2', cursive" };

export function GroupAdBanner({ onOpen }: { onOpen: () => void }) {
  const [openAds, setOpenAds] = useState<number | null>(null);

  // Un aperçu du nombre d'annonces actives, rafraîchi à l'ouverture de la scène.
  useEffect(() => {
    let cancelled = false;
    void fetchGroupAds()
      .then((r) => {
        if (!cancelled) setOpenAds(r.ads.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title="Tableau « cherche un groupe »"
      className="absolute right-5 top-44 z-30 flex max-w-[240px] items-center gap-2 rounded-lg border-2 border-[#7a4a22] bg-[#f1dfb6]/95 px-3 py-1.5 text-left shadow-md transition-transform hover:scale-[1.03]"
      style={FONT}
    >
      <span className="text-lg leading-none">📋</span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold leading-tight text-[#3a2410]">Groupes</span>
        <span className="block text-[11px] leading-tight text-[#5e3818]">
          {openAds === null ? "Cherche un groupe…" : openAds === 0 ? "Aucune annonce" : `${openAds} annonce${openAds > 1 ? "s" : ""}`}
        </span>
      </span>
    </button>
  );
}
