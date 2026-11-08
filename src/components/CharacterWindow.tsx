// Fenêtre unifiée « Personnage » : fiche + sac en une seule fenêtre (remplace InspectPanel + InventoryPanel quand
// ENABLE_UNIFIED_SHEET est à true). `mine` fourni = mon propre perso (équiper, jeter, régler l'arme, objets) ;
// sans `mine` = lecture seule (inspection d'un autre joueur).
import { useCallback, useEffect, useRef, useState } from "react";
import { uiSound } from "../lib/ui-sounds";
import { ZoomImage } from "./ZoomImage";
import { WeaponSheet, CompanionSheet } from "./ItemSheets";
import { Bag, Coin } from "./GameIcons";
import { WornSprite } from "./WornSprite";
import { ItemDetails, RarityName, RarityPill } from "./InventoryPanel";
import type { ForgeCharacter } from "./ForgePanel";
import { inspectCharacter, type Inspected } from "../lib/inspect";
import { TIER_INFO } from "../lib/companions";
import { CONSUMABLE_INFO, fetchMyConsumables, type ConsumableStack } from "../lib/consumables";
import { fetchMyGold } from "../lib/loot";
import { fetchMyBuild } from "../lib/expedition-combat";
import { scenesClient, type Point } from "../lib/scenes-supabase";
import {
  DEFAULT_HAND, EFFECT_INFO, bonusText, adjustItem, deleteMyItem, equipItem, fetchEquippedItemId,
  fetchHandAnchor, fetchMyItems, itemDisplayName, itemStats, weaponFits, type WeaponItem,
} from "../lib/weapons";

type Tab = "weapons" | "companions" | "items";
const BTN = "rounded border border-[#7a4a22] px-1.5 text-[11px] font-bold hover:bg-[#7a4a22]/15 disabled:opacity-40";

