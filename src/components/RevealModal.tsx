// Moment de « révélation » (booster, arme forgée…) : une fenêtre qui demande un clic pour dévoiler le contenu.
// La musique principale est coupée pendant ce moment (Music_Funny), et le son de la révélation est d'autant plus
// « gagnant » que la valeur (tier 0 à 5) est haute.
import { useEffect, useState, type ReactNode } from "react";
import { JINGLE_REVEAL, startJingle, stopJingle } from "../lib/jingle";
import { revealSound, uiSound } from "../lib/ui-sounds";

const GLOW = ["#d6c08f", "#d6c08f", "#4ade80", "#60a5fa", "#c084fc", "#fbbf24"];
const FONT = { fontFamily: "'Baloo 2', cursive" };

export const RARITY_TIER: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

export function RevealModal({ tier, title, children, onClose }: { tier: number; title: string; children: ReactNode; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    startJingle(JINGLE_REVEAL);
    uiSound("drum");
    return () => stopJingle();
  }, []);
  const glow = GLOW[Math.min(5, Math.max(0, tier))]!;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3" style={FONT} onClick={(e) => e.stopPropagation()}>
      <style>{`
        @keyframes rv-pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.12);opacity:1}}
        @keyframes rv-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
        @keyframes rv-flash{0%{opacity:.9}100%{opacity:0}}
      `}</style>
      {!revealed ? (
        <button
          type="button"
          onClick={() => {
            revealSound(tier);
            setRevealed(true);
          }}
          className="flex flex-col items-center gap-4 text-[#fff3d6]"
        >
          <div
            className="flex h-40 w-40 items-center justify-center rounded-full text-7xl font-extrabold"
            style={{ background: "radial-gradient(circle, #5a3a1a 0%, #2b1406 70%)", boxShadow: "0 0 50px 12px rgba(253,230,138,.35)", animation: "rv-pulse 1.3s ease-in-out infinite" }}
          >
            ?
          </div>
          <div className="text-xl font-extrabold">{title}</div>
          <div className="text-sm opacity-80">Clique pour révéler</div>
        </button>
      ) : (
        <div
          className="relative w-[min(26rem,96%)] rounded-xl border-4 bg-[#f1dfb6] p-5 text-center text-[#3a2410]"
          style={{ borderColor: glow, boxShadow: `0 0 ${20 + tier * 14}px ${4 + tier * 3}px ${glow}`, animation: "rv-pop 450ms ease-out both" }}
        >
          {tier >= 3 && <div className="pointer-events-none absolute inset-0 rounded-lg bg-white" style={{ animation: "rv-flash 700ms ease-out forwards" }} />}
          <div className="text-xs font-bold uppercase tracking-widest text-[#7a4a22]">{title}</div>
          <div className="my-3">{children}</div>
          <button
            type="button"
            onClick={() => {
              uiSound("click");
              onClose();
            }}
            className="rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-6 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818]"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
