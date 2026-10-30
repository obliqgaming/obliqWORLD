// Écran des talents : mon arbre + l'autre arbre de ma famille. SQL 055.
import { useCallback, useEffect, useMemo, useState } from "react";
import { uiSound } from "../lib/ui-sounds";
import { fetchGamePowers, fetchGameSettings, type GamePower } from "../lib/expedition-combat";
import {
  AXIS_LABEL, RENAME_SUGGESTIONS, TREE_ORDER, fetchMyTalentKeys, fetchTalentBuild, fetchTalents, ownedWithFree, pointsTotal, resetTalents,
  setClassName, takeTalent, talentStatus, type GameTalent, type TalentBuild,
} from "../lib/talents";

const FONT = { fontFamily: "'Baloo 2', cursive" };
const BTN = "rounded border-2 border-[#7a4a22] bg-[#7a4a22] px-2.5 py-0.5 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function ClassNameModal({ characterId, axisKey, onDone }: { characterId: string; axisKey: string; onDone: () => void }) {
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (v: string) => {
    setBusy(true);
    setErr(null);
    try {
      await setClassName(characterId, v);
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? "Impossible d'enregistrer.");
      setBusy(false);
    }
  };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3" style={FONT}>
      <div className="w-[min(26rem,94%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-center text-[#3a2410] shadow-xl">
        <div className="text-xl font-extrabold">Veux-tu renommer ta classe ?</div>
        <div className="mt-1 text-xs">Pour le plaisir : tu restes {AXIS_LABEL[axisKey] ?? axisKey}, mais tu peux te faire appeler autrement.</div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {(RENAME_SUGGESTIONS[axisKey] ?? []).map((n) => (
            <button key={n} type="button" disabled={busy} className={BTN} onClick={() => void save(n)}>{n}</button>
          ))}
        </div>
        <input
          value={txt}
          maxLength={20}
          onChange={(e) => setTxt(e.target.value)}
          placeholder="Ou ton propre nom (20 caractères)"
          className="mt-3 w-full rounded border-2 border-[#7a4a22] bg-[#fff8e6] p-1.5 text-center text-sm"
        />
        {err && <div className="mt-1 text-xs font-bold text-[#b91c1c]">{err}</div>}
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" disabled={busy || !txt.trim()} className={BTN} onClick={() => void save(txt)}>Valider mon nom</button>
          <button type="button" disabled={busy} className="rounded border-2 border-[#7a4a22] px-2.5 py-0.5 text-xs font-bold text-[#5e3818] hover:bg-[#7a4a22]/15" onClick={onDone}>Garder « {AXIS_LABEL[axisKey] ?? axisKey} »</button>
        </div>
      </div>
    </div>
  );
}

