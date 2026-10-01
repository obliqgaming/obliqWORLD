import { useState, type ChangeEvent, type MouseEvent } from "react";
import { uploadDrawingAsCharacterAsset, type AuthIdentity, type VisualAsset } from "../lib/scenes-supabase";
import { AccountBadge } from "./AccountBadge";
import { DrawingCanvas } from "./DrawingCanvas";
import { SoundControl } from "./SoundControl";

export function CharacterSelect({
  assets,
  onChoose,
  muted,
  onToggleMute,
  volume,
  onVolumeChange,
  authIdentity,
  onConnect,
  onDisconnect,
  error,
  busy,
}: {
  assets: VisualAsset[];
  onChoose: (visualAssetId: string, name: string) => void;
  muted: boolean;
  onToggleMute: (e: MouseEvent) => void;
  volume: number;
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  authIdentity: AuthIdentity | null;
  onConnect: (provider: "twitch" | "discord") => void;
  onDisconnect: () => void;
  // Message à afficher si le chargement/la création du personnage a échoué,
  // et si une création est en cours (désactive "Confirmer" entre-temps).
  error?: string | null;
  busy?: boolean;
}) {
  const [tab, setTab] = useState<"existing" | "draw">("existing");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const confirmExisting = () => {
    if (!selected) return;
    onChoose(selected, name);
  };

  const handleDrawingExported = async (blob: Blob) => {
    setSaving(true);
    try {
      const asset = await uploadDrawingAsCharacterAsset(blob, name);
      onChoose(asset.id, name);
    } catch (e) {
      console.error("Drawing upload failed", e);
      setSaving(false);
    }
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-[#1a0f07] p-4">
      <SoundControl
        muted={muted}
        onToggleMute={onToggleMute}
        volume={volume}
        onVolumeChange={onVolumeChange}
        className="absolute right-5 top-5 z-10"
      />
      <AccountBadge
        identity={authIdentity}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        className="absolute left-5 top-5 z-10"
      />

      <div
        className="w-full max-w-3xl text-[#3a2210]"
        style={{
          borderStyle: "solid",
          // Nouveau cadre (rectangle simple, sans lanterne/bannière qui dépassait du
          // cadre en bois de l'ancienne image et provoquait le chevauchement du texte
          // au rendu). Bordure mesurée directement sur le fichier source
          // (1672x941 px) : gauche 242, droite 244, haut 89, bas 101.
          // Important : border-width en % n'est pas fiable sur toutes les tailles
          // (le navigateur peut l'ignorer/l'écraser, ce qui rendait le cadre en bois
          // quasi invisible) — on utilise des valeurs fixes en px à la place, dans
          // les mêmes proportions que le fichier source.
          borderWidth: "48px 62px 54px 61px",
          borderImageSource: "url('/ui/character-frame.webp')",
          borderImageSlice: "89 244 101 242 fill",
          borderImageRepeat: "stretch",
        }}
      >
        <h2 className="mb-4 text-center text-2xl font-bold" style={{ fontFamily: "'Baloo 2', cursive" }}>
          Choisis ton personnage
        </h2>

        {error && (
          <p className="mb-4 rounded-lg border-2 border-red-700/60 bg-red-900/20 px-3 py-2 text-center text-sm font-bold text-red-800">
            {error}
          </p>
        )}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du personnage"
          maxLength={30}
          className="mb-4 w-full rounded-lg border-2 border-[#7a4a22]/70 bg-white/60 px-3 py-2 text-sm font-medium text-[#3a2210] outline-none placeholder:font-normal placeholder:text-[#7a4a22]/80"
        />

        <div className="mb-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              tab === "existing" ? "bg-[#7a4a22] text-[#fff3d6]" : "bg-black/10 text-[#3a2210]"
            }`}
          >
            Personnage existant
          </button>
          <button
            type="button"
            onClick={() => setTab("draw")}
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              tab === "draw" ? "bg-[#7a4a22] text-[#fff3d6]" : "bg-black/10 text-[#3a2210]"
            }`}
          >
            Dessiner le mien
          </button>
        </div>

        {tab === "existing" ? (
          <div>
            <div className="grid max-h-72 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className={`overflow-hidden rounded-lg border-2 ${
                    selected === a.id ? "border-[#7a4a22]" : "border-transparent"
                  }`}
                >
                  <img src={a.image_url} alt={a.name} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!selected || !!busy}
              onClick={confirmExisting}
              className="mt-4 w-full rounded-lg bg-[#7a4a22] py-2 font-bold text-[#fff3d6] disabled:opacity-40"
            >
              {busy ? "Création…" : "Confirmer"}
            </button>
          </div>
        ) : (
          <DrawingCanvas onExport={handleDrawingExported} exporting={saving} />
        )}
      </div>
    </div>
  );
}
