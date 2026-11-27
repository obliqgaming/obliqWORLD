// Onglet « Réglages » de /admin : tous les chiffres du jeu (game_settings : or, chances de butin,
// durées, dégâts, etc.) modifiables sans repasser par le code. Tout futur réglage ajouté dans
// game_settings apparaît automatiquement ici (SQL 018 : fonction admin_set_setting).
import { useEffect, useMemo, useState } from "react";
import { scenesClient } from "../lib/scenes-supabase";

type Setting = { key: string; value: number; note: string };

// Réglages que plus aucune fonction du serveur ne lit (audit 83 + SQL 172/173) : gardés visibles mais signalés, à supprimer au prochain nettoyage.
const OBSOLETE = new Set([
  "xp_boss", "xp_per_chef", "xp_per_monster", // remplacés par xp_combat_* (SQL 172)
  "map_chef_gold", "map_elite_gold", // remplacés par map_chef_gold_min/max et map_elite_gold_min/max
  "extra_player_extra_monsters", // le nombre de monstres suit le nombre de joueurs, ce réglage n'est lu nulle part
]);
// Pas retrouvés dans le code serveur lu : à confirmer avant de les supprimer.
const TO_CHECK = new Set<string>();

// Groupes, dans l'ordre : le premier qui correspond gagne. `hint` explique comment les réglages se combinent.
const GROUPS: { title: string; hint?: string; test: (k: string) => boolean }[] = [
  {
    title: "Difficulté — P'tite Balade",
    hint: "Peps (ou dégâts) d'un monstre normal/élite/chef = base de l'étape × monster_hp_scale (monster_damage_scale) × bonus de groupe (extra_player_*, missing_player_*) × court_<type>_hp_mult (court_<type>_dmg_mult). Le boss : (150 + 18 × court_boss_n) × boss_hp_scale × bonus de groupe du boss (boss_extra_player_*) × court_boss_hp_mult.",
    test: (k) => k.startsWith("court_") || k === "map_layers_court" || k === "map_narrative_layer_1" || k === "map_narrative_layer_2" || k === "map_clairiere_max",
  },
  {
    title: "Difficulté — Grand Safari",
    hint: "Comme la Balade, avec long_<type>_hp_mult / long_<type>_dmg_mult et un boss dont la taille vient de long_boss_n (14 = comme le boss de la Balade). Les PV et la force des monstres de chaque étape suivent la courbe de la table route_step_curve (dans Supabase) ; une étape sans ligne dans cette table retombe sur l'ancien calcul long_step_scale + long_step_offset (plafond long_step_cap). curve_ref_step = étape de référence de la courbe.",
    test: (k) => k.startsWith("long_") || k.startsWith("map_combat_layer_long_") || k.startsWith("map_narr_long_") || k === "map_layers_long" || k === "map_camp_layer_long" || k === "map_clairiere_max_long" || k === "map_extra_combat_long" || k === "curve_ref_step" || k === "map_marchand_chance" || k === "map_tripot_chance",
  },
  {
    title: "Difficulté — communs aux deux expéditions",
    hint: "S'appliquent à la Balade ET au Safari : échelle de base des monstres, bonus de groupe des monstres normaux/élites/chefs (extra_player_*, missing_player_*), type de case (élite/chef). Le boss a ses propres bonus de groupe (voir « Boss, techniques et invocations »).",
    test: (k) => ["monster_hp_scale", "monster_damage_scale", "boss_hp_scale", "monster_count_bonus", "mini_boss_hp_mult", "pv_scale", "pm_scale", "duo_extra_monsters", "default_group_size", "map_elite_chance", "chef_damage_bonus"].includes(k) || k.startsWith("extra_player_") || k.startsWith("missing_player_"),
  },
  { title: "Boss, techniques et invocations des monstres", hint: "Comprend les bonus de groupe propres au boss (boss_extra_player_hp_bonus, boss_extra_player_damage_bonus), qui remplacent extra_player_* pour le boss seulement. Les profils de boss et de chefs (Gardes, Vénéneux, Meute, Sorcier ; Hurleur, Meneur, Tenace) se règlent dans la table monster_profiles de Supabase.", test: (k) => k.startsWith("boss_") || k.startsWith("summon_") || k.startsWith("tech_") || k.startsWith("monster_tech_") || k === "coup_marque_mult" || k === "monster_poison_dmg" || k === "tir_desarmant_mult" },
  { title: "XP et niveaux", test: (k) => k.startsWith("xp_") || k.startsWith("event_xp_") || k === "quest_xp" || k.startsWith("map_xp_") || k.endsWith("_lvl_bump") || k.includes("_lvl_gain_") || k === "level_axis_choice" || k.startsWith("talent_") },
  { title: "Flouz, butin et dés", test: (k) => k.startsWith("loot_") || k.endsWith("_gold") || k.includes("_gold_") || k.startsWith("booster_") || k.startsWith("daily_gold_") || k.startsWith("death_") || k === "pot_extra_player" || k.startsWith("potion_w_") || k.startsWith("map_chef_") && k.includes("chance") || k.startsWith("map_elite_potion") || k.startsWith("map_elite_w_") || k === "map_chef_weapons" || k === "consumable_stack_max" },
  { title: "Armes, forge, boutique et réparation", test: (k) => k.startsWith("weapon_") || k.startsWith("forge_") || k.startsWith("shop_") || k.startsWith("repair_") || k.startsWith("monster_w_") },
  { title: "Compagnons", test: (k) => k.startsWith("companion_") },
  { title: "Marchand itinérant, Tripot et Camp", test: (k) => k.startsWith("merchant_") || k.startsWith("map_merchant_") || k.startsWith("tripot_") || k.startsWith("camp_") },
  { title: "Carte : forme des expéditions", test: (k) => k.startsWith("map_") || k.startsWith("expedition_") || k.startsWith("step_weight_") || k.startsWith("outcome_") },
  { title: "Rencontres écrites et événements", test: (k) => k.startsWith("event_") || k.startsWith("community_event_") },
  { title: "Soins, potions et combat", test: (k) => k.startsWith("combat_") || k.startsWith("heal_") || k.startsWith("potion_") || k.startsWith("scroll_") || k.endsWith("_mult") || ["rage_bonus", "warcry_bonus", "permadeath_enabled", "pm_regen_per_step"].includes(k) },
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
    const out: { title: string; hint?: string | undefined; items: Setting[] }[] = [];
    const used = new Set<string>();
    for (const g of GROUPS) {
      const items = shown.filter((r) => !used.has(r.key) && g.test(r.key));
      items.forEach((i) => used.add(i.key));
      if (items.length) out.push({ title: g.title, hint: g.hint, items });
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
        <details key={g.title} className="mb-3" open={!!filter}>
          <summary className="mb-1 cursor-pointer font-bold text-amber-400">{g.title} <span className="text-xs font-normal text-neutral-500">({g.items.length})</span></summary>
          {g.hint && <div className="mb-2 rounded bg-neutral-800 p-2 text-xs text-neutral-300">{g.hint}</div>}
          {g.items.map((s) => {
            const cur = edit[s.key];
            const dirty = cur !== undefined && cur !== String(s.value);
            return (
              <div key={s.key} className="mb-1 flex items-center gap-2 rounded bg-neutral-900 p-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-neutral-300">
                    {s.key}
                    {OBSOLETE.has(s.key) && <span className="ml-2 rounded bg-red-900 px-1 text-[10px] font-bold text-red-200">OBSOLÈTE : plus lu par le jeu</span>}
                    {TO_CHECK.has(s.key) && <span className="ml-2 rounded bg-neutral-700 px-1 text-[10px] font-bold text-amber-200">à confirmer : pas retrouvé dans le code</span>}
                  </div>
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
        </details>
      ))}
    </div>
  );
}