export function CharacterWindow({
  characterId, mine, onClose,
}: {
  characterId: string;
  mine?: { character: ForgeCharacter; onWeaponChanged: () => void };
  onClose: () => void;
}) {
  const character = mine?.character ?? null;
  const [d, setD] = useState<Inspected | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [vitals, setVitals] = useState<{ pvMax: number | null; pmMax: number | null } | null>(null);
  const [tab, setTab] = useState<Tab>("weapons");
  // Données de mon sac (inutilisées en lecture seule)
  const [gold, setGold] = useState(0);
  const [stacks, setStacks] = useState<ConsumableStack[]>([]);
  const [items, setItems] = useState<WeaponItem[]>([]);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [hand, setHand] = useState<Point>(DEFAULT_HAND);
  const [family, setFamily] = useState<"melee" | "magie" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; dx: number; dy: number; rot: number; scale: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    setVitals(null);
    void scenesClient.from("character_build").select("*").eq("character_id", characterId).maybeSingle().then(({ data }) => {
      if (!alive || !data) return;
      const r = data as Record<string, unknown>;
      const n = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : null);
      setVitals({ pvMax: n("pv_max"), pmMax: n("pm_max") });
    });
    return () => { alive = false; };
  }, [characterId]);
  useEffect(() => {
    let alive = true;
    inspectCharacter(characterId)
      .then((r) => alive && setD(r))
      .catch((e: any) => alive && setErr(e?.message?.includes("inspect_character") ? "Pas encore activé (SQL 046)." : (e?.message ?? "Erreur")));
    return () => { alive = false; };
  }, [characterId]);

  useEffect(() => {
    if (!mine) return;
    void fetchMyConsumables().then(setStacks);
    void fetchMyGold().then(setGold);
  }, [mine]);
  const reload = useCallback(async () => {
    if (!character) return;
    try {
      setItems(await fetchMyItems());
      setEquipped(await fetchEquippedItemId(character.id));
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur de chargement");
    }
  }, [character]);
  useEffect(() => {
    if (!character) return;
    void reload();
    void fetchHandAnchor(character.visualAssetId).then((h) => h && setHand(h));
    void fetchMyBuild(character.id).then((b) => setFamily(b?.family ?? null)).catch(() => {});
  }, [reload, character]);

  async function act(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      uiSound("ok");
      await reload();
      mine?.onWeaponChanged();
    } catch (e: any) {
      uiSound("error");
      setMsg(e?.message ?? "Erreur");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const eq = items.find((i) => i.id === equipped) ?? null;
  const adj = eq && edit && edit.id === eq.id ? edit : eq ? { id: eq.id, dx: eq.adjust_dx, dy: eq.adjust_dy, rot: eq.adjust_rot, scale: eq.adjust_scale } : { id: "", dx: 0, dy: 0, rot: 0, scale: 100 };
  type Adj = { dx: number; dy: number; rot: number; scale: number };
  const setAdj = (f: (a: Adj) => Adj) => {
    if (!eq) return;
    setEdit({ id: eq.id, ...f({ dx: adj.dx, dy: adj.dy, rot: adj.rot, scale: adj.scale }) });
  };
  const dirty = !!eq && (adj.dx !== eq.adjust_dx || adj.dy !== eq.adjust_dy || adj.rot !== eq.adjust_rot || adj.scale !== eq.adjust_scale);
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !previewRef.current) return;
    const r = previewRef.current.getBoundingClientRect();
    const ddx = ((e.clientX - dragRef.current.x) / r.width) * 100;
    const ddy = ((e.clientY - dragRef.current.y) / r.height) * 100;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setAdj((a) => ({ ...a, dx: Math.max(-60, Math.min(60, a.dx + ddx)), dy: Math.max(-60, Math.min(60, a.dy + ddy)) }));
  };

  const spec = d ? (d.axis ?? (d.family === "magie" ? "Magie" : d.family === "melee" ? "Mêlée" : "—")) : "";
  const w = d?.weapon ?? null;
  const title = "text-[11px] font-extrabold uppercase tracking-wide text-[#7a4a22]";
  const stat = (icon: string, n: number, one: string, many: string) => (
    <div className="flex items-center gap-2 rounded-lg bg-white/45 px-2 py-0.5">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-base font-extrabold leading-none">{n}</span>
      <span className="text-[11px] leading-tight opacity-80">{n > 1 ? many : one}</span>
    </div>
  );
  const vital = (icon: string, n: number, label: string) => (
    <div className="flex items-center gap-2 rounded-lg bg-white/45 px-2 py-0.5">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-base font-extrabold leading-none">{n}</span>
      <span className="text-[11px] leading-tight opacity-80">{label}</span>
    </div>
  );
  const nComp = d?.companions.length ?? 0;
  const tabs: { key: Tab; label: string }[] = [
    { key: "weapons", label: mine ? `Armes (${items.length})` : "Arme équipée" },
    { key: "companions", label: `Compagnons (${nComp})` },
    ...(mine ? [{ key: "items" as Tab, label: `Objets (${stacks.reduce((s, x) => s + x.count, 0)})` }] : []),
  ];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-2" onClick={onClose} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="flex max-h-full w-[min(46rem,98%)] flex-col rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] text-[#3a2410] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#7a4a22]/40 px-4 py-2">
          <div className="truncate text-xl font-extrabold">
            <Bag size="1.2em" /> {d?.name ?? character?.name ?? "Personnage"}
            {mine && <span className="ml-2 text-sm text-[#92400e]"><Coin /> {gold > 0 ? `${gold} flouz` : "pas de flouz"}</span>}
          </div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto parchment-scroll px-4 pb-4 pt-3">
          {err && <div className="text-sm font-bold text-[#92400e]">{err}</div>}
          {!d && !err && <div className="text-sm">Chargement…</div>}
          {d && (
            <div className="grid gap-4 sm:grid-cols-[16rem_minmax(0,1fr)]">
              {/* Colonne gauche : le perso, ses chiffres, (mon) réglage d'arme */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#7a4a22] px-3 py-1 text-sm font-extrabold text-[#fff3d6]">Niv. {d.level ?? 1}</span>
                  <div className="min-w-0 leading-tight">
                    <div className="text-[10px] font-bold uppercase opacity-60">Spécialisation</div>
                    <div className="truncate text-sm font-extrabold">{spec}{d.class_name ? <span className="font-bold opacity-70"> · « {d.class_name} »</span> : null}</div>
                  </div>
                </div>
                {vitals && vitals.pvMax !== null && vital("❤️", vitals.pvMax, "points de peps")}
                {vitals && vitals.pmMax !== null && vitals.pmMax > 0 && vital("💧", vitals.pmMax, "points de jus")}
                <div
                  ref={previewRef}
                  className={`relative z-10 touch-none rounded-md border border-[#7a4a22]/60 bg-white/40 p-0.5 ${mine && eq ? "cursor-move" : ""}`}
                  onPointerDown={(e) => {
                    if (!mine || !eq) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onPointerMove={onDragMove}
                  onPointerUp={() => (dragRef.current = null)}
                  onPointerCancel={() => (dragRef.current = null)}
                >
                  {mine && character ? (
                    <WornSprite
                      src={character.imageUrl}
                      alt={character.name}
                      weapon={eq ? { imageUrl: eq.weapon.image_url, grip: eq.weapon.grip_anchor, width: eq.weapon.width, height: eq.weapon.height, hand, dx: adj.dx, dy: adj.dy, rot: adj.rot, scale: adj.scale } : null}
                    />
                  ) : (
                    d.image_url && <img src={d.image_url} alt="" className="block w-full object-contain" draggable={false} />
                  )}
                </div>
                {mine && eq && (
                  <div className="mt-1 text-[11px]">
                    <div className="space-y-0.5 opacity-80"><div>✋ <b>Glisse</b> l'arme équipée.</div><div>💾 Puis <b>Enregistrer</b>.</div></div>
                    <div className="mt-1 grid grid-cols-[3.6rem_minmax(0,1fr)_2.4rem] items-center gap-x-1 gap-y-1">
                      <span>Rotation</span>
                      <input type="range" min={-180} max={180} step={5} value={adj.rot} onChange={(e) => setAdj((a) => ({ ...a, rot: Number(e.target.value) }))} className="min-w-0" />
                      <span className="text-right">{adj.rot}°</span>
                      <span>Taille</span>
                      <input type="range" min={80} max={120} step={1} value={adj.scale} onChange={(e) => setAdj((a) => ({ ...a, scale: Number(e.target.value) }))} className="min-w-0" />
                      <span className="text-right">{adj.scale}%</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button type="button" disabled={busy || !dirty} className={BTN} onClick={() => void act(() => adjustItem(eq.id, adj.dx, adj.dy, adj.rot, adj.scale))}>Enregistrer</button>
                      <button type="button" className={BTN} onClick={() => setAdj(() => ({ dx: 0, dy: 0, rot: 0, scale: 100 }))}>Remettre à zéro</button>
                    </div>
                  </div>
                )}
                <div className={title + " mt-1"}>Créations</div>
                {stat("✍", d.weapons_drawn, "arme dessinée", "armes dessinées")}
                {stat("🐾", d.companions_drawn ?? 0, "compagnon dessiné", "compagnons dessinés")}
                {stat("📜", d.events_written ?? 0, "passage écrit", "passages écrits")}
              </div>

              {/* Colonne droite : onglets */}
              <div className="min-w-0 sm:relative">
               <div className="flex h-full min-h-0 flex-col sm:absolute sm:inset-0">
                <div className="mb-2 flex shrink-0 flex-wrap gap-1 border-b border-[#7a4a22]/40 pb-1.5">
                  {tabs.map((t) => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)}
                      className={`rounded-t px-2.5 py-0.5 text-xs font-extrabold ${tab === t.key ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]/50 hover:bg-[#7a4a22]/15"}`}>{t.label}</button>
                  ))}
                </div>

                {tab === "weapons" && mine && character && (
                  <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto parchment-scroll pr-1">
                    {items.length === 0 && <div className="text-sm">Aucune arme sur toi. Va voir à la Forge du Manchot !</div>}
                    {[...items].sort((a, b) => Number(b.id === equipped) - Number(a.id === equipped)).map((it) => (
                      <div key={it.id} className={`flex items-center gap-2 rounded border p-1.5 ${it.id === equipped ? "border-[#7a4a22] bg-white/70" : "border-[#7a4a22]/50 bg-white/40"}`}>
                        <ZoomImage src={it.weapon.image_url} details={(() => { const st = itemStats(it); return <WeaponSheet name={itemDisplayName(it)} rarity={st.rarity} prototype={it.is_prototype} weaponType={it.weapon.weapon_type} bonus={st.bonus} effect={st.effect} authorId={it.weapon.author_user_id} extra={<div className="text-xs">Durabilité <b>{it.durability}/{it.durability_max}</b></div>} />; })()} className="h-14 w-16 shrink-0 object-contain" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">
                            <RarityName name={itemDisplayName(it) + (it.weapon.hidden ? " (masquée)" : "")} rarity={itemStats(it).rarity} prototype={it.is_prototype} />
                            {it.id === equipped && <span className="ml-1.5 rounded bg-[#7a4a22] px-1.5 text-[10px] font-extrabold text-[#fff3d6]">Équipée</span>}
                          </div>
                          <ItemDetails it={it} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <button type="button" disabled={busy || it.weapon.hidden || it.durability <= 0 || !weaponFits(it.weapon.weapon_type, family)}
                            title={!weaponFits(it.weapon.weapon_type, family) ? "Cette arme est réservée à l'autre spécialisation" : undefined} className={BTN}
                            onClick={() => void act(() => equipItem(character.id, equipped === it.id ? null : it.id))}>
                            {equipped === it.id ? "Ranger" : it.durability <= 0 ? "Cassée" : !weaponFits(it.weapon.weapon_type, family) ? (it.weapon.weapon_type === "magic" ? "Magie" : "Mêlée") : "Équiper"}
                          </button>
                          <button type="button" disabled={busy} title="Jeter" className="rounded border border-[#b91c1c] px-1.5 text-[11px] font-bold text-[#b91c1c] hover:bg-[#b91c1c]/10 disabled:opacity-40"
                            onClick={() => { if (window.confirm(`Jeter « ${itemDisplayName(it)} » ?`)) void act(() => deleteMyItem(it.id)); }}>Jeter</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "weapons" && !mine && (
                  w ? (
                    <div className="flex gap-3 rounded-lg border border-[#7a4a22]/50 bg-white/40 p-2">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-white/50">
                        <ZoomImage src={w.image_url} details={<WeaponSheet name={w.name} rarity={w.rarity} prototype={!!w.prototype} bonus={w.bonus} effect={w.effect} />} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <RarityName name={w.name} rarity={w.rarity} prototype={!!w.prototype} />
                          <RarityPill rarity={w.rarity} prototype={!!w.prototype} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
                          <span className="rounded bg-[#fde68a] px-1.5 py-px">{bonusText(w.bonus)}</span>
                          {w.effect && EFFECT_INFO[w.effect] && <span className="rounded bg-[#dbeafe] px-1.5 py-px text-[#1d4ed8]">{EFFECT_INFO[w.effect]!.name}</span>}
                        </div>
                        {w.effect && EFFECT_INFO[w.effect] && <div className="mt-0.5 text-[11px] opacity-80">{EFFECT_INFO[w.effect]!.text}</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm opacity-70">Aucune arme équipée.</div>
                  )
                )}

                {tab === "companions" && (
                  nComp === 0 ? (
                    <div className="text-sm opacity-70">Aucun compagnon.</div>
                  ) : (
                    <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto parchment-scroll pr-1">
                      {d.companions.map((c, i) => (
                        <div key={i} className="rounded-lg border border-[#7a4a22]/40 bg-white/40 p-1.5 text-center leading-tight" title={c.name}>
                          <div className="flex h-16 items-center justify-center">
                            <ZoomImage src={c.image_url} scale={0.75} details={<CompanionSheet name={c.name} tier={c.tier} />} className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="mt-1 truncate text-[12px] font-bold">{c.name}</div>
                          <div className="text-[10px] opacity-70">{TIER_INFO[c.tier].label}</div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === "items" && mine && (
                  stacks.length === 0 ? (
                    <div className="text-sm opacity-70">Aucun objet.</div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto parchment-scroll rounded border border-[#b98a54] bg-[#f6e8c4] p-2 text-sm">
                      <div className="text-xs font-extrabold uppercase">Objets (utilisables en expédition)</div>
                      <div className="mt-1 grid grid-cols-[1.6rem_max-content_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
                        {stacks.map((st) => (
                          <div key={st.kind} className="contents">
                            <span className="text-center">{CONSUMABLE_INFO[st.kind].icon}</span>
                            <span className="whitespace-nowrap"><b>{CONSUMABLE_INFO[st.kind].name}</b> ×{st.count}</span>
                            <span className="text-xs leading-snug">{CONSUMABLE_INFO[st.kind].text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
                {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
               </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

