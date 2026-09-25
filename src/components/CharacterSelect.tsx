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
      <div className="w-full max-w-lg rounded-xl border border-[#7a4a22]/70 bg-[#2a180c] p-5 text-[#fff3d6]">
        <h2 className="mb-4 text-center text-2xl font-bold" style={{ fontFamily: "'Baloo 2', cursive" }}>
          Choisis ton personnage
        </h2>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du personnage"
          maxLength={30}
          className="mb-4 w-full rounded-lg border border-[#7a4a22]/70 bg-black/20 px-3 py-2 text-sm text-[#fff3d6] outline-none placeholder:text-[#c9a877]/50"
        />

        <div className="mb-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={`rounded-full px-3 py-1 text-sm ${tab === "existing" ? "bg-[#7a4a22]" : "bg-black/20"}`}
          >
            Personnage existant
          </button>
          <button
            type="button"
            onClick={() => setTab("draw")}
            className={`rounded-full px-3 py-1 text-sm ${tab === "draw" ? "bg-[#7a4a22]" : "bg-black/20"}`}
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
                  className={`overflow-hidden rounded-lg border-2 ${selected === a.id ? "border-[#e8b168]" : "border-transparent"}`}
                >
                  <img src={a.image_url} alt={a.name} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!selected}
              onClick={confirmExisting}
              className="mt-4 w-full rounded-lg bg-[#7a4a22] py-2 font-bold disabled:opacity-40"
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
