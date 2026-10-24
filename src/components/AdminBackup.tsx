// Onglet « Sauvegarde » de /admin : télécharge un JSON des tables importantes (SQL 036).
import { useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";

export function AdminBackup() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await scenesClient.rpc("admin_export");
      if (error) throw error;
      const tables = (data as any)?.tables ?? {};
      const summary = Object.entries(tables).map(([k, v]) => `${k}: ${(v as unknown[]).length}`).join(" · ");
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `obliqworld-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(`✔ Sauvegarde téléchargée (${Math.round(blob.size / 1024)} Ko). ${summary}`);
    } catch (e: any) {
      setMsg(e?.message?.includes("admin_export") ? "Fonction absente : lance le SQL 036." : (e?.message ?? "Erreur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 text-sm text-neutral-100">
      <p>
        Télécharge un fichier avec le contenu des tables importantes (scènes, personnages, dessins, armes, boutique, compagnons, or, réglages, rencontres, signalements).
        Fais-le avant chaque grosse mise à jour et avant d'inviter du monde. Garde les fichiers hors de ton ordinateur de jeu (cloud, clé USB).
      </p>
      <p className="text-neutral-400">
        Les images PNG ne sont pas dedans (seulement leurs adresses) : télécharge aussi le dossier « drawings » depuis Supabase &gt; Storage de temps en temps.
      </p>
      <button type="button" disabled={busy} onClick={() => void download()} className="rounded bg-amber-600 px-4 py-2 font-semibold disabled:opacity-50">
        {busy ? "Export…" : "Télécharger la sauvegarde (JSON)"}
      </button>
      {msg && <p className="font-bold text-amber-300">{msg}</p>}
    </div>
  );
}
