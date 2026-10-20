// Forge v1 : dessiner une arme (canvas 170 × 150), voir en direct comment elle
// se tient dans la main de son personnage, la forger, l'équiper ou la ranger.
import { useCallback, useEffect, useState } from "react";
import { DrawingCanvas } from "./DrawingCanvas";
import { WornSprite } from "./WornSprite";
import type { Point } from "../lib/scenes-supabase";
import {
  WEAPON_H, WEAPON_TYPES, WEAPON_W, DEFAULT_HAND,
  createWeapon, deleteMyWeapon, equipWeapon, fetchHandAnchor, fetchMyWeapons,
  type Weapon, type WeaponType, type WornWeapon,
} from "../lib/weapons";
import { scenesClient } from "../lib/scenes-supabase";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-4 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export type ForgeCharacter = { id: string; name: string; imageUrl: string; visualAssetId: string };

export function ForgePanel({ character, onClose, onWeaponChanged }: { character: ForgeCharacter | null; onClose: () => void; onWeaponChanged: () => void }) {
  const [hand, setHand] = useState<Point>(DEFAULT_HAND);
  const [name, setName] = useState("");
  const [type, setType] = useState<WeaponType>("blunt_slash");
  const [preview, setPreview] = useState<{ url: string; anchor: Point } | null>(null);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [equippedId, setEquippedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setWeapons(await fetchMyWeapons());
      if (character) {
        const { data } = await scenesClient.from("character_build").select("equipped_weapon_id").eq("character_id", character.id).maybeSingle();
        setEquippedId(((data as any)?.equipped_weapon_id as string | null) ?? null);
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur de chargement");
    }
  }, [character]);

  useEffect(() => {
    void reload();
    if (character) void fetchHandAnchor(character.visualAssetId).then((h) => h && setHand(h));
  }, [reload, character]);

  const worn = (w: { imageUrl: string; grip: Point; width: number; height: number }): WornWeapon => ({ ...w, hand });

  async function act(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
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
      const w = await createWeapon(blob, name.trim(), type, anchor);
      await equipWeapon(character.id, w.id);
      setName("");
    }, "Arme forgée et équipée !");
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
              <div className="mt-3 text-xs font-bold uppercase tracking-widest text-[#7a4a22]">Mes armes</div>
              {weapons.length === 0 && <div className="mt-1 text-xs">Aucune arme pour l'instant.</div>}
              <div className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto">
                {weapons.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 rounded border border-[#7a4a22]/50 bg-white/40 p-1">
                    <img src={w.image_url} alt="" className="h-9 w-10 object-contain" />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="truncate font-bold">{w.name}{w.hidden ? " (masquée)" : ""}</div>
                      <div className="opacity-70">{w.weapon_type === "magic" ? "magique" : "contondant/tranchant"}</div>
                    </div>
                    <button type="button" disabled={busy || w.hidden} className="rounded border border-[#7a4a22] px-1.5 text-[11px] font-bold hover:bg-[#7a4a22]/15 disabled:opacity-40"
                      onClick={() => void act(() => equipWeapon(character.id, equippedId === w.id ? null : w.id))}>
                      {equippedId === w.id ? "Ranger" : "Équiper"}
                    </button>
                    <button type="button" disabled={busy} title="Supprimer" className="rounded border border-[#b91c1c] px-1.5 text-[11px] font-bold text-[#b91c1c] hover:bg-[#b91c1c]/10"
                      onClick={() => { if (window.confirm(`Supprimer « ${w.name} » ?`)) void act(() => deleteMyWeapon(w.id)); }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
