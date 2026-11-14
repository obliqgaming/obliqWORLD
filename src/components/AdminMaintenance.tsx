// Interrupteur « Mode maintenance » (SQL 118), affiché en haut de l'onglet Expéditions.
import { useCallback, useEffect, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";
import { fetchSiteStatus } from "../lib/site-status";

export function AdminMaintenance({ activeExpeditions }: { activeExpeditions: number }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await fetchSiteStatus();
    if (!s) { setMsg("Table absente : lance le SQL 118 dans Supabase."); return; }
    setOn(s.maintenance);
    setText(s.message);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const apply = async (next: boolean) => {
    if (next && activeExpeditions > 0 && !window.confirm(`${activeExpeditions} expédition(s) en cours. Les joueurs seront bloqués mais les chronos continuent. Activer quand même ?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await scenesClient.rpc("admin_set_maintenance", { p_on: next, p_message: text });
      if (error) throw error;
      setOn(next);
      setMsg(next ? "✔ Maintenance ACTIVÉE (les joueurs la voient d'ici ~1 min). Toi, tu peux continuer à jouer." : "✔ Maintenance désactivée.");
    } catch (e) {
      setMsg((e as { message?: string })?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-2 rounded border p-3 ${on ? "border-red-500 bg-red-950/40" : "border-neutral-700"}`}>
      <p className="font-bold">Mode maintenance : {on === null ? "…" : on ? "🔴 ACTIVÉ" : "🟢 désactivé"}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={600} className="w-full rounded bg-neutral-800 p-2" />
      <div className="flex gap-2">
        <button type="button" disabled={busy || on === null} onClick={() => void apply(!on)} className={`rounded px-3 py-1 font-semibold ${on ? "bg-emerald-600" : "bg-red-600"}`}>
          {on ? "Désactiver la maintenance" : "Activer la maintenance"}
        </button>
        {on && <button type="button" disabled={busy} onClick={() => void apply(true)} className="rounded bg-neutral-700 px-3 py-1 font-semibold">Mettre à jour le message</button>}
      </div>
      {msg && <p className="font-bold text-amber-300">{msg}</p>}
    </div>
  );
}
