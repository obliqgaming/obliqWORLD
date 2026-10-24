// Onglet « Signalements » de /admin : bugs et demandes de suppression de compte.
import { useEffect, useState } from "react";
import { adminFetchRequests, adminSetRequestStatus, type PlayerRequest } from "../lib/requests";

export function AdminRequests() {
  const [rows, setRows] = useState<PlayerRequest[]>([]);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [msg, setMsg] = useState<string | null>(null);
  const reload = async () => {
    try {
      setRows(await adminFetchRequests());
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    }
  };
  useEffect(() => {
    void reload();
  }, []);
  const shown = rows.filter((r) => filter === "all" || r.status === "open");
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4 text-sm text-neutral-100">
      <div className="flex items-center gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")} className="rounded bg-neutral-800 px-2 py-1 text-neutral-100">
          <option value="open">À traiter</option>
          <option value="all">Toutes</option>
        </select>
        <span className="text-neutral-400">{shown.length} demande(s)</span>
        {msg && <span className="font-bold text-amber-400">{msg}</span>}
      </div>
      {shown.map((r) => (
        <div key={r.id} className="space-y-1 rounded border border-neutral-700 p-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <b className={r.kind === "deletion" ? "text-red-400" : "text-amber-300"}>{r.kind === "deletion" ? "Suppression de compte" : "Bug"}</b>
            <span className="text-neutral-400">{new Date(r.created_at).toLocaleString("fr-FR")}</span>
            <span className="text-neutral-400">compte {r.user_id.slice(0, 8)}…</span>
            {r.expedition_id && <span className="text-neutral-400">expédition {r.expedition_id.slice(0, 8)}…</span>}
            {r.step_id && <span className="text-neutral-400">étape {r.step_id.slice(0, 8)}…</span>}
          </div>
          {r.message && <div className="whitespace-pre-wrap">{r.message}</div>}
          <button
            type="button"
            onClick={() => void adminSetRequestStatus(r.id, r.status === "open" ? "done" : "open").then(reload)}
            className="rounded bg-neutral-700 px-3 py-1 font-semibold"
          >
            {r.status === "open" ? "Marquer traité" : "Rouvrir"}
          </button>
        </div>
      ))}
    </div>
  );
}
