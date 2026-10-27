// Onglet « Compagnons » de /admin : modération des compagnons dessinés par les joueurs (SQL 048).
import { useEffect, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";
import { fetchAuthorNames } from "../lib/authors";

type Row = { id: string; name: string; image_url: string; rarity: string; hidden: boolean; author_user_id: string; created_at: string };

export function AdminCompanions() {
  const [list, setList] = useState<Row[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error } = await scenesClient.from("companion_designs").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) {
      setMsg(error.message.includes("companion_designs") ? "Lance d'abord le SQL 048." : error.message);
      return;
    }
    const rows = (data ?? []) as Row[];
    setList(rows);
    setNames(await fetchAuthorNames(rows.map((r) => r.author_user_id)));
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(id: string, fn: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(id);
    setMsg(null);
    const r = await fn;
    setBusy(null);
    if (r.error) setMsg(r.error.message);
    else {
      setMsg(ok);
      await load();
    }
  }

  return (
    <div className="p-2 text-sm text-white">
      <p className="mb-2 opacity-80">Compagnons dessinés par les joueurs. « Masquer » : plus en vente, ne sort plus comme monstre (les compagnons déjà achetés restent à leurs joueurs). « Supprimer » : définitif.</p>
      {msg && <div className="mb-2 font-bold text-amber-300">{msg}</div>}
      {list === null && !msg && <div>Chargement…</div>}
      <div className="grid gap-2 md:grid-cols-2">
        {(list ?? []).map((r) => (
          <div key={r.id} className={`flex gap-2 rounded border border-neutral-600 bg-neutral-900 p-2 ${r.hidden ? "opacity-60" : ""}`}>
            <img src={r.image_url} alt="" className="h-20 w-20 shrink-0 bg-neutral-700 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{r.name} {r.hidden && <span className="text-amber-300">(masqué)</span>}</div>
              <div className="opacity-70">{r.rarity} · par {names[r.author_user_id] ?? r.author_user_id.slice(0, 8)} · {new Date(r.created_at).toLocaleDateString("fr-FR")}</div>
              <div className="mt-1 flex gap-2">
                <button type="button" disabled={busy === r.id} className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" onClick={() => void run(r.id, scenesClient.rpc("admin_companion_design_hide", { p_design_id: r.id, p_hidden: !r.hidden }), r.hidden ? "Réaffiché." : "Masqué.")}>{r.hidden ? "Réafficher" : "Masquer"}</button>
                <button type="button" disabled={busy === r.id} className="rounded bg-red-800 px-2 py-1 hover:bg-red-700" onClick={() => { if (window.confirm(`Supprimer « ${r.name} » pour de bon ?`)) void run(r.id, scenesClient.rpc("admin_companion_design_delete", { p_design_id: r.id }), "Supprimé."); }}>Supprimer</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
