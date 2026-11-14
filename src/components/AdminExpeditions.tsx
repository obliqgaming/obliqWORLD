// Onglet « Expéditions » de /admin (SQL 117) : voir les expéditions en cours et en TERMINER une (le groupe rentre au village avec son
// butin, comme le nœud « Sortie » : personne ne meurt, aucun combat n'est lancé). Refusé tant qu'un combat est en cours.
import { useCallback, useEffect, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";

type Row = {
  id: string;
  route: string | null;
  etape: number | null;
  combat_en_cours: boolean;
  joueurs: { nom: string; peps: number | null; peps_max: number | null; parti: boolean }[];
};

export function AdminExpeditions() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    const { data, error } = await scenesClient.rpc("admin_list_expeditions");
    if (error) {
      setRows([]);
      setMsg(error.message.includes("admin_list_expeditions") ? "Fonction absente : lance le SQL 117 dans Supabase." : error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const end = async (r: Row) => {
    const noms = r.joueurs.map((j) => j.nom).join(", ");
    if (!window.confirm(`Terminer cette expédition (${noms || "sans joueur"}) ?\n\nLe groupe rentre au village avec son butin. Personne ne meurt et aucun combat n'est lancé.`)) return;
    setBusy(r.id);
    setMsg(null);
    try {
      const { error } = await scenesClient.rpc("admin_end_expedition", { p_expedition_id: r.id });
      if (error) throw error;
      setMsg("✔ Expédition terminée : le groupe est rentré au village.");
    } catch (e) {
      setMsg((e as { message?: string })?.message ?? "Erreur");
    } finally {
      setBusy(null);
      await load();
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4 text-sm text-neutral-100">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">Expéditions en cours</p>
        <button type="button" onClick={() => void load()} className="rounded bg-neutral-700 px-3 py-1 font-semibold">Actualiser</button>
      </div>
      <p className="text-neutral-400">« Terminer » ramène le groupe au village avec son butin (comme une sortie normale). Impossible pendant un combat.</p>
      {msg && <p className="font-bold text-amber-300">{msg}</p>}
      {rows === null && <p>Chargement…</p>}
      {rows?.length === 0 && !msg && <p className="opacity-80">Aucune expédition en cours.</p>}
      {(rows ?? []).map((r) => (
        <div key={r.id} className="rounded border border-neutral-700 bg-neutral-900 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold">Étape {r.etape ?? "?"}</span>
              <span className="ml-2 opacity-70">{r.route === "long" ? "longue" : "P'tite Balade"}</span>
              {r.combat_en_cours && <span className="ml-2 rounded bg-red-800 px-2 py-0.5 text-xs font-bold">⚔ combat en cours</span>}
            </div>
            <button
              type="button"
              disabled={busy === r.id || r.combat_en_cours}
              onClick={() => void end(r)}
              className="rounded bg-amber-600 px-3 py-1 font-semibold disabled:opacity-40"
              title={r.combat_en_cours ? "Impossible pendant un combat" : "Faire rentrer le groupe au village"}
            >
              Terminer
            </button>
          </div>
          <div className="mt-1 text-neutral-300">
            {r.joueurs.map((j) => `${j.nom}${j.peps_max ? ` (${j.peps ?? 0}/${j.peps_max})` : ""}${j.parti ? " — parti" : ""}`).join(" · ") || "Aucun joueur"}
          </div>
          <div className="mt-1 break-all text-[10px] text-neutral-500">{r.id}</div>
        </div>
      ))}
    </div>
  );
}
