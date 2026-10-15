import { useState, type ChangeEvent, type MouseEvent } from "react";
import { uploadDrawingAsCharacterAsset, type AuthIdentity, type CharacterFamily, type Point, type VisualAsset } from "../lib/scenes-supabase";
import { AccountBadge } from "./AccountBadge";
import { DrawingCanvas } from "./DrawingCanvas";
import { SoundControl } from "./SoundControl";

// Provisoire pendant le développement : permet de se connecter en invité avec un
// « personnage déjà existant ». À passer à false quand le jeu sera ouvert : les
// nouveaux joueurs devront alors dessiner leur personnage.
const DEV_ALLOW_EXISTING_CHARACTERS = true;

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
  onChoose: (visualAssetId: string, name: string, family: CharacterFamily) => void;
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
  const [name, setName] = useState("");
  // Famille choisie AVANT le dessin ; définitive une fois le personnage créé.
  const [family, setFamily] = useState<CharacterFamily | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"draw" | "existing">("draw");
  const [selected, setSelected] = useState<string | null>(null);

  const handleDrawingExported = async (blob: Blob, handAnchor: Point | null) => {
    if (!family) return;
    setSaving(true);
    try {
      const asset = await uploadDrawingAsCharacterAsset(blob, name, handAnchor);
      onChoose(asset.id, name, family);
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
          Crée ton personnage
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

        {/* Étape 1 : la famille (définitive) */}
        <p className="mb-2 text-center text-sm font-bold">1. Choisis ta famille (définitif)</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {(
            [
              { id: "melee", label: "Mêlée", desc: "Tu te bats au corps à corps." },
              { id: "magie", label: "Magie", desc: "Tu lances des sorts." },
            ] as { id: CharacterFamily; label: string; desc: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={saving || !!busy}
              onClick={() => setFamily(f.id)}
              className={`rounded-lg border-2 px-3 py-2 text-left ${
                family === f.id ? "border-[#7a4a22] bg-[#7a4a22]/20" : "border-transparent bg-black/10"
              }`}
            >
              <div className="text-base font-bold">{f.label}</div>
              <div className="text-xs font-medium opacity-80">{f.desc}</div>
            </button>
          ))}
        </div>

        {/* Étape 2 : le dessin (obligatoire) */}
        {DEV_ALLOW_EXISTING_CHARACTERS && (
          <div className="mb-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setTab("draw")}
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                tab === "draw" ? "bg-[#7a4a22] text-[#fff3d6]" : "bg-black/10 text-[#3a2210]"
              }`}
            >
              Dessiner le mien
            </button>
            <button
              type="button"
              onClick={() => setTab("existing")}
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                tab === "existing" ? "bg-[#7a4a22] text-[#fff3d6]" : "bg-black/10 text-[#3a2210]"
              }`}
            >
              Personnage existant (provisoire)
            </button>
          </div>
        )}
        {!family ? (
          <p className="rounded-lg bg-black/10 px-3 py-6 text-center text-sm font-medium">
            Choisis d'abord ta famille pour continuer.
          </p>
        ) : tab === "existing" && DEV_ALLOW_EXISTING_CHARACTERS ? (
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
              onClick={() => selected && onChoose(selected, name, family)}
              className="mt-4 w-full rounded-lg bg-[#7a4a22] py-2 font-bold text-[#fff3d6] disabled:opacity-40"
            >
              {busy ? "Création…" : "Confirmer"}
            </button>
          </div>
        ) : (
          <DrawingCanvas onExport={handleDrawingExported} exporting={saving || !!busy} />
        )}
      </div>
    </div>
  );
}
