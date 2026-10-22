// Vrai combat d'expédition (SQL 007 + 010). Tout l'état vient du serveur :
// ennemis communs à tout le groupe, PV/PM, journal. Le navigateur n'envoie que
// son choix (pouvoir + cible) et demande la résolution quand tout le monde est
// prêt ou que le délai est écoulé. Aucun polling : Realtime uniquement.
//
// Le serveur résout un tour d'un coup, mais l'écran le REJOUE action par action
// à partir du journal structuré : chaque coup est animé, accompagné d'un
// bruitage, et les PV affichés ne bougent qu'au moment où le coup touche.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALLY_SLOTS, ENEMY_SLOTS, HpBar, PlaceholderEnemy, hpColor, type CombatAlly } from "./ExpeditionCombatView";
import {
  fetchCombatSnapshot,
  fetchEnemyImagePool,
  fetchGameAxes,
  fetchGamePowers,
  fetchGameSettings,
  fetchMyBuild,
  pickEnemyEntry,
  type EnemyImage,
  powersForBuild,
  resolveCombatTurn,
  submitCombatAction,
  subscribeToCombat,
  type CombatLogRow,
  type CombatSnapshot,
  type GameAxis,
  type GamePower,
  type MyBuild,
} from "../lib/expedition-combat";
import { WornSprite } from "./WornSprite";
import { DEFAULT_HAND, fetchWeaponsById, fetchWornWeapons, type WornWeapon } from "../lib/weapons";
import { CURSOR_INTERACT } from "../lib/cursors";
import { LootPanel } from "./LootPanel";
import { CONSUMABLE_INFO, fetchMyConsumables, submitCombatItem, type ConsumableStack } from "../lib/consumables";
import { playCombatSound, type CombatSound } from "../lib/combat-sounds";
import { leaveScenePresence, type PresenceChannel } from "../lib/scenes-supabase";

const ROLE_LABEL: Record<string, string> = { chef: "Chef de meute", boss: "Boss", add: "Invoqué", normal: "" };

const EVENT_MS = 1050; // durée d'une action rejouée
const LAND_MS = 380; // instant où le coup touche (PV qui bougent, bruit)

function pnum(p: GamePower, k: string): number | undefined {
  const v = p.params?.[k];
  return typeof v === "number" ? v : undefined;
}
function isSelfOnly(p: GamePower): boolean {
  return p.params?.["self_only"] === true;
}
function isAllyPower(p: GamePower): boolean {
  const prm = p.params;
  if (!prm || isSelfOnly(p)) return false;
  return prm["heal"] !== undefined || prm["survive_at"] !== undefined;
}
function needsNoEnemy(p: GamePower): boolean {
  const prm = p.params;
  return !!prm && (prm["redirect_single_target"] !== undefined || prm["pm_gain"] !== undefined || isSelfOnly(p) || isAllyPower(p));
}

function soundFor(ev: NonNullable<CombatLogRow["ev"]>): CombatSound {
  if (ev.t === "heal") return "heal";
  if (ev.t === "summon") return "summon";
  if (ev.t === "dmg") {
    if (ev.pw === "aoe") return "aoe";
    if (ev.pw === "monstre") return "monster";
    if (ev.pw === "coup_puissant" || ev.pw === "incantation") return "heavy";
    return "hit";
  }
  return "info";
}

