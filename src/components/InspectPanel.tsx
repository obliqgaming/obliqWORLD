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
  const spec = d ? (d.axis ?? (d.family === "magie" ? "Magie" : d.family === "melee" ? "Mêlée" : "—")) : "";
  const stat = (icon: string, n: number, one: string, many: string) => (
    <div className="flex items-center gap-2 rounded-lg bg-white/45 px-2 py-1">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-lg font-extrabold leading-none">{n}</span>
      <span className="text-[11px] leading-tight opacity-80">{n > 1 ? many : one}</span>
    </div>
  );
  const title = "text-[11px] font-extrabold uppercase tracking-wide text-[#7a4a22]";
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-2" onClick={onClose} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="flex max-h-full w-[min(34rem,96%)] flex-col rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] text-[#3a2410] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#7a4a22]/40 px-4 py-2">
          <div className="truncate text-xl font-extrabold">{d?.name ?? "Fiche de personnage"}</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto parchment-scroll px-4 pb-4 pt-3">
          {err && <div className="text-sm font-bold text-[#92400e]">{err}</div>}
          {!d && !err && <div className="text-sm">Chargement…</div>}
          {d && (
            <>
              <div className="flex gap-4">
                <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-lg border border-[#7a4a22]/60 bg-white/40">
                  {d.image_url && <img src={d.image_url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#7a4a22] px-3 py-1 text-sm font-extrabold text-[#fff3d6]">Niv. {d.level ?? 1}</span>
                    <div className="min-w-0 leading-tight">
                      <div className="text-[10px] font-bold uppercase opacity-60">Spécialisation</div>
                      <div className="truncate text-sm font-extrabold">{spec}{d.class_name ? <span className="font-bold opacity-70"> · « {d.class_name} »</span> : null}</div>
                    </div>
                  </div>
                  <div className={title}>Créations</div>
                  <div className="grid gap-1.5">
                    {stat("✍", d.weapons_drawn, "arme dessinée", "armes dessinées")}
                    {stat("🐾", d.companions_drawn ?? 0, "compagnon dessiné", "compagnons dessinés")}
                    {stat("📜", d.events_written ?? 0, "passage écrit", "passages écrits")}
                  </div>
                </div>
              </div>
              <div className="my-3 border-t border-[#7a4a22]/30" />
              <div className={title}>Arme équipée</div>
              {w ? (
                <div className="mt-1.5 flex gap-3 rounded-lg border border-[#7a4a22]/50 bg-white/40 p-2">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-white/50">
                    <img src={w.image_url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <RarityName name={`${w.prototype ? "Prototype de " : ""}${w.name}`} rarity={w.rarity} />
                      <span className="rounded px-1.5 py-px text-[10px] font-extrabold" style={{ background: RARITY_INFO[w.rarity].color, color: "#2b1406" }}>{RARITY_INFO[w.rarity].label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
                      <span className="rounded bg-[#fde68a] px-1.5 py-px">{bonusText(w.bonus)}</span>
                      {w.effect && EFFECT_INFO[w.effect] && <span className="rounded bg-[#dbeafe] px-1.5 py-px text-[#1d4ed8]">{EFFECT_INFO[w.effect]!.name}</span>}
                    </div>
                    {w.effect && EFFECT_INFO[w.effect] && <div className="mt-0.5 text-[11px] opacity-80">{EFFECT_INFO[w.effect]!.text}</div>}
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm opacity-70">Aucune arme équipée.</div>
              )}
              <div className="my-3 border-t border-[#7a4a22]/30" />
              <div className={title}>Compagnons ({d.companions.length})</div>
              {d.companions.length === 0 ? (
                <div className="mt-1 text-sm opacity-70">Aucun compagnon.</div>
              ) : (
                <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {d.companions.map((c, i) => (
                    <div key={i} className="rounded-lg border border-[#7a4a22]/40 bg-white/40 p-1.5 text-center leading-tight" title={c.name}>
                      <div className="flex h-16 items-center justify-center">
                        <img src={c.image_url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                      </div>
                      <div className="mt-1 truncate text-[12px] font-bold">{c.name}</div>
                      <div className="text-[10px] opacity-70">{TIER_INFO[c.tier].label}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
