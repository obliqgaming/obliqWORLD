// Fenêtre d'échange façon WoW : mon offre à gauche, celle de l'autre joueur à droite (en direct), puis validation des deux côtés.
import { useEffect, useRef, useState } from "react";
import {
  tradeAccept, tradeAddItem, tradeCancel, tradeRemoveItem, tradeSetGold,
  type TradeItem, type TradeState,
} from "../lib/trade";
import { fetchMyItems, fetchEquippedItemId, itemDisplayName, itemStats, RARITY_INFO, type Rarity, type WeaponItem } from "../lib/weapons";
import { fetchMyCompanions, TIER_INFO, type Companion } from "../lib/companions";
import { CONSUMABLE_INFO, fetchMyConsumables, type ConsumableKind, type ConsumableStack } from "../lib/consumables";
import { fetchMyGold } from "../lib/loot";
import { Coin } from "./GameIcons";
import { uiSound } from "../lib/ui-sounds";

const FONT = { fontFamily: "'Baloo 2', cursive" };
const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";
const BTN2 = "rounded-lg border-2 border-[#7a4a22] px-3 py-1 text-xs font-bold text-[#5e3818] hover:bg-[#7a4a22]/15 disabled:opacity-50";

export function TradeInvite({ name, onAnswer }: { name: string; onAnswer: (accept: boolean) => void }) {
  return (
    <div className="absolute left-1/2 top-24 z-50 w-[min(22rem,92%)] -translate-x-1/2 rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-3 text-center text-[#3a2410] shadow-xl" style={FONT}>
      <div className="text-sm font-extrabold">🤝 {name} te propose un échange</div>
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" className={BTN} onClick={() => onAnswer(true)}>Accepter</button>
        <button type="button" className={BTN2} onClick={() => onAnswer(false)}>Refuser</button>
      </div>
    </div>
  );
}

export function TradeWaiting({ name, onCancel }: { name: string; onCancel: () => void }) {
  return (
    <div className="absolute left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-bold text-[#fff3d6]" style={FONT}>
      En attente de {name}…
      <button type="button" className="rounded border border-[#fff3d6]/60 px-2 py-0.5 hover:bg-white/15" onClick={onCancel}>Annuler</button>
    </div>
  );
}

function ItemSlot({ it, onRemove }: { it: TradeItem; onRemove?: (() => void) | undefined }) {
  const c = it.kind === "weapon" ? RARITY_INFO[(it.rarity as Rarity) ?? "common"]?.color : undefined;
  const cons = it.kind === "consumable" ? CONSUMABLE_INFO[it.ckind as ConsumableKind] : undefined;
  return (
    <div className="relative flex h-20 w-full flex-col items-center justify-center rounded-lg border border-[#7a4a22]/60 bg-white/40 p-1 text-center" title={it.info ?? undefined}>
      {it.image_url ? <img src={it.image_url} alt="" className="h-10 w-full object-contain" /> : <div className="text-2xl leading-none">{cons?.icon ?? "📦"}</div>}
      <div className="mt-0.5 w-full truncate text-[11px] font-extrabold leading-tight" style={{ color: c ? "#2b1406" : undefined }}>
        {cons ? `${cons.name} ×${it.qty}` : it.label}
      </div>
      {it.kind === "weapon" && c && <span className="absolute left-1 top-1 h-2 w-2 rounded-full" style={{ background: c, boxShadow: "0 0 0 1px #2b1406" }} />}
      {onRemove && (
        <button type="button" onClick={onRemove} className="absolute right-0.5 top-0.5 rounded bg-[#7a4a22] px-1 text-[10px] font-bold leading-4 text-[#fff3d6] hover:bg-[#b91c1c]">×</button>
      )}
    </div>
  );
}

