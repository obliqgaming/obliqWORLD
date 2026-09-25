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
        className="w-full max-w-2xl text-[#3a2210]"
        style={{
          borderStyle: "solid",
          // Cadre "lanterne + médaillon" fourni par Lils. Valeurs de découpe estimées
          // à partir des dimensions réelles du fichier (1491x1055) — à ajuster si un
          // coin (lanterne à gauche, médaillon à droite) est étiré ou coupé au rendu.
          borderWidth: "70px 90px 60px 130px",
          borderImageSource: "url('/ui/character-frame.png')",
          borderImageSlice: "150 220 140 300 fill",
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
