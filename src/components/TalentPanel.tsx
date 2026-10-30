// Écran des talents : mon arbre + l'autre arbre de ma famille. SQL 055.
import { useCallback, useEffect, useMemo, useState } from "react";
import { uiSound } from "../lib/ui-sounds";
import { fetchGamePowers, fetchGameSettings, type GamePower } from "../lib/expedition-combat";
import {
  AXIS_LABEL, RENAME_SUGGESTIONS, TALENT_LEVELS, CROSS_MIN_LEVEL, TREE_ORDER, fetchMyTalentKeys, fetchTalentBuild, fetchTalents, ownedWithFree, pointsTotal, resetTalents,
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

const OWN_LEVELS = [3, 5, 8, 12, 16, 20]; // niveau d'obtention du rang 1…6 dans sa propre classe

export function TalentPanel({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const [build, setBuild] = useState<TalentBuild | null>(null);
  const [talents, setTalents] = useState<GameTalent[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [powers, setPowers] = useState<GamePower[]>([]);
  const [resetCost, setResetCost] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [tab, setTab] = useState(0);

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
  const nextPointLevel = build ? TALENT_LEVELS.find((l) => l > build.level) ?? null : null;

  const take = async (k: string) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await takeTalent(characterId, k);
      uiSound("success");
      setConfirmKey(null);
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

  const card = (t: GameTalent, mine: boolean, label: string | null) => {
    if (!build) return null;
    const stt = talentStatus(t, build, owned, talents, pointsLeft);
    const p = t.power_key ? powers.find((x) => x.power_key === t.power_key) : null;
    const st = stt.state;
    const style =
      st === "owned" ? { background: "#d1fae5", border: "2px solid #047857" }
      : st === "available" ? { background: "#fff1b8", border: "2px solid #c98a00", boxShadow: "0 0 0 2px rgba(201,138,0,0.25)" }
      : st === "next" ? { background: "#fdf3d8", border: "2px dashed #c98a00" }
      : { background: "rgba(255,255,255,0.28)", border: "1px solid #b98a54", opacity: 0.72 };
    return (
      <div key={t.talent_key} className="min-w-0 flex-1 rounded-lg p-2 text-[11px] leading-tight" style={style}>
        <div className="flex items-center justify-between gap-1">
          <span className="rounded bg-[#7a4a22] px-1.5 py-px text-[10px] font-extrabold text-[#fff3d6]">{label}</span>
          <span className="text-[10px] font-bold">
            {st === "owned" ? <span className="text-[#047857]">✔ Acquis</span> : st === "next" ? <span className="text-[#92400e]">Prochain</span> : st === "locked" ? "🔒" : null}
          </span>
        </div>
        <div className="mt-1 text-[13px] font-extrabold">{t.name}</div>
        <div className="mt-0.5 opacity-85">{t.description}</div>
        {p && (
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-bold">
            <span className="rounded bg-[#dbeafe] px-1.5 py-px text-[#1d4ed8]">{p.cost_pm ? `${p.cost_pm} PM` : "0 PM"}</span>
            {p.recharge ? <span className="rounded bg-[#e5e7eb] px-1.5 py-px text-[#374151]">Recharge {p.recharge} t.</span> : null}
          </div>
        )}
        {st === "available" && confirmKey !== t.talent_key && (
          <button type="button" disabled={busy} className={`${BTN} mt-1.5 w-full`} onClick={() => (t.slot ? setConfirmKey(t.talent_key) : void take(t.talent_key))}>Apprendre</button>
        )}
        {st === "available" && confirmKey === t.talent_key && (
          <div className="mt-1.5 rounded bg-white/60 p-1 text-center">
            <div className="text-[10px] font-bold">Ce choix exclut l'autre voie.</div>
            <div className="mt-1 flex justify-center gap-1">
              <button type="button" disabled={busy} className={BTN} onClick={() => void take(t.talent_key)}>Confirmer</button>
              <button type="button" className="text-[10px] underline" onClick={() => setConfirmKey(null)}>Annuler</button>
            </div>
          </div>
        )}
        {st === "locked" && stt.reason && (stt.reason === "Bientôt" || stt.reason.startsWith("Tu as choisi")) && (
          <div className="mt-1 text-[10px] italic opacity-80">{stt.reason === "Bientôt" ? "Bientôt" : "Autre voie choisie"}</div>
        )}
        {!mine && null}
      </div>
    );
  };

  const tree = (axis: string, mine: boolean, idx: number) => {
    if (!build) return null;
    const list = talents.filter((t) => t.axis_key === axis);
    const ranks = [1, 2, 3, 4, 5, 6];
    return (
      <div key={axis} className={`${tab === idx ? "block" : "hidden"} min-w-0 flex-1 rounded-lg border border-[#7a4a22]/60 bg-white/30 p-2 sm:block`} style={mine ? undefined : { background: "rgba(255,255,255,0.18)" }}>
        <div className="mb-2 text-center">
          <div className="text-base font-extrabold">{AXIS_LABEL[axis] ?? axis}</div>
          {mine ? (
            <div className="text-[10px] font-bold text-[#047857]">Ta classe</div>
          ) : (
            <div className="text-[10px] font-bold text-[#92400e]">Autre branche · dès le niveau {CROSS_MIN_LEVEL} · 3 premiers talents</div>
          )}
        </div>
        <div className="space-y-2">
          {ranks.map((r) => {
            const row = list.filter((t) => t.rank === r);
            if (row.length === 0) return null;
            const lvl = mine ? OWN_LEVELS[r - 1] : null;
            const head = mine ? `Niv. ${lvl}` : `Étape ${r}`;
            if (row.length === 1) return <div key={r} className="flex">{card(row[0]!, mine, head)}</div>;
            return (
              <div key={r} className="rounded-lg border border-dashed border-[#7a4a22]/70 p-1.5">
                <div className="mb-1 text-center text-[10px] font-extrabold text-[#5e3818]">{head} · Choisis une voie</div>
                <div className="flex gap-1.5">{row.map((t, i) => card(t, mine, `Voie ${i === 0 ? "A" : "B"}`))}</div>
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
      <div className="flex max-h-full w-[min(48rem,98%)] flex-col rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] text-[#3a2410] shadow-xl" onClick={(e) => e.stopPropagation()}>
        {!build ? (
          <div className="p-4 text-center text-sm">{err ?? "Chargement…"}</div>
        ) : !own || build.axis_choice_pending ? (
          <div className="p-4 text-center text-sm">Choisis d'abord ta classe (niveau 3) pour accéder aux talents.</div>
        ) : (
          <>
            <div className="shrink-0 p-3 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xl font-extrabold">{build.class_name ?? AXIS_LABEL[own] ?? own}</div>
                <button type="button" className="rounded border-2 border-[#7a4a22] px-2 py-0.5 text-xs font-bold text-[#5e3818] hover:bg-[#7a4a22]/15" onClick={() => setRenaming(true)}>✎ Renommer</button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/40 p-1.5">
                  <div className="text-[10px] font-bold uppercase opacity-70">Niveau</div>
                  <div className="text-2xl font-extrabold leading-none">{build.level}</div>
                </div>
                <div className="rounded-lg p-1.5" style={pointsLeft > 0 ? { background: "#fde68a", border: "2px solid #c98a00" } : { background: "rgba(255,255,255,0.4)" }}>
                  <div className="text-[10px] font-bold uppercase opacity-70">Points à dépenser</div>
                  <div className="text-3xl font-extrabold leading-none" style={{ color: pointsLeft > 0 ? "#92400e" : undefined }}>{pointsLeft}</div>
                </div>
                <div className="rounded-lg bg-white/40 p-1.5">
                  <div className="text-[10px] font-bold uppercase opacity-70">Prochain point</div>
                  <div className="text-2xl font-extrabold leading-none">{nextPointLevel ? `Niv. ${nextPointLevel}` : "—"}</div>
                </div>
              </div>
              <div className="mt-2 flex gap-1 sm:hidden">
                {order.map((a, i) => (
                  <button key={a} type="button" onClick={() => setTab(i)} className="flex-1 rounded border-2 border-[#7a4a22] py-0.5 text-xs font-bold" style={{ background: tab === i ? "#7a4a22" : "transparent", color: tab === i ? "#fff3d6" : "#5e3818" }}>
                    {i === 0 ? "Mon arbre" : "Autre arbre"}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto parchment-scroll px-3 pb-2">
              <div className="flex flex-col gap-2 sm:flex-row">{order.map((a, i) => tree(a, a === own, i))}</div>
              {err && <div className="mt-2 text-xs font-bold text-[#b91c1c]">{err}</div>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#7a4a22]/40 p-2.5">
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
