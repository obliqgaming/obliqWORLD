// Forge v1 : dessiner une arme (canvas 170 × 150), voir en direct comment elle
// se tient dans la main de son personnage, la forger, l'équiper ou la ranger.
import { useEffect, useState } from "react";
import { DrawingCanvas } from "./DrawingCanvas";
import { WornSprite } from "./WornSprite";
import type { Point } from "../lib/scenes-supabase";
import {
  EFFECT_INFO, RARITY_INFO, bonusText, WEAPON_H, WEAPON_TYPES, WEAPON_W, DEFAULT_HAND,
  createWeapon, equipItem, fetchHandAnchor,
  type Weapon, type WeaponType, type WornWeapon,
} from "../lib/weapons";
import { RarityName } from "./InventoryPanel";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-4 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export type ForgeCharacter = { id: string; name: string; imageUrl: string; visualAssetId: string };

export function ForgePanel({ character, onClose, onWeaponChanged }: { character: ForgeCharacter | null; onClose: () => void; onWeaponChanged: () => void }) {
  const [hand, setHand] = useState<Point>(DEFAULT_HAND);
  const [name, setName] = useState("");
  const [type, setType] = useState<WeaponType>("blunt_slash");
  const [preview, setPreview] = useState<{ url: string; anchor: Point } | null>(null);
  const [result, setResult] = useState<Weapon | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (character) void fetchHandAnchor(character.visualAssetId).then((h) => h && setHand(h));
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
      await equipItem(character.id, itemId);
      setResult(weapon);
      setName("");
    });
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/55 p-2" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-full w-[min(56rem,98%)] overflow-y-auto rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">⚒ Forgeron</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        {!character ? (
          <div className="mt-3 text-sm">Il te faut un personnage pour forger une arme.</div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-[1fr_14rem]">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'arme" className="min-w-0 flex-1 rounded border border-[#7a4a22] bg-white/70 px-2 py-1 text-sm" />
                <select value={type} onChange={(e) => setType(e.target.value as WeaponType)} className="rounded border border-[#7a4a22] bg-white/70 px-2 py-1 text-sm">
                  {WEAPON_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <DrawingCanvas
                width={WEAPON_W}
                height={WEAPON_H}
                anchorOptional={false}
                anchorLabel="Point poignée : glisse le repère là où la main tient l'arme"
                anchorTitle="Point poignée — glisse pour le placer"
                exportLabel="Forger et équiper"
                exporting={busy}
                initialAnchor={{ x: 20, y: 80 }}
                onPreview={(url, anchor) => anchor && setPreview({ url, anchor })}
                onExport={handleExport}
              />
              {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
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
              <div className="mt-3 text-xs">Ton prototype est équipé tout de suite ; tes armes sont dans ton 🎒 Inventaire. Sa rareté est tirée au hasard à la validation.</div>
            </div>
          </div>
        )}
        {result && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
            <div className="w-[min(24rem,96%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-center shadow-xl">
              <div className="text-xs font-bold uppercase tracking-widest text-[#7a4a22]">Ton arme est forgée !</div>
              <img src={result.image_url} alt="" className="mx-auto my-2 h-24 object-contain" />
              <RarityName name={`Prototype de ${result.name}`} rarity={result.rarity} />
              <div className="mt-2 text-sm font-bold" style={{ color: "#3a2410" }}>
                {RARITY_INFO[result.rarity].label} · {bonusText(result.bonus_damage)}
              </div>
              {result.effect_key && EFFECT_INFO[result.effect_key] && (
                <div className="text-sm"><b>{EFFECT_INFO[result.effect_key]!.name}</b> : {EFFECT_INFO[result.effect_key]!.text}</div>
              )}
              <div className="mt-1 text-xs">Prototype : durabilité très réduite (2 expéditions).</div>
              <button type="button" onClick={() => { setResult(null); onClose(); }} className={`${BTN} mt-3`}>OK</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
