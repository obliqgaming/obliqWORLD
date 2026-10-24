// Onglet « Boutique » du forgeron : acheter les armes dessinées par les autres joueurs, fixer le prix des siennes.
import { useEffect, useState } from "react";
import { EFFECT_INFO, RARITY_INFO, bonusText, weaponFits, weaponKindLabel } from "../lib/weapons";
import { fetchShop, shopBuy, shopCollect, shopSetPrice, type Listing, type PriceRange } from "../lib/shop";
import { RarityName } from "./InventoryPanel";
import type { Rarity } from "../lib/weapons";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function ShopPanel({ gold, family, onGoldChange, onBought }: { gold: number; family: "melee" | "magie" | null; onGoldChange: () => void; onBought: () => void }) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [ranges, setRanges] = useState<Record<Rarity, PriceRange> | null>(null);
  const [pct, setPct] = useState(20);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = async () => {
    try {
      const r = await fetchShop();
      setListings(r.listings);
      setRanges(r.ranges);
      setPct(r.authorPct);
    } catch (e: any) {
      setMsg(e?.message?.includes("weapon_listings") ? "La boutique n'est pas encore activée (SQL 029)." : (e?.message ?? "Erreur"));
      setListings([]);
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
      onGoldChange();
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const pending = (listings ?? []).filter((l) => l.mine).reduce((s, l) => s + l.author_gold_pending, 0);
  const mine = (listings ?? []).filter((l) => l.mine);
  const others = (listings ?? []).filter((l) => !l.mine);

  const card = (l: Listing) => {
    const w = l.weapon;
    const sold = l.stock_left <= 0;
    const range = ranges?.[w.rarity];
    const fits = weaponFits(w.weapon_type, family);
    return (
      <div key={l.weapon_id} className={`flex gap-2 rounded border border-[#7a4a22]/60 bg-white/40 p-2 ${sold ? "opacity-60" : ""}`}>
        <img src={w.image_url} alt="" className="h-20 w-14 shrink-0 object-contain" />
        <div className="min-w-0 flex-1 text-xs">
          <RarityName name={w.name} rarity={w.rarity} />
          <div className="mt-0.5">{RARITY_INFO[w.rarity].label} · {weaponKindLabel(w.weapon_type)} · {bonusText(w.bonus_damage)}</div>
          {w.effect_key && EFFECT_INFO[w.effect_key] && (
            <div><b>{EFFECT_INFO[w.effect_key]!.name}</b> : {EFFECT_INFO[w.effect_key]!.text}</div>
          )}
          <div className="opacity-70">{l.authorName ? `par ${l.authorName} · ` : ""}{sold ? "ÉPUISÉE (on peut en trouver en butin)" : `${l.stock_left}/${l.stock_total} en stock`}</div>
          {!fits && !l.mine && <div className="font-bold text-[#7a3a0e]">⚠ Pas portable par ta spécialisation (elle resterait dans ton inventaire).</div>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <b>{l.price} 💰</b>
            {!l.mine && (
              <button type="button" disabled={busy || sold || gold < l.price} className={BTN} onClick={() => void act(async () => { await shopBuy(l.weapon_id); onBought(); }, `✔ « ${w.name} » est dans ton inventaire.`)}>
                Acheter
              </button>
            )}
            {l.mine && range && (
              <>
                <input
                  type="number"
                  min={range.min}
                  max={range.max}
                  value={prices[l.weapon_id] ?? String(l.price)}
                  onChange={(e) => setPrices((p) => ({ ...p, [l.weapon_id]: e.target.value }))}
                  className="w-16 rounded border border-[#7a4a22] bg-white/70 px-1 py-0.5"
                />
                <span className="opacity-70">({range.min} à {range.max})</span>
                <button type="button" disabled={busy} className={BTN} onClick={() => void act(() => shopSetPrice(l.weapon_id, Number(prices[l.weapon_id] ?? l.price)), "✔ Prix modifié.")}>
                  Changer le prix
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 text-[#3a2410]">
      <div className="text-xs opacity-80">
        Les armes dessinées par les joueurs sont en vente ici. L'auteur fixe le prix (dans une fourchette selon la rareté) et reçoit {pct} % de chaque vente. Tu as {gold} 💰
      </div>
      {pending > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded border border-[#7a4a22] bg-[#fde7c8] p-2 text-sm font-bold">
          📬 Tes ventes t'ont rapporté {pending} 💰
          <button type="button" disabled={busy} className={BTN} onClick={() => void act(async () => { await shopCollect(); }, "✔ Or récupéré.")}>Récupérer</button>
        </div>
      )}
      {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
      {listings === null && <div className="mt-2 text-sm">Chargement…</div>}
      {mine.length > 0 && <div className="mt-3 text-xs font-bold uppercase tracking-widest text-[#7a4a22]">Mes armes en vente</div>}
      <div className="mt-1 grid gap-2 md:grid-cols-2">{mine.map(card)}</div>
      <div className="mt-3 text-xs font-bold uppercase tracking-widest text-[#7a4a22]">Armes des autres joueurs</div>
      {listings && others.length === 0 && <div className="mt-1 text-sm">Rien d'autre en vente pour l'instant.</div>}
      <div className="mt-1 grid gap-2 md:grid-cols-2">{others.map(card)}</div>
    </div>
  );
}
