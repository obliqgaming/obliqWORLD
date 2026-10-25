// Onglet « Créatures » de /admin : renommer les créatures de la forêt (Wild), les personnages morts devenus monstres
// et, avec eux, les compagnons obtenus (SQL 039).
import { useEffect, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";

type Creature = { id: string; name: string; image_url: string; monster_origin: "wild" | "dead_character" };

export function AdminCreatures() {
  const [list, setList] = useState<Creature[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error } = await scenesClient
      .from("visual_assets")
      .select("id, name, image_url, monster_origin")
      .not("monster_origin", "is", null)
      .order("monster_origin")
      .order("name");
    if (error) setMsg(error.message);
    else setList((data ?? []) as Creature[]);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(c: Creature) {
    const name = (edits[c.id] ?? c.name).trim();
    if (!name || name === c.name) return;
    setBusy(c.id);
    setMsg(null);
    const { data, error } = await scenesClient.rpc("admin_rename_creature", { p_asset_id: c.id, p_name: name });
    setBusy(null);
    if (error) {
      setMsg(error.message.includes("admin_rename_creature") ? "Fonction absente : lance le SQL 039." : error.message);
      return;
    }
    setMsg(`✔ « ${c.name} » → « ${name} » (${(data as any)?.compagnons_mis_a_jour ?? 0} compagnon(s) mis à jour)`);
    setEdits((e) => {
      const n = { ...e };
      delete n[c.id];
      return n;
    });
    await load();
  }

  return (
    <div className="p-2 text-sm">
      <p className="mb-2 opacity-80">
        Renomme les créatures de la forêt et les personnages morts devenus monstres. Le nouveau nom s'affiche en combat et sur les compagnons déjà obtenus.
      </p>
      {msg && <div className="mb-2 rounded bg-neutral-800 p-2">{msg}</div>}
      {list === null ? (
        "Chargement…"
      ) : list.length === 0 ? (
        "Aucune créature."
      ) : (
        <table className="w-full text-left">
          <thead className="text-xs uppercase opacity-60">
            <tr><th className="p-1" /><th className="p-1">Nom</th><th className="p-1">Origine</th><th className="p-1" /></tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-neutral-800">
                <td className="p-1"><img src={c.image_url} alt="" className="h-12 w-12 rounded bg-neutral-800 object-contain" /></td>
                <td className="p-1">
                  <input
                    value={edits[c.id] ?? c.name}
                    maxLength={40}
                    onChange={(e) => setEdits((s) => ({ ...s, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && void save(c)}
                    className="w-64 rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
                  />
                </td>
                <td className="p-1 opacity-70">{c.monster_origin === "wild" ? "Forêt (Wild)" : "Personnage mort"}</td>
                <td className="p-1">
                  <button type="button" disabled={busy === c.id || (edits[c.id] ?? c.name).trim() === c.name} onClick={() => void save(c)} className="rounded bg-emerald-700 px-3 py-1 font-semibold disabled:opacity-40">
                    Renommer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
