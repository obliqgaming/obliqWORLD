// Vrai combat d'expédition (SQL 007). Tout l'état vient du serveur : ennemis
// communs à tout le groupe, PV/PM, journal. Le navigateur n'envoie que son
// choix (pouvoir + cible) et demande la résolution quand tout le monde est prêt
// ou que le délai est écoulé. Aucun polling : Realtime uniquement.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALLY_SLOTS,
  ENEMY_SLOTS,
  HpBar,
  PlaceholderEnemy,
  hpColor,
  type CombatAlly,
} from "./ExpeditionCombatView";
import {
  fetchCombatSnapshot,
  fetchEnemyImagePool,
  fetchGameAxes,
  fetchGamePowers,
  fetchMyBuild,
  pickEnemyImage,
  powersForBuild,
  resolveCombatTurn,
  submitCombatAction,
  subscribeToCombat,
  type CombatSnapshot,
  type GameAxis,
  type GamePower,
  type MyBuild,
} from "../lib/expedition-combat";
import { leaveScenePresence, type PresenceChannel } from "../lib/scenes-supabase";

const ROLE_LABEL: Record<string, string> = { chef: "Chef de meute", boss: "Boss", add: "Invoqué", normal: "" };

function isAllyPower(p: GamePower): boolean {
  const prm = p.params;
  return !!prm && (prm["heal"] !== undefined || prm["survive_at"] !== undefined);
}

function needsNoEnemy(p: GamePower): boolean {
  const prm = p.params;
  return !!prm && (prm["redirect_single_target"] !== undefined || prm["pm_gain"] !== undefined);
}