export function TradePanel({ state, onClose }: { state: TradeState; onClose: () => void }) {
  const t = state.trade;
  const me = state.me;
  const meUser = me === "a" ? t.user_a : t.user_b;
  const otherName = me === "a" ? t.name_b : t.name_a;
  const myGold = me === "a" ? t.gold_a : t.gold_b;
  const theirGold = me === "a" ? t.gold_b : t.gold_a;
  const myAcc = me === "a" ? t.accepted_a : t.accepted_b;
  const theirAcc = me === "a" ? t.accepted_b : t.accepted_a;
  const mine = state.items.filter((i) => i.user_id === meUser);
  const theirs = state.items.filter((i) => i.user_id !== meUser);
  const open = t.status === "open";
  const SLOTS = 6;

  const [tab, setTab] = useState<"weapons" | "companions" | "items">("weapons");
  const [weapons, setWeapons] = useState<WeaponItem[]>([]);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [comps, setComps] = useState<Companion[]>([]);
  const [stacks, setStacks] = useState<ConsumableStack[]>([]);
  const [wallet, setWallet] = useState(0);
  const [goldInput, setGoldInput] = useState(String(myGold));
  const [qty, setQty] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const myChar = me === "a" ? t.char_a : t.char_b;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [w, eq, c, s, g] = await Promise.all([fetchMyItems(), fetchEquippedItemId(myChar), fetchMyCompanions(), fetchMyConsumables(), fetchMyGold()]);
        if (cancelled) return;
        setWeapons(w); setEquipped(eq); setComps(c); setStacks(s); setWallet(g);
      } catch { /* ignoré */ }
    })();
    return () => { cancelled = true; };
  }, [open, myChar]);

  // L'or tapé suit l'état du serveur (quand il change de l'extérieur).
  useEffect(() => { setGoldInput(String(myGold)); }, [myGold]);

  // Si l'autre joueur change son offre alors que j'avais validé, on le dit clairement.
  const wasAcc = useRef(false);
  useEffect(() => {
    if (open && wasAcc.current && !myAcc) {
      setNotice("L'offre a changé : vérifie-la avant de valider à nouveau.");
      const to = window.setTimeout(() => setNotice(null), 5000);
      wasAcc.current = myAcc;
      return () => window.clearTimeout(to);
    }
    wasAcc.current = myAcc;
    return undefined;
  }, [myAcc, open]);
  useEffect(() => { if (t.status === "completed") uiSound("success"); }, [t.status]);

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try { await fn(); } catch (e: any) { uiSound("error"); setMsg(e?.message ?? "Erreur"); } finally { setBusy(false); }
  };

  const offeredRefs = new Set(mine.filter((i) => i.ref_id).map((i) => i.ref_id!));
  const offeredKinds = new Set(mine.filter((i) => i.ckind).map((i) => i.ckind!));
  const finished = !open;

  const slotsOf = (list: TradeItem[], removable: boolean) => (
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: SLOTS }, (_, i) => {
        const it = list[i];
        return it
          ? <ItemSlot key={it.id} it={it} onRemove={removable && open ? () => void act(() => tradeRemoveItem(t.id, it.id)) : undefined} />
          : <div key={`e${i}`} className="h-20 rounded-lg border border-dashed border-[#7a4a22]/40 bg-black/5" />;
      })}
    </div>
  );

  const submitGold = () => {
    const n = Math.max(0, Math.floor(Number(goldInput) || 0));
    if (n === myGold) return;
    void act(() => tradeSetGold(t.id, n));
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-2" style={FONT} onClick={(e) => e.stopPropagation()}>
      <div className="max-h-full w-[min(44rem,98%)] overflow-y-auto parchment-scroll rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">🤝 Échange avec {otherName}</div>
          {finished && <button type="button" className={BTN2} onClick={onClose}>Fermer</button>}
        </div>

        {t.status === "completed" && <div className="mt-2 rounded-lg bg-[#d1fae5] p-2 text-center text-sm font-extrabold text-[#065f46]">✔ Échange terminé !</div>}
        {(t.status === "cancelled" || t.status === "declined") && <div className="mt-2 rounded-lg bg-[#fde7c8] p-2 text-center text-sm font-bold">{t.note ?? "L'échange a été annulé."}</div>}
        {notice && open && <div className="mt-2 rounded-lg bg-[#fef3c7] p-1.5 text-center text-xs font-bold text-[#92400e]">{notice}</div>}
        {t.note && open && <div className="mt-2 rounded-lg bg-[#fde7c8] p-1.5 text-center text-xs font-bold text-[#92400e]">{t.note}</div>}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border-2 p-2" style={{ borderColor: myAcc ? "#16a34a" : "#b98a54" }}>
            <div className="flex items-center justify-between text-xs font-extrabold uppercase text-[#7a4a22]">
              <span>Ton offre</span><span style={{ color: "#15803d" }}>{myAcc ? "✔ validé" : ""}</span>
            </div>
            <div className="mt-1.5">{slotsOf(mine, true)}</div>
            <div className="mt-2 flex items-center gap-1.5 text-sm font-bold">
              <Coin />
              <input
                type="number" min={0} max={wallet} value={goldInput} disabled={!open || busy}
                onChange={(e) => setGoldInput(e.target.value)} onBlur={submitGold} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-24 rounded border border-[#7a4a22] bg-white/70 px-1.5 py-0.5 text-sm"
              />
              <span className="text-[11px] font-semibold opacity-70">/ {wallet}</span>
            </div>
          </div>
          <div className="rounded-lg border-2 p-2" style={{ borderColor: theirAcc ? "#16a34a" : "#b98a54" }}>
            <div className="flex items-center justify-between text-xs font-extrabold uppercase text-[#7a4a22]">
              <span>Offre de {otherName}</span><span style={{ color: "#15803d" }}>{theirAcc ? "✔ validé" : ""}</span>
            </div>
            <div className="mt-1.5">{slotsOf(theirs, false)}</div>
            <div className="mt-2 flex items-center gap-1.5 text-sm font-bold"><Coin /> {theirGold}</div>
          </div>
        </div>

        {open && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button type="button" disabled={busy} className={BTN} onClick={() => void act(async () => {
              const r = await tradeAccept(t.id, !myAcc);
              if (!r.ok) setMsg(r.reason ?? "L'échange n'a pas pu se faire.");
            })}>
              {myAcc ? "Retirer ma validation" : "✔ Valider"}
            </button>
            <button type="button" disabled={busy} className={BTN2} onClick={() => void act(() => tradeCancel(t.id))}>Annuler l'échange</button>
            <div className="w-full text-center text-[11px] opacity-70">Dès qu'une offre change, les validations sont retirées. L'échange se fait quand vous avez tous les deux validé.</div>
          </div>
        )}
        {msg && <div className="mt-2 text-center text-xs font-bold text-[#92400e]">{msg}</div>}

        {open && (
          <div className="mt-3 border-t border-[#7a4a22]/40 pt-2">
            <div className="flex gap-1.5">
              {([["weapons", "⚔ Armes"], ["companions", "🐾 Compagnons"], ["items", "🧪 Objets"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`rounded px-2.5 py-1 text-xs font-bold ${tab === k ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>{l}</button>
              ))}
              <span className="ml-auto self-center text-[11px] opacity-70">Clique pour proposer (max 6)</span>
            </div>
            <div className="mt-2 grid max-h-44 gap-1.5 overflow-y-auto parchment-scroll sm:grid-cols-2">
              {tab === "weapons" && weapons.filter((w) => !w.is_prototype && w.id !== equipped && !offeredRefs.has(w.id)).map((w) => {
                const st = itemStats(w);
                return (
                  <button key={w.id} type="button" disabled={busy || mine.length >= SLOTS} onClick={() => void act(() => tradeAddItem(t.id, "weapon", w.id))}
                    className="flex items-center gap-2 rounded border border-[#b98a54] bg-[#f6e8c4] p-1.5 text-left text-xs hover:bg-[#ecd9a8] disabled:opacity-50">
                    <img src={w.weapon.image_url} alt="" className="h-9 w-9 shrink-0 object-contain" />
                    <span className="min-w-0"><b className="block truncate" style={{ color: "#2b1406" }}>{itemDisplayName(w)}</b>
                      <span style={{ color: "#5e3818" }}>{RARITY_INFO[st.rarity].label} · {w.durability}/{w.durability_max}</span></span>
                  </button>
                );
              })}
              {tab === "companions" && comps.filter((c) => !c.active && !(c as any).loot_expedition_id && !offeredRefs.has(c.id)).map((c) => (
                <button key={c.id} type="button" disabled={busy || mine.length >= SLOTS} onClick={() => void act(() => tradeAddItem(t.id, "companion", c.id))}
                  className="flex items-center gap-2 rounded border border-[#b98a54] bg-[#f6e8c4] p-1.5 text-left text-xs hover:bg-[#ecd9a8] disabled:opacity-50">
                  <img src={c.image_url} alt="" className="h-9 w-9 shrink-0 object-contain" />
                  <span className="min-w-0"><b className="block truncate">{c.name}</b><span style={{ color: "#5e3818" }}>{TIER_INFO[c.tier].label} · {c.hp_max} peps</span></span>
                </button>
              ))}
              {tab === "items" && stacks.filter((s) => !offeredKinds.has(s.kind)).map((s) => {
                const info = CONSUMABLE_INFO[s.kind];
                const q = Math.min(Math.max(1, qty[s.kind] ?? 1), s.count);
                return (
                  <div key={s.kind} className="flex items-center gap-2 rounded border border-[#b98a54] bg-[#f6e8c4] p-1.5 text-xs">
                    <span className="text-xl leading-none">{info.icon}</span>
                    <span className="min-w-0 flex-1"><b className="block truncate">{info.name}</b><span style={{ color: "#5e3818" }}>tu en as {s.count}</span></span>
                    <input type="number" min={1} max={s.count} value={q} onChange={(e) => setQty((o) => ({ ...o, [s.kind]: Number(e.target.value) }))} className="w-12 rounded border border-[#7a4a22] bg-white/70 px-1 py-0.5 text-center" />
                    <button type="button" disabled={busy || mine.length >= SLOTS} className={BTN} onClick={() => void act(() => tradeAddItem(t.id, "consumable", null, s.kind, q))}>Ajouter</button>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 text-[11px] opacity-70">Impossible d'échanger : prototypes, arme équipée, compagnon actif, butin d'une expédition en cours.</div>
          </div>
        )}
      </div>
    </div>
  );
}
