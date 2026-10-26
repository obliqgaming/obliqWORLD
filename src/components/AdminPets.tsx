// Onglet « Pets » de /admin : compagnons de départ (SQL 043-044). Renommer, changer la taille, retirer, ajouter.
import { useEffect, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";

type Pet = { id: string; name: string; image_url: string; tier: "small" | "medium" | "large" };
const TIERS: Record<string, string> = { small: "Petit", medium: "Moyen", large: "Grand" };
const FIELD = "rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-white";

export function AdminPets() {
  const [list, setList] = useState<Pet[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  async function load() {
    const { data, error } = await scenesClient.from("starter_companions").select("id, name, image_url, tier").order("sort").order("name");
    if (error) setMsg(error.message.includes("starter_companions") ? "Lance d'abord les SQL 043 et 044." : error.message);
    else setList((data ?? []) as Pet[]);
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(id: string, fn: () => PromiseLike<{ data?: any; error: { message: string } | null }>, ok: string) {
    setBusy(id);
    setMsg(null);
    const r = await fn();
    setBusy(null);
    if (r.error) setMsg(r.error.message.includes("admin_pet") ? "Fonction absente : lance le SQL 044." : r.error.message);
    else {
      setMsg(ok);
      await load();
    }
  }

  return (
    <div className="p-2 text-sm text-white">
      <p className="mb-2 opacity-80">
        Compagnons offerts au départ (chaque joueur en choisit un, une seule fois). Retirer un pet de la liste ne l'enlève pas aux joueurs qui l'ont déjà choisi ; le fichier du bucket n'est pas touché.
      </p>
      {msg && <div className="mb-2 rounded bg-neutral-800 p-2">{msg}</div>}
      {list === null ? (
        "Chargement…"
      ) : (
        <table className="w-full text-left">
          <thead className="text-xs uppercase opacity-60">
            <tr><th className="p-1" /><th className="p-1">Nom</th><th className="p-1">Taille</th><th className="p-1" /></tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const val = edits[p.id] ?? p.name;
              return (
                <tr key={p.id} className="border-t border-neutral-800">
                  <td className="p-1"><img src={p.image_url} alt="" className="h-12 w-12 rounded bg-neutral-800 object-contain" /></td>
                  <td className="p-1">
                    <input value={val} maxLength={40} onChange={(e) => setEdits((s) => ({ ...s, [p.id]: e.target.value }))} className={`w-56 ${FIELD}`} />
                    <button type="button" disabled={busy === p.id || val.trim() === p.name || !val.trim()} onClick={() => void run(p.id, () => scenesClient.rpc("admin_pet_rename", { p_id: p.id, p_name: val }), "✔ Renommé")} className="ml-2 rounded bg-emerald-700 px-3 py-1 font-semibold disabled:opacity-40">Renommer</button>
                  </td>
                  <td className="p-1">
                    <select value={p.tier} disabled={busy === p.id} onChange={(e) => void run(p.id, () => scenesClient.rpc("admin_pet_set_tier", { p_id: p.id, p_tier: e.target.value }), "✔ Taille changée")} className={FIELD}>
                      {Object.entries(TIERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="p-1">
                    <button type="button" disabled={busy === p.id} onClick={() => window.confirm(`Retirer « ${p.name} » de la liste de départ ?`) && void run(p.id, () => scenesClient.rpc("admin_pet_delete", { p_id: p.id }), "✔ Retiré de la liste")} className="rounded bg-red-800 px-3 py-1 font-semibold disabled:opacity-40">Retirer</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3">
        <span className="font-semibold">Ajouter :</span>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom" maxLength={40} className={`w-40 ${FIELD}`} />
        <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="Adresse de l'image (bucket drawings)" className={`w-96 ${FIELD}`} />
        <button type="button" disabled={!newUrl.trim() || busy === "new"} onClick={() => void run("new", () => scenesClient.rpc("admin_pet_add", { p_name: newName, p_url: newUrl.trim(), p_tier: "small" }), "✔ Ajouté").then(() => { setNewName(""); setNewUrl(""); })} className="rounded bg-emerald-700 px-3 py-1 font-semibold disabled:opacity-40">Ajouter</button>
      </div>
    </div>
  );
}