export function ExpeditionBattle({
  sceneImageUrl,
  combatId,
  characterId,
  allies,
  volume,
  muted,
  onFinished,
}: {
  sceneImageUrl: string;
  combatId: string;
  characterId: string;
  allies: CombatAlly[];
  volume: number;
  muted: boolean;
  /** Appelé quand le joueur ferme le panneau de fin de combat. */
  onFinished: () => void;
}) {
  const [snap, setSnap] = useState<CombatSnapshot | null>(null);
  const [build, setBuild] = useState<MyBuild | null>(null);
  const [powers, setPowers] = useState<GamePower[]>([]);
  const [axes, setAxes] = useState<GameAxis[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>({});
  const [worn, setWorn] = useState<Record<string, WornWeapon>>({});
  const [weaponPool, setWeaponPool] = useState<Record<string, Omit<WornWeapon, "hand">>>({});
  const [lootSettled, setLootSettled] = useState(true);
  const [stacks, setStacks] = useState<ConsumableStack[]>([]);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemKind, setItemKind] = useState<ConsumableStack | null>(null);
  const [pool, setPool] = useState<EnemyImage[]>([]);
  const [selectedPower, setSelectedPower] = useState<string | null>(null); // null = attaque de base
  const [targetEnemy, setTargetEnemy] = useState<string | null>(null);
  const [targetAlly, setTargetAlly] = useState<string | null>(null);
  const [sentTurn, setSentTurn] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showLog, setShowLog] = useState(true);
  const [playedId, setPlayedId] = useState<number | null>(null); // dernier événement rejoué
  const [landedId, setLandedId] = useState<number | null>(null); // événement dont le coup a touché
  const resolvingRef = useRef(false);
  const reloadTimer = useRef<number | undefined>(undefined);
  const volRef = useRef({ volume, muted });
  volRef.current = { volume, muted };

  const reloadNow = useCallback(async () => {
    try {
      const s = await fetchCombatSnapshot(combatId);
      if (s) setSnap(s);
    } catch (e) {
      console.error("combat reload failed", e);
    }
  }, [combatId]);
  // Plusieurs lignes changent en rafale à chaque tour : on regroupe les lectures.
  const reload = useCallback(() => {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => void reloadNow(), 150);
  }, [reloadNow]);

  useEffect(() => {
    let cancelled = false;
    let channel: PresenceChannel | null = null;
    (async () => {
      try {
        const [b, p, a, st, imgs] = await Promise.all([
          fetchMyBuild(characterId),
          fetchGamePowers(),
          fetchGameAxes(),
          fetchGameSettings(),
          fetchEnemyImagePool(allies.map((x) => x.characterId)),
        ]);
        if (cancelled) return;
        setBuild(b);
        setPowers(p);
        setAxes(a);
        setSettings(st);
        setPool(imgs);
        setWeaponPool(await fetchWeaponsById());
        setWorn(await fetchWornWeapons(allies.map((x) => x.characterId)));
      } catch (e) {
        console.error("combat setup failed", e);
      }
      await reloadNow();
      if (!cancelled) channel = subscribeToCombat(combatId, reload);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(reloadTimer.current);
      if (channel) leaveScenePresence(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatId, characterId]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Au premier chargement, l'historique déjà là n'est pas rejoué.
  useEffect(() => {
    if (snap && playedId === null) setPlayedId(snap.log.reduce((m, l) => Math.max(m, l.id), 0));
  }, [snap, playedId]);

  const combat = snap?.combat ?? null;
  const turn = combat?.turn ?? 1;
  const active = combat?.status === "active";

  // ---------- Rejeu du tour ----------
  const pending = useMemo(
    () => (snap && playedId !== null ? snap.log.filter((l) => l.id > playedId && l.ev) : []),
    [snap, playedId],
  );
  const current = pending[0] ?? null;
  const replaying = pending.length > 0;

  useEffect(() => {
    if (!current) return;
    setLandedId(null);
    const tLand = window.setTimeout(() => {
      setLandedId(current.id);
      if (current.ev) playCombatSound(soundFor(current.ev), volRef.current.volume, volRef.current.muted);
    }, LAND_MS);
    const tDone = window.setTimeout(() => setPlayedId(current.id), EVENT_MS);
    return () => {
      window.clearTimeout(tLand);
      window.clearTimeout(tDone);
    };
  }, [current?.id]);

  // PV affichés = PV réels moins ce qui n'a pas encore « touché » à l'écran.
  const delta = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of pending) {
      if (!l.ev || !l.ev.d || l.ev.n === undefined) continue;
      if (l.id === current?.id && landedId === l.id) continue; // déjà appliqué
      if (l.ev.t === "dmg") m.set(l.ev.d, (m.get(l.ev.d) ?? 0) + l.ev.n);
      else if (l.ev.t === "heal") m.set(l.ev.d, (m.get(l.ev.d) ?? 0) - l.ev.n);
    }
    return m;
  }, [pending, current?.id, landedId]);

  const shownAllyHp = (a: CombatAlly) => Math.max(0, Math.min(a.hpMax, a.hpCurrent + (delta.get(a.characterId) ?? 0)));
  const shownEnemyHp = (id: string, hp: number, max: number) => Math.max(0, Math.min(max, hp + (delta.get(id) ?? 0)));

  const deadlineMs = combat ? new Date(combat.turn_deadline).getTime() : null;
  const secondsLeft = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : null;

  const me = allies.find((a) => a.characterId === characterId) ?? null;
  const myDead = !!me && shownAllyHp(me) <= 0 && !replaying;
  const mySnapPlayer = snap?.players.find((p) => p.character_id === characterId) ?? null;
  const myCooldowns = mySnapPlayer?.cooldowns ?? {};
  const aliveAllies = allies.filter((a) => a.hpCurrent > 0);
  const readyCount = snap
    ? snap.players.filter((p) => p.last_submitted_turn >= turn && aliveAllies.some((a) => a.characterId === p.character_id)).length
    : 0;
  const iAmReady = (mySnapPlayer?.last_submitted_turn ?? 0) >= turn || sentTurn >= turn;

  const aliveEnemies = useMemo(() => (snap?.enemies ?? []).filter((e) => e.pv_current > 0), [snap]);

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

  // ---------- Résolution : tout le monde prêt, ou délai écoulé ----------
  const tryResolve = useCallback(async () => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    try {
      await resolveCombatTurn(combatId);
      await reloadNow();
    } catch (e) {
      console.error("resolve turn failed", e);
    } finally {
      resolvingRef.current = false;
    }
  }, [combatId, reloadNow]);

  useEffect(() => {
    if (!active || !snap) return;
    if (aliveAllies.length > 0 && readyCount >= aliveAllies.length) void tryResolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, turn, readyCount, aliveAllies.length]);

  useEffect(() => {
    if (!active || !deadlineMs) return;
    const delay = Math.max(0, deadlineMs - Date.now()) + 400;
    const t1 = window.setTimeout(() => void tryResolve(), delay);
    const t2 = window.setTimeout(() => void tryResolve(), delay + 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, turn, deadlineMs]);

  // ---------- Mes pouvoirs et les dégâts prévus ----------
  const myPowers = useMemo(() => (build ? powersForBuild(build, powers) : []), [build, powers]);
  const myAxisKey = build ? (build.axis_key ?? (build.family === "melee" ? "apprenti_melee" : "apprenti_magie")) : null;
  const myAxis = axes.find((a) => a.axis_key === myAxisKey) ?? null;
  const baseAttackName = myAxis?.base_attack_name ?? "Attaque";
  const pvScale = settings["pv_scale"] ?? 1;
  const pmScale = settings["pm_scale"] ?? 1;
  const targetEnemyRow = (snap?.enemies ?? []).find((e) => e.id === targetEnemy) ?? aliveEnemies[0] ?? null;

  const dmgVs = (mult: number, ignore = 0): number | null => {
    if (!myAxis || !targetEnemyRow) return null;
    const raw = myAxis.force * pvScale * mult;
    return Math.max(1, Math.round((raw * 100) / (100 + Number(targetEnemyRow.defense) * (1 - ignore))));
  };
  const previewOf = (p: GamePower | null): string => {
    if (!myAxis) return "";
    if (!p) {
      const d = dmgVs(myAxis.axis_key === "mage" || myAxis.axis_key === "apprenti_magie" ? 0.8 : 1, myAxis.axis_key === "chasseur" ? 0.3 : 0);
      return d !== null ? `≈ ${d} dégâts` : "";
    }
    const heal = pnum(p, "heal");
    if (heal !== undefined) return `+${Math.max(1, Math.round(heal * pvScale))} PV`;
    const pmGain = pnum(p, "pm_gain");
    if (pmGain !== undefined) return `+${Math.round(pmGain * pmScale)} PM`;
    if (pnum(p, "survive_at") !== undefined) return "évite la mort";
    if (pnum(p, "redirect_single_target") !== undefined || p.params?.["redirect_single_target"] === true) {
      const d = dmgVs(1);
      return d !== null ? `attire les monstres · ≈ ${d}` : "attire les monstres";
    }
    const charge = pnum(p, "charge_turns");
    if (charge !== undefined) {
      const d = dmgVs(pnum(p, "damage_mult") ?? 1);
      return d !== null ? `≈ ${d} dégâts après ${charge} tours` : "";
    }
    const dot = pnum(p, "dot_mult");
    if (dot !== undefined) {
      const d = dmgVs(dot);
      return d !== null ? `≈ ${d}/tour pendant ${pnum(p, "turns") ?? 3} tours` : "";
    }
    const mult = pnum(p, "damage_mult") ?? pnum(p, "self_damage_mult") ?? (p.params?.["bonus_per_20pct_missing"] !== undefined ? 1 : undefined);
    if (mult !== undefined) {
      const d = dmgVs(mult, p.power_key === "tir_desarmant" ? 0.3 : 0);
      return d !== null ? `≈ ${d} dégâts` : "";
    }
    return "";
  };

  // Résumé court des effets d'un pouvoir (en plus des dégâts / soins déjà chiffrés).
  const effectTags = (p: GamePower | null): string => {
    const prm = p?.params;
    if (!p || !prm) return "";
    const t: string[] = [];
    const edm = pnum(p, "enemy_damage_mult");
    if (edm !== undefined) t.push(`monstres −${Math.round((1 - edm) * 100)} % · ${pnum(p, "turns") ?? 2} tours`);
    if (prm["redirect_single_target"] === true) t.push("les monstres te visent");
    const ab = pnum(p, "ally_bonus");
    if (ab !== undefined) t.push(`alliés +${Math.round((ab - 1) * 100)} %`);
    if (prm["acts_first"] === true) t.push("agit en premier");
    const nh = pnum(p, "next_hit_mult");
    if (nh !== undefined) t.push(`prochaine attaque du monstre −${Math.round((1 - nh) * 100)} %`);
    if (pnum(p, "pm_return_ratio") !== undefined) t.push("rend des PM");
    if (prm["cancel_if_hit"] === true) t.push("annulée si tu es touché");
    const bp = pnum(p, "bonus_per_20pct_missing");
    if (bp !== undefined) t.push(`+${Math.round(bp * 100)} % dégâts par 20 % de PV perdus · ${pnum(p, "turns") ?? 3} tours`);
    if (prm["stack"] === true) t.push("cumulable");
    if (isSelfOnly(p)) t.push("sur toi");
    return t.join(" · ");
  };

  useEffect(() => {
    void fetchMyConsumables().then(setStacks);
  }, [turn, combat?.status]);

  const useItem = async (st: ConsumableStack, ally: string | null) => {
    if (!active || myDead || replaying) return;
    setError(null);
    try {
      await submitCombatItem(combatId, characterId, st.firstId, ally);
      setSentTurn(turn);
      setSelectedPower(null);
      setItemsOpen(false);
      setItemKind(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : ((e as { message?: string })?.message ?? "Erreur"));
    }
  };

  const send = async (powerKey: string | null) => {
    if (!active || myDead || replaying) return;
    const gp = powerKey ? powers.find((p) => p.power_key === powerKey) : null;
    const ally = gp && isAllyPower(gp) ? (targetAlly ?? characterId) : null;
    const enemy = gp && needsNoEnemy(gp) ? null : targetEnemy;
    setSelectedPower(powerKey);
    setError(null);
    try {
      await submitCombatAction(combatId, characterId, powerKey, enemy, ally);
      setSentTurn(turn);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ((e as { message?: string })?.message ?? "Erreur");
      setError(msg);
    }
  };

  const enemySlots = (snap?.enemies ?? []).slice(0, ENEMY_SLOTS.length);
  const logLines = (snap?.log ?? []).filter((l) => !l.ev || (playedId !== null && l.id <= playedId));
  const lastLog = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    lastLog.current?.scrollIntoView({ block: "end" });
  }, [logLines.length]);

  const finished = !!combat && combat.status !== "active" && !replaying && playedId !== null;
  const endSoundDone = useRef(false);
  useEffect(() => {
    if (finished && !endSoundDone.current) {
      endSoundDone.current = true;
      playCombatSound(combat!.status === "victory" ? "victory" : "defeat", volRef.current.volume, volRef.current.muted);
    }
  }, [finished, combat]);

  // ---------- Animations ----------
  const fxFor = (kind: "p" | "e", id: string): "act" | "hit" | "heal" | null => {
    const ev = current?.ev;
    if (!ev) return null;
    if (landedId === current!.id && ev.dk === kind && ev.d === id) return ev.t === "heal" ? "heal" : ev.t === "dmg" ? "hit" : null;
    if (ev.sk === kind && ev.s === id && landedId !== current!.id) return "act";
    return null;
  };
  const floatFor = (kind: "p" | "e", id: string) => {
    const ev = current?.ev;
    if (!ev || landedId !== current!.id || ev.dk !== kind || ev.d !== id || ev.n === undefined) return null;
    if (ev.t === "dmg") return { text: `−${ev.n}`, color: "#fca5a5" };
    if (ev.t === "heal") return { text: `+${ev.n}`, color: "#86efac" };
    return null;
  };

  return (
    <div
      className="absolute inset-0 z-20 select-none overflow-hidden"
      style={{ fontFamily: "'Baloo 2', cursive" }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes obw-lunge-r { 0%{transform:translateX(0)} 35%{transform:translateX(7vw)} 100%{transform:translateX(0)} }
        @keyframes obw-lunge-l { 0%{transform:translateX(0)} 35%{transform:translateX(-7vw)} 100%{transform:translateX(0)} }
        @keyframes obw-shake { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-10px)} 35%{transform:translateX(9px)} 55%{transform:translateX(-6px)} 75%{transform:translateX(4px)} }
        @keyframes obw-flash { 0%{filter:brightness(2.4) saturate(0.4) drop-shadow(0 0 8px #f87171)} 100%{filter:none} }
        @keyframes obw-heal { 0%{filter:brightness(1.6) drop-shadow(0 0 12px #86efac)} 100%{filter:none} }
        @keyframes obw-float { 0%{opacity:0;transform:translate(-50%,0) scale(.6)} 15%{opacity:1;transform:translate(-50%,-8px) scale(1.25)} 100%{opacity:0;transform:translate(-50%,-46px) scale(1)} }
        .obw-act-r{animation:obw-lunge-r ${LAND_MS * 2}ms ease-in-out}
        .obw-act-l{animation:obw-lunge-l ${LAND_MS * 2}ms ease-in-out}
        .obw-hit{animation:obw-shake 450ms ease-in-out, obw-flash 600ms ease-out}
        .obw-heal{animation:obw-heal 800ms ease-out}
        .obw-float{animation:obw-float 900ms ease-out forwards}
      `}</style>
      <img src={sceneImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />

      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-xs font-bold uppercase tracking-widest text-[#fff3d6]">
        {combat?.is_boss ? "Combat de boss" : "Combat"} · tour {turn}
        {active && !replaying && secondsLeft !== null ? ` · ${secondsLeft} s` : ""}
      </div>

      {active && combat?.aoe_warning && !replaying && (
        <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-lg border-2 border-[#f87171] bg-[#4a0d0d]/95 px-4 py-1.5 text-sm font-bold text-[#fff3d6]">
          ⚠ Le boss prépare une attaque de zone : elle touchera tout le groupe à la fin de ce tour !
        </div>
      )}

      {/* Texte de l'action en cours de rejeu */}
      {current && (
        <div className="absolute left-1/2 top-[11%] z-30 -translate-x-1/2 rounded-lg bg-black/70 px-4 py-1.5 text-center text-sm font-bold text-[#fff3d6]">
          {current.text}
        </div>
      )}

      {/* Groupe à gauche */}
      {allies.slice(0, ALLY_SLOTS.length).map((a, i) => {
        const slot = ALLY_SLOTS[i]!;
        const hp = shownAllyHp(a);
        const dead = hp <= 0;
        const clickable = active && !replaying && selectedPower && powers.find((p) => p.power_key === selectedPower && isAllyPower(p)) && !dead;
        const isTargeted = targetAlly === a.characterId;
        const fx = fxFor("p", a.characterId);
        const fl = floatFor("p", a.characterId);
        return (
          <div
            key={a.characterId}
            className="absolute"
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, height: "26%", transform: "translate(-50%, -100%)", zIndex: Math.round(slot.y), cursor: clickable ? CURSOR_INTERACT : undefined }}
            onClick={() => {
              if (clickable) {
                setTargetAlly(a.characterId);
                void submitCombatAction(combatId, characterId, selectedPower, null, a.characterId)
                  .then(() => setSentTurn(turn))
                  .catch((e) => setError(String(e?.message ?? e)));
              }
            }}
          >
            {fl && (
              <div key={current!.id} className="obw-float pointer-events-none absolute left-1/2 top-0 z-50 text-2xl font-extrabold" style={{ color: fl.color, textShadow: "0 2px 4px #000" }}>
                {fl.text}
              </div>
            )}
            <div className={fx === "act" ? "obw-act-r h-full" : fx === "hit" ? "obw-hit h-full" : fx === "heal" ? "obw-heal h-full" : "h-full"}>
              <div style={{ transform: "scaleX(-1)", height: "100%" }}>
                <WornSprite
                  fit="height"
                  src={a.imageUrl}
                  alt={a.name}
                  weapon={worn[a.characterId]}
                  className="block h-full w-auto object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
                  style={{ filter: dead ? "grayscale(1) brightness(0.5)" : undefined, outline: isTargeted ? "2px solid #9effa0" : undefined }}
                />
              </div>
            </div>
            <div className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-[#fff3d6]" style={{ textShadow: "0 1px 3px #000" }}>
              {a.name}
            </div>
          </div>
        );
      })}

      {/* Ennemis à droite : mêmes monstres pour tout le groupe */}
      {enemySlots.map((en, i) => {
        const slot = ENEMY_SLOTS[i]!;
        const hp = shownEnemyHp(en.id, en.pv_current, en.pv_max);
        const dead = hp <= 0;
        const entry = pickEnemyEntry(pool, en.id);
        const img = entry?.imageUrl ?? null;
        const mw = en.weapon_id ? weaponPool[en.weapon_id] ?? null : null;
        const mWeapon: WornWeapon | null = mw ? { ...mw, hand: entry?.handAnchor ?? DEFAULT_HAND } : null;
        const selected = targetEnemy === en.id;
        const target = en.announced_target_id ? allies.find((a) => a.characterId === en.announced_target_id) : null;
        const fx = fxFor("e", en.id);
        const fl = floatFor("e", en.id);
        return (
          <div
            key={en.id}
            className="absolute"
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, height: en.role === "boss" ? "34%" : "26%", transform: "translate(-50%, -100%)", zIndex: Math.round(slot.y), cursor: dead || !active || replaying ? undefined : CURSOR_INTERACT }}
            onClick={() => {
              if (dead || !active || replaying) return;
              setTargetEnemy(en.id);
              const gp = selectedPower ? powers.find((p) => p.power_key === selectedPower) : null;
              if (iAmReady && !(gp && needsNoEnemy(gp))) {
                void submitCombatAction(combatId, characterId, selectedPower, en.id, null).catch((e) => setError(String(e?.message ?? e)));
              }
            }}
          >
            <div className="absolute -top-14 left-1/2 w-32 -translate-x-1/2 text-center text-[11px] font-bold text-[#fff3d6]" style={{ textShadow: "0 1px 3px #000" }}>
              {ROLE_LABEL[en.role] ? <div className="text-[9px] uppercase tracking-widest text-[#fbbf24]">{ROLE_LABEL[en.role]}</div> : null}
              {en.name}
              <HpBar current={hp} max={en.pv_max} className="mt-0.5" />
              <div className="text-[10px]" style={{ color: hpColor(hp, en.pv_max) }}>
                {hp}/{en.pv_max}
              </div>
              {!dead && !replaying && target ? <div className="text-[10px] text-[#fca5a5]">vise {target.name}</div> : null}
            </div>
            {fl && (
              <div key={current!.id} className="obw-float pointer-events-none absolute left-1/2 top-0 z-50 text-2xl font-extrabold" style={{ color: fl.color, textShadow: "0 2px 4px #000" }}>
                {fl.text}
              </div>
            )}
            <div className={fx === "act" ? "obw-act-l h-full" : fx === "hit" ? "obw-hit h-full" : fx === "heal" ? "obw-heal h-full" : "h-full"}>
              <div className="h-full" style={{ filter: dead ? "grayscale(1) brightness(0.5)" : undefined, outline: selected && !dead ? "2px dashed #fbbf24" : undefined, outlineOffset: 2 }}>
                {img ? <WornSprite fit="height" src={img} alt={en.name} weapon={mWeapon} className="block h-full w-auto object-contain" /> : <PlaceholderEnemy />}
              </div>
            </div>
          </div>
        );
      })}

      {/* Groupe + PV/PM : bas gauche */}
      <div className="absolute bottom-[7.5rem] left-4 z-30 flex w-60 flex-col gap-1.5 rounded-lg border border-[#7a4a22]/60 bg-[#2b1406]/90 p-2.5 text-[#fff3d6]">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Groupe</div>
        {allies.map((a) => {
          const ready = snap?.players.find((p) => p.character_id === a.characterId)?.last_submitted_turn ?? 0;
          const hp = shownAllyHp(a);
          return (
            <div key={a.characterId} className="flex items-center gap-2 text-xs">
              <img src={a.imageUrl} alt="" className="h-8 w-8 rounded-full bg-black/30 object-cover" />
              <div className="flex-1 overflow-hidden">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold">
                    {a.name}
                    {a.isSelf ? " (toi)" : ""} {active && !replaying && a.hpCurrent > 0 && ready >= turn ? "✓" : ""}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold" style={{ color: hpColor(hp, a.hpMax) }}>
                    {hp}/{a.hpMax}
                  </span>
                </div>
                <HpBar current={hp} max={a.hpMax} />
                {a.isSelf && a.pmMax ? <div className="mt-0.5 text-[10px] font-bold text-[#93c5fd]">PM {a.pmCurrent ?? 0}/{a.pmMax}</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Journal de combat : bas droite */}
      <div className="absolute bottom-14 right-4 z-30 w-72 rounded-lg border border-[#7a4a22]/60 bg-[#2b1406]/90 text-[#fff3d6]">
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
        <div className="absolute bottom-4 left-1/2 z-30 flex max-w-[78%] -translate-x-1/2 flex-col items-center gap-1.5">
          <div className="rounded-full bg-black/60 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#fff3d6]/80">
            {replaying
              ? "Résolution du tour…"
              : myDead
                ? "Tu es à terre — tu regardes le combat"
                : iAmReady
                  ? `Action envoyée — ${readyCount}/${aliveAllies.length} prêts (tu peux encore changer)`
                  : `Choisis ton action, puis clique un ennemi pour le cibler — ${readyCount}/${aliveAllies.length} prêts`}
          </div>
          {error && !replaying && <div className="rounded bg-[#4a0d0d]/90 px-2 py-0.5 text-[11px] font-bold text-[#fca5a5]">{error}</div>}
          {!myDead && !replaying && (
            <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-[#7a4a22]/60 bg-[#2b1406]/90 p-2">
              {[{ key: null as string | null, p: null as GamePower | null, name: baseAttackName, cost: 0, cd: 0, desc: "Attaque de base (gratuite)" }]
                .concat(
                  myPowers.map((p) => ({
                    key: p.power_key as string | null,
                    p: p as GamePower | null,
                    name: p.name,
                    cost: p.cost_pm,
                    cd: myCooldowns[p.power_key] ?? 0,
                    desc: p.description,
                  })),
                )
                .map((b) => {
                  const noPm = (me?.pmCurrent ?? 0) < b.cost;
                  const disabled = b.cd > 0 || noPm;
                  const activeSel = iAmReady && selectedPower === b.key;
                  const prev = previewOf(b.p);
                  return (
                    <button
                      key={b.key ?? "base"}
                      type="button"
                      disabled={disabled}
                      title={b.desc}
                      onClick={() => void send(b.key)}
                      className="min-w-28 rounded-lg border px-3 py-2 text-sm font-bold text-[#fff3d6] transition-colors hover:bg-[#7a4a22]/60 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        borderColor: activeSel ? "#9effa0" : "rgba(122,74,34,0.7)",
                        background: activeSel ? "rgba(158,255,160,0.18)" : "rgba(0,0,0,0.25)",
                      }}
                    >
                      <div>{b.name}</div>
                      {prev && <div className="text-[11px] font-bold text-[#fbbf24]">{prev}</div>}
                      {effectTags(b.p) && <div className="max-w-40 text-[10px] font-normal leading-tight text-[#fff3d6]/85">{effectTags(b.p)}</div>}
                      <div className="text-[10px] font-normal opacity-80">
                        {b.cd > 0 ? `recharge : ${b.cd} tour${b.cd > 1 ? "s" : ""}` : b.cost > 0 ? `${b.cost} PM${noPm ? " (insuffisant)" : ""}` : "gratuit"}
                      </div>
                    </button>
                  );
                })}
              <button
                type="button"
                disabled={stacks.length === 0}
                title="Boire une potion ou lire un parchemin prend ton tour."
                onClick={() => {
                  setItemsOpen((o) => !o);
                  setItemKind(null);
                }}
                className="min-w-28 rounded-lg border border-[#7a4a22]/70 bg-black/25 px-3 py-2 text-sm font-bold text-[#fff3d6] hover:bg-[#7a4a22]/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div>🎒 Objets</div>
                <div className="text-[10px] font-normal">{stacks.length === 0 ? "aucun objet" : "prend ton tour"}</div>
              </button>
            </div>
          )}
          {!myDead && !replaying && itemsOpen && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-[#7a4a22]/60 bg-[#2b1406]/95 p-2">
              {itemKind === null
                ? stacks.map((st) => (
                    <button
                      key={st.kind}
                      type="button"
                      title={CONSUMABLE_INFO[st.kind].text}
                      onClick={() => (st.kind === "potion_soin" && aliveAllies.length > 1 ? setItemKind(st) : void useItem(st, null))}
                      className="rounded-lg border border-[#7a4a22]/70 bg-black/25 px-3 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#7a4a22]/60"
                    >
                      {CONSUMABLE_INFO[st.kind].icon} {CONSUMABLE_INFO[st.kind].name} ×{st.count}
                      <div className="max-w-44 text-[10px] font-normal leading-tight opacity-85">{CONSUMABLE_INFO[st.kind].text}</div>
                    </button>
                  ))
                : (
                    <>
                      <span className="text-xs text-[#fff3d6]">Soigner qui ?</span>
                      {aliveAllies.map((a) => (
                        <button key={a.characterId} type="button" onClick={() => void useItem(itemKind, a.characterId)} className="rounded border border-[#7a4a22]/70 bg-black/25 px-2 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#7a4a22]/60">
                          {a.characterId === characterId ? "Moi" : a.name}
                        </button>
                      ))}
                    </>
                  )}
            </div>
          )}
          {!myDead && !replaying && selectedPower && powers.find((p) => p.power_key === selectedPower && isAllyPower(p)) && (
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
            {combat!.status === "victory" && combat!.xp_reward > 0 && (
              <div className="mt-2 text-base font-extrabold text-[#92400e]">+{combat!.xp_reward} XP</div>
            )}
            {combat!.status === "victory" && me && (
              <LootPanel
                expeditionId={combat!.expedition_id}
                combatId={combat!.id}
                characterId={me.characterId}
                names={Object.fromEntries(allies.map((a) => [a.characterId, a.name]))}
                gold={combat!.gold_reward ?? 0}
                onSettled={setLootSettled}
              />
            )}
            <button type="button" onClick={onFinished} disabled={combat!.status === "victory" && !lootSettled} className="mt-3 rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-5 py-1.5 text-sm font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50">
              {combat!.status === "victory" && !lootSettled ? "Butin en cours…" : "Continuer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
