// Marqueur cliquable d'un lieu interactif + fenêtre qui s'ouvre au clic.
// Pour l'instant les fenêtres sont des maquettes : le contenu arrive pas à pas
// (forge, éditeur d'étapes).
import { CURSOR_INTERACT } from "../lib/cursors";
import { hotspotInfo, type SceneHotspot } from "../lib/hotspots";
import { ForgePanel, type ForgeCharacter } from "./ForgePanel";
import { EncounterEditor } from "./EncounterEditor";
import { MerchantPanel } from "./MerchantPanel";
import { FarmPanel } from "./FarmPanel";

export function HotspotMarker({ hotspot, onClick }: { hotspot: SceneHotspot; onClick: () => void }) {
  const info = hotspotInfo(hotspot.kind);
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
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 text-xl transition-transform hover:scale-110"
        style={{ background: "rgba(43,20,6,0.8)", borderColor: "rgba(253,230,138,0.9)", boxShadow: "0 0 12px 3px rgba(253,230,138,0.35)" }}
      >
        {info.icon}
      </span>
    </button>
  );
}

export function HotspotPanel({
  hotspot,
  onClose,
  character,
  onWeaponChanged,
}: {
  hotspot: SceneHotspot;
  onClose: () => void;
  character?: ForgeCharacter | null;
  onWeaponChanged?: () => void;
}) {
  if (hotspot.kind === "forge") {
    return <ForgePanel character={character ?? null} onClose={onClose} onWeaponChanged={onWeaponChanged ?? (() => {})} />;
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
          {info.icon} {hotspot.label ?? info.label}
        </div>
        <div className="mt-2 text-sm">{info.hint ? `${info.hint}.` : ""} Cet endroit n'est pas encore construit : il arrive bientôt.</div>
        <button type="button" onClick={onClose} className="mt-4 rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-5 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818]">
          Fermer
        </button>
      </div>
    </div>
  );
}
