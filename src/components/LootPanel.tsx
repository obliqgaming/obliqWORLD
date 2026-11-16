// Butin d'un combat : or partagé + objets joués aux dés (« pour moi / pas pour moi », 20 s).
// Realtime uniquement (pas de polling) ; seul un minuteur local décompte la fenêtre.
import { Coin } from "./GameIcons";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLoot, lootRespond, lootResolve, subscribeToLoot, type LootItem, type LootRoll, type LootWeapon } from "../lib/loot";
import { EFFECT_INFO, RARITY_INFO, bonusText } from "../lib/weapons";
import { CONSUMABLE_INFO, type ConsumableKind } from "../lib/consumables";
import { RarityName } from "./InventoryPanel";

export function LootPanel({
  expeditionId,
  combatId,
  stepId,
  characterId,
  names,
  gold,
  family,
  onSettled,
}: {
  expeditionId: string;
  combatId?: string;
  stepId?: string;
  characterId: string;
  names: Record<string, string>;
  gold: number;
  family?: string | null;
  onSettled: (settled: boolean) => void;
}) {
  const [items, setItems] = useState<LootItem[]>([]);
  const [rolls, setRolls] = useState<LootRoll[]>([]);
  const [weapons, setWeapons] = useState<LootWeapon[]>([]);
  const [creatures, setCreatures] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const resolving = useRef(false);
  // Tant que le butin n'est pas lu une première fois, on ne le déclare pas « réglé » (sinon « Continuer » s'allumait trop tôt).
  const [loaded, setLoaded] = useState(false);
  // Mon choix tout de suite à l'écran, sans attendre le retour du serveur.
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    try {
      const d = await fetchLoot(expeditionId, combatId ?? null, stepId);
      setItems(d.items);
      setRolls(d.rolls);
      setWeapons(d.weapons);
      setCreatures(d.creatures);
    } catch (e) {
      console.error("loot load failed", e);
    } finally {
      setLoaded(true);
    }
  }, [expeditionId, combatId, stepId]);

  useEffect(() => {
    void reload();
    const ch = subscribeToLoot(expeditionId, () => void reload());
    return () => {
      void ch.unsubscribe();
    };
  }, [expeditionId, reload]);

  const rolling = items.filter((i) => i.status === "rolling");
  useEffect(() => {
    onSettled(loaded && (items.length === 0 || rolling.length === 0));
  }, [items, rolling.length, loaded, onSettled]);

  // Minuteur local (seulement tant qu'un objet est en jeu).
  useEffect(() => {
    if (rolling.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [rolling.length]);

  // Résolution : à l'échéance, ou dès que tout le monde a répondu (idempotent côté serveur).
  useEffect(() => {
    if (resolving.current) return;
    const ready = rolling.some((i) => {
      const mine = rolls.filter((r) => r.loot_id === i.id);
      return new Date(i.roll_deadline).getTime() <= now || (mine.length > 0 && mine.every((r) => r.wants !== null));
    });
    if (!ready) return;
    resolving.current = true;
    lootResolve(expeditionId)
      .catch((e) => console.error("loot resolve failed", e))
      .finally(() => {
        resolving.current = false;
        void reload();
      });
  }, [now, rolling, rolls, expeditionId, reload]);

  const respond = (lootId: string, wants: boolean) => {
    setPicked((p) => ({ ...p, [lootId]: wants }));
    lootRespond(lootId, characterId, wants)
      .then(reload)
      .catch((e) => {
        console.error("loot respond failed", e);
        setPicked((p) => {
          const n = { ...p };
          delete n[lootId];
          return n;
        });
      });
  };

  if (gold <= 0 && items.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border-2 border-[#7a4a22] bg-[#e8d2a0] p-3 text-left text-sm">
      <div className="text-xs font-extrabold uppercase tracking-wide">Butin</div>
      {gold > 0 && <div className="mt-1 font-bold text-[#92400e]"><Coin /> {gold} flouz partagé entre les survivants</div>}
      {items.map((it) => {
        const w = weapons.find((x) => x.id === it.weapon_id);
        const rs = rolls.filter((r) => r.loot_id === it.id);
        const mine = rs.find((r) => r.character_id === characterId);
        const left = Math.max(0, Math.ceil((new Date(it.roll_deadline).getTime() - now) / 1000));
        const winner = it.winner_character_id ? names[it.winner_character_id] ?? "?" : null;
        return (
          <div key={it.id} className="mt-2 rounded border border-[#b98a54] bg-[#f6e8c4] p-2">
            <div className="flex items-center gap-2">
              {w && <img src={w.image_url} alt="" className="h-12 w-8 object-contain" />}
              {it.kind === "companion" && it.visual_asset_id && creatures[it.visual_asset_id] && <img src={creatures[it.visual_asset_id]} alt="" className="h-12 w-12 object-contain" />}
              <div className="min-w-0 flex-1">
                {w ? <RarityName name={w.name} rarity={w.rarity} pill /> : it.kind === "companion" ? <span className="font-bold">🐾 Compagnon ({it.item_key === "large" ? "grand" : it.item_key === "medium" ? "moyen" : "petit"})</span> : <span className="font-bold">{it.item_key && CONSUMABLE_INFO[it.item_key as ConsumableKind] ? `${CONSUMABLE_INFO[it.item_key as ConsumableKind]!.icon} ${CONSUMABLE_INFO[it.item_key as ConsumableKind]!.name}` : "Objet"}</span>}
                {w && family && (w.weapon_type === "magic" || w.weapon_type === "blunt_slash") && (
                  (w.weapon_type === "magic") === (family === "magie")
                    ? <span title="Les jets de dés sont d'abord pour ceux qui ont la bonne spé" className="mr-1 inline-block rounded bg-[#16a34a] px-1.5 text-[10px] font-extrabold text-white">✦ Prio spé</span>
                    : <span className="mr-1 inline-block rounded bg-[#9ca3af] px-1.5 text-[10px] font-extrabold text-white">Autre spé</span>
                )}
                {!w && it.item_key && CONSUMABLE_INFO[it.item_key as ConsumableKind] && <div className="text-[11px]">{CONSUMABLE_INFO[it.item_key as ConsumableKind]!.text}</div>}
                {w && <div className="text-[11px]">{bonusText(w.bonus_damage)}{w.effect_key && EFFECT_INFO[w.effect_key] ? ` · ${EFFECT_INFO[w.effect_key]?.name}` : ""}</div>}
              </div>
              {it.status === "rolling" && <div className="text-xs font-bold tabular-nums">{left} s</div>}
            </div>
            {it.status === "rolling" && mine && (() => {
              const sel = mine.wants ?? picked[it.id] ?? null;
              const sty = (on: boolean, base: string) => `rounded border-2 px-3 py-0.5 text-xs font-bold transition ${base} ${on ? "ring-4 ring-[#1d4ed8] ring-offset-1 ring-offset-[#f6e8c4] scale-105" : sel !== null ? "opacity-60" : ""}`;
              return (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <button type="button" aria-pressed={sel === true} onClick={() => respond(it.id, true)} className={sty(sel === true, "border-[#166534] bg-[#16a34a] text-white")}>{sel === true ? "✔ " : ""}Pour moi</button>
                  <button type="button" aria-pressed={sel === false} onClick={() => respond(it.id, false)} className={sty(sel === false, "border-[#7a4a22] bg-[#d9bf8c]")}>{sel === false ? "✔ " : ""}Pas pour moi</button>
                  {sel !== null && <span className="text-[11px] italic">en attente des autres…</span>}
                </div>
              );
            })()}
            {it.status === "rolling" && !mine && <div className="mt-1 text-xs italic">Ce n'est pas pour toi (autre famille d'armes).</div>}
            {it.status !== "rolling" && (
              <div className="mt-1 text-xs">
                {rs.filter((r) => r.roll !== null).sort((a, b) => (b.roll ?? 0) - (a.roll ?? 0)).map((r) => (
                  <span key={r.character_id} className="mr-2">🎲 {names[r.character_id] ?? "?"} : {r.roll}</span>
                ))}
                <div className="font-bold">
                  {it.status === "lost" ? "Perdu." : winner ? `Remporté par ${winner}${it.winner_character_id === characterId ? " (toi !)" : ""}.` : ""}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