export function ExpeditionBattle({
  sceneImageUrl,
  combatId,
  characterId,
  allies,
  onFinished,
}: {
  sceneImageUrl: string;
  combatId: string;
  characterId: string;
  allies: CombatAlly[];
  /** Appelé quand le joueur ferme le panneau de fin de combat. */
  onFinished: () => void;
}) {
  const [snap, setSnap] = useState<CombatSnapshot | null>(null);
  const [build, setBuild] = useState<MyBuild | null>(null);
  const [powers, setPowers] = useState<GamePower[]>([]);
  const [axes, setAxes] = useState<GameAxis[]>([]);
  const [pool, setPool] = useState<{ name: string; imageUrl: string }[]>([]);
  const [selectedPower, setSelectedPower] = useState<string | null>(null); // null = attaque de base
  const [targetEnemy, setTargetEnemy] = useState<string | null>(null);
  const [targetAlly, setTargetAlly] = useState<string | null>(null);
  const [sentTurn, setSentTurn] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showLog, setShowLog] = useState(true);
  const resolvingRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      const s = await fetchCombatSnapshot(combatId);
      if (s) setSnap(s);
    } catch (e) {
      console.error("combat reload failed", e);
    }
  }, [combatId]);

  // Données fixes + abonnement.
  useEffect(() => {
    let cancelled = false;
    let channel: PresenceChannel | null = null;
    (async () => {
      try {
        const [b, p, a, imgs] = await Promise.all([
          fetchMyBuild(characterId),
          fetchGamePowers(),
          fetchGameAxes(),
          fetchEnemyImagePool(allies.map((x) => x.characterId)),
        ]);
        if (cancelled) return;
        setBuild(b);
        setPowers(p);
        setAxes(a);
        setPool(imgs);
      } catch (e) {
        console.error("combat setup failed", e);
      }
      await reload();
      if (!cancelled) channel = subscribeToCombat(combatId, () => void reload());
    })();
    return () => {
      cancelled = true;
      if (channel) leaveScenePresence(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatId, characterId]);

  // Compte à rebours local.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const combat = snap?.combat ?? null;
  const turn = combat?.turn ?? 1;
  const active = combat?.status === "active";
  const deadlineMs = combat ? new Date(combat.turn_deadline).getTime() : null;
  const secondsLeft = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : null;

  const me = allies.find((a) => a.characterId === characterId) ?? null;
  const myDead = !!me && me.hpCurrent <= 0;
  const mySnapPlayer = snap?.players.find((p) => p.character_id === characterId) ?? null;
  const myCooldowns = mySnapPlayer?.cooldowns ?? {};
  const aliveAllies = allies.filter((a) => a.hpCurrent > 0);
  const readyCount = snap ? snap.players.filter((p) => p.last_submitted_turn >= turn && aliveAllies.some((a) => a.characterId === p.character_id)).length : 0;
  const iAmReady = (mySnapPlayer?.last_submitted_turn ?? 0) >= turn || sentTurn >= turn;

  const aliveEnemies = useMemo(() => (snap?.enemies ?? []).filter((e) => e.pv_current > 0), [snap]);

  // Nouveau tour : on repart d'une sélection propre (cible = ennemi le plus faible).
  useEffect(() => {
    setSelectedPower(null);
    setTargetAlly(null);
    setError(null);
  }, [turn]);
  useEffect(() => {
    if (aliveEnemies.length === 0) return;
    if (targetEnemy && aliveEnemies.some((e) => e.id === targetEnemy)) return;
    const weakest = [...aliveEnemies].sort((a, b) => a.pv_current - b.pv_current)[0]!;
    setTargetEnemy(weakest.id);
  }, [aliveEnemies, targetEnemy]);

  // Résolution : quand tout le monde est prêt, ou à la fin du délai.
  const tryResolve = useCallback(
    async (attempt: number) => {
      if (resolvingRef.current) return;
      resolvingRef.current = true;
      try {
        await resolveCombatTurn(combatId);
        await reload();
      } catch (e) {
        console.error("resolve turn failed", e);
      } finally {
        resolvingRef.current = false;
      }
      void attempt;
    },
    [combatId, reload],
  );

  useEffect(() => {
    if (!active || !snap) return;
    if (aliveAllies.length > 0 && readyCount >= aliveAllies.length) void tryResolve(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, turn, readyCount, aliveAllies.length]);

  useEffect(() => {
    if (!active || !deadlineMs) return;
    const delay = Math.max(0, deadlineMs - Date.now()) + 400;
    const t1 = window.setTimeout(() => void tryResolve(0), delay);
    const t2 = window.setTimeout(() => void tryResolve(1), delay + 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, turn, deadlineMs]);

  const myPowers = useMemo(() => (build ? powersForBuild(build, powers) : []), [build, powers]);
  const myAxisKey = build ? (build.axis_key ?? (build.family === "melee" ? "apprenti_melee" : "apprenti_magie")) : null;
  const baseAttackName = axes.find((a) => a.axis_key === myAxisKey)?.base_attack_name ?? "Attaque";

  const send = async (powerKey: string | null) => {
    if (!active || myDead) return;
    const gp = powerKey ? powers.find((p) => p.power_key === powerKey) : null;
    const ally = gp && isAllyPower(gp) ? (targetAlly ?? characterId) : null;
    const enemy = gp && (isAllyPower(gp) || needsNoEnemy(gp)) ? null : targetEnemy;
    setSelectedPower(powerKey);
    setError(null);
    try {
      await submitCombatAction(combatId, characterId, powerKey, enemy, ally);
      setSentTurn(turn);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Erreur";
      setError(msg);
    }
  };

  const enemySlots = (snap?.enemies ?? []).slice(0, ENEMY_SLOTS.length);
  const logLines = snap?.log ?? [];
  const lastLog = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    lastLog.current?.scrollIntoView({ block: "end" });
  }, [logLines.length]);

  const finished = combat && combat.status !== "active";

  return (
    <div
      className="absolute inset-0 z-20 select-none overflow-hidden"
      style={{ fontFamily: "'Baloo 2', cursive" }}
      onClick={(e) => e.stopPropagation()}
    >
      <img src={sceneImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />

      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-xs font-bold uppercase tracking-widest text-[#fff3d6]">
        {combat?.is_boss ? "Combat de boss" : "Combat"} · tour {turn}
        {active && secondsLeft !== null ? ` · ${secondsLeft} s` : ""}
      </div>

      {active && combat?.aoe_warning && (
        <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-lg border-2 border-[#f87171] bg-[#4a0d0d]/95 px-4 py-1.5 text-sm font-bold text-[#fff3d6]">
          ⚠ Le boss prépare une attaque de zone : elle touchera tout le groupe à la fin de ce tour !
        </div>
      )}

      {/* Groupe à gauche */}
      {allies.slice(0, ALLY_SLOTS.length).map((a, i) => {
        const slot = ALLY_SLOTS[i]!;
        const dead = a.hpCurrent <= 0;
        const clickable = active && selectedPower && powers.find((p) => p.power_key === selectedPower && isAllyPower(p)) && !dead;
        const isTargeted = targetAlly === a.characterId;
        return (
          <div
            key={a.characterId}
            className="absolute"
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, height: "26%", transform: "translate(-50%, -100%)", zIndex: Math.round(slot.y), cursor: clickable ? "pointer" : undefined }}
            onClick={() => {
              if (clickable) {
                setTargetAlly(a.characterId);
                void submitCombatAction(combatId, characterId, selectedPower, null, a.characterId).then(() => setSentTurn(turn)).catch((e) => setError(String(e?.message ?? e)));
              }
            }}
          >
            <div style={{ transform: "scaleX(-1)", height: "100%" }}>
              <img
                src={a.imageUrl}
                alt={a.name}
                draggable={false}
                className="h-full w-auto object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
                style={{ filter: dead ? "grayscale(1) brightness(0.5)" : undefined, outline: isTargeted ? "2px solid #9effa0" : undefined }}
              />
            </div>
            <div
              className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-[#fff3d6]"
              style={{ textShadow: "0 1px 3px #000" }}
            >
              {a.name}
            </div>
          </div>
        );
      })}

      {/* Ennemis à droite : mêmes monstres pour tout le groupe */}
      {enemySlots.map((en, i) => {
        const slot = ENEMY_SLOTS[i]!;
        const dead = en.pv_current <= 0;
        const img = pickEnemyImage(pool, en.id);
        const selected = targetEnemy === en.id;
        const target = en.announced_target_id ? allies.find((a) => a.characterId === en.announced_target_id) : null;
        return (
          <div
            key={en.id}
            className="absolute"
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, height: en.role === "boss" ? "34%" : "26%", transform: "translate(-50%, -100%)", zIndex: Math.round(slot.y), cursor: dead || !active ? undefined : "pointer" }}
            onClick={() => {
              if (dead || !active) return;
              setTargetEnemy(en.id);
              // Si une action est déjà envoyée, on la renvoie avec la nouvelle cible.
              const gp = selectedPower ? powers.find((p) => p.power_key === selectedPower) : null;
              if (iAmReady && !(gp && (isAllyPower(gp) || needsNoEnemy(gp)))) {
                void submitCombatAction(combatId, characterId, selectedPower, en.id, null).catch((e) => setError(String(e?.message ?? e)));
              }
            }}
          >
            <div
              className="absolute -top-14 left-1/2 w-32 -translate-x-1/2 text-center text-[11px] font-bold text-[#fff3d6]"
              style={{ textShadow: "0 1px 3px #000" }}
            >
              {ROLE_LABEL[en.role] ? <div className="text-[9px] uppercase tracking-widest text-[#fbbf24]">{ROLE_LABEL[en.role]}</div> : null}
              {en.name}
              <HpBar current={en.pv_current} max={en.pv_max} className="mt-0.5" />
              <div className="text-[10px]" style={{ color: hpColor(en.pv_current, en.pv_max) }}>
                {en.pv_current}/{en.pv_max}
              </div>
              {!dead && target ? <div className="text-[10px] text-[#fca5a5]">vise {target.name}</div> : null}
            </div>
            <div className="h-full" style={{ filter: dead ? "grayscale(1) brightness(0.5)" : undefined, outline: selected && !dead ? "2px dashed #fbbf24" : undefined, outlineOffset: 2 }}>
              {img ? <img src={img} alt={en.name} draggable={false} className="h-full w-auto object-contain" /> : <PlaceholderEnemy />}
            </div>
          </div>
        );
      })}

      {/* Groupe + PV/PM : bas gauche */}
      <div className="absolute bottom-[7.5rem] left-4 z-30 flex w-60 flex-col gap-1.5 rounded-lg border border-[#7a4a22]/60 bg-[#2b1406]/90 p-2.5 text-[#fff3d6]">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Groupe</div>
        {allies.map((a) => {
          const ready = snap?.players.find((p) => p.character_id === a.characterId)?.last_submitted_turn ?? 0;
          return (
            <div key={a.characterId} className="flex items-center gap-2 text-xs">
              <img src={a.imageUrl} alt="" className="h-8 w-8 rounded-full bg-black/30 object-cover" />
              <div className="flex-1 overflow-hidden">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold">
                    {a.name}
                    {a.isSelf ? " (toi)" : ""} {active && a.hpCurrent > 0 && ready >= turn ? "✓" : ""}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold" style={{ color: hpColor(a.hpCurrent, a.hpMax) }}>
                    {a.hpCurrent}/{a.hpMax}
                  </span>
                </div>
                <HpBar current={a.hpCurrent} max={a.hpMax} />
                {a.isSelf && a.pmMax ? <div className="mt-0.5 text-[10px] font-bold text-[#93c5fd]">PM {a.pmCurrent ?? 0}/{a.pmMax}</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Journal de combat : haut gauche */}
      <div className="absolute left-4 top-4 z-30 w-72 rounded-lg border border-[#7a4a22]/60 bg-[#2b1406]/90 text-[#fff3d6]">
        <button type="button" className="flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest opacity-80" onClick={() => setShowLog((v) => !v)}>
          Journal de combat <span>{showLog ? "−" : "+"}</span>
        </button>
        {showLog && (
          <div className="max-h-48 overflow-y-auto px-2.5 pb-2 text-[11px] leading-snug">
            {logLines.length === 0 ? <div className="opacity-60">Le combat commence…</div> : null}
            {logLines.map((l, i) => (
              <div key={l.id} ref={i === logLines.length - 1 ? lastLog : undefined} className="border-t border-white/10 py-0.5 first:border-0">
                <span className="opacity-50">T{l.turn} </span>
                {l.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions : bas centre */}
      {active && (
        <div className="absolute bottom-4 left-1/2 z-30 flex max-w-[70%] -translate-x-1/2 flex-col items-center gap-1.5">
          <div className="rounded-full bg-black/60 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#fff3d6]/80">
            {myDead
              ? "Tu es à terre — tu regardes le combat"
              : iAmReady
                ? `Action envoyée — ${readyCount}/${aliveAllies.length} prêts (tu peux encore changer)`
                : `Choisis ton action, puis clique un ennemi pour le cibler — ${readyCount}/${aliveAllies.length} prêts`}
          </div>
          {error && <div className="rounded bg-[#4a0d0d]/90 px-2 py-0.5 text-[11px] font-bold text-[#fca5a5]">{error}</div>}
          {!myDead && (
            <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-[#7a4a22]/60 bg-[#2b1406]/90 p-2">
              {[{ key: null as string | null, name: baseAttackName, cost: 0, cd: 0, desc: "Attaque de base (gratuite)" }]
                .concat(
                  myPowers.map((p) => ({
                    key: p.power_key as string | null,
                    name: p.name,
                    cost: p.cost_pm,
                    cd: myCooldowns[p.power_key] ?? 0,
                    desc: p.description,
                  })),
                )
                .map((p) => {
                  const noPm = (me?.pmCurrent ?? 0) < p.cost;
                  const disabled = p.cd > 0 || noPm;
                  const activeSel = iAmReady && selectedPower === p.key;
                  return (
                    <button
                      key={p.key ?? "base"}
                      type="button"
                      disabled={disabled}
                      title={p.desc}
                      onClick={() => void send(p.key)}
                      className="min-w-28 rounded-lg border px-3 py-2 text-sm font-bold text-[#fff3d6] transition-colors hover:bg-[#7a4a22]/60 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        borderColor: activeSel ? "#9effa0" : "rgba(122,74,34,0.7)",
                        background: activeSel ? "rgba(158,255,160,0.18)" : "rgba(0,0,0,0.25)",
                      }}
                    >
                      <div>{p.name}</div>
                      <div className="text-[10px] font-normal opacity-80">
                        {p.cd > 0 ? `recharge : ${p.cd} tour${p.cd > 1 ? "s" : ""}` : p.cost > 0 ? `${p.cost} PM${noPm ? " (insuffisant)" : ""}` : "gratuit"}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
          {!myDead && selectedPower && powers.find((p) => p.power_key === selectedPower && isAllyPower(p)) && (
            <div className="rounded bg-black/60 px-2 py-0.5 text-[10px] text-[#fff3d6]">Clique sur un allié pour le cibler (toi par défaut).</div>
          )}
        </div>
      )}

      {/* Fin de combat */}
      {finished && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-[min(26rem,90%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-center text-[#3a2410] shadow-xl">
            <div className="text-xl font-extrabold">{combat!.status === "victory" ? "Victoire !" : "Le groupe est tombé…"}</div>
            <div className="mt-1 text-sm">
              {combat!.status === "victory"
                ? combat!.is_boss
                  ? "Le boss est vaincu : l'expédition est réussie, vous rentrez avec le butin."
                  : "Les monstres sont vaincus. L'expédition continue."
                : "Plus personne ne tient debout : l'expédition est terminée."}
            </div>
            <button type="button" onClick={onFinished} className="mt-3 rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-5 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818]">
              Continuer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
