// /admin > Scènes > « expedition » : une musique (ou plusieurs) par type d'étape (SQL 050).
import { useState } from "react";
import { scenesClient, type MusicFile, type Scene } from "../lib/scenes-supabase";
import { joinMusicList, parseMusicList } from "../lib/jingle";

const TYPES = [
  { key: "music_narrative", label: "📖 Étape narrative (rencontre, camp…)" },
  { key: "music_combat", label: "⚔ Combat" },
  { key: "music_danger", label: "⚠ Danger (danger imminent, épreuve)" },
  { key: "music_boss", label: "👑 Boss et mini-boss" },
] as const;
type Key = (typeof TYPES)[number]["key"];

export function AdminStepMusic({ scene, files }: { scene: Scene; files: MusicFile[] }) {
  const [vals, setVals] = useState<Record<Key, string>>(() => ({
    music_narrative: scene.music_narrative ?? "",
    music_combat: scene.music_combat ?? "",
    music_danger: scene.music_danger ?? "",
    music_boss: scene.music_boss ?? "",
  }));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = TYPES.some((t) => vals[t.key] !== ((scene as any)[t.key] ?? ""));

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await scenesClient.from("scenes").update(vals).eq("id", scene.id);
    setBusy(false);
    if (error) setMsg(error.message.includes("music_") ? "Lance d'abord le SQL 050." : error.message);
    else {
      TYPES.forEach((t) => ((scene as any)[t.key] = vals[t.key]));
      setMsg("Musiques d'expédition enregistrées ✅");
    }
  }

  return (
    <div className="mb-4 rounded bg-neutral-800 px-3 py-2 text-sm">
      <div className="mb-1 text-xs opacity-80">
        🎼 <b>Musiques par type d'étape</b> <i>(vide = la musique de la scène ; deux étapes du même type de suite : la musique continue)</i>
      </div>
      {TYPES.map((t) => {
        const list = parseMusicList(vals[t.key]);
        return (
          <div key={t.key} className="mb-1 flex flex-wrap items-center gap-2">
            <span className="w-64 text-xs">{t.label}</span>
            {list.length === 0 && <span className="text-xs opacity-60">— musique de la scène —</span>}
            {list.map((u) => (
              <span key={u} className="inline-flex items-center gap-1 rounded bg-neutral-900 px-2 py-1 text-xs">
                {files.find((f) => f.url === u)?.name ?? decodeURIComponent(u.split("/").pop() ?? u)}
                <button type="button" title="Retirer" className="text-red-400" onClick={() => setVals((v) => ({ ...v, [t.key]: joinMusicList(list.filter((x) => x !== u)) }))}>✕</button>
              </span>
            ))}
            <select
              value=""
              onChange={(e) => {
                const u = e.target.value;
                if (u && !list.includes(u)) setVals((v) => ({ ...v, [t.key]: joinMusicList([...list, u]) }));
              }}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            >
              <option value="">+ Ajouter…</option>
              {files.map((f) => <option key={f.name} value={f.url}>{f.name}</option>)}
            </select>
          </div>
        );
      })}
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy || !dirty} className="rounded bg-emerald-700 px-3 py-1 text-xs font-semibold disabled:opacity-40">{busy ? "Enregistrement…" : "Enregistrer"}</button>
        {msg && <span className="text-xs">{msg}</span>}
      </div>
    </div>
  );
}
