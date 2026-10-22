// Butin d'un combat : or partagé + objets joués aux dés (« pour moi / pas pour moi », 20 s).
// Realtime uniquement (pas de polling) ; seul un minuteur local décompte la fenêtre.
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLoot, lootRespond, lootResolve, subscribeToLoot, type LootItem, type LootRoll, type LootWeapon } from "../lib/loot";
import { EFFECT_INFO, RARITY_INFO, bonusText } from "../lib/weapons";
import { CONSUMABLE_INFO, type ConsumableKind } from "../lib/consumables";
import { RarityName } from "./InventoryPanel";

export function LootPanel({
  expeditionId,
  combatId,
  characterId,
  names,
  gold,
  onSettled,
}: {
  expeditionId: string;
  combatId: string;
  characterId: string;
  names: Record<string, string>;
  gold: number;
  onSettled: (settled: boolean) => void;
}) {
  const [items, setItems] = useState<LootItem[]>([]);
  const [rolls, setRolls] = useState<LootRoll[]>([]);
  const [weapons, setWeapons] = useState<LootWeapon[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const resolving = useRef(false);

  const reload = useCallback(async () => {
    try {
      const d = await fetchLoot(expeditionId, combatId);
      setItems(d.items);
      setRolls(d.rolls);
      setWeapons(d.weapons);
    } catch (e) {
      console.error("loot load failed", e);
    }
  }, [expeditionId, combatId]);

  useEffect(() => {
    void reload();
    const ch = subscribeToLoot(expeditionId, () => void reload());
    return () => {
      void ch.unsubscribe();
    };
  }, [expeditionId, reload]);

  const rolling = items.filter((i) => i.status === "rolling");
  useEffect(() => {
    onSettled(items.length === 0 || rolling.length === 0);
  }, [items, rolling.length, onSettled]);

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

  if (gold <= 0 && items.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border-2 border-[#7a4a22] bg-[#e8d2a0] p-3 text-left text-sm">
      <div className="text-xs font-extrabold uppercase tracking-wide">Butin</div>
      {gold > 0 && <div className="mt-1 font-bold text-[#92400e]">💰 {gold} or partagé entre les survivants</div>}
      {items.map((it) => {
        const w = weapons.find((x) => x.id === it.weapon_id);
        const rs = rolls.filter((r) => r.loot_id === it.id);
        const mine = rs.find((r) => r.character_id === characterId);
        const left = Math.max(0, Math.ceil((new Date(it.roll_deadline).getTime() - now) / 1000));
        const winner = it.winner_character_id ? names[it.winner_character_id] ?? "?" : null;
        return (
          <div key={it.id} className="mt-2 rounded border border-[#b98a54] bg-[#f6e8c4] p-2">
            <div className="flex items-center gap-2">
              {!w && it.item_key && CONSUMABLE_INFO[it.item_key as ConsumableKind] && <div className="text-[11px]">{CONSUMABLE_INFO[it.item_key as ConsumableKind]!.text}</div>}
              {w && <img src={w.image_url} alt="" className="h-12 w-8 object-contain" />}
              <div className="min-w-0 flex-1">
                {w ? <RarityName name={w.name} rarity={w.rarity} /> : <span className="font-bold">{it.item_key && CONSUMABLE_INFO[it.item_key as ConsumableKind] ? `${CONSUMABLE_INFO[it.item_key as ConsumableKind]!.icon} ${CONSUMABLE_INFO[it.item_key as ConsumableKind]!.name}` : "Objet"}</span>}
                {w && <div className="text-[11px]">{RARITY_INFO[w.rarity].label} · {bonusText(w.bonus_damage)}{w.effect_key && EFFECT_INFO[w.effect_key] ? ` · ${EFFECT_INFO[w.effect_key]?.name}` : ""}</div>}
              </div>
              {it.status === "rolling" && <div className="text-xs font-bold tabular-nums">{left} s</div>}
            </div>
            {it.status === "rolling" && mine && (
              mine.wants === null ? (
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => void lootRespond(it.id, characterId, true).then(reload)} className="rounded border-2 border-[#166534] bg-[#16a34a] px-3 py-0.5 text-xs font-bold text-white">Pour moi</button>
                  <button type="button" onClick={() => void lootRespond(it.id, characterId, false).then(reload)} className="rounded border-2 border-[#7a4a22] bg-[#d9bf8c] px-3 py-0.5 text-xs font-bold">Pas pour moi</button>
                </div>
              ) : (
                <div className="mt-1 text-xs">Ton choix : <b>{mine.wants ? "pour moi" : "pas pour moi"}</b> — en attente des autres…</div>
              )
            )}
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
      <div className="mt-2 text-[11px] italic">Le butin n'est gardé qu'au retour de l'expédition, et seulement par ceux qui sont encore debout.</div>
    </div>
  );
}
