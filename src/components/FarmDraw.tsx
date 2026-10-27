// Ferme : dessiner un compagnon (SQL 048) et acheter ceux des autres joueurs.
import { useEffect, useState } from "react";
import { uiSound } from "../lib/ui-sounds";
import { Coin } from "./GameIcons";
import { DrawingCanvas } from "./DrawingCanvas";
import { RARITY_TIER, RevealModal } from "./RevealModal";
import { RarityName } from "./InventoryPanel";
import { RARITY_INFO, type Rarity } from "../lib/weapons";
import { fetchMyGold } from "../lib/loot";
import { shopCollect } from "../lib/shop";
import {
  COMPANION_H, COMPANION_W, companionSetPrice, companionShopBuy, createCompanionDesign, fetchCompanionRules, fetchCompanionShop,
  type CompanionDesign, type CompanionListing, type CompanionRules,
} from "../lib/companions";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function FarmDraw({ onChanged }: { onChanged: () => void }) {
  const [rules, setRules] = useState<CompanionRules | null>(null);
  const [gold, setGold] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<CompanionDesign | null>(null);
  useEffect(() => {
    void fetchCompanionRules().then(setRules);
    void fetchMyGold().then(setGold);
  }, []);

  async function handleExport(blob: Blob) {
    if (busy) return;
    if (!name.trim()) return setMsg("Donne un nom à ton compagnon.");
    setBusy(true);
    setMsg(null);
    try {
      const { design } = await createCompanionDesign(blob, name.trim());
      setName("");
      setResult(design);
      void fetchMyGold().then(setGold);
      onChanged();
    } catch (e: any) {
      uiSound("error");
      setMsg(e?.message?.includes("companion_design_create") ? "Lance d'abord le SQL 048." : (e?.message ?? "Erreur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="space-y-1 text-sm leading-snug">
        <div>🎨 Dessine un compagnon : <b>{rules?.cost ?? 6} <Coin /></b>, <b>un par jour</b>. Tu as <b>{gold}</b> <Coin />.</div>
        <div>✨ Sa <b>rareté est tirée au sort</b> à la validation (plus elle est haute, plus il a de PV). Tu reçois tout de suite ton <b>prototype</b> (PV les plus bas), et le compagnon est mis en vente à la ferme : tu touches <b>{rules?.authorPct ?? 20} %</b> de chaque vente.</div>
        <div>🌲 Il pourra aussi apparaître comme créature dans la forêt. Dessine-le de profil, sur fond transparent.</div>
      </div>
      <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Nom du compagnon" className="mt-2 w-full rounded border border-[#7a4a22] bg-white/70 px-2 py-1 text-sm" />
      <div className="mt-2">
        <DrawingCanvas width={COMPANION_W} height={COMPANION_H} noAnchor exportLabel={`Valider (${rules?.cost ?? 6} or)`} exporting={busy} onExport={(b) => void handleExport(b)} />
      </div>
      {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
      {result && (
        <RevealModal tier={RARITY_TIER[result.rarity] ?? 1} title="Ton compagnon est validé !" onClose={() => setResult(null)}>
          <img src={result.image_url} alt="" className="mx-auto h-28 w-28 object-contain" />
          <div className="mt-2 text-center"><RarityName name={result.name} rarity={result.rarity} /></div>
          <div className="mt-1 text-center text-sm">{RARITY_INFO[result.rarity].label} · {rules?.hp[result.rarity] ?? "?"} PV pour les acheteurs</div>
          <div className="mt-1 text-center text-xs opacity-80">Ton prototype est dans « Mes compagnons ».</div>
        </RevealModal>
      )}
    </div>
  );
}

export function FarmShop({ onChanged }: { onChanged: () => void }) {
  const [list, setList] = useState<CompanionListing[] | null>(null);
  const [rules, setRules] = useState<CompanionRules | null>(null);
  const [gold, setGold] = useState(0);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = async () => {
    try {
      setList(await fetchCompanionShop());
      setRules(await fetchCompanionRules());
      setGold(await fetchMyGold());
    } catch (e: any) {
      setMsg(e?.message?.includes("companion_listings") ? "La boutique n'est pas encore activée (SQL 048)." : (e?.message ?? "Erreur"));
      setList([]);
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      uiSound("coin");
      setMsg(ok);
      await reload();
      onChanged();
    } catch (e: any) {
      uiSound("error");
      setMsg(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const pending = (list ?? []).filter((l) => l.mine).reduce((s, l) => s + l.author_gold_pending, 0);
  const card = (l: CompanionListing) => {
    const d = l.design;
    const sold = l.stock_left <= 0;
    const range = rules?.ranges[d.rarity as Rarity];
    return (
      <div key={l.design_id} className={`flex gap-2 rounded border border-[#7a4a22]/60 bg-white/40 p-2 ${sold ? "opacity-60" : ""}`}>
        <img src={d.image_url} alt="" className="h-16 w-16 shrink-0 object-contain" />
        <div className="min-w-0 flex-1 text-xs">
          <RarityName name={d.name} rarity={d.rarity as Rarity} />
          <div className="mt-0.5">{RARITY_INFO[d.rarity as Rarity].label} · {rules?.hp[d.rarity as Rarity] ?? "?"} PV</div>
          <div className="opacity-70">{l.authorName ? `par ${l.authorName} · ` : ""}{sold ? "ÉPUISÉ (on peut en trouver en butin)" : `${l.stock_left}/${l.stock_total} en stock`}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <b>{l.price} <Coin /></b>
            {!l.mine && <button type="button" disabled={busy || sold || gold < l.price} className={BTN} onClick={() => void act(() => companionShopBuy(l.design_id), `✔ « ${d.name} » est à la ferme.`)}>Acheter</button>}
            {l.mine && range && (
              <>
                <input type="number" min={range.min} max={range.max} value={prices[l.design_id] ?? String(l.price)} onChange={(e) => setPrices((p) => ({ ...p, [l.design_id]: e.target.value }))} className="w-16 rounded border border-[#7a4a22] bg-white/70 px-1 py-0.5" />
                <span className="opacity-70">({range.min} à {range.max})</span>
                <button type="button" disabled={busy} className={BTN} onClick={() => void act(() => companionSetPrice(l.design_id, Number(prices[l.design_id] ?? l.price)), "✔ Prix modifié.")}>Changer le prix</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };
  const mine = (list ?? []).filter((l) => l.mine);
  const others = (list ?? []).filter((l) => !l.mine);
  return (
    <div className="mt-3">
      <div className="text-sm">🛒 Les compagnons dessinés par les joueurs. Tu as <b>{gold}</b> <Coin />.</div>
      {pending > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded border border-[#7a4a22] bg-[#fde7c8] p-2 text-sm font-bold">
          📬 Tes ventes t'ont rapporté {pending} <Coin />
          <button type="button" disabled={busy} className={BTN} onClick={() => void act(async () => { await shopCollect(); }, "✔ Or récupéré.")}>Récupérer</button>
        </div>
      )}
      {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
      {list === null && <div className="mt-2 text-sm">Chargement…</div>}
      {mine.length > 0 && <div className="mt-3 text-xs font-bold uppercase tracking-widest text-[#7a4a22]">Mes compagnons en vente</div>}
      <div className="mt-1 grid gap-2 md:grid-cols-2">{mine.map(card)}</div>
      <div className="mt-3 text-xs font-bold uppercase tracking-widest text-[#7a4a22]">Compagnons des autres joueurs</div>
      {list && others.length === 0 && <div className="mt-1 text-sm">Rien d'autre en vente pour l'instant.</div>}
      <div className="mt-1 grid gap-2 md:grid-cols-2">{others.map(card)}</div>
    </div>
  );
}
