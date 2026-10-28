// Onglet « Créatures » de /admin : renommer les créatures de la forêt (Wild), les personnages morts devenus monstres
// et, avec eux, les compagnons obtenus (SQL 039).
import { useEffect, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";

type Creature = { id: string; name: string; image_url: string; monster_origin: "wild" | "dead_character" | "drawn_companion" };

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

  // Ajouter une créature de Wild : on envoie l'image (PNG, 1 Mo max) dans le dossier drawings, puis on la marque « Wild ».
  const [newName, setNewName] = useState("");
  const [uploading, setUploading] = useState(false);
  async function addCreature(file: File) {
    setMsg(null);
    if (file.type !== "image/png") return setMsg("L'image doit être un PNG.");
    if (file.size > 1024 * 1024) return setMsg("Image trop lourde (1 Mo maximum).");
    setUploading(true);
    try {
      const fileName = `creature_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`;
      const { error: upErr } = await scenesClient.storage.from("drawings").upload(fileName, file, { contentType: "image/png", upsert: false });
      if (upErr) throw upErr;
      const url = scenesClient.storage.from("drawings").getPublicUrl(fileName).data.publicUrl;
      const name = newName.trim() || file.name.replace(/\.png$/i, "").slice(0, 40);
      const { error } = await scenesClient.rpc("admin_creature_add", { p_name: name, p_image_url: url });
      if (error) {
        void scenesClient.storage.from("drawings").remove([fileName]);
        throw error;
      }
      setMsg(`✔ « ${name} » ajoutée aux créatures de la forêt.`);
      setNewName("");
      await load();
    } catch (e: any) {
      setMsg(e?.message?.includes("admin_creature_add") ? "Fonction absente : lance le SQL 051." : (e?.message ?? "Erreur"));
    } finally {
      setUploading(false);
    }
  }

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
    <div className="p-2 text-sm text-white">
      <p className="mb-2 opacity-80">
        Renomme les créatures de la forêt et les personnages morts devenus monstres. Le nouveau nom s'affiche en combat et sur les compagnons déjà obtenus.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded bg-neutral-800 p-2">
        <b>➕ Ajouter une créature de Wild</b>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom (sinon : nom du fichier)" maxLength={40} className="w-56 rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-white" />
        <label className="cursor-pointer rounded bg-emerald-700 px-3 py-1 font-semibold">
          {uploading ? "Envoi…" : "Choisir une image PNG"}
          <input type="file" accept="image/png" disabled={uploading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addCreature(f); }} />
        </label>
      </div>
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
                    className="w-64 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-white"
                  />
                </td>
                <td className="p-1 opacity-70">{c.monster_origin === "wild" ? "Forêt (Wild)" : c.monster_origin === "drawn_companion" ? "Compagnon dessiné" : "Personnage mort"}</td>
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
