// Marqueur cliquable d'un lieu interactif + fenêtre qui s'ouvre au clic.
// Pour l'instant les fenêtres sont des maquettes : le contenu arrive pas à pas
// (forge, éditeur d'étapes).
import { GroupBoard } from "./GroupBoard";
import { uiSound } from "../lib/ui-sounds";
import { Coin, HotspotGlyph } from "./GameIcons";
import { CURSOR_INTERACT } from "../lib/cursors";
import { claimDailyGold, hotspotInfo, useHotspotStyles, type SceneHotspot } from "../lib/hotspots";
import { useEffect, useState } from "react";
import { ForgePanel, type ForgeCharacter } from "./ForgePanel";
import { EncounterEditor } from "./EncounterEditor";
import { MerchantPanel } from "./MerchantPanel";
import { FarmPanel } from "./FarmPanel";
import { QuestPanel } from "./QuestPanel";

export function HotspotMarker({ hotspot, onClick, bubble, alert }: { hotspot: SceneHotspot; onClick: () => void; bubble?: string | undefined; alert?: boolean | undefined }) {
  const info = hotspotInfo(hotspot.kind);
  const styles = useHotspotStyles();
  if (!styles && hotspotInfo(hotspot.kind).kind in { forge: 1, step_editor: 1, farm: 1, merchant: 1, quests: 1 }) return null; // réglages pas encore chargés : pas de saut de taille
  const st = styles?.[hotspot.kind];
  const seed = [...hotspot.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); // décale la respiration de chaque lieu
  if (st?.image_url) {
    // Lieu en image (personnage) : le point posé dans /admin = ses pieds, la largeur est un % de la scène.
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={hotspot.label ?? info.label}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
        style={{ left: `${hotspot.position.x}%`, top: `${hotspot.position.y}%`, width: `${st.width_pct}%`, cursor: CURSOR_INTERACT, zIndex: bubble ? 36 : 11 + Math.max(0, Math.min(8, Math.floor(hotspot.position.y / (100 / 9)))) }}
      >
        {(st.npc_name || bubble || alert) && (
          <span className="pointer-events-none absolute bottom-full left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ fontFamily: "'Baloo 2', cursive" }}>
            {bubble && (
              <span
                className="relative mb-1 block w-max max-w-[220px] rounded-xl border border-[#b7791f]/80 bg-[#fff1c2] px-3 py-1.5 text-center text-sm font-semibold text-[#6b3a07] shadow-md"
                style={{ whiteSpace: "normal" }}
              >
                {bubble}
                <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent" style={{ borderTopColor: "#fff1c2" }} />
              </span>
            )}
            {alert && !bubble && (
              <span className="obw-alert text-2xl font-black leading-none" style={{ color: "#facc15", textShadow: "0 0 6px #b45309, 0 1px 2px #000, 0 0 10px #fde047" }}>❗</span>
            )}
            {st.npc_name && (
              <span className="whitespace-nowrap text-sm font-extrabold" style={{ color: "#fcd34d", textShadow: "0 1px 3px #000, 0 0 6px rgba(0,0,0,0.8)" }}>
                {st.npc_name}
              </span>
            )}
          </span>
        )}
        <span
          className="obw-breathe block"
          style={{ animationDuration: `${3.2 + (seed % 14) / 10}s`, animationDelay: `-${(seed % 37) / 10}s` }}
        >
          <img
            src={st.image_url}
            alt={info.label}
            draggable={false}
            className="block w-full transition-transform hover:scale-105"
            style={{ transform: st.flip ? "scaleX(-1)" : undefined, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.45))" }}
          />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={hotspot.label ?? info.label}
      className="pointer-events-auto absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
      style={{ left: `${hotspot.position.x}%`, top: `${hotspot.position.y}%`, cursor: CURSOR_INTERACT }}
    >
      {"bare" in info && info.bare ? (
        <span className="text-lg transition-transform hover:scale-125" style={{ filter: "drop-shadow(0 0 6px rgba(253,230,138,0.9))" }}>
          <HotspotGlyph icon={info.icon} />
        </span>
      ) : (
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 text-xl transition-transform hover:scale-110"
          style={{ background: "rgba(43,20,6,0.8)", borderColor: "rgba(253,230,138,0.9)", boxShadow: "0 0 12px 3px rgba(253,230,138,0.35)" }}
        >
          <HotspotGlyph icon={info.icon} />
        </span>
      )}
    </button>
  );
}

export function HotspotPanel({
  hotspot,
  onClose,
  character,
  onWeaponChanged,
  onInvite,
}: {
  hotspot: SceneHotspot;
  onClose: () => void;
  character?: ForgeCharacter | null;
  onWeaponChanged?: () => void;
  onInvite?: (characterId: string) => void;
}) {
  if (hotspot.kind === "forge") {
    return <ForgePanel character={character ?? null} onClose={onClose} onWeaponChanged={onWeaponChanged ?? (() => {})} />;
  }
  if (hotspot.kind.startsWith("gold")) {
    return <GoldPanel hotspotId={hotspot.id} onClose={onClose} />;
  }
  if (hotspot.kind === "board") {
    return <GroupBoard character={character ? { id: character.id, name: character.name } : null} onClose={onClose} onInvite={onInvite} />;
  }
  if (hotspot.kind === "quests") {
    return <QuestPanel onClose={onClose} />;
  }
  if (hotspot.kind === "farm") {
    return <FarmPanel onClose={onClose} />;
  }
  if (hotspot.kind === "merchant") {
    return <MerchantPanel onClose={onClose} onWeaponChanged={onWeaponChanged ?? (() => {})} />;
  }
  if (hotspot.kind === "step_editor") {
    return <EncounterEditor onClose={onClose} />;
  }
  const info = hotspotInfo(hotspot.kind);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="w-[min(30rem,92%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-[#3a2410] shadow-xl">
        <div className="text-xl font-extrabold">
          <HotspotGlyph icon={info.icon} /> {hotspot.label ?? info.label}
        </div>
        <div className="mt-2 text-sm">{info.hint ? `${info.hint}.` : ""} Cet endroit n'est pas encore construit : il arrive bientôt.</div>
        <button type="button" onClick={onClose} className="mt-4 rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-5 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818]">
          Fermer
        </button>
      </div>
    </div>
  );
}

function GoldPanel({ hotspotId, onClose }: { hotspotId: string; onClose: () => void }) {
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    let alive = true;
    claimDailyGold(hotspotId)
      .then((n) => { uiSound("coin"); if (alive) setRes({ ok: true, text: `+${n} flouz ramassé !` }); })
      .catch((e: any) => alive && setRes({ ok: false, text: e?.message?.includes("daily_gold_claim") ? "Cet endroit n'est pas encore activé (SQL 032)." : (e?.message ?? "Impossible de ramasser.") }));
    return () => {
      alive = false;
    };
  }, [hotspotId]);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="w-[min(20rem,92%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-center text-[#3a2410] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl"><Coin size="2.5rem" /></div>
        <div className="mt-2 text-base font-extrabold">{res ? res.text : "…"}</div>
        <button type="button" onClick={onClose} className="mt-4 rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-5 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818]">OK</button>
      </div>
    </div>
  );
}
