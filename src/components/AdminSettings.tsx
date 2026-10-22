// Onglet « Réglages » de /admin : tous les chiffres du jeu (game_settings : or, chances de butin,
// durées, dégâts, etc.) modifiables sans repasser par le code. Tout futur réglage ajouté dans
// game_settings apparaît automatiquement ici (SQL 018 : fonction admin_set_setting).
import { useEffect, useMemo, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";

type Setting = { key: string; value: number; note: string };

const GROUPS: [string, string][] = [
  ["loot_", "Butin (or, armes de monstres, dés)"],
  ["weapon_", "Armes (durabilité…)"],
  ["forge_", "Forge"],
  ["combat_", "Combat"],
];

export function AdminSettings() {
  const [rows, setRows] = useState<Setting[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const reload = async () => {
    const { data, error } = await scenesClient.from("game_settings").select("key, value, note").order("key");
    if (error) {
      setMsg("Impossible de lire les réglages : " + error.message);
      return;
    }
    setRows((data ?? []).map((r: any) => ({ key: r.key, value: Number(r.value), note: r.note })));
    setEdit({});
  };
  useEffect(() => {
    void reload();
  }, []);

  async function save(s: Setting) {
    const raw = (edit[s.key] ?? "").replace(",", ".").trim();
    const v = Number(raw);
    if (raw === "" || !Number.isFinite(v)) {
      setMsg(`« ${raw} » n'est pas un nombre.`);
      return;
    }
    const { error } = await scenesClient.rpc("admin_set_setting", { p_key: s.key, p_value: v });
    if (error) {
      setMsg(error.message.includes("admin_set_setting") ? "Lance d'abord le SQL 018 dans Supabase." : error.message);
      return;
    }
    setMsg(`✔ ${s.key} = ${v}`);
    await reload();
  }

  const shown = useMemo(() => rows.filter((r) => !filter || (r.key + " " + r.note).toLowerCase().includes(filter.toLowerCase())), [rows, filter]);
  const grouped = useMemo(() => {
    const out: { title: string; items: Setting[] }[] = [];
    const used = new Set<string>();
    for (const [prefix, title] of GROUPS) {
      const items = shown.filter((r) => r.key.startsWith(prefix));
      items.forEach((i) => used.add(i.key));
      if (items.length) out.push({ title, items });
    }
    const rest = shown.filter((r) => !used.has(r.key));
    if (rest.length) out.push({ title: "Autres réglages", items: rest });
    return out;
  }, [shown]);

  return (
    <div className="mx-auto max-w-3xl p-4 text-sm text-neutral-100">
      <div className="mb-2 text-lg font-bold">Réglages du jeu</div>
      <div className="mb-3 text-xs text-neutral-400">
        Les chances sont entre 0 et 1 (0,14 ≈ 1 sur 7). Les durées sont en secondes. Le changement s'applique au prochain combat / à la prochaine
        expédition.
      </div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer…" className="mb-3 w-full rounded bg-neutral-800 px-2 py-1" />
      {msg && <div className="mb-2 rounded bg-neutral-800 px-2 py-1 text-xs">{msg}</div>}
      {grouped.map((g) => (
        <div key={g.title} className="mb-4">
          <div className="mb-1 font-bold text-amber-400">{g.title}</div>
          {g.items.map((s) => {
            const cur = edit[s.key];
            const dirty = cur !== undefined && cur !== String(s.value);
            return (
              <div key={s.key} className="mb-1 flex items-center gap-2 rounded bg-neutral-900 p-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-neutral-300">{s.key}</div>
                  <div className="text-xs text-neutral-400">{s.note}</div>
                </div>
                <input
                  value={cur ?? String(s.value)}
                  onChange={(e) => setEdit((o) => ({ ...o, [s.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && dirty && void save(s)}
                  className="w-24 rounded bg-neutral-800 px-2 py-1 text-right"
                />
                <button type="button" disabled={!dirty} onClick={() => void save(s)} className="rounded bg-amber-600 px-2 py-1 text-xs font-bold disabled:opacity-30">
                  OK
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
