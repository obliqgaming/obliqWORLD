// Forge : « Mes prototypes » — on range ses prototypes ici pour ne pas encombrer le sac, et on les ressort au besoin.
import { useEffect, useState } from "react";
import { ZoomImage } from "./ZoomImage";
import { WeaponSheet } from "./ItemSheets";
import { RarityName } from "./InventoryPanel";
import { fetchMyItems, fetchStoredPrototypes, itemDisplayName, itemStats, storeAllPrototypes, storePrototype, weaponKindLabel, type WeaponItem } from "../lib/weapons";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function PrototypesPanel({ onChanged }: { onChanged: () => void }) {
  const [stored, setStored] = useState<WeaponItem[] | null>(null);
  const [bagProtos, setBagProtos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const reload = async () => {
    const [s, bag] = await Promise.all([fetchStoredPrototypes(), fetchMyItems().catch(() => [] as WeaponItem[])]);
    setStored(s);
    setBagProtos(bag.filter((i) => i.is_prototype).length);
  };
  useEffect(() => {
    void reload();
  }, []);
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
      await reload();
      onChanged();
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3">
      <div className="rounded-lg bg-white/35 p-2.5 text-sm leading-snug">
        <div className="font-extrabold">📦 Range tes prototypes ici : ils n'encombrent plus ton sac.</div>
        <div className="mt-1 text-xs opacity-80">Tu peux les ressortir quand tu veux. Un prototype équipé ne peut pas être rangé.</div>
        <button type="button" disabled={busy || bagProtos === 0} className={`${BTN} mt-2`} onClick={() => void act(async () => { const n = await storeAllPrototypes(); setMsg(n > 0 ? `✔ ${n} prototype${n > 1 ? "s" : ""} rangé${n > 1 ? "s" : ""}.` : "Aucun prototype à ranger."); })}>
          📦 Ranger mes prototypes{bagProtos > 0 ? ` (${bagProtos} dans le sac)` : ""}
        </button>
      </div>
      {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
      {stored === null && <div className="mt-3 text-sm">Chargement…</div>}
      {stored && stored.length === 0 && <div className="mt-3 text-sm opacity-80">Aucun prototype rangé pour l'instant.</div>}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {(stored ?? []).map((it) => {
          const st = itemStats(it);
          return (
            <div key={it.id} className="flex items-center gap-2 rounded border border-[#7a4a22]/60 bg-white/40 p-2 text-sm">
              <ZoomImage
                src={it.weapon.image_url}
                details={<WeaponSheet name={itemDisplayName(it)} rarity={st.rarity} prototype={it.is_prototype} weaponType={it.weapon.weapon_type} bonus={st.bonus} effect={st.effect} authorId={it.weapon.author_user_id} />}
                className="h-16 w-12 shrink-0 object-contain"
              />
              <div className="min-w-0 flex-1 text-xs">
                <RarityName name={itemDisplayName(it)} rarity={st.rarity} prototype={it.is_prototype} />
                <div className="opacity-70">{weaponKindLabel(it.weapon.weapon_type)}</div>
              </div>
              <button type="button" disabled={busy} className={BTN} onClick={() => void act(() => storePrototype(it.id, false), "✔ Remis dans ton sac.")}>Retirer</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
