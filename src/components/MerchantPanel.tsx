// Fenêtre du marchand : acheter potions et parchemin, revendre ses objets et ses armes (au quart).
import { Coin } from "./GameIcons";
import { useEffect, useState } from "react";
import { CONSUMABLE_INFO, CONSUMABLE_ORDER, fetchMyConsumables, type ConsumableStack } from "../lib/consumables";
import { fetchMerchantSettings, merchantBuy, merchantSellConsumable, merchantSellWeapon, type MerchantSettings } from "../lib/merchant";
import { RARITY_INFO, fetchMyItems, itemDisplayName, type WeaponItem } from "../lib/weapons";
import { fetchMyGold } from "../lib/loot";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function MerchantPanel({ onClose, onWeaponChanged }: { onClose: () => void; onWeaponChanged: () => void }) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [gold, setGold] = useState(0);
  const [st, setSt] = useState<MerchantSettings | null>(null);
  const [stacks, setStacks] = useState<ConsumableStack[]>([]);
  const [items, setItems] = useState<WeaponItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [g, s, c, w] = await Promise.all([fetchMyGold(), fetchMerchantSettings(), fetchMyConsumables(), fetchMyItems()]);
      setGold(g);
      setSt(s);
      setStacks(c);
      setItems(w);
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  async function act(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
      await reload();
      onWeaponChanged();
    } catch (e: any) {
      setMsg(e?.message?.includes("merchant_") && e?.message?.includes("function") ? "Le marchand n'est pas encore activé (SQL 030)." : (e?.message ?? "Erreur"));
    } finally {
      setBusy(false);
    }
  }

  const count = (k: string) => stacks.find((s) => s.kind === k)?.count ?? 0;
  const sellEach = (k: string) => Math.max(1, Math.floor(((st?.prices[k] ?? 10) * (st?.sellPct ?? 25)) / 100));
  const weaponValue = (it: WeaponItem) =>
    it.is_prototype ? null : Math.max(1, Math.round(((st?.weaponBase[it.weapon.rarity] ?? 6) * (st?.sellPct ?? 25)) / 100 * (it.durability / Math.max(1, it.durability_max))));

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/55 p-2" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-full w-[min(40rem,98%)] overflow-y-auto rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">🛍 Marchand <span className="ml-2 text-sm text-[#92400e]">tu as {gold} <Coin /></span></div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setTab("buy")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "buy" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>Acheter</button>
          <button type="button" onClick={() => setTab("sell")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "sell" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>Vendre</button>
        </div>
        {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
        {tab === "buy" ? (
          <div className="mt-3 space-y-2">
            <div className="text-sm leading-snug">♾ <b>Stock illimité</b>, mais pas plus de <b>9</b> objets de la même sorte <i>(sur toi)</i>.</div>
            {CONSUMABLE_ORDER.map((k) => {
              const price = st?.prices[k];
              return (
                <div key={k} className="flex items-center gap-2 rounded border border-[#7a4a22]/60 bg-white/40 p-2 text-sm">
                  <span className="text-xl">{CONSUMABLE_INFO[k].icon}</span>
                  <div className="min-w-0 flex-1">
                    <b>{CONSUMABLE_INFO[k].name}</b> <span className="text-xs opacity-70">(tu en as {count(k)})</span>
                    <div className="text-xs">{CONSUMABLE_INFO[k].text}</div>
                  </div>
                  <button type="button" disabled={busy || price == null || gold < price || count(k) >= 9} className={BTN} onClick={() => void act(() => merchantBuy(k, 1))}>
                    Acheter · {price ?? "?"} <Coin />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="space-y-1 text-sm leading-snug"><div>💱 Le marchand rachète <b>tout au quart</b> du prix.</div><div>⚔ Les armes valent selon leur <b>rareté</b> et leur <b>durabilité restante</b>.</div><div><i>Un prototype ne se revend pas.</i></div></div>
            {CONSUMABLE_ORDER.filter((k) => count(k) > 0).map((k) => (
              <div key={k} className="flex items-center gap-2 rounded border border-[#7a4a22]/60 bg-white/40 p-2 text-sm">
                <span className="text-xl">{CONSUMABLE_INFO[k].icon}</span>
                <div className="min-w-0 flex-1"><b>{CONSUMABLE_INFO[k].name}</b> <span className="text-xs opacity-70">× {count(k)}</span></div>
                <button type="button" disabled={busy} className={BTN} onClick={() => void act(() => merchantSellConsumable(k, 1))}>Vendre 1 · {sellEach(k)} <Coin /></button>
              </div>
            ))}
            {items.map((it) => {
              const v = weaponValue(it);
              return (
                <div key={it.id} className="flex items-center gap-2 rounded border border-[#7a4a22]/60 bg-white/40 p-2 text-sm">
                  <img src={it.weapon.image_url} alt="" className="h-12 w-9 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1 truncate">
                    <b style={{ color: RARITY_INFO[it.weapon.rarity].color, background: "#2b1406", padding: "0 4px", borderRadius: 4 }}>{itemDisplayName(it)}</b>
                    <span className="ml-1 text-xs opacity-70">{RARITY_INFO[it.weapon.rarity].label} · {it.durability}/{it.durability_max}</span>
                  </div>
                  {v == null ? (
                    <span className="text-xs opacity-70">non rachetable</span>
                  ) : (
                    <button type="button" disabled={busy} className={BTN} onClick={() => void act(() => merchantSellWeapon(it.id), "✔ Arme vendue.")}>Vendre · {v} <Coin /></button>
                  )}
                </div>
              );
            })}
            {stacks.length === 0 && items.length === 0 && <div className="text-sm">Tu n'as rien à vendre.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
