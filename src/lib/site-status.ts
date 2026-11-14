// Mode maintenance (SQL 118) : table site_status (1 ligne). Lecture publique, écriture admin via admin_set_maintenance.
import { useEffect, useState } from "react";
import { scenesClient } from "./scenes-supabase";

export type SiteStatus = { maintenance: boolean; message: string };

export async function fetchSiteStatus(): Promise<SiteStatus | null> {
  try {
    const { data, error } = await scenesClient.from("site_status").select("maintenance, message").eq("id", 1).maybeSingle();
    if (error || !data) return null;
    return { maintenance: !!data.maintenance, message: String(data.message ?? "") };
  } catch {
    return null;
  }
}

/** Vérifie au chargement, toutes les 60 s et au retour sur l'onglet. En cas d'erreur : on ne bloque personne. */
export function useSiteStatus(): SiteStatus | null {
  const [s, setS] = useState<SiteStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const r = await fetchSiteStatus();
      if (alive && r) setS(r);
    };
    void run();
    const t = window.setInterval(run, 60000);
    const vis = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, []);
  return s;
}
