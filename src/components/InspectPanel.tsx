// Fenêtre « Inspecter » : le dessin en grand d'un autre joueur, son arme, ses créations et ses compagnons.
import { useEffect, useState } from "react";
import { inspectCharacter, type Inspected } from "../lib/inspect";
import { TIER_INFO } from "../lib/companions";
import { EFFECT_INFO, RARITY_INFO, bonusText } from "../lib/weapons";
import { RarityName } from "./InventoryPanel";

export function InspectPanel({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const [d, setD] = useState<Inspected | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    inspectCharacter(characterId)
      .then((r) => alive && setD(r))
      .catch((e: any) => alive && setErr(e?.message?.includes("inspect_character") ? "Pas encore activé (SQL 046)." : (e?.message ?? "Erreur")));
    return () => {
      alive = false;
    };
  }, [characterId]);
  const w = d?.weapon ?? null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto parchment-scroll bg-black/55 p-2" onClick={onClose} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-full w-[min(34rem,96%)] overflow-y-auto parchment-scroll rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">🔍 {d?.name ?? "Inspecter"}</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        {err && <div className="mt-2 text-sm font-bold text-[#92400e]">{err}</div>}
        {!d && !err && <div className="mt-3 text-sm">Chargement…</div>}
        {d && (
          <>
            <div className="mt-3 flex gap-4">
              <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded border border-[#7a4a22]/60 bg-white/40">
                {d.image_url && <img src={d.image_url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />}
              </div>
              <div className="min-w-0 space-y-1 text-sm">
                <div>Niveau <b>{d.level ?? 1}</b></div>
                <div>{d.family === "magie" ? "Magie" : d.family === "melee" ? "Mêlée" : ""}{d.axis ? <> · <b>{d.axis}</b></> : null}</div>
                <div>✍ <b>{d.weapons_drawn}</b> arme{d.weapons_drawn > 1 ? "s" : ""} dessinée{d.weapons_drawn > 1 ? "s" : ""}</div>
              </div>
            </div>
            <div className="mt-3 font-extrabold">Arme équipée</div>
            {w ? (
              <div className="mt-1 flex gap-2 rounded border border-[#7a4a22]/60 bg-white/40 p-2 text-xs">
                <img src={w.image_url} alt="" className="h-14 w-14 shrink-0 object-contain" draggable={false} />
                <div>
                  <div className="text-sm font-extrabold"><RarityName name={`${w.prototype ? "Prototype de " : ""}${w.name}`} rarity={w.rarity} /></div>
                  <div>{RARITY_INFO[w.rarity].label} · {bonusText(w.bonus)}</div>
                  {w.effect && EFFECT_INFO[w.effect] && <div><b>{EFFECT_INFO[w.effect]!.name}</b> : {EFFECT_INFO[w.effect]!.text}</div>}
                </div>
              </div>
            ) : (
              <div className="mt-1 text-sm opacity-70">Aucune arme équipée.</div>
            )}
            <div className="mt-3 font-extrabold">Compagnons ({d.companions.length})</div>
            {d.companions.length === 0 ? (
              <div className="mt-1 text-sm opacity-70">Aucun compagnon.</div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {d.companions.map((c, i) => (
                  <div key={i} className="w-20 text-center text-[11px] leading-tight" title={c.name}>
                    <img src={c.image_url} alt="" className="mx-auto h-14 w-14 object-contain" draggable={false} />
                    <div className="truncate font-bold">{c.name}</div>
                    <div className="rounded px-1" style={{ background: TIER_INFO[c.tier].color, color: "#2b1406" }}>{TIER_INFO[c.tier].label}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
