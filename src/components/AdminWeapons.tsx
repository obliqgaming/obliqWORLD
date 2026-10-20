// Onglet « Armes » de /admin : toutes les armes dessinées, à cacher ou supprimer
// après coup (aucune validation avant publication).
import { useEffect, useState } from "react";
import { bonusText, weaponKindLabel, EFFECT_INFO, RARITY_INFO, adminDeleteWeapon, adminFetchAllWeapons, adminSetWeaponHidden, type Weapon } from "../lib/weapons";

export function AdminWeapons() {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const reload = async () => {
    try {
      setWeapons(await adminFetchAllWeapons());
    } catch (e) {
      console.error(e);
      setMsg("Impossible de lire les armes — as-tu lancé le SQL 014 ?");
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  async function act(fn: () => Promise<void>) {
    try {
      await fn();
      await reload();
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    }
  }

  const shown = weapons.filter((w) => w.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="p-4 text-white">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-bold">Armes ({weapons.length})</h2>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer par nom" className="rounded bg-neutral-800 px-2 py-1 text-sm" />
      </div>
      {msg && <div className="mb-2 text-sm text-amber-400">{msg}</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((w) => (
          <div key={w.id} className={`flex gap-3 rounded border border-neutral-700 bg-neutral-900 p-2 ${w.hidden ? "opacity-50" : ""}`}>
            <img src={w.image_url} alt="" className="h-20 w-24 shrink-0 rounded bg-neutral-800 object-contain" />
            <div className="min-w-0 flex-1 text-xs">
              <div className="truncate text-sm font-bold" style={{ color: RARITY_INFO[w.rarity].color }}>{w.name}</div>
              <div>{RARITY_INFO[w.rarity].label} · {weaponKindLabel(w.weapon_type)} · {bonusText(w.bonus_damage)}</div>
              {w.effect_key && <div>{EFFECT_INFO[w.effect_key]?.name}</div>}
              <div className="opacity-60">auteur {w.author_user_id.slice(0, 8)}… · {new Date(w.created_at).toLocaleDateString("fr-FR")}</div>
              <div className="mt-1 flex gap-2">
                <button type="button" className="rounded bg-neutral-700 px-2 py-0.5 font-semibold hover:bg-neutral-600" onClick={() => void act(() => adminSetWeaponHidden(w.id, !w.hidden))}>
                  {w.hidden ? "Réafficher" : "Cacher"}
                </button>
                <button type="button" className="rounded bg-red-800 px-2 py-0.5 font-semibold hover:bg-red-700" onClick={() => { if (window.confirm(`Supprimer « ${w.name} » pour tout le monde ?`)) void act(() => adminDeleteWeapon(w.id)); }}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="text-sm opacity-70">Aucune arme.</div>}
      </div>
    </div>
  );
}