export function TalentPanel({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const [build, setBuild] = useState<TalentBuild | null>(null);
  const [talents, setTalents] = useState<GameTalent[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [powers, setPowers] = useState<GamePower[]>([]);
  const [resetCost, setResetCost] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, t, k, p, st] = await Promise.all([fetchTalentBuild(characterId), fetchTalents(), fetchMyTalentKeys(characterId), fetchGamePowers(), fetchGameSettings().catch(() => ({} as Record<string, number>))]);
      setBuild(b);
      setTalents(t);
      setKeys(k);
      setPowers(p);
      setResetCost(Number(st["talent_reset_cost"] ?? 20));
    } catch (e: any) {
      setErr(e?.message ?? "Impossible de charger les talents (SQL 055 lancé ?).");
    }
  }, [characterId]);
  useEffect(() => {
    void load();
  }, [load]);

  const owned = useMemo(() => (build ? ownedWithFree(build, keys, talents) : new Set<string>()), [build, keys, talents]);
  const pointsLeft = build ? pointsTotal(build.level) - keys.length : 0;

  const take = async (k: string) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await takeTalent(characterId, k);
      uiSound("success");
      await load();
    } catch (e: any) {
      uiSound("fail");
      setErr(e?.message ?? "Impossible de prendre ce talent.");
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await resetTalents(characterId);
      setConfirmReset(false);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Impossible de réinitialiser.");
    } finally {
      setBusy(false);
    }
  };

  const powerInfo = (t: GameTalent) => {
    const p = t.power_key ? powers.find((x) => x.power_key === t.power_key) : null;
    if (!p) return null;
    return `${p.cost_pm ? `${p.cost_pm} PM` : "0 PM"}${p.recharge ? ` · recharge ${p.recharge}` : ""}`;
  };

  const tree = (axis: string, mine: boolean) => {
    if (!build) return null;
    const list = talents.filter((t) => t.axis_key === axis);
    const ranks = [1, 2, 3, 4, 5, 6];
    return (
      <div key={axis} className="min-w-0 flex-1 rounded-lg border border-[#7a4a22]/60 bg-white/35 p-2">
        <div className="mb-1 text-center text-sm font-extrabold">
          {AXIS_LABEL[axis] ?? axis} {mine ? <span className="text-[10px] font-bold text-[#047857]">(ta classe)</span> : <span className="text-[10px] font-bold text-[#92400e]">(autre arbre · niv. 9)</span>}
        </div>
        <div className="space-y-1.5">
          {ranks.map((r) => {
            const row = list.filter((t) => t.rank === r);
            if (row.length === 0) return null;
            return (
              <div key={r} className="flex gap-1.5">
                <div className="flex w-4 shrink-0 items-center justify-center text-[10px] font-bold opacity-60">{r}</div>
                {row.map((t) => {
                  const stt = talentStatus(t, build, owned, talents, pointsLeft);
                  const bg = stt.state === "owned" ? "#d1fae5" : stt.state === "available" ? "#fef3c7" : "rgba(255,255,255,0.35)";
                  const info = powerInfo(t);
                  return (
                    <div key={t.talent_key} className="min-w-0 flex-1 rounded border p-1.5 text-[11px] leading-tight" style={{ background: bg, borderColor: stt.state === "owned" ? "#047857" : "#b98a54", opacity: stt.state === "locked" ? 0.7 : 1 }} title={t.description}>
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-extrabold">{t.slot ? `${t.slot} · ` : ""}{t.name}</span>
                        {stt.state === "owned" && <span className="text-[#047857]">✔</span>}
                      </div>
                      <div className="opacity-80">{t.description}</div>
                      {info && <div className="mt-0.5 text-[10px] font-bold text-[#1d4ed8]">{info}</div>}
                      {stt.state === "available" && (
                        <button type="button" disabled={busy} className={`${BTN} mt-1`} onClick={() => void take(t.talent_key)}>Prendre</button>
                      )}
                      {stt.state === "locked" && stt.reason && <div className="mt-0.5 text-[10px] italic opacity-70">{stt.reason}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const family = build?.family ?? "melee";
  const own = build?.axis_key ?? null;
  const order = own && TREE_ORDER[family] ? [own, ...TREE_ORDER[family]!.filter((a) => a !== own)] : (TREE_ORDER[family] ?? []);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3" style={FONT} onClick={onClose}>
      <div className="max-h-full w-[min(48rem,98%)] overflow-y-auto parchment-scroll rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl" onClick={(e) => e.stopPropagation()}>
        {!build ? (
          <div className="text-center text-sm">{err ?? "Chargement…"}</div>
        ) : !own || build.axis_choice_pending ? (
          <div className="text-center text-sm">Choisis d'abord ta classe (niveau 3) pour accéder aux talents.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-xl font-extrabold">
                🌟 Talents — {build.class_name ?? AXIS_LABEL[own] ?? own}
                <button type="button" className="ml-2 text-xs font-bold underline" onClick={() => setRenaming(true)}>renommer</button>
              </div>
              <div className="text-sm font-bold">Niveau {build.level} · <span className={pointsLeft > 0 ? "text-[#047857]" : ""}>{pointsLeft} point{pointsLeft > 1 ? "s" : ""} de talent</span></div>
            </div>
            <div className="mt-1 text-[11px]">Un point de talent aux niveaux 5, 8, 12, 16 et 20. Les talents se choisissent au village. Dans l'autre arbre de ta famille (dès le niveau 9), tu repars du premier talent.</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">{order.map((a) => tree(a, a === own))}</div>
            {err && <div className="mt-2 text-xs font-bold text-[#b91c1c]">{err}</div>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px]">
                {confirmReset ? (
                  <span>
                    Réinitialiser coûte <b>{resetCost} or</b>.{" "}
                    <button type="button" disabled={busy} className={BTN} onClick={() => void reset()}>Confirmer</button>{" "}
                    <button type="button" className="text-xs underline" onClick={() => setConfirmReset(false)}>Annuler</button>
                  </span>
                ) : (
                  keys.length > 0 && <button type="button" className="text-xs font-bold underline" onClick={() => setConfirmReset(true)}>Réinitialiser mes talents ({resetCost} or)</button>
                )}
              </div>
              <button type="button" className={BTN} onClick={onClose}>Fermer</button>
            </div>
          </>
        )}
      </div>
      {renaming && build && own && (
        <div onClick={(e) => e.stopPropagation()}>
          <ClassNameModal characterId={characterId} axisKey={own} onDone={() => { setRenaming(false); void load(); }} />
        </div>
      )}
    </div>
  );
}
