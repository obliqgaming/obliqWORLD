// Onglet « Équilibrage » de /admin : statistiques des vraies expéditions, par taille de groupe (SQL 079). Lecture seule.
import { useEffect, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";

type Row = {
  route: string;
  players: number;
  expeditions: number;
  returned: number;
  wiped: number;
  in_progress: number;
  avg_fights_won: number | null;
  boss_reached: number;
  boss_killed: number;
  avg_deaths: number | null;
  avg_gold_group: number | null;
  avg_gold_player: number | null;
  avg_alive_pv_pct: number | null;
};

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)} %` : "—");
const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));

export function AdminBalance() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await scenesClient.rpc("admin_balance_stats");
      if (error) throw error;
      setRows((data as Row[]) ?? []);
    } catch (e: any) {
      setMsg(e?.message?.includes("admin_balance_stats") ? "Fonction absente : lance le SQL 079." : (e?.message ?? "Erreur"));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-4 text-sm text-neutral-100">
      <p className="text-neutral-300">
        Chiffres tirés des vraies expéditions (une ligne par type d'expédition et par nombre de joueurs). Rien ne se modifie ici : regarde, puis ajuste dans l'onglet Réglages.
        Peu d'expéditions = chiffres peu fiables ; ne conclus qu'à partir de quelques parties par ligne. Les expéditions terminées depuis plus de 30 jours sont effacées par le ménage automatique.
      </p>
      <button type="button" onClick={() => void load()} disabled={busy} className="rounded bg-neutral-800 px-3 py-1 font-semibold hover:bg-neutral-700 disabled:opacity-50">
        {busy ? "Chargement…" : "Actualiser"}
      </button>
      {msg && <div className="rounded bg-red-900/60 px-3 py-2">{msg}</div>}
      {rows && rows.length === 0 && <div className="text-neutral-400">Aucune expédition avec combat pour l'instant.</div>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left">
            <thead className="text-xs uppercase text-neutral-400">
              <tr>
                {["Type", "Joueurs", "Expéditions", "Revenues", "Anéanties", "En cours", "Combats gagnés (moy.)", "Boss atteint", "Boss vaincu", "Morts (moy.)", "Or du groupe (moy.)", "Or / joueur (moy.)", "PV des vivants (fin)"].map((h) => (
                  <th key={h} className="border-b border-neutral-700 px-2 py-1 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.route}-${r.players}`} className="border-b border-neutral-800">
                  <td className="px-2 py-1 font-bold">{r.route === "long" ? "Longue" : "Courte"}</td>
                  <td className="px-2 py-1">{r.players}</td>
                  <td className="px-2 py-1">{r.expeditions}</td>
                  <td className="px-2 py-1">{r.returned} ({pct(r.returned, r.expeditions)})</td>
                  <td className="px-2 py-1">{r.wiped} ({pct(r.wiped, r.expeditions)})</td>
                  <td className="px-2 py-1">{r.in_progress}</td>
                  <td className="px-2 py-1">{num(r.avg_fights_won)}</td>
                  <td className="px-2 py-1">{r.boss_reached}</td>
                  <td className="px-2 py-1">{r.boss_killed} ({pct(r.boss_killed, r.boss_reached)})</td>
                  <td className="px-2 py-1">{num(r.avg_deaths)}</td>
                  <td className="px-2 py-1">{num(r.avg_gold_group)}</td>
                  <td className="px-2 py-1">{num(r.avg_gold_player)}</td>
                  <td className="px-2 py-1">{r.avg_alive_pv_pct === null ? "—" : `${r.avg_alive_pv_pct} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
