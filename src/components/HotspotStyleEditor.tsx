// /admin : image, taille et miroir des lieux en personnages (forge, ferme, marchand…).
import { useEffect, useState } from "react";
import { HOTSPOT_KINDS, fetchHotspotStyles, saveHotspotStyle, uploadHotspotImage, type HotspotStyle } from "../lib/hotspots";

export function HotspotStyleEditor() {
  const [styles, setStyles] = useState<Record<string, HotspotStyle>>({});
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void fetchHotspotStyles().then(setStyles);
  }, []);
  const kinds = HOTSPOT_KINDS.filter((k) => styles[k.kind]);

  const save = async (st: HotspotStyle) => {
    setStyles((o) => ({ ...o, [st.kind]: st }));
    try {
      await saveHotspotStyle(st);
      setMsg("✔ Enregistré");
    } catch (e: any) {
      setMsg(e?.message?.includes("hotspot_styles") ? "Lance d'abord le SQL 083 dans Supabase." : (e?.message ?? "Erreur"));
    }
  };

  return (
    <div className="mt-4 max-w-3xl rounded border border-neutral-700 p-3 text-sm">
      <div className="mb-1 font-bold text-amber-400">Apparence des lieux (image, taille, miroir)</div>
      <div className="mb-2 text-xs text-neutral-400">
        Valable pour toutes les scènes. La taille est en % de la largeur de la scène. Le point posé = les pieds du personnage.
      </div>
      {msg && <div className="mb-2 rounded bg-neutral-800 px-2 py-1 text-xs">{msg}</div>}
      {kinds.map((k) => {
        const st = styles[k.kind];
        if (!st) return null;
        return (
          <div key={k.kind} className="mb-2 flex flex-wrap items-center gap-3 rounded bg-neutral-900 p-2">
            {st.image_url && <img src={st.image_url} alt="" className="h-14 w-14 object-contain" style={{ transform: st.flip ? "scaleX(-1)" : undefined }} />}
            <div className="min-w-[10rem] flex-1 font-semibold">{k.label}</div>
            <label className="flex items-center gap-1 text-xs">
              Nom
              <input
                value={st.npc_name ?? ""}
                onChange={(e) => setStyles((o) => ({ ...o, [k.kind]: { ...st, npc_name: e.target.value } }))}
                onBlur={() => void save(st)}
                className="w-28 rounded bg-neutral-800 px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              Taille
              <input
                type="number"
                min={2}
                max={40}
                step={0.5}
                value={st.width_pct}
                onChange={(e) => setStyles((o) => ({ ...o, [k.kind]: { ...st, width_pct: Number(e.target.value) || 9 } }))}
                onBlur={() => void save(st)}
                className="w-16 rounded bg-neutral-800 px-1 py-0.5 text-right"
              />
              %
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={st.flip} onChange={(e) => void save({ ...st, flip: e.target.checked })} /> Miroir
            </label>
            <label className="cursor-pointer rounded bg-neutral-700 px-2 py-1 text-xs">
              Changer l'image
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await uploadHotspotImage(k.kind, f);
                    await save({ ...st, image_url: url });
                  } catch (err: any) {
                    setMsg(err?.message ?? "Envoi impossible");
                  }
                }}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}
