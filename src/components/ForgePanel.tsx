// Forge v1 : dessiner une arme (canvas 170 × 150), voir en direct comment elle
// se tient dans la main de son personnage, la forger, l'équiper ou la ranger.
import { useEffect, useRef, useState } from "react";
import { DrawingCanvas } from "./DrawingCanvas";
import { WornSprite } from "./WornSprite";
import type { Point } from "../lib/scenes-supabase";
import {
  EFFECT_INFO, RARITY_INFO, bonusText, WEAPON_H, WEAPON_TYPES, WEAPON_W, DEFAULT_HAND,
  createWeapon, equipItem, weaponFits, weaponKindLabel, fetchHandAnchor, fetchMyItems, itemDisplayName,
  type Weapon, type WeaponItem, type WeaponType, type WornWeapon,
} from "../lib/weapons";
import { RarityName } from "./InventoryPanel";
import { fetchMyBuild } from "../lib/expedition-combat";
import { fetchForgeCost, fetchMyGold, fetchRepairCosts, repairItem } from "../lib/loot";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-4 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export type ForgeCharacter = { id: string; name: string; imageUrl: string; visualAssetId: string };

export function ForgePanel({ character, onClose, onWeaponChanged }: { character: ForgeCharacter | null; onClose: () => void; onWeaponChanged: () => void }) {
  const [hand, setHand] = useState<Point>(DEFAULT_HAND);
  const [cost, setCost] = useState(0);
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairItems, setRepairItems] = useState<WeaponItem[]>([]);
  const [repairCosts, setRepairCosts] = useState<Record<string, number>>({});
  const reloadRepair = async () => {
    try {
      setRepairItems((await fetchMyItems()).filter((i) => !i.is_prototype && i.durability < i.durability_max));
      setRepairCosts(await fetchRepairCosts());
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => {
    if (repairOpen) void reloadRepair();
  }, [repairOpen]);
  const [gold, setGold] = useState(0);
  useEffect(() => {
    void fetchForgeCost().then(setCost);
    void fetchMyGold().then(setGold);
  }, []);
  const [name, setName] = useState("");
  const [type, setType] = useState<WeaponType>("blunt_slash");
  const typeTouched = useRef(false);
  const [family, setFamily] = useState<"melee" | "magie" | null>(null);
  const [preview, setPreview] = useState<{ url: string; anchor: Point } | null>(null);
  const [result, setResult] = useState<Weapon | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (character) void fetchHandAnchor(character.visualAssetId).then((h) => h && setHand(h));
    // Par défaut, le type d'arme de ta spécialisation (tu ne peux équiper que celui-là).
    if (character) void fetchMyBuild(character.id).then((b) => { if (b) { setFamily(b.family === "magie" ? "magie" : "melee"); if (!typeTouched.current) setType(b.family === "magie" ? "magic" : "blunt_slash"); } }).catch(() => {});
  }, [character]);

  const worn = (w: { imageUrl: string; grip: Point; width: number; height: number }): WornWeapon => ({ ...w, hand });

  async function act(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      onWeaponChanged();
      if (ok) setMsg(ok);
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function handleExport(blob: Blob, anchor: Point | null) {
    if (!character) return;
    if (!name.trim()) return setMsg("Donne un nom à ton arme.");
    if (!anchor) return setMsg("Place le point poignée.");
    void act(async () => {
      const { weapon, itemId } = await createWeapon(blob, name.trim(), type, anchor);
      try {
        await equipItem(character.id, itemId);
      } catch {
        // Arme de l'autre spécialisation : elle reste dans l'inventaire, non équipée.
      }
      setResult(weapon);
      setName("");
      void fetchMyGold().then(setGold);
    });
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/55 p-2" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-full w-[min(56rem,98%)] overflow-y-auto rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">⚒ Forgeron{cost > 0 && <span className="ml-2 text-sm text-[#92400e]">Forger coûte {cost} or · tu as {gold} 💰</span>}</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        {!character ? (
          <div className="mt-3 text-sm">Il te faut un personnage pour forger une arme.</div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-[1fr_14rem]">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'arme" className="min-w-0 flex-1 rounded border border-[#7a4a22] bg-white/70 px-2 py-1 text-sm" />
                <select value={type} onChange={(e) => { typeTouched.current = true; setType(e.target.value as WeaponType); }} className="rounded border border-[#7a4a22] bg-white/70 px-2 py-1 text-sm">
                  {WEAPON_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              {family && !weaponFits(type, family) && (
                <div className="mb-2 rounded border border-[#c96a2e] bg-[#fde7c8] px-2 py-1 text-xs font-bold text-[#7a3a0e]">
                  ⚠ Ton personnage est {family === "magie" ? "Magie" : "Mêlée"} : il ne pourra pas porter une arme de ce type (elle restera dans ton inventaire).
                </div>
              )}
              <DrawingCanvas
                width={WEAPON_W}
                height={WEAPON_H}
                anchorOptional={false}
                anchorLabel="Point poignée : glisse le repère là où la main tient l'arme"
                anchorTitle="Point poignée — glisse pour le placer"
                exportLabel="Forger et équiper"
                exporting={busy}
                initialAnchor={{ x: 50, y: 85 }}
                onPreview={(url, anchor) => anchor && setPreview({ url, anchor })}
                onExport={handleExport}
              />
              {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
              <div className="mt-3 rounded border border-[#7a4a22]/60 bg-white/40 p-2">
                <button type="button" onClick={() => setRepairOpen((o) => !o)} className="text-sm font-extrabold">
                  🔧 Réparer mes armes {repairOpen ? "▲" : "▼"}
                </button>
                {repairOpen && (
                  <div className="mt-1 text-xs">
                    <div className="mb-1 opacity-80">Prix par point de durabilité manquant, selon la rareté. Un prototype ne se répare pas, une arme à 0 disparaît.</div>
                    {repairItems.length === 0 && <div>Aucune arme à réparer.</div>}
                    {repairItems.map((it) => {
                      const price = (it.durability_max - it.durability) * (repairCosts[it.weapon.rarity] ?? 2);
                      return (
                        <div key={it.id} className="mb-1 flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate">
                            <b>{itemDisplayName(it)}</b> · {RARITY_INFO[it.weapon.rarity].label} · {it.durability}/{it.durability_max}
                          </div>
                          <button
                            type="button"
                            disabled={busy || gold < price}
                            className={BTN}
                            onClick={() =>
                              void act(async () => {
                                await repairItem(it.id);
                                await reloadRepair();
                                setGold(await fetchMyGold());
                                onWeaponChanged();
                              })
                            }
                          >
                            Réparer · {price} 💰
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#7a4a22]">Aperçu sur {character.name}</div>
              <div className="mt-1 w-full max-w-[14rem] rounded-md border border-[#7a4a22]/60 bg-white/40 p-2">
                <WornSprite
                  src={character.imageUrl}
                  alt={character.name}
                  weapon={preview ? worn({ imageUrl: preview.url, grip: preview.anchor, width: WEAPON_W, height: WEAPON_H }) : null}
                />
              </div>
              <div className="mt-3 text-xs">Ton prototype est équipé tout de suite (toujours commun) ; tes armes sont dans ton 🎒 Inventaire. La rareté du modèle est tirée au hasard à la validation : les exemplaires puissants se gagnent en butin.</div>
            </div>
          </div>
        )}
        {result && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
            <div className="w-[min(24rem,96%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-center shadow-xl">
              <div className="text-xs font-bold uppercase tracking-widest text-[#7a4a22]">Ton arme est forgée !</div>
              <img src={result.image_url} alt="" className="mx-auto my-2 h-24 object-contain" />
              <RarityName name={result.name} rarity={result.rarity} />
              <div className="mt-2 text-base font-extrabold" style={{ color: "#3a2410" }}>
                {RARITY_INFO[result.rarity].label} · {weaponKindLabel(result.weapon_type)} · {bonusText(result.bonus_damage)}
              </div>
              {result.effect_key && EFFECT_INFO[result.effect_key] && (
                <div className="text-sm"><b>{EFFECT_INFO[result.effect_key]!.name}</b> : {EFFECT_INFO[result.effect_key]!.text}</div>
              )}
              <div className="mt-3 rounded border border-[#7a4a22]/50 bg-white/40 p-2 text-xs">
                Ce n'est qu'un <b>prototype</b> : il est <b>commun</b> (+1 dégât, pas d'effet, durabilité de 4 combats). Les exemplaires de cette puissance se trouvent en butin.
              </div>
              <button type="button" onClick={() => { setResult(null); onClose(); }} className={`${BTN} mt-3`}>OK</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
