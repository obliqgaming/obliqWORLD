// Feu de camp (SQL 049) : chacun utilise ses objets librement (boire ne coûte pas de tour) ; le groupe repart par le vote habituel.
// Une seule ration par personne, un seul festin pour le groupe.
import { useEffect, useRef, useState } from "react";
import { uiSound } from "../lib/ui-sounds";
import { CONSUMABLE_INFO, campUse, fetchCampUses, fetchMyConsumables, subscribeToCampUses, type CampUse, type ConsumableKind, type ConsumableStack } from "../lib/consumables";

export type CampMember = { characterId: string; name: string; pv: number; pvMax: number; pm: number; pmMax: number; gone: boolean };

const BTN = "rounded border-2 border-[#7a4a22] bg-[#7a4a22] px-2 py-0.5 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";
const CAMP_KINDS: ConsumableKind[] = ["potion_soin", "potion_mana", "ration", "festin", "larme_vie"];

export function CampPanel({ expeditionId, characterId, members }: { expeditionId: string; characterId: string; members: CampMember[] }) {
  const [stacks, setStacks] = useState<ConsumableStack[]>([]);
  const [uses, setUses] = useState<CampUse[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const lock = useRef(false);
  const [healTarget, setHealTarget] = useState<string>(characterId);
  const [reviveTarget, setReviveTarget] = useState<string>("");

  const reload = async () => {
    setStacks(await fetchMyConsumables());
    setUses(await fetchCampUses(expeditionId));
  };
  useEffect(() => {
    void reload();
    const ch = subscribeToCampUses(expeditionId, () => void reload());
    return () => {
      void ch.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expeditionId]);

  const me = members.find((m) => m.characterId === characterId);
  const iAmDown = !me || me.pv <= 0;
  const alive = members.filter((m) => m.pv > 0 && !m.gone);
  const fallen = members.filter((m) => m.pv <= 0 && !m.gone && m.characterId !== characterId);
  const ateRation = uses.some((u) => u.kind === "ration" && u.character_id === characterId);
  const feastDone = uses.some((u) => u.kind === "festin");
  const count = (k: ConsumableKind) => stacks.find((s) => s.kind === k)?.count ?? 0;

  async function use(kind: ConsumableKind, target: string | null, okText: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await campUse(expeditionId, characterId, kind, target);
      uiSound("ok");
      setMsg(okText);
      await reload();
    } catch (e: any) {
      uiSound("error");
      setMsg(e?.message ?? "Erreur");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const mine = CAMP_KINDS.filter((k) => count(k) > 0);

  return (
    <div className="absolute right-2 top-14 z-30 w-[min(19rem,46%)] rounded-lg border-2 border-[#7a4a22] bg-[#f1dfb6]/95 p-3 text-[#3a2410] shadow-xl" style={{ fontFamily: "'Baloo 2', cursive" }} onClick={(e) => e.stopPropagation()}>
      <div className="text-base font-extrabold">🔥 Feu de camp</div>
      <div className="text-xs leading-snug">Un moment de répit. Boire une potion ne coûte aucun tour. <b>Une ration par personne</b>, <b>un festin pour tout le groupe</b>. Quand tout le monde est prêt, votez pour reprendre la route.</div>
      <div className="mt-2 space-y-0.5 text-xs">
        {members.filter((m) => !m.gone).map((m) => (
          <div key={m.characterId} className={m.pv <= 0 ? "opacity-60" : ""}>
            <b>{m.name}</b> · {m.pv <= 0 ? "à terre" : `${m.pv}/${m.pvMax} PV`}{m.pv > 0 && m.pmMax > 0 ? ` · ${m.pm}/${m.pmMax} PM` : ""}
          </div>
        ))}
      </div>
      {iAmDown && <div className="mt-2 text-xs font-bold text-[#7a3a0e]">Tu es à terre : un allié peut te ressusciter avec une larme de vie.</div>}
      {!iAmDown && mine.length === 0 && <div className="mt-2 text-xs">Tu n'as rien à utiliser au camp.</div>}
      {!iAmDown && (
        <div className="mt-2 space-y-1.5">
          {mine.map((k) => {
            const info = CONSUMABLE_INFO[k];
            const disabled =
              busy ||
              (k === "ration" && ateRation) ||
              (k === "festin" && feastDone) ||
              (k === "larme_vie" && fallen.length === 0);
            const note = k === "ration" && ateRation ? "déjà mangée" : k === "festin" && feastDone ? "déjà fait" : k === "larme_vie" && fallen.length === 0 ? "personne à ressusciter" : "";
            return (
              <div key={k} className="rounded border border-[#7a4a22]/50 bg-white/40 p-1.5 text-xs">
                <div><b>{info.icon} {info.name}</b> ×{count(k)} {note && <i className="opacity-70">({note})</i>}</div>
                <div className="opacity-80">{info.text}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {k === "potion_soin" && alive.length > 1 && (
                    <select value={healTarget} onChange={(e) => setHealTarget(e.target.value)} className="rounded border border-[#7a4a22] bg-white/70 px-1 py-0.5">
                      {alive.map((m) => <option key={m.characterId} value={m.characterId}>{m.characterId === characterId ? "Moi" : m.name}</option>)}
                    </select>
                  )}
                  {k === "larme_vie" && fallen.length > 0 && (
                    <select value={reviveTarget || fallen[0]!.characterId} onChange={(e) => setReviveTarget(e.target.value)} className="rounded border border-[#7a4a22] bg-white/70 px-1 py-0.5">
                      {fallen.map((m) => <option key={m.characterId} value={m.characterId}>{m.name}</option>)}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={disabled}
                    className={BTN}
                    onClick={() =>
                      void use(
                        k,
                        k === "potion_soin" ? (alive.some((m) => m.characterId === healTarget) ? healTarget : characterId) : k === "larme_vie" ? reviveTarget || fallen[0]!.characterId : null,
                        `✔ ${info.name} utilisé.`,
                      )
                    }
                  >
                    Utiliser
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
    </div>
  );
}
