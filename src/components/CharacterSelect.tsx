import { useState } from "react";
import { uploadDrawingAsCharacterAsset, type VisualAsset } from "../lib/scenes-supabase";
import { DrawingCanvas } from "./DrawingCanvas";

export function CharacterSelect({
  assets,
  onChoose,
}: {
  assets: VisualAsset[];
  onChoose: (visualAssetId: string, name: string) => void;
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
    <div className="flex h-screen w-screen items-center justify-center bg-[#1a0f07] p-4">
      <div
        className="w-full max-w-3xl text-[#3a2210]"
        style={{
          borderStyle: "solid",
          // Nouveau cadre (rectangle simple, sans lanterne/bannière qui dépassait du
          // cadre en bois de l'ancienne image et provoquait le chevauchement du texte
          // au rendu). Bordure mesurée directement sur le fichier source
          // (1672x941 px) : gauche 242, droite 244, haut 89, bas 101 — proportions
          // conservées ici pour que rien ne déborde ni ne soit tronqué quelle que
          // soit la taille finale à l'écran.
          borderWidth: "5.7% 7.3% 6.4% 7.2%",
          borderImageSource: "url('/ui/character-frame.webp')",
          borderImageSlice: "89 244 101 242 fill",
          borderImageRepeat: "stretch",
        }}
      >
        <h2 className="mb-4 text-center text-2xl font-bold" style={{ fontFamily: "'Baloo 2', cursive" }}>
          Choisis ton personnage
        </h2>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du personnage"
          maxLength={30}
          className="mb-4 w-full rounded-lg border border-[#7a4a22]/40 bg-black/5 px-3 py-2 text-sm text-[#3a2210] outline-none placeholder:text-[#7a4a22]/50"
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
              disabled={!selected}
              onClick={confirmExisting}
              className="mt-4 w-full rounded-lg bg-[#7a4a22] py-2 font-bold text-[#fff3d6] disabled:opacity-40"
            >
              Confirmer
            </button>
          </div>
        ) : (
          <DrawingCanvas onExport={handleDrawingExported} exporting={saving} />
        )}
      </div>
    </div>
  );
}
