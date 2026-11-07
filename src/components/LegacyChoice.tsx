// Écran « Que gardes-tu ? » : après une mort, avant de dessiner un nouveau personnage.
import { useState } from "react";
import { ZoomImage } from "./ZoomImage";
import { WeaponSheet, CompanionSheet } from "./ItemSheets";
import { itemDisplayName, itemStats, weaponKindLabel } from "../lib/weapons";
import { chooseLegacy, type LegacyHeld } from "../lib/legacy";
import type { Rarity } from "../lib/weapons";

const CARD = "relative flex cursor-pointer flex-col items-center rounded-lg border-2 p-2 text-center text-xs transition";

export function LegacyChoice({ held, onDone }: { held: LegacyHeld; onDone: () => void }) {
  const [w, setW] = useState<string | null>(held.weapons.length === 1 ? held.weapons[0]!.id : null);
  const [c, setC] = useState<string | null>(held.companions.length === 1 ? held.companions[0]!.id : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = (held.weapons.length === 0 || w) && (held.companions.length === 0 || c);

  const confirm = async () => {
    if (!ready || busy) return;
    if (!window.confirm("Valider ce choix ? Tout le reste de tes anciennes affaires sera perdu pour de bon.")) return;
    setBusy(true);
    setErr(null);
    try {
      await chooseLegacy(w, c);
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? "Impossible de valider pour l'instant. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-y-auto bg-[#1b0f06] p-3" style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-[96vh] w-[min(40rem,100%)] overflow-y-auto overflow-x-hidden rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-2xl parchment-scroll">
        <div className="text-xl font-extrabold">🕯️ Que gardes-tu de ton ancien personnage ?</div>
        <p className="mt-1 text-sm leading-snug">
          Pour repartir du bon pied, tu peux emporter <b>une arme</b> et <b>un compagnon</b> parmi tes anciennes affaires.
          Tout le reste est perdu. Tu auras aussi un compagnon de départ gratuit et les flouz d'un nouveau joueur.
          Rien ne presse : si tu pars, ce choix t'attendra à ton retour.
        </p>

        {held.weapons.length > 0 && (
          <>
            <div className="mt-3 text-sm font-extrabold">⚔️ Une arme à emporter</div>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {held.weapons.map((it) => {
                const st = itemStats(it);
                const sel = w === it.id;
                return (
                  <div key={it.id} onClick={() => setW(it.id)} className={`${CARD} ${sel ? "border-[#b4532a] bg-[#fff3d6] shadow-md" : "border-[#7a4a22]/50 bg-white/40 hover:bg-white/60"}`}>
                    {sel && <span className="absolute right-1 top-1 text-sm">✅</span>}
                    <ZoomImage
                      src={it.weapon.image_url}
                      details={<WeaponSheet name={itemDisplayName(it)} rarity={st.rarity as Rarity} weaponType={it.weapon.weapon_type} bonus={st.bonus} effect={st.effect} authorId={it.weapon.author_user_id} extra={<div className="text-xs">Durabilité <b>{it.durability}/{it.durability_max}</b></div>} />}
                      className="h-20 w-16 object-contain"
                    />
                    <div className="mt-1 font-bold leading-tight">{itemDisplayName(it)}</div>
                    <div className="opacity-70">{weaponKindLabel(it.weapon.weapon_type)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {held.companions.length > 0 && (
          <>
            <div className="mt-3 text-sm font-extrabold">🐾 Un compagnon à emporter</div>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {held.companions.map((co) => {
                const sel = c === co.id;
                return (
                  <div key={co.id} onClick={() => setC(co.id)} className={`${CARD} ${sel ? "border-[#b4532a] bg-[#fff3d6] shadow-md" : "border-[#7a4a22]/50 bg-white/40 hover:bg-white/60"}`}>
                    {sel && <span className="absolute right-1 top-1 text-sm">✅</span>}
                    <ZoomImage
                      src={co.image_url}
                      scale={0.75}
                      details={<CompanionSheet name={co.name} rarity={(co.rarity as Rarity | null | undefined) ?? null} tier={co.tier} prototype={co.is_prototype} hp={co.hp} hpMax={co.hp_max} />}
                      className="h-20 w-20 object-contain"
                    />
                    <div className="mt-1 font-bold leading-tight">{co.name}</div>
                    <div className="opacity-70">❤ {co.hp}/{co.hp_max}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {err && <div className="mt-3 rounded bg-[#fde2e2] px-2 py-1 text-xs font-bold text-[#7a1d1d]">{err}</div>}
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => void confirm()}
          className="mt-4 w-full rounded-lg border-2 border-[#7a2e14] bg-[#b4532a] px-4 py-2 text-base font-extrabold text-[#fff3d6] shadow-md transition hover:bg-[#9c4420] disabled:opacity-50"
        >
          {busy ? "…" : ready ? "Valider mon choix" : "Choisis d'abord ce que tu emportes"}
        </button>
      </div>
    </div>
  );
}
