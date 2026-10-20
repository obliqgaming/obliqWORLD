// Inventaire v1 : les armes que je porte sur moi, équiper / ranger / jeter.
// (Pas de changement d'arme en combat : on équipe au village.)
import { useCallback, useEffect, useRef, useState } from "react";
import { WornSprite } from "./WornSprite";
import type { Point } from "../lib/scenes-supabase";
import {
  DEFAULT_HAND, EFFECT_INFO, bonusText, weaponKindLabel, adjustItem, RARITY_INFO, WEAPON_H, WEAPON_W,
  deleteMyItem, equipItem, fetchEquippedItemId, fetchHandAnchor, fetchMyItems, itemDisplayName,
  type WeaponItem,
} from "../lib/weapons";
import type { ForgeCharacter } from "./ForgePanel";

export function RarityName({ name, rarity }: { name: string; rarity: keyof typeof RARITY_INFO }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-xs font-extrabold" style={{ background: "#2b1406", color: RARITY_INFO[rarity].color }}>
      {name}
    </span>
  );
}

export function ItemDetails({ it }: { it: WeaponItem }) {
  const eff = it.weapon.effect_key ? EFFECT_INFO[it.weapon.effect_key] : null;
  return (
    <div className="text-[11px] leading-tight">
      <div className="opacity-80">
        {RARITY_INFO[it.weapon.rarity].label} · {weaponKindLabel(it.weapon.weapon_type)} · {bonusText(it.weapon.bonus_damage)} · durabilité {it.durability}/{it.durability_max}
      </div>
      {eff && <div><b>{eff.name}</b> : {eff.text}</div>}
    </div>
  );
}

export function InventoryPanel({ character, onClose, onWeaponChanged }: { character: ForgeCharacter | null; onClose: () => void; onWeaponChanged: () => void }) {
  const [items, setItems] = useState<WeaponItem[]>([]);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [hand, setHand] = useState<Point>(DEFAULT_HAND);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Réglage en cours de modification (sinon on montre le réglage enregistré de l'arme affichée).
  const [edit, setEdit] = useState<{ id: string; dx: number; dy: number; rot: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await fetchMyItems());
      if (character) setEquipped(await fetchEquippedItemId(character.id));
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur de chargement");
    }
  }, [character]);

  useEffect(() => {
    void reload();
    if (character) void fetchHandAnchor(character.visualAssetId).then((h) => h && setHand(h));
  }, [reload, character]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      onWeaponChanged();
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const shownId = selectedId ?? equipped;
  const eq = items.find((i) => i.id === shownId) ?? null;
  const adj = eq && edit && edit.id === eq.id ? edit : eq ? { id: eq.id, dx: eq.adjust_dx, dy: eq.adjust_dy, rot: eq.adjust_rot } : { id: "", dx: 0, dy: 0, rot: 0 };
  const setAdj = (f: (a: { dx: number; dy: number; rot: number }) => { dx: number; dy: number; rot: number }) => {
    if (!eq) return;
    setEdit({ id: eq.id, ...f({ dx: adj.dx, dy: adj.dy, rot: adj.rot }) });
  };
  const selectItem = (it: WeaponItem) => {
    setSelectedId(it.id);
    setEdit(null);
  };
  const dirty = !!eq && (adj.dx !== eq.adjust_dx || adj.dy !== eq.adjust_dy || adj.rot !== eq.adjust_rot);
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !previewRef.current) return;
    const r = previewRef.current.getBoundingClientRect();
    const ddx = ((e.clientX - dragRef.current.x) / r.width) * 100;
    const ddy = ((e.clientY - dragRef.current.y) / r.height) * 100;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setAdj((a) => ({ ...a, dx: Math.max(-60, Math.min(60, a.dx + ddx)), dy: Math.max(-60, Math.min(60, a.dy + ddy)) }));
  };
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/55 p-2" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-full w-[min(40rem,98%)] overflow-y-auto rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">🎒 Inventaire</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        {!character ? (
          <div className="mt-3 text-sm">Il te faut un personnage.</div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-[10rem_1fr]">
            <div>
              <div
                ref={previewRef}
                className={`touch-none rounded-md border border-[#7a4a22]/60 bg-white/40 p-2 ${eq ? "cursor-move" : ""}`}
                onPointerDown={(e) => {
                  if (!eq) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragRef.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerMove={onDragMove}
                onPointerUp={() => (dragRef.current = null)}
                onPointerCancel={() => (dragRef.current = null)}
              >
                <WornSprite
                  src={character.imageUrl}
                  alt={character.name}
                  weapon={eq ? { imageUrl: eq.weapon.image_url, grip: eq.weapon.grip_anchor, width: WEAPON_W, height: WEAPON_H, hand, dx: adj.dx, dy: adj.dy, rot: adj.rot } : null}
                />
              </div>
              <div className="mt-1 text-center text-xs font-bold">{eq ? itemDisplayName(eq) : "Mains nues"}</div>
              {eq && (
                <div className="mt-1 text-[11px]">
                  <div className="opacity-70">Glisse l'arme pour la replacer dans la main, puis tourne-la :</div>
                  <label className="flex items-center gap-1">
                    Rotation
                    <input type="range" min={-180} max={180} step={5} value={adj.rot} onChange={(e) => setAdj((a) => ({ ...a, rot: Number(e.target.value) }))} className="flex-1" />
                    <span className="w-8 text-right">{adj.rot}°</span>
                  </label>
                  <div className="mt-1 flex gap-1">
                    <button type="button" disabled={busy || !dirty} className="rounded border border-[#7a4a22] px-1.5 font-bold hover:bg-[#7a4a22]/15 disabled:opacity-40"
                      onClick={() => void act(() => adjustItem(eq.id, adj.dx, adj.dy, adj.rot))}>Enregistrer</button>
                    <button type="button" className="rounded border border-[#7a4a22] px-1.5 font-bold hover:bg-[#7a4a22]/15"
                      onClick={() => setAdj(() => ({ dx: 0, dy: 0, rot: 0 }))}>Remettre à zéro</button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {items.length === 0 && <div className="text-sm">Aucune arme sur toi. Va voir le forgeron !</div>}
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 rounded border border-[#7a4a22]/50 bg-white/40 p-1.5">
                  <img src={it.weapon.image_url} alt="" className="h-10 w-12 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate"><RarityName name={itemDisplayName(it) + (it.weapon.hidden ? " (masquée)" : "")} rarity={it.weapon.rarity} /></div>
                    <ItemDetails it={it} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" className="rounded border border-[#7a4a22] px-1.5 text-[11px] font-bold hover:bg-[#7a4a22]/15" onClick={() => selectItem(it)}>
                      Régler
                    </button>
                    <button type="button" disabled={busy || it.weapon.hidden || it.durability <= 0} className="rounded border border-[#7a4a22] px-1.5 text-[11px] font-bold hover:bg-[#7a4a22]/15 disabled:opacity-40"
                      onClick={() => void act(() => equipItem(character.id, equipped === it.id ? null : it.id))}>
                      {equipped === it.id ? "Ranger" : it.durability <= 0 ? "Cassée" : "Équiper"}
                    </button>
                    <button type="button" disabled={busy} title="Jeter" className="rounded border border-[#b91c1c] px-1.5 text-[11px] font-bold text-[#b91c1c] hover:bg-[#b91c1c]/10"
                      onClick={() => { if (window.confirm(`Jeter « ${itemDisplayName(it)} » ?`)) void act(() => deleteMyItem(it.id)); }}>Jeter</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
      </div>
    </div>
  );
}
