// Onglet « Phrases » de /admin : répliques des PNJ et phrases de montée de niveau (SQL 091). Ajouter, modifier, supprimer.
import { useEffect, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";
import { PHRASE_CATEGORIES, fetchAllPhrases } from "../lib/phrases";
import { NPC_LINES } from "../lib/npc-lines";
import { LEVEL_LINES } from "../lib/levelup";

type Row = { id: string; category: string; text: string };
const defaultsOf = (cat: string): string[] => (cat === "levelup" ? LEVEL_LINES : NPC_LINES[cat.replace("npc:", "")] ?? []);

export function AdminPhrases() {
  const [cat, setCat] = useState(PHRASE_CATEGORIES[0]!.key);
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newText, setNewText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data, error } = await scenesClient.from("game_phrases").select("id, category, text").eq("category", cat).order("created_at");
    if (error) return setMsg(error.message.includes("game_phrases") ? "Lance d'abord le SQL 091 dans Supabase." : error.message);
    setRows((data ?? []) as Row[]);
    setEdits({});
  }
  useEffect(() => { setMsg(null); void load(); }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (m: string) => { setMsg(m); void fetchAllPhrases(true); void load(); };
  const save = async (r: Row) => {
    const t = (edits[r.id] ?? r.text).trim();
    if (!t) return;
    const { error } = await scenesClient.from("game_phrases").update({ text: t }).eq("id", r.id);
    error ? setMsg(error.message) : done("✔ Enregistré");
  };
  const del = async (r: Row) => {
    if (!window.confirm("Supprimer cette phrase ?")) return;
    const { error } = await scenesClient.from("game_phrases").delete().eq("id", r.id);
    error ? setMsg(error.message) : done("Supprimée");
  };
  const add = async () => {
    const t = newText.trim();
    if (!t) return;
    const { error } = await scenesClient.from("game_phrases").insert({ category: cat, text: t });
    if (error) return setMsg(error.message);
    setNewText("");
    done("✔ Ajoutée");
  };
  const loadDefaults = async () => {
    const list = defaultsOf(cat);
    if (!list.length || !window.confirm(`Ajouter les ${list.length} phrases d'origine à cette liste ?`)) return;
    const { error } = await scenesClient.from("game_phrases").insert(list.map((text) => ({ category: cat, text })));
    error ? setMsg(error.message) : done("✔ Phrases d'origine ajoutées");
  };

  return (
    <div className="max-w-3xl p-3 text-sm">
      <p className="mb-2 text-xs text-neutral-400">
        Les répliques des PNJ s'affichent dans une bulle au-dessus de leur tête, et les phrases de montée de niveau sur l'écran « Niveau ! ». Si une liste est vide, le jeu utilise les phrases d'origine.
        La cadence des PNJ se règle dans Réglages (npc_speech_min_minutes / npc_speech_max_minutes).
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {PHRASE_CATEGORIES.map((c) => (
          <button key={c.key} type="button" onClick={() => setCat(c.key)} className={`rounded px-3 py-1 text-xs font-semibold ${cat === c.key ? "bg-amber-600" : "bg-neutral-800"}`}>{c.label}</button>
        ))}
      </div>
      {msg && <div className="mb-2 rounded bg-neutral-800 px-2 py-1 text-xs">{msg}</div>}
      {rows.length === 0 && (
        <div className="mb-2 rounded border border-neutral-700 p-2 text-xs">
          Aucune phrase enregistrée : le jeu utilise les {defaultsOf(cat).length} phrases d'origine.{" "}
          <button type="button" onClick={() => void loadDefaults()} className="rounded bg-neutral-700 px-2 py-0.5 font-semibold">Les charger ici pour les modifier</button>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} className="mb-1.5 flex items-start gap-2">
          <textarea value={edits[r.id] ?? r.text} onChange={(e) => setEdits((o) => ({ ...o, [r.id]: e.target.value }))} rows={2} maxLength={200} className="flex-1 rounded bg-neutral-800 px-2 py-1" />
          <button type="button" disabled={(edits[r.id] ?? r.text) === r.text} onClick={() => void save(r)} className="rounded bg-emerald-700 px-2 py-1 text-xs font-semibold disabled:opacity-40">Enregistrer</button>
          <button type="button" onClick={() => void del(r)} className="rounded bg-red-800 px-2 py-1 text-xs font-semibold">Supprimer</button>
        </div>
      ))}
      <div className="mt-3 flex items-start gap-2">
        <textarea value={newText} onChange={(e) => setNewText(e.target.value)} rows={2} maxLength={200} placeholder="Nouvelle phrase…" className="flex-1 rounded bg-neutral-800 px-2 py-1" />
        <button type="button" onClick={() => void add()} className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold">Ajouter</button>
      </div>
    </div>
  );
}
