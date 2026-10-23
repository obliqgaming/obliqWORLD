// Onglet « Rencontres » de /admin : relire, corriger, approuver ou refuser les rencontres écrites.
import { useEffect, useState } from "react";
import { STATUS_LABEL, TYPE_LABEL, RISK_LABEL, adminFetchEncounters, adminUpdateEncounter, type CommunityEvent } from "../lib/encounters";

export function AdminEncounters() {
  const [rows, setRows] = useState<CommunityEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [edit, setEdit] = useState<Record<string, Partial<CommunityEvent>>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const reload = async () => {
    try {
      setRows(await adminFetchEncounters());
      setEdit({});
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  async function save(r: CommunityEvent, status?: string) {
    const d = { ...r, ...(edit[r.id] ?? {}) };
    try {
      await adminUpdateEncounter({
        id: r.id,
        situation: d.situation_text ?? "",
        success: d.success_text ?? "",
        failure: d.failure_text ?? "",
        damageMode: d.damage_mode,
        risk: d.risk_level,
        status: status ?? d.status,
      });
      setMsg("✔ Enregistré");
      await reload();
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    }
  }

  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  const set = (id: string, p: Partial<CommunityEvent>) => setEdit((o) => ({ ...o, [id]: { ...(o[id] ?? {}), ...p } }));
  const area = "w-full rounded bg-neutral-800 p-1 text-sm";
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4 text-sm">
      <div className="flex items-center gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded bg-neutral-800 px-2 py-1">
          <option value="all">Toutes</option>
          {(Object.keys(STATUS_LABEL) as CommunityEvent["status"][]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <span className="text-neutral-400">{shown.length} rencontre(s)</span>
        {msg && <span className="font-bold text-amber-400">{msg}</span>}
      </div>
      {shown.map((r) => {
        const d = { ...r, ...(edit[r.id] ?? {}) };
        return (
          <div key={r.id} className="space-y-1 rounded border border-neutral-700 p-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <b>{TYPE_LABEL[r.step_type]}</b>
              <select value={d.risk_level} onChange={(e) => set(r.id, { risk_level: e.target.value as CommunityEvent["risk_level"] })} className="rounded bg-neutral-800 px-1">
                {(Object.keys(RISK_LABEL) as CommunityEvent["risk_level"][]).map((k) => (
                  <option key={k} value={k}>{RISK_LABEL[k]}</option>
                ))}
              </select>
              <select value={d.damage_mode} onChange={(e) => set(r.id, { damage_mode: e.target.value as "partage" | "isole" })} className="rounded bg-neutral-800 px-1">
                <option value="partage">dégâts partagés</option>
                <option value="isole">dégâts isolés</option>
              </select>
              <span className="text-neutral-400">{STATUS_LABEL[r.status]} · jouée {r.times_played}×</span>
            </div>
            <textarea className={area} rows={2} value={d.situation_text ?? ""} onChange={(e) => set(r.id, { situation_text: e.target.value })} />
            <textarea className={area} rows={2} value={d.success_text ?? ""} onChange={(e) => set(r.id, { success_text: e.target.value })} />
            <textarea className={area} rows={2} value={d.failure_text ?? ""} onChange={(e) => set(r.id, { failure_text: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => void save(r)} className="rounded bg-neutral-700 px-3 py-1 font-semibold">Enregistrer</button>
              <button type="button" onClick={() => void save(r, "approved")} className="rounded bg-green-700 px-3 py-1 font-semibold">Approuver</button>
              <button type="button" onClick={() => void save(r, "rejected")} className="rounded bg-red-700 px-3 py-1 font-semibold">Refuser</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
