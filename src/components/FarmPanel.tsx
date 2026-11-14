// La ferme : tes compagnons (créatures gagnées en butin). Un seul t'accompagne en expédition ;
// il prend la moitié des dégâts que tu reçois. À 0 PV il s'enfuit et se repose quelques expéditions.
import { uiSound } from "../lib/ui-sounds";
import { ZoomImage } from "./ZoomImage";
import { CompanionSheet } from "./ItemSheets";
import { useEffect, useRef, useState } from "react";
import { FarmDraw, FarmShop } from "./FarmDraw";
import { RARITY_INFO } from "../lib/weapons";
import { Coin } from "./GameIcons";
import { Pill } from "./InventoryPanel";
import { shopCollect } from "../lib/shop";
import { TIER_INFO, claimStarterCompanion, fetchCompanionRules, fetchCompanionShop, fetchMyCompanions, fetchStarterChoices, releaseCompanion, setActiveCompanion, type Companion, type StarterCompanion } from "../lib/companions";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function FarmPanel({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Companion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tab, setTab] = useState<"mine" | "draw" | "buy">("draw");
  const [starters, setStarters] = useState<StarterCompanion[]>([]);
  // Or des ventes de MES compagnons, à récupérer depuis n'importe quel onglet.
  const [pending, setPending] = useState(0);
  const [authorPct, setAuthorPct] = useState<number | null>(null);
  const reloadPending = async () => {
    try {
      const l = await fetchCompanionShop();
      setPending(l.filter((x) => x.mine).reduce((t, x) => t + x.author_gold_pending, 0));
    } catch { /* ignoré */ }
  };
  useEffect(() => {
    void reloadPending();
    void fetchCompanionRules().then((r) => setAuthorPct(r?.authorPct ?? null)).catch(() => {});
  }, []);

  const reload = async () => {
    try {
      setList(await fetchMyCompanions());
      setStarters(await fetchStarterChoices());
    } catch (e: any) {
      setMsg(e?.message?.includes("companions") ? "La Ferme des Jetés en Pâture n'est pas encore activée (SQL 031)." : (e?.message ?? "Erreur"));
      setList([]);
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  const lock = useRef(false);
  async function act(fn: () => Promise<void>) {
    if (lock.current) return;   // anti double-clic
    lock.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      uiSound("ok");
      await reload();
      window.dispatchEvent(new Event("obliq-companion-changed"));
    } catch (e: any) {
      uiSound("error");
      setMsg(e?.message ?? "Erreur");
    } finally {
      lock.current = false;
      setBusy(false);
      setConfirmId(null);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto overflow-x-hidden parchment-scroll bg-black/55 p-2" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-full w-[min(40rem,98%)] overflow-y-auto overflow-x-hidden parchment-scroll rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-3 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">🐾 La Ferme des Jetés en Pâture</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        {pending > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border-2 border-[#b45309] bg-[#fcd34d] p-2 text-sm font-extrabold text-[#3a2410] shadow-[0_0_0_3px_rgba(245,158,11,0.35)]">
            📬 Tes ventes t'ont rapporté {pending} <Coin />
            <button type="button" disabled={busy} className={BTN} onClick={() => void act(async () => { await shopCollect(); await reloadPending(); })}>Récupérer</button>
          </div>
        )}
        {starters.length > 0 && (
          <div className="mt-3 rounded border-2 border-[#16a34a] bg-white/50 p-2">
            <div className="text-sm font-extrabold">🎁 Choisis ton premier compagnon <i>(gratuit, une seule fois)</i></div>
            <div className="mt-1 text-xs opacity-80">Clique sur un dessin pour le voir en grand, puis sur « Choisir » pour l'adopter.</div>
            <div className="mt-2 flex flex-wrap gap-3">
              {starters.map((c) => (
                <div key={c.id} className="flex flex-col items-center gap-1 rounded border border-[#7a4a22] bg-white/60 p-1">
                  <ZoomImage src={c.image_url} alt={c.name} scale={0.75} details={<CompanionSheet name={c.name} tier={c.tier} />} className="h-24 w-24 object-contain" />
                  <div className="max-w-[6.5rem] truncate text-xs font-bold" title={c.name}>{c.name}</div>
                  <button type="button" disabled={busy} className={BTN} onClick={() => void act(() => claimStarterCompanion(c.id))}>Choisir</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setTab("draw")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "draw" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>🎨 Dessiner</button>
          <button type="button" onClick={() => setTab("buy")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "buy" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>🛒 Acheter</button>
          <button type="button" onClick={() => setTab("mine")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "mine" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>🐾 Mes compagnons</button>
        </div>
        {tab === "draw" && <FarmDraw onChanged={() => void reload()} />}
        {tab === "buy" && <FarmShop onChanged={() => { void reload(); window.dispatchEvent(new Event("obliq-companion-changed")); }} />}
        {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
        {list === null && <div className="mt-3 text-sm">Chargement…</div>}
        {tab === "mine" && (
          <div className="mt-3 rounded-lg bg-white/35 p-2.5 text-sm leading-snug">
            <div className="font-extrabold">🐾 Un compagnon t'accompagne en expédition</div>
            <div className="mt-1">Il prend <b>la moitié des dégâts</b> que tu reçois.</div>
            <div>💤 À 0 peps, il se repose : <b>3</b> expéditions (petit), <b>6</b> (moyen) ou <b>9</b> (grand).</div>
            <div className="mt-1 text-xs opacity-80">Où en trouver : en butin sur les monstres, à l'onglet Acheter, ou en les dessinant.</div>
          </div>
        )}
        {tab === "mine" && <div className="mt-3 grid gap-2 md:grid-cols-2">
          {(list ?? []).map((c) => {
            const resting = c.rest_left > 0;
            const provisional = c.loot_expedition_id !== null;
            return (
              <div key={c.id} className={`flex gap-2 rounded border bg-white/40 p-2 ${c.active ? "border-[#166534] ring-2 ring-[#16a34a]" : "border-[#7a4a22]/60"}`}>
                <ZoomImage src={c.image_url} scale={0.75} details={<CompanionSheet name={c.name} rarity={c.rarity} tier={c.tier} prototype={c.is_prototype} hp={c.hp} hpMax={c.hp_max} restLeft={c.rest_left} />} className="h-24 w-24 shrink-0 object-contain" style={resting ? { filter: "grayscale(1)", opacity: 0.6 } : undefined} />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="truncate">
                    <span className="text-sm font-extrabold">{c.name}</span>
                  </div>
                  <div>{c.is_prototype ? <Pill label="Prototype" color="#f3f4f6" /> : c.rarity ? <Pill label={RARITY_INFO[c.rarity].label} color={RARITY_INFO[c.rarity].color} /> : <Pill label={TIER_INFO[c.tier].label} color={TIER_INFO[c.tier].color} />} · {c.hp}/{c.hp_max} peps</div>
                  {resting && <div className="font-bold text-[#7a3a0e]">💤 Se repose encore {c.rest_left} expédition{c.rest_left > 1 ? "s" : ""}</div>}
                  {provisional && <div className="font-bold text-[#7a3a0e]">À toi à la fin de l'expédition</div>}
                  {c.active && !resting && <div className="font-bold text-[#166534]">✔ T'accompagne</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!c.active && <button type="button" disabled={busy || resting || provisional} className={BTN} onClick={() => void act(() => setActiveCompanion(c.id))}>Emmener</button>}
                    {c.active && <button type="button" disabled={busy} className={BTN} onClick={() => void act(() => setActiveCompanion(null))}>Laisser ici</button>}
                    {!provisional && (confirmId === c.id ? (
                      <>
                        <div className="w-full text-xs font-bold text-[#b91c1c]">⚠ Définitif : tu ne le retrouveras pas.</div>
                        <button type="button" disabled={busy} className="rounded border-2 border-[#b91c1c] bg-[#b91c1c] px-2 py-1 text-xs font-bold text-white" onClick={() => void act(() => releaseCompanion(c.id))}>Oui, le relâcher pour de bon</button>
                        <button type="button" disabled={busy} className="rounded border-2 border-[#7a4a22] px-2 py-1 text-xs font-bold" onClick={() => setConfirmId(null)}>Non, le garder</button>
                      </>
                    ) : (
                      <button type="button" disabled={busy} className="rounded border-2 border-[#b91c1c] px-2 py-1 text-xs font-bold text-[#b91c1c]" onClick={() => setConfirmId(c.id)}>Relâcher</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>}
      </div>
    </div>
  );
}
