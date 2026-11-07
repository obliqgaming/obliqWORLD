import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptPartyInvite,
  broadcastChatMessage,
  broadcastEmote,
  type EmotePayload,
  fetchChatHistory,
  joinGroupChat,
  sendGroupChat,
  saveChatMessage,
  broadcastMove,
  computeDepthScale,
  connectIdentityProvider,
  createCharacterWithAsset,
  createCharacterBuild,
  type CharacterFamily,
  createPartyAndInvite,
  createSoloParty,
  declinePartyInvite,
  enterExpeditionPortal,
  getAuthIdentity,
  fetchCharacterAssets,
  fetchExpeditionParticipants,
  fetchMyActiveParty,
  fetchMyCharacter,
  fetchMyDeath,
  type DeathSummary,
  archiveDeadCharacter,
  releaseSpirit,
  fetchOpenExpeditionForParty,
  fetchActiveExpeditionForParty,
  fetchExpeditionScene,
  ensureExpeditionStep,
  fetchStepVotes,
  castStepVote,
  resolveExpeditionStep,
  fetchExpeditionById,
  subscribeToExpeditionRun,
  isExpeditionSceneName,
  fetchPartyMembers,
  fetchScene,
  fetchSceneByName,
  fetchSceneExits,
  fetchScenePortals,
  inviteToParty,
  isChannelReady,
  isPresenceDebugEnabled,
  joinScenePresence,
  kickFromParty,
  leaveExpeditionPortal,
  leaveParty,
  readPeersFromChannel,
  leaveScenePresence,
  moveCharacterToScene,
  pointInPolygon,
  saveCharacterPosition,
  scenesClient,
  setPresenceDebugEnabled,
  signOutToGuest,
  startExpedition,
  subscribeToExpeditionChanges,
  subscribeToIncomingInvites,
  subscribeToPartyChanges,
  type AuthIdentity,
  type Character,
  type ChatMessage,
  type Expedition,
  type ExpeditionParticipant,
  type ExpeditionStep,
  type StepVote,
  type ExpeditionPortal,
  type Party,
  type PartyMember,
  type PeerState,
  type PresenceChannel,
  type Point,
  type Scene,
  type SceneExit,
  type VisualAsset,
} from "../lib/scenes-supabase";
import { AccountBadge } from "../components/AccountBadge";
import { ReferralReveal } from "../components/QuestPanel";
import { capturePendingReferral, claimPendingReferral } from "../lib/referral";
import { CharacterSelect } from "../components/CharacterSelect";
import { LoginScreen } from "../components/LoginScreen";
import { DeadScreen } from "../components/DeadScreen";
import { HelpDialog } from "../components/HelpDialog";
import { ensureSessionCleanup, publishDisplayName, markLoggedOut, loggedOutInfo, clearLoggedOut } from "../lib/session";
import { PetSprite } from "../components/PetSprite";
import { fetchMyCompanions, fetchPartyCompanions, type PartyCompanion } from "../lib/companions";
import { AboutDialog } from "../components/AboutDialog";
import { GroupBoard } from "../components/GroupBoard";
import { QuestTracker } from "../components/QuestTracker";
import { GroupAdBanner } from "../components/GroupAdBanner";
import { fetchAdReminders, meetLabel, touchSeen, touchSeenPeers } from "../lib/group-ads";
import { WelcomeModal } from "../components/WelcomeModal";
import { ADMIN_USER_ID, REQUIRE_PROVIDER_LOGIN } from "../lib/alpha-config";
import { ExpeditionPortalMarker } from "../components/ExpeditionPortal";
import { ExpeditionCombatView, type CombatAlly, type ExpeditionEvent } from "../components/ExpeditionCombatView";
import { ExpeditionBattle } from "../components/ExpeditionBattle";
import { Pasture } from "../components/Pasture";
import { WeaponDisplay } from "../components/WeaponDisplay";
import { CampPanel } from "../components/CampPanel";
import { AxisChoiceModal, EndBanner, LevelUpBanner, LevelUpModal, OutcomePanel, type OutcomeInfo } from "../components/ExpeditionExtras";
import {
  chooseAxis,
  fetchGameAxes,
  fetchGamePowers,
  fetchLatestCombat,
  fetchMyBuild,
  fetchRunStats,
  fetchStepOutcome,
  startCombat,
  subscribeToRunStats,
  type GameAxis,
  type GamePower,
  type RunStat,
} from "../lib/expedition-combat";
import { PLACEHOLDER_EVENTS, eventForStep, expeditionLength } from "../lib/expedition-placeholder-events";
import { openNarrativeStep, fetchNarrativeEvent, type NarrativeEvent } from "../lib/narrative";
import { NarrativeStepPanel } from "../components/NarrativeStepPanel";
import { HotspotMarker, HotspotPanel } from "../components/SceneHotspots";
import { LoadingScreen } from "../components/LoadingScreen";
import { fetchLevelUpInfo, playLevelUpJingle, randomLevelLine, rememberVitals, writeSnap, type LevelUpInfo } from "../lib/levelup";
import { useNpcSpeech } from "../lib/npc-lines";
import { shouldMirror, useImageFlips } from "../lib/image-flips";
import { InspectPanel } from "../components/InspectPanel";
import { WornSprite } from "../components/WornSprite";
import { EMOTES, EMOTE_KEYS, EMOTE_COOLDOWN_MS, emoteFromCommand, emoteStyle, type EmoteKey } from "../lib/emotes";
import { CURSOR_DEFAULT, CURSOR_INTERACT, arrowCursor, useArrowCursorReady } from "../lib/cursors";
import { InventoryPanel } from "../components/InventoryPanel";
import { ClassNameModal, TalentPanel } from "../components/TalentPanel";
import { fetchWornWeapons, type WornWeapon } from "../lib/weapons";
import { setUiAudio, uiSound } from "../lib/ui-sounds";
import { JINGLE_FAIL, JINGLE_SUCCESS, parseMusicList, startJingle } from "../lib/jingle";
import { claimDailyGold, fetchSceneHotspots, useActiveGoldIds, useClaimedGoldToday, useHotspotStyles, type SceneHotspot } from "../lib/hotspots";
import { PartyInvitePopup } from "../components/PartyInvitePopup";
import { PartyPanel } from "../components/PartyPanel";
import { PeerContextMenu } from "../components/PeerContextMenu";
import { TradePanel, TradeInvite, TradeWaiting } from "../components/TradePanel";
import { fetchTradeState, subscribeToTrades, tradeRequest, tradeRespond, tradeCancel, type TradeState } from "../lib/trade";
import { SoundControl } from "../components/SoundControl";
import { findPath } from "../lib/pathfinding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ObliqWorld" },
      { name: "description", content: "Explorez le monde — auberge, village, forêt." },
      { property: "og:title", content: "ObliqWorld" },
      { property: "og:description", content: "Explorez le monde — auberge, village, forêt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=IM+Fell+English&display=swap",
      },
    ],
  }),
  loader: () => fetchSceneByName("auberge"),
  component: Index,
});

// ---------- Vitesse de marche ----------
// Vitesse de base + un bonus qui monte avec la distance (ACCEL_INTENSITY : 0 =
// vitesse constante, 1 = comportement d'origine très marqué). Passé de 0.12
// (~90% de moins que l'origine) à 0.2 (~80% de moins) car à 90% l'accélération
// ne se sentait plus du tout.
// Marche du joueur : true = petits sauts gauche/droite (520 ms) ; false = ancien balancement de la tête (« auberge-walk »).
const PLAYER_WALK_HOP = true;
const RUN_FACTOR = 1.45; // double-clic : on court, juste un peu plus vite
const BASE_WALK_SPEED_PX_PER_SEC = 140; // vitesse "de base" sur courte distance
const ACCEL_INTENSITY = 0.35; // remonté à nouveau (0.2 -> 0.28 -> 0.35)
const ACCEL_REFERENCE_PX = 900; // distance à partir de laquelle le bonus est à fond
const MIN_WALK_MS = 300;
// Largeur du personnage exprimée en fraction de la largeur AFFICHÉE de la
// scène (sceneBoxSize.width), plutôt qu'en pixels fixes. Avant, un
// redimensionnement de la fenêtre changeait la taille de la scène sans changer
// celle du personnage, qui devenait alors trop petit/trop grand par rapport
// au décor. 120px sur une scène affichée à ~1333px de large (cas courant en
// fenêtré) donne ce ratio ; il reproduit donc l'apparence déjà validée tout en
// suivant les changements de taille de fenêtre.
const CHARACTER_WIDTH_RATIO = 120 / 1333;
const CHAT_BUBBLE_MS = 4500;
const CHAT_LOG_SIZE = 30;
const chatCache = new Map<string, ChatMessage[]>(); // log du tchat par scène (survit aux allers-retours entre scènes)
const NAME_COLORS = ["#fca5a5", "#fdba74", "#fde047", "#bef264", "#86efac", "#5eead4", "#7dd3fc", "#a5b4fc", "#d8b4fe", "#f0abfc", "#cbd5e1", "#fff3d6"];
// Couleur automatique d'un pseudo (si le joueur n'en a pas choisi) : toujours la même pour un même personnage.
const autoNameColor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length]!;
};
const CHAT_COLOR_KEY = "obliqworld-chat-color";
// Le plus bas à l'écran est devant. Reste sous 20 : les écrans plein cadre (expédition) passent par-dessus les personnages du lieu.
const depthZ = (y: number) => 14 + Math.max(0, Math.min(5, Math.floor(y / 17)));
const CHAT_EXPIRE_MS = 2 * 60 * 60 * 1000; // sans nouveau message pendant 2 h, le tchat s'efface
const expireChat = (log: ChatMessage[]): ChatMessage[] => {
  const last = log[log.length - 1];
  return last && Date.now() - last.ts > CHAT_EXPIRE_MS ? [] : log;
};
const GROUP_CHAT_COLOR = "#7dd3fc"; // canal /g (groupe) ; le canal /d (dire) garde la couleur habituelle
const mergeChat = (a: ChatMessage[], b: ChatMessage[]): ChatMessage[] => {
  const out = [...a];
  for (const m of b) if (!out.some((o) => o.characterId === m.characterId && o.text === m.text && Math.abs(o.ts - m.ts) < 5000)) out.push(m);
  return out.sort((x, y) => x.ts - y.ts).slice(-CHAT_LOG_SIZE);
};
const CHAT_IDLE_MS = 15000; // délai avant que le tchat devienne quasi transparent
const CHAT_IDLE_OPACITY = 0.1;
// ---------- État "absent" ----------
// Au bout de AWAY_AFTER_MS sans que le joueur ait bougé (clic de déplacement)
// ni écrit dans le tchat, son personnage passe "absent" : "(ABS)" s'affiche à
// côté de son pseudo chez tout le monde. Il repasse actif dès son prochain
// déplacement ou message. Coût réseau : 1 seul envoi de présence à l'entrée
// en absence, 1 seul à la sortie (le prochain déplacement l'embarque déjà).
const AWAY_AFTER_MS = 2 * 60 * 1000;
// Un pair qui disparaît de la synchro n'est pas retiré tout de suite : on
// attend PEER_GONE_GRACE_MS au cas où c'est un simple accroc réseau (le
// WebSocket qui rate un battement). S'il revient avant, rien ne se voit.
const PEER_GONE_GRACE_MS = 5000;
// Filet de sécurité, sans coût réseau : toutes les PRESENCE_RESYNC_MS, on
// relit l'état de présence déjà en cache dans le navigateur (aucune requête)
// pour se remettre d'aplomb si jamais un événement "sync" a été manqué.
const PRESENCE_RESYNC_MS = 4000;
// true = le pseudo est affiché sous chaque personnage (avec "(ABS)" en plus
// si absent). false = seul "(ABS)" apparaît, sans pseudo.
const SHOW_NAME_LABELS = true;

function distanceInPx(rect: DOMRect, a: Point, b: Point) {
  const dxPx = ((b.x - a.x) / 100) * rect.width;
  const dyPx = ((b.y - a.y) / 100) * rect.height;
  return Math.hypot(dxPx, dyPx);
}

function walkDurationMs(distPx: number) {
  const accel = Math.min(1, distPx / ACCEL_REFERENCE_PX);
  const speed = BASE_WALK_SPEED_PX_PER_SEC * (1 + ACCEL_INTENSITY * accel);
  return Math.max(MIN_WALK_MS, Math.round((distPx / speed) * 1000));
}

// Position ACTUELLE (celle où la transition CSS en est, pas l'ancienne cible
// stockée dans le state React) du sprite du personnage — nécessaire pour que
// "le dernier clic prime" reparte du bon endroit visuel, pas de l'ancienne
// destination.
function currentSpritePercent(el: HTMLElement, sceneRect: DOMRect): Point {
  const style = getComputedStyle(el);
  const leftPx = parseFloat(style.left) || 0;
  const topPx = parseFloat(style.top) || 0;
  return { x: (leftPx / sceneRect.width) * 100, y: (topPx / sceneRect.height) * 100 };
}

function Index() {
  const initialScene = Route.useLoaderData() as Scene;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const mutedRef = useRef(false);

  // ---------- Volume général (musique + son de pas), réglable via un curseur.
  // Mémorisé dans le navigateur pour que le réglage reste d'une visite à
  // l'autre. 1 = volume normal (comportement d'avant), 0 = silence. ----------
  const [volume, setVolume] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("obliqworld-volume");
      const v = raw != null ? parseFloat(raw) : 1;
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    } catch {
      return 1;
    }
  });
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(1, Math.max(0, parseFloat(e.target.value)));
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    if (jingleRef.current) jingleRef.current.volume = v;
    try {
      localStorage.setItem("obliqworld-volume", String(v));
    } catch {
      /* ignore */
    }
  };

  const [scene, setScene] = useState<Scene>(initialScene);
  const [exits, setExits] = useState<SceneExit[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [checkingCharacter, setCheckingCharacter] = useState(true);
  // Écran de chargement : tant que la scène de reconnexion, son image et ses lieux ne sont pas prêts.
  const imageFlips = useImageFlips();
  const [restoring, setRestoring] = useState(true);
  const restoreStartedRef = useRef(false);
  const [hotspotsLoaded, setHotspotsLoaded] = useState(false);
  const [veilTimeout, setVeilTimeout] = useState(false);
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVeilTimeout(true), 8000); // sécurité : le voile ne reste jamais bloqué
    return () => window.clearTimeout(t);
  }, []);
  // Fondu entre deux scènes (changement de scène, téléportation) : noir qui monte, on change, puis redescend quand tout est prêt.
  const [fadeOut, setFadeOut] = useState(false);
  const sceneReadyRef = useRef(false);
  // Message affiché si le chargement ou la création de personnage échoue
  // (session invitée impossible, réseau, etc.) — avant, ces échecs n'étaient
  // visibles que dans la console, donnant l'impression d'un écran qui ne
  // réagit à rien (c'est ce qu'on soupçonne pour le souci sur iPad).
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const [authIdentity, setAuthIdentity] = useState<AuthIdentity | null>(null);
  useEffect(() => {
    capturePendingReferral();
  }, []);
  useEffect(() => {
    if (!authIdentity || authIdentity.isAnonymous) return;
    void claimPendingReferral().finally(() => setReferralReveal(true));
  }, [authIdentity?.userId]);
  const [loginRequired, setLoginRequired] = useState(false);
  const loggingOutRef = useRef(false); // déconnexion en cours : plus aucune reconnexion de canal
  // Compagnon choisi à la ferme (image) : visible de tous, il marche devant son maître.
  const [myPet, setMyPet] = useState<string | null>(null);
  const myPetRef = useRef<string | null>(null);
  const myGearRef = useRef(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [deadInfo, setDeadInfo] = useState<{ name: string; cause: string | null; summary?: DeathSummary } | null>(null);
  const [deadBusy, setDeadBusy] = useState(false);
  const [deadError, setDeadError] = useState<string | null>(null);
  // Journal visible à l'écran (dernières lignes), pour diagnostiquer sans
  // avoir besoin d'ouvrir la console du navigateur (F12).
  const [presenceLog, setPresenceLog] = useState<string[]>([]);
  const [presenceDebugOn, setPresenceDebugOnState] = useState(() => isPresenceDebugEnabled());
  const lastLoggedPeerKeysRef = useRef<string>("");
  const logPresence = (line: string) => {
    if (isPresenceDebugEnabled()) console.debug(`[presence] ${line}`);
    setPresenceLog((l) => [...l.slice(-19), `${new Date().toLocaleTimeString()} ${line}`]);
  };
  const togglePresenceDebug = () => {
    const next = !isPresenceDebugEnabled();
    setPresenceDebugEnabled(next);
    setPresenceDebugOnState(next);
  };
  const [characterAssets, setCharacterAssets] = useState<VisualAsset[]>([]);
  const [pos, setPos] = useState<Point>({ x: 50, y: 70 });
  const [walking, setWalking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peers, setPeers] = useState<Record<string, PeerState>>({});

  // ---------- Groupe (party) — §5 revu le 2026-10-14 ----------
  const [party, setParty] = useState<Party | null>(null);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  // Invitation reçue en attente de réponse (un seul à la fois affiché — s'il
  // y en avait plusieurs, les suivantes s'affichent dès que celle-ci est
  // traitée, via le prochain événement temps réel).
  const [pendingInvite, setPendingInvite] = useState<{ partyId: string; inviterName: string } | null>(null);
  // Menu contextuel ouvert sur un pair cliqué (clé = userId du pair dans
  // `peers`, coordonnées écran du clic).
  const [peerMenu, setPeerMenu] = useState<{ peerKey: string; peerName: string; x: number; y: number } | null>(null);
  const partyChannelRef = useRef<PresenceChannel | null>(null);
  const inviteChannelRef = useRef<PresenceChannel | null>(null);

  // ---------- Portail d'expédition (§5, revu le 2026-10-14) ----------
  useArrowCursorReady();
  const claimedGold = useClaimedGoldToday();
  const hotspotStyles = useHotspotStyles();
  const activeGold = useActiveGoldIds();
  const [inspectId, setInspectId] = useState<string | null>(null); // recharge l'affichage quand la flèche-curseur des portails est prête
  const [scenePortals, setScenePortals] = useState<ExpeditionPortal[]>([]);
  const [longMinLevel, setLongMinLevel] = useState(5); // réglage long_expedition_min_level (SQL 040), pour l'étiquette du portail
  // Lieux interactifs de la scène (forgeron, éditeur d'étapes…), posés depuis /admin.
  const [hotspots, setHotspots] = useState<SceneHotspot[]>([]);
  const npcSpeech = useNpcSpeech(hotspots.filter((h) => !!hotspotStyles?.[h.kind]?.npc_name).map((h) => ({ id: h.id, kind: h.kind })));
  const [openHotspot, setOpenHotspot] = useState<SceneHotspot | null>(null);
  // Texte « +1 or » qui monte et s'efface au-dessus du tas ramassé (plus de fenêtre OK).
  const [goldFloats, setGoldFloats] = useState<{ key: number; x: number; y: number; text: string; ok: boolean }[]>([]);
  const collectGold = (h: SceneHotspot) => {
    const key = Date.now() + Math.random();
    const push = (text: string, ok: boolean) => {
      setGoldFloats((f) => [...f, { key, x: h.position.x, y: h.position.y, text, ok }]);
      window.setTimeout(() => setGoldFloats((f) => f.filter((g) => g.key !== key)), 1800);
    };
    claimDailyGold(h.id)
      .then((n) => { uiSound("coin"); push(`+${n} flouz`, true); })
      .catch((e: any) => push(e?.message?.includes("daily_gold_claim") ? "Pas encore activé" : "Déjà ramassé", false));
  };
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [talentsOpen, setTalentsOpen] = useState(false);
  const [referralReveal, setReferralReveal] = useState(false);
  const [renameAxis, setRenameAxis] = useState<string | null>(null);
  const [wornWeapons, setWornWeapons] = useState<Record<string, WornWeapon>>({});
  const peerIdsKey = Object.values(peers).map((x) => x.characterId).sort().join(",");
  // Change dès qu'un joueur présent change d'arme (ou son réglage) : on recharge alors l'équipement affiché.
  const peerGearKey = Object.values(peers).map((x) => `${x.characterId}:${x.gear ?? 0}`).sort().join(",");
  const refreshWornWeapons = useCallback(() => {
    const ids = [character?.id, ...peerIdsKey.split(",")].filter((x): x is string => !!x);
    void fetchWornWeapons(ids).then(setWornWeapons);
  }, [character?.id, peerIdsKey, peerGearKey]);
  useEffect(() => {
    refreshWornWeapons();
  }, [refreshWornWeapons]);
  const [openExpedition, setOpenExpedition] = useState<Expedition | null>(null);
  const [expeditionParticipants, setExpeditionParticipants] = useState<ExpeditionParticipant[]>([]);
  const expeditionChannelRef = useRef<PresenceChannel | null>(null);
  // Expédition en cours, conservée en changeant de scène (openExpedition, lui,
  // est réinitialisé à chaque changement de scène).
  const [activeExpedition, setActiveExpedition] = useState<Expedition | null>(null);
  const [expeditionSceneMissing, setExpeditionSceneMissing] = useState(false);
  const teleportingRef = useRef(false);
  // Déroulé partagé : l'étape courante vient de la base (current_step_index),
  // les votes aussi (voir 004_vote_partage_expedition.sql).
  const [runStep, setRunStep] = useState<ExpeditionStep | null>(null);
  const [stepVotes, setStepVotes] = useState<StepVote[]>([]);
  const [narrativeEvent, setNarrativeEvent] = useState<NarrativeEvent | null>(null);
  // Système de jeu (SQL 006 à 009) : PV/PM réels, combat, résultat d'événement, axe.
  const [runStats, setRunStats] = useState<RunStat[]>([]);
  const [partyCompanions, setPartyCompanions] = useState<Record<string, PartyCompanion>>({});
  const [activeCombatId, setActiveCombatId] = useState<string | null>(null);
  const [combatError, setCombatError] = useState<string | null>(null);
  const [outcomeInfo, setOutcomeInfo] = useState<OutcomeInfo | null>(null);
  const [endBanner, setEndBanner] = useState<{ title: string; text: string } | null>(null);
  const [axisChoice, setAxisChoice] = useState<{ axes: GameAxis[]; powers: GamePower[] } | null>(null);
  const [axisBusy, setAxisBusy] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [levelInfo, setLevelInfo] = useState<LevelUpInfo | null>(null);
  const [levelLine, setLevelLine] = useState("");
  const [levelBanner, setLevelBanner] = useState<number | null>(null);
  const levelBannerShownRef = useRef<number>(0);
  const [axisError, setAxisError] = useState<string | null>(null);

  // ---- Ratio réel de l'image de scène (fix du bug "objet-cover recadre l'image,
  // mais les % de position/zone marchable sont calculés sur l'image d'origine") ----
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    setImgNatural(null); // on réinitialise le temps que la nouvelle image de scène se charge
  }, [scene.image_url]);
  const sceneBoxSize = imgNatural
    ? (() => {
        const scale = Math.min(viewport.w / imgNatural.w, viewport.h / imgNatural.h);
        return { width: Math.round(imgNatural.w * scale), height: Math.round(imgNatural.h * scale) };
      })()
    : { width: viewport.w, height: viewport.h };

  // ---- Marche des autres joueurs, calculée localement (fix téléportation) ----
  const prevPeerPosRef = useRef<Record<string, Point>>({});
  // Dernière horloge (champ t) reçue par pair : écarte les états périmés de la
  // présence qui feraient revenir un pair en arrière pendant sa marche.
  const peerLastTRef = useRef<Record<string, number>>({});
  const peerWalkTimers = useRef<Record<string, number>>({});
  const peerRemoveTimers = useRef<Record<string, number>>({});
  // « Vus aujourd'hui » : chaque joueur croisé est noté une fois par session.
  const seenPeersRef = useRef<Set<string>>(new Set());
  const [peerWalking, setPeerWalking] = useState<Record<string, boolean>>({});
  const [peerDuration, setPeerDuration] = useState<Record<string, number>>({});

  // ---- Sens du personnage (miroir horizontal selon la direction de marche) ----
  // Le sprite de base est dessiné "vers la gauche" : on ne le retourne pas
  // quand il se dirige vers la gauche, et on le retourne en miroir (scaleX(-1))
  // quand il se dirige vers la droite. false = pas retourné (regarde à
  // gauche), true = retourné (regarde à droite).
  const [facingRight, setFacingRight] = useState(false);
  const [peerFacingRight, setPeerFacingRight] = useState<Record<string, boolean>>({});

  // ---- Chat ----
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatChannel, setChatChannel] = useState<"say" | "group">("say");
  const [chatColor, setChatColor] = useState<string | null>(() => {
    try { return localStorage.getItem(CHAT_COLOR_KEY); } catch { return null; }
  });
  const [colorOpen, setColorOpen] = useState(false);
  const pickChatColor = (c: string | null) => {
    setChatColor(c);
    setColorOpen(false);
    try { if (c) localStorage.setItem(CHAT_COLOR_KEY, c); else localStorage.removeItem(CHAT_COLOR_KEY); } catch { /* ignoré */ }
  };
  const groupChatRef = useRef<PresenceChannel | null>(null);
  const [bubbles, setBubbles] = useState<Record<string, { text: string; expiresAt: number }>>({});
  const bubbleTimers = useRef<Record<string, number>>({});
  const [chatIdle, setChatIdle] = useState(false);
  const [chatHovered, setChatHovered] = useState(false);
  const chatIdleTimer = useRef<number | null>(null);
  const bumpChatActivity = () => {
    setChatIdle(false);
    if (chatIdleTimer.current) window.clearTimeout(chatIdleTimer.current);
    chatIdleTimer.current = window.setTimeout(() => setChatIdle(true), CHAT_IDLE_MS);
  };
  useEffect(() => {
    bumpChatActivity();
    return () => {
      if (chatIdleTimer.current) window.clearTimeout(chatIdleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setChatLog((log) => (log.length ? expireChat(log) : log)), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const walkTimer = useRef<number | null>(null);
  const walkQueueRef = useRef<Point[]>([]);
  // État absent : ref pour les timers/réseau, state pour l'affichage.
  const awayRef = useRef(false);
  const awayTimer = useRef<number | null>(null);
  const [selfAway, setSelfAway] = useState(false);
  // Dernière position LOGIQUE connue du personnage (indépendante du DOM), pour
  // calculer le sens du sprite de façon fiable (voir stepWalk plus bas) : lire
  // getComputedStyle pendant une transition CSS en cours peut renvoyer une
  // valeur légèrement en avance/retard sur l'animation réelle, ce qui, sur un
  // chemin à plusieurs petits segments, pouvait rendre le signe de la
  // direction incohérent d'un segment à l'autre et donner l'impression que le
  // personnage ne se retournait qu'une fois arrivé à destination.
  const lastLogicalPosRef = useRef<Point>({ x: 50, y: 70 });
  const charSpriteRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<PresenceChannel | null>(null);
  const userIdRef = useRef<string | null>(null);
  const characterRef = useRef<Character | null>(null);
  const sceneIdRef = useRef<string>(initialScene.id);

  // ---------- Musique, avec fondu au changement de scène ----------
  // Plusieurs morceaux possibles par scène (adresses séparées par « | ») : on en tire un au hasard, jamais le même deux fois
  // de suite, puis un autre quand il se termine. Une seule musique à la fois : un « jingle » (révélation, réussite, échec)
  // coupe la musique principale, joue une fois, puis la musique principale repart.
  const lastTrackRef = useRef<string | null>(null);
  const jingleRef = useRef<HTMLAudioElement | null>(null);
  const pendingMusicRef = useRef<string | null>(null);
  // Musique actuellement choisie pour la scène d'expédition (par type d'étape) : on ne relance rien si elle ne change pas.
  const stepMusicRef = useRef<string | null>(null);

  const playMusic = (musicSpec: string, fade: boolean) => {
    if (jingleRef.current) {
      pendingMusicRef.current = musicSpec; // un jingle est en cours : la nouvelle musique démarrera à sa fin
      return;
    }
    const list = parseMusicList(musicSpec);
    if (list.length === 0) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }
    const candidates = list.length > 1 ? list.filter((u) => u !== lastTrackRef.current) : list;
    const url = candidates[Math.floor(Math.random() * candidates.length)]!;
    lastTrackRef.current = url;
    const prev = audioRef.current;
    const next = new Audio(url);
    next.loop = list.length === 1;
    next.muted = mutedRef.current;
    next.volume = fade ? 0 : volumeRef.current;
    if (list.length > 1) {
      next.addEventListener("ended", () => {
        if (audioRef.current === next && !jingleRef.current) playMusic(musicSpec, true);
      });
    }

    next.play().catch(() => {
      setNeedsInteraction(true);
      const start = () => {
        next.play().then(() => setNeedsInteraction(false)).catch(() => {});
        window.removeEventListener("pointerdown", start);
        window.removeEventListener("keydown", start);
      };
      window.addEventListener("pointerdown", start);
      window.addEventListener("keydown", start);
    });

    audioRef.current = next;

    if (fade) {
      const steps = 20;
      let i = 0;
      const fadeIn = window.setInterval(() => {
        i++;
        next.volume = Math.min(volumeRef.current, (i / steps) * volumeRef.current);
        if (prev) prev.volume = Math.max(0, (1 - i / steps) * volumeRef.current);
        if (i >= steps) {
          window.clearInterval(fadeIn);
          if (prev) prev.pause();
        }
      }, 30);
    } else if (prev) {
      prev.pause();
    }
  };

  const endJingle = () => {
    const j = jingleRef.current;
    if (!j) return;
    jingleRef.current = null;
    j.pause();
    const pending = pendingMusicRef.current;
    pendingMusicRef.current = null;
    if (pending) {
      playMusic(pending, true);
      return;
    }
    const main = audioRef.current;
    if (main) {
      main.volume = 0;
      main.play().catch(() => {});
      let i = 0;
      const t = window.setInterval(() => {
        i++;
        main.volume = Math.min(volumeRef.current, (i / 20) * volumeRef.current);
        if (i >= 20) window.clearInterval(t);
      }, 30);
    }
  };

  useEffect(() => {
    setUiAudio(volume, muted);
  }, [volume, muted]);

  useEffect(() => {
    const onJingle = (e: Event) => {
      const url = (e as CustomEvent<{ url: string }>).detail?.url;
      if (!url) return;
      if (jingleRef.current) {
        jingleRef.current.pause(); // jamais deux jingles ensemble
        jingleRef.current = null;
      }
      audioRef.current?.pause();
      const j = new Audio(url);
      j.muted = mutedRef.current;
      j.volume = volumeRef.current;
      jingleRef.current = j;
      j.addEventListener("ended", () => {
        if (jingleRef.current === j) endJingle();
      });
      j.play().catch(() => endJingle());
    };
    const onStop = () => endJingle();
    window.addEventListener("obliq-jingle", onJingle);
    window.addEventListener("obliq-jingle-stop", onStop);
    return () => {
      window.removeEventListener("obliq-jingle", onJingle);
      window.removeEventListener("obliq-jingle-stop", onStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stepMusicRef.current = initialScene.music_url;
    playMusic(initialScene.music_url, false);
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
    mutedRef.current = audio.muted;
    if (jingleRef.current) jingleRef.current.muted = audio.muted;
    if (needsInteraction) {
      audio.play().then(() => setNeedsInteraction(false)).catch(() => {});
    }
  };

  // ---------- Pas de marche : petit bruit de pas discret, synthétisé (pas de
  // fichier audio à gérer) ----------
  // Un seul son générique pour l'instant (pas de variante par matière — trop
  // de travail pour le moment, comme convenu). Bruit filtré très bref avec une
  // extinction rapide, pour rester discret et ne pas devenir pénible même sur
  // un trajet long. Ne joue que pour SON PROPRE personnage (pas les autres
  // joueurs), pour éviter que ça devienne bruyant à plusieurs.
  const footstepCtxRef = useRef<AudioContext | null>(null);
  const footstepTimer = useRef<number | null>(null);

  const getFootstepCtx = (): AudioContext | null => {
    if (footstepCtxRef.current) return footstepCtxRef.current;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
    if (!Ctor) return null;
    footstepCtxRef.current = new Ctor();
    return footstepCtxRef.current;
  };

  // Débloque le contexte audio dès la première interaction (nécessaire dans la
  // plupart des navigateurs) — comme le clic sert de toute façon à se
  // déplacer, ça se fait sans effort supplémentaire pour la personne.
  useEffect(() => {
    const unlock = () => {
      getFootstepCtx()?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const playFootstep = () => {
    if (mutedRef.current) return;
    const ctx = getFootstepCtx();
    if (!ctx || ctx.state !== "running") return;

    const duration = 0.09;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 650 + Math.random() * 200; // légère variation, pour pas que ça sonne robotique

    const baseGain = 0.06 * volumeRef.current; // volume volontairement bas, discret, module par le curseur général
    if (baseGain <= 0) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(baseGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + duration);
  };

  useEffect(() => {
    if (!walking) {
      if (footstepTimer.current) {
        window.clearInterval(footstepTimer.current);
        footstepTimer.current = null;
      }
      return;
    }
    playFootstep();
    footstepTimer.current = window.setInterval(playFootstep, 260);
    return () => {
      if (footstepTimer.current) {
        window.clearInterval(footstepTimer.current);
        footstepTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking]);

  // ---------- Statut de connexion (invité / Twitch / Discord), pour le badge ----------
  useEffect(() => {
    let cancelled = false;
    getAuthIdentity()
      .then((id) => {
        if (!cancelled) setAuthIdentity(id);
      })
      .catch((e) => console.error("Auth identity lookup failed", e));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectProvider = async (provider: "twitch" | "discord") => {
    try {
      clearLoggedOut();
      await connectIdentityProvider(provider);
      // connectIdentityProvider redirige la page entière vers Twitch/Discord ;
      // on ne revient ici que si ça a échoué avant la redirection.
    } catch (e) {
      console.error("Connexion échouée", e);
      window.alert(
        "La connexion a échoué. Si tu es dans l'aperçu Lovable, ouvre le site publié et réessaie depuis là.",
      );
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Te déconnecter ? Ton personnage et tes affaires t'attendent à ta prochaine connexion.")) return;
    try {
      // Départ propre : on quitte la scène (les autres te voient partir tout de suite) et on s'arrête de marcher.
      loggingOutRef.current = true;
      if (walkTimer.current) window.clearTimeout(walkTimer.current);
      if (channelRef.current) leaveScenePresence(channelRef.current);
      channelRef.current = null;
      markLoggedOut(characterRef.current?.name ?? null);
      await signOutToGuest();
    } finally {
      // Une nouvelle session invité doit être recréée proprement : on
      // recharge plutôt que de tenter de tout réinitialiser à la main.
      window.location.reload();
    }
  };

  // ---------- Personnage : on vérifie s'il existe déjà, sinon on demande à en choisir un ----------
  useEffect(() => {
    let cancelled = false;
    let wantsLogin = false;
    (async () => {
      // Alpha : connexion Twitch / Discord obligatoire (un invité existant doit d'abord relier son compte).
      if (REQUIRE_PROVIDER_LOGIN || loggedOutInfo().loggedOut) {
        const id = await getAuthIdentity();
        if (!id.userId || (id.isAnonymous && id.userId !== ADMIN_USER_ID)) {
          if (!cancelled) {
            setLoginRequired(true);
            setCheckingCharacter(false);
          }
          return null;
        }
      }
      const mine = await fetchMyCharacter();
      if (mine === null) {
        // Pas de personnage et pas de compte Twitch/Discord : page « Se connecter », sans dessin (plus de mode invité).
        const id = await getAuthIdentity();
        if (!id.userId || id.isAnonymous) {
          wantsLogin = true;
          if (!cancelled) setLoginRequired(true);
        }
      }
      return mine;
    })()
      .then((c) => {
        if (c === null && (REQUIRE_PROVIDER_LOGIN || loggedOutInfo().loggedOut || wantsLogin)) return;
        if (cancelled) return;
        if (c) {
          // On attend la vérification de mort avant de lever l'écran de chargement (sinon flash de l'écran de dessin).
          return fetchMyDeath(c.id)
            .then((d) => {
              if (cancelled) return;
              if (d.dead && !d.inExpedition) {
                setDeadInfo({ name: c.name, cause: d.cause, summary: d.summary });
                return;
              }
              setCharacter(c);
              characterRef.current = c;
              setPos(c.position);
              lastLogicalPosRef.current = c.position;
              void restoreLastScene(c);
            })
            .catch((e) => {
              console.error("Death check failed", e);
              if (cancelled) return;
              setCharacter(c);
              characterRef.current = c;
              setPos(c.position);
              lastLogicalPosRef.current = c.position;
              void restoreLastScene(c);
            });
        } else {
          return fetchCharacterAssets().then((assets) => {
            if (!cancelled) setCharacterAssets(assets);
          });
        }
      })
      .catch((e) => {
        console.error("Character lookup failed", e);
        if (!cancelled) setCharacterError("Impossible de charger ton personnage. Vérifie ta connexion et réessaie.");
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingCharacter(false);
          if (!restoreStartedRef.current) setRestoring(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnexion : on réapparaît là où on s'était déconnecté (scène + position), sauf scène d'expédition (gérée à part).
  const restoreLastScene = async (c: { scene_id: string }) => {
    restoreStartedRef.current = true;
    if (!c.scene_id || c.scene_id === initialScene.id) {
      setRestoring(false);
      return;
    }
    try {
      const target = await fetchScene(c.scene_id);
      if (isExpeditionSceneName(target.name)) return;
      stepMusicRef.current = null;
      playMusic(target.music_url, true);
      setScene(target);
    } catch (e) {
      console.error("restore scene failed", e);
    } finally {
      setRestoring(false);
    }
  };

  // Après une expédition : si le personnage est tombé, écran de mort puis nouveau dessin.
  const checkDeathNow = async () => {
    if (!character) return;
    try {
      const d = await fetchMyDeath(character.id);
      if (d.dead && !d.inExpedition) setDeadInfo({ name: character.name, cause: d.cause, summary: d.summary });
    } catch (e) {
      console.error("Death check failed", e);
    }
  };

  const refreshMyPet = async () => {
    try {
      const list = await fetchMyCompanions();
      const c = list.find((x) => x.active && x.hp > 0 && x.rest_left === 0 && x.loot_expedition_id === null);
      const url = c?.image_url ?? null;
      if (url !== myPetRef.current) {
        myPetRef.current = url;
        setMyPet(url);
        trackPresence(lastLogicalPosRef.current, 0, false);
      }
    } catch {
      /* ferme non activée : pas de compagnon */
    }
  };
  useEffect(() => {
    if (!character) return;
    void refreshMyPet();
    const h = () => void refreshMyPet();
    window.addEventListener("obliq-companion-changed", h);
    return () => window.removeEventListener("obliq-companion-changed", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id, scene.id, activeExpedition?.status]);

  // Le t'chat redescend tout seul à chaque nouveau message, et quand on revient sur l'onglet.
  const scrollChatDown = () => {
    const el = chatLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => {
    scrollChatDown();
    const t = window.setTimeout(scrollChatDown, 60);
    return () => window.clearTimeout(t);
  }, [chatLog, character?.id]);
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === "visible") window.setTimeout(scrollChatDown, 30);
    };
    document.addEventListener("visibilitychange", h);
    window.addEventListener("focus", h);
    return () => {
      document.removeEventListener("visibilitychange", h);
      window.removeEventListener("focus", h);
    };
  }, []);

  // Message d'accueil : une seule fois par navigateur, dès qu'on a un personnage.
  useEffect(() => {
    if (!character) return;
    try {
      if (!localStorage.getItem("obliqworld-welcome-v1")) setWelcomeOpen(true);
    } catch {
      /* stockage indisponible : pas de message */
    }
  }, [character?.id]);

  const handleNewCharacterAfterDeath = async () => {
    setDeadBusy(true);
    setDeadError(null);
    try {
      await archiveDeadCharacter();
      setCharacter(null);
      characterRef.current = null;
      setDeadInfo(null);
      setCharacterAssets(await fetchCharacterAssets());
    } catch (e) {
      console.error("Archive dead character failed", e);
      setDeadError("Impossible de préparer un nouveau personnage. Réessaie dans un instant.");
    } finally {
      setDeadBusy(false);
    }
  };

  const handleCharacterChosen = async (visualAssetId: string, name: string, family: CharacterFamily) => {
    setCharacterError(null);
    setCreatingCharacter(true);
    try {
      const c = await createCharacterWithAsset(scene.id, visualAssetId, name);
      // Famille définitive + PV de départ. Si ça échoue le perso existe déjà :
      // on le laisse jouer (sans famille) plutôt que de bloquer la connexion.
      try {
        await createCharacterBuild(c.id, family);
      } catch (buildError) {
        console.error("Character build creation failed", buildError);
      }
      setCharacter(c);
      characterRef.current = c;
      setPos(c.position);
      lastLogicalPosRef.current = c.position;
    } catch (e) {
      console.error("Character creation failed", e);
      setCharacterError("La création du personnage a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setCreatingCharacter(false);
    }
  };

  useEffect(() => () => {
    if (walkTimer.current) window.clearTimeout(walkTimer.current);
    Object.values(peerWalkTimers.current).forEach((t) => window.clearTimeout(t));
    Object.values(bubbleTimers.current).forEach((t) => window.clearTimeout(t));
  }, []);

  // ---------- Groupe (party) : chargement du groupe actif + abonnements temps
  // réel (§5, revu le 2026-10-14) ----------
  const refreshParty = async (partyId: string) => {
    try {
      const members = await fetchPartyMembers(partyId);
      setPartyMembers(members);
      // Le groupe peut avoir été dissous entre-temps (tout le monde parti) —
      // on ne garde l'affichage que s'il reste au moins un membre joined/invited.
      if (members.every((m) => m.status === "left")) {
        setParty(null);
        setPartyMembers([]);
      }
    } catch (e) {
      console.error("refreshParty failed", e);
    }
  };

  useEffect(() => {
    if (!character) return;
    let cancelled = false;

    void publishDisplayName();
    ensureSessionCleanup()
      .then(() => fetchMyActiveParty(character.id))
      .then((result) => {
        if (cancelled || !result) return;
        setParty(result.party);
        setPartyMembers(result.members);
        if (partyChannelRef.current) leaveScenePresence(partyChannelRef.current);
        partyChannelRef.current = subscribeToPartyChanges(result.party.id, () => refreshParty(result.party.id));
      })
      .catch((e) => console.error("fetchMyActiveParty failed", e));

    // Invitations reçues alors qu'on n'a pas (encore) de groupe actif connu
    // côté UI — déclenche aussi quand on en a déjà un, pour le cas où on
    // reçoit une invitation à un AUTRE groupe pendant qu'on est déjà dans le
    // sien (affichée, à accepter manuellement — ça quittera l'ancien).
    inviteChannelRef.current = subscribeToIncomingInvites(character.id, async (partyId) => {
      try {
        const members = await fetchPartyMembers(partyId);
        const inviter = members.find((m) => m.character_id !== character.id) ?? members[0];
        setPendingInvite({ partyId, inviterName: inviter?.name ?? "Quelqu'un" });
      } catch (e) {
        console.error("Loading invite details failed", e);
      }
    });

    return () => {
      cancelled = true;
      if (partyChannelRef.current) leaveScenePresence(partyChannelRef.current);
      if (inviteChannelRef.current) leaveScenePresence(inviteChannelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id]);

  // --- Échange entre joueurs (SQL 066) ---
  const [trade, setTrade] = useState<TradeState | null>(null);
  const tradeIdRef = useRef<string | null>(null);
  const refreshTrade = async () => {
    try {
      const st = await fetchTradeState(tradeIdRef.current);
      if (!st) { tradeIdRef.current = null; setTrade(null); return; }
      tradeIdRef.current = st.trade.id;
      setTrade(st);
    } catch { /* ignoré */ }
  };
  useEffect(() => {
    const uid = authIdentity?.userId;
    if (!uid || !character?.id) return;
    void refreshTrade();
    const ch = subscribeToTrades(uid, () => { void refreshTrade(); });
    return () => { void leaveScenePresence(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authIdentity?.userId, character?.id]);
  const closeTrade = () => { tradeIdRef.current = null; setTrade(null); };
  const handleTradeWith = async (targetCharacterId: string) => {
    try {
      const id = await tradeRequest(targetCharacterId);
      tradeIdRef.current = id;
      await refreshTrade();
    } catch (e: any) {
      window.alert(e?.message ?? "Échange impossible");
    }
  };

  const handleInvitePeer = async (targetCharacterId: string) => {
    if (!character) return;
    try {
      if (party) {
        await inviteToParty(party.id, targetCharacterId);
      } else {
        const newParty = await createPartyAndInvite(character.id, targetCharacterId);
        setParty(newParty);
        const members = await fetchPartyMembers(newParty.id);
        setPartyMembers(members);
        if (partyChannelRef.current) leaveScenePresence(partyChannelRef.current);
        partyChannelRef.current = subscribeToPartyChanges(newParty.id, () => refreshParty(newParty.id));
      }
    } catch (e) {
      console.error("Invite failed", e);
      window.alert("Impossible d'inviter ce joueur (peut-être déjà dans un groupe ailleurs).");
    }
  };

  const handleAcceptInvite = async () => {
    if (!character || !pendingInvite) return;
    const { partyId } = pendingInvite;
    setPendingInvite(null);
    try {
      // Si on avait déjà un groupe (improbable mais possible), on le quitte
      // d'abord — on ne peut être membre actif que d'un seul groupe à la fois.
      if (party && party.id !== partyId) await leaveParty(party.id, character.id);
      await acceptPartyInvite(partyId, character.id);
      const [partyRow, members] = await Promise.all([
        scenesClient.from("parties").select("*").eq("id", partyId).single(),
        fetchPartyMembers(partyId),
      ]);
      if (partyRow.data) setParty(partyRow.data as Party);
      setPartyMembers(members);
      if (partyChannelRef.current) leaveScenePresence(partyChannelRef.current);
      partyChannelRef.current = subscribeToPartyChanges(partyId, () => refreshParty(partyId));
    } catch (e) {
      console.error("Accept invite failed", e);
    }
  };

  const handleDeclineInvite = async () => {
    if (!character || !pendingInvite) return;
    const { partyId } = pendingInvite;
    setPendingInvite(null);
    try {
      await declinePartyInvite(partyId, character.id);
    } catch (e) {
      console.error("Decline invite failed", e);
    }
  };

  const handleLeaveParty = async () => {
    if (!character || !party) return;
    try {
      await leaveParty(party.id, character.id);
      setParty(null);
      setPartyMembers([]);
      if (partyChannelRef.current) leaveScenePresence(partyChannelRef.current);
    } catch (e) {
      console.error("Leave party failed", e);
    }
  };

  const handleKickFromParty = async (targetCharacterId: string) => {
    if (!party) return;
    try {
      await kickFromParty(party.id, targetCharacterId);
    } catch (e) {
      console.error("Kick failed", e);
    }
  };

  // ---------- Portail d'expédition : cliquer = se déclarer prêt (§5, revu le
  // 2026-10-14). L'expédition ne part que lorsque TOUS les membres joined du
  // groupe sont prêts. ----------
  const joinedMemberIds = partyMembers.filter((m) => m.status === "joined").map((m) => m.character_id);
  const groupIds = party ? joinedMemberIds : character ? [character.id] : [];
  const readyIds = new Set(
    expeditionParticipants.filter((p) => p.entered_portal_at && !p.left_expedition_at).map((p) => p.character_id),
  );
  const readyCount = groupIds.filter((id) => readyIds.has(id)).length;
  const selfReady = !!character && readyIds.has(character.id);
  const expeditionLaunched = openExpedition?.status === "active";

  const refreshExpedition = async (expeditionId: string) => {
    try {
      const [parts, expRow] = await Promise.all([
        fetchExpeditionParticipants(expeditionId),
        scenesClient.from("expeditions").select("*").eq("id", expeditionId).single(),
      ]);
      setExpeditionParticipants(parts);
      if (expRow.data) setOpenExpedition(expRow.data as Expedition);
    } catch (e) {
      console.error("refreshExpedition failed", e);
    }
  };

  const watchExpedition = (expeditionId: string) => {
    if (expeditionChannelRef.current) leaveScenePresence(expeditionChannelRef.current);
    expeditionChannelRef.current = subscribeToExpeditionChanges(expeditionId, () => refreshExpedition(expeditionId));
    void refreshExpedition(expeditionId);
  };

  // Quelqu'un du groupe a déjà cliqué avant nous (ou on revient sur la scène) :
  // on rejoint l'expédition en attente au lieu d'attendre notre propre clic.
  // Contrôle unique au montage, puis écoute Realtime des nouvelles expéditions
  // du groupe (aucun polling : le jeu doit rester gratuit).
  useEffect(() => {
    if (scenePortals.length === 0 || !party || openExpedition) return;
    let cancelled = false;
    const check = () =>
      fetchOpenExpeditionForParty(party.id, scene.id)
        .then((exp) => {
          if (!cancelled && exp) {
            setOpenExpedition(exp);
            watchExpedition(exp.id);
          }
        })
        .catch((e) => console.error("fetchOpenExpeditionForParty failed", e));
    void check();
    const channel = scenesClient
      .channel(`party-expeditions:${party.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "expeditions", filter: `party_id=eq.${party.id}` },
        () => void check(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      leaveScenePresence(channel as unknown as PresenceChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenePortals.map((p) => p.id).join(","), party?.id, scene.id, openExpedition?.id]);

  // Tout le groupe est prêt -> on tente de lancer. Tous les clients du groupe
  // exécutent ceci en même temps ; startExpedition est conditionné sur
  // status='lobby', donc un seul appel a un effet.
  useEffect(() => {
    if (!openExpedition || openExpedition.status !== "lobby") return;
    if (groupIds.length === 0 || readyCount < groupIds.length) return;
    startExpedition(openExpedition.id)
      .then(() => refreshExpedition(openExpedition.id))
      .catch((e) => console.error("startExpedition failed", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyCount, groupIds.length, openExpedition?.id, openExpedition?.status]);

  useEffect(() => {
    if (!scenePortals.some((p) => p.route === "long")) return;
    let off = false;
    scenesClient
      .from("game_settings")
      .select("value")
      .eq("key", "long_expedition_min_level")
      .maybeSingle()
      .then(({ data }) => {
        if (!off && data && typeof data.value === "number") setLongMinLevel(data.value);
        else if (!off && data) setLongMinLevel(Number(data.value) || 5);
      });
    return () => {
      off = true;
    };
  }, [scenePortals.map((p) => p.route).join(",")]);

  const handleTogglePortal = async (portal: ExpeditionPortal) => {
    if (!character || expeditionLaunched) return;
    try {
      if (selfReady && openExpedition && (openExpedition.route ?? "court") === portal.route) {
        await leaveExpeditionPortal(openExpedition.id, character.id);
        await refreshExpedition(openExpedition.id);
        return;
      }

      let activeParty = party;
      if (!activeParty) {
        const ok = window.confirm(
          "Une expédition en solo est très dangereuse : attention, vous aventurer ici sans groupe risque de mal finir. Continuer quand même ?",
        );
        if (!ok) return;
        activeParty = await createSoloParty(character.id);
        setParty(activeParty);
        setPartyMembers(await fetchPartyMembers(activeParty.id));
        if (partyChannelRef.current) leaveScenePresence(partyChannelRef.current);
        const newPartyId = activeParty.id;
        partyChannelRef.current = subscribeToPartyChanges(newPartyId, () => refreshParty(newPartyId));
      }

      const exp = await enterExpeditionPortal(
        character.id,
        activeParty.id,
        activeParty.created_by_character_id,
        scene.id,
        portal.route,
      );
      setOpenExpedition(exp);
      watchExpedition(exp.id);
    } catch (e) {
      console.error("Portal toggle failed", e);
      const m = String((e as { message?: string })?.message ?? "");
      window.alert(
        m.includes("niveau") || m.includes("autre portail")
          ? m
          : "Impossible d'entrer dans le portail pour l'instant. Réessaie dans un instant.",
      );
    }
  };

  // ---------- Tchat propre à chaque scène : on vide le log affiché quand on
  // change de scène (le canal réseau était déjà séparé par scène, mais le
  // log local gardait les anciens messages affichés par-dessus) ----------
  // Le log de chaque scène est gardé en mémoire (et dans sessionStorage) : en quittant puis en revenant dans une scène
  // (l'auberge par exemple), on retrouve les messages déjà reçus. Les messages envoyés PENDANT qu'on était parti ne sont pas rattrapés.
  const chatSceneRef = useRef<string | null>(null);
  useEffect(() => {
    // (déclaré AVANT l'effet de changement de scène : au changement, la référence n'a pas encore bougé, donc on n'écrase rien)
    if (chatSceneRef.current !== scene.id || isExpeditionSceneName(scene.name)) return; // le tchat d'une expédition ne se garde pas
    chatCache.set(scene.id, chatLog);
    try {
      sessionStorage.setItem(`obliqworld-chat-${scene.id}`, JSON.stringify(chatLog.slice(-CHAT_LOG_SIZE)));
    } catch {
      /* ignoré */
    }
  }, [chatLog, scene.id]);
  useEffect(() => {
    let restored: ChatMessage[] = isExpeditionSceneName(scene.name) ? [] : (chatCache.get(scene.id) ?? []);
    if (restored.length === 0 && !isExpeditionSceneName(scene.name)) {
      try {
        const raw = sessionStorage.getItem(`obliqworld-chat-${scene.id}`);
        if (raw) restored = JSON.parse(raw) as ChatMessage[];
      } catch {
        /* ignoré */
      }
    }
    chatSceneRef.current = scene.id;
    setChatLog(expireChat(restored));
    setChatInput("");
  }, [scene.id]);

  // L'historique vient de la base (50 derniers messages du lieu + ceux du groupe) : on le fusionne à ce qui est déjà affiché.
  useEffect(() => {
    if (!character) return;
    let cancelled = false;
    const sid = scene.id;
    // En expédition : seulement ce qui s'est dit depuis le début de CETTE expédition.
    const inExp = isExpeditionSceneName(scene.name);
    if (inExp && !activeExpedition) return;
    void fetchChatHistory(sid, party?.id ?? null, CHAT_LOG_SIZE, inExp ? (activeExpedition?.started_at ?? activeExpedition?.created_at ?? null) : null)
      .then((h) => { if (!cancelled && chatSceneRef.current === sid) setChatLog((cur) => expireChat(mergeChat(h, cur))); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, party?.id, character?.id, activeExpedition?.id]);

  // Canal du groupe : suit le groupe partout (même en expédition).
  useEffect(() => {
    if (!party?.id) {
      setChatChannel((c) => (c === "group" ? "say" : c));
      return;
    }
    const myId = character?.id;
    const ch = joinGroupChat(party.id, (m) => {
      if (m.characterId === myId) return;
      setChatLog((log) => [...log.slice(-(CHAT_LOG_SIZE - 1)), m]);
      bumpChatActivity();
    });
    groupChatRef.current = ch;
    return () => { if (groupChatRef.current === ch) groupChatRef.current = null; leaveScenePresence(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party?.id, character?.id]);

  // Joueurs croisés → « Vus aujourd'hui » (une fois chacun par session ; petit délai pour grouper).
  useEffect(() => {
    const fresh = Object.values(peers).map((p) => p.characterId).filter((id) => id && !seenPeersRef.current.has(id));
    if (fresh.length === 0) return;
    const t = window.setTimeout(() => {
      fresh.forEach((id) => seenPeersRef.current.add(id));
      void touchSeenPeers(fresh).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(t);
  }, [peers]);

  // « Vus aujourd'hui » : on note ma présence à la connexion, à chaque changement de lieu et au retour sur l'onglet (pas de polling).
  useEffect(() => {
    if (!character?.id) return;
    const cid = character.id;
    void touchSeen(cid).catch(() => {});
    const onVis = () => { if (document.visibilityState === "visible") void touchSeen(cid).catch(() => {}); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [character?.id, scene.id]);

  // Rappel à la connexion : un rendez-vous de groupe (le mien ou celui où je suis inscrit) approche.
  useEffect(() => {
    if (!character?.id) return;
    let cancelled = false;
    void fetchAdReminders()
      .then((rs) => {
        if (cancelled || rs.length === 0) return;
        setChatLog((log) => [
          ...log,
          ...rs.map((r) => ({
            characterId: "system", name: "Tchat", ts: Date.now(),
            text: `📋 Rendez-vous ${meetLabel(r.meet_at)} : « ${r.text} »${r.mine ? " (ton annonce)" : ` (par ${r.author_name})`}`,
          })),
        ]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [character?.id]);

  // ---------- Sorties de la scène courante ----------
  useEffect(() => {
    let cancelled = false;
    fetchSceneExits(scene.id)
      .then((e) => {
        if (!cancelled) setExits(e);
      })
      .catch((e) => console.error("Exits fetch failed", e));
    return () => {
      cancelled = true;
    };
  }, [scene.id]);

  // ---------- Portail d'expédition de la scène courante (§5, revu le
  // 2026-10-14) — au plus un par scène pour l'instant. Réinitialise l'état
  // d'expédition ouverte en changeant de scène : rejoindre le portail d'une
  // AUTRE scène recommence proprement. ----------
  useEffect(() => {
    let cancelled = false;
    setOpenExpedition(null);
    setExpeditionParticipants([]);
    if (expeditionChannelRef.current) {
      leaveScenePresence(expeditionChannelRef.current);
      expeditionChannelRef.current = null;
    }
    fetchScenePortals(scene.id)
      .then((p) => {
        if (!cancelled) setScenePortals(p);
      })
      .catch((e) => console.error("Scene portal fetch failed", e));
    setHotspots([]);
    setOpenHotspot(null);
    setHotspotsLoaded(false);
    fetchSceneHotspots(scene.id)
      .then((h) => {
        if (!cancelled) setHotspots(h);
      })
      .catch((e) => console.error("Scene hotspots fetch failed", e))
      .finally(() => {
        if (!cancelled) setHotspotsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scene.id]);

  // ---------- Scène « expédition » : téléportation du groupe au lancement ----------
  const inExpeditionScene = isExpeditionSceneName(scene.name);

  // Étape « affichée » : dès que le serveur avance current_step_index, le résultat de l'étape précédente n'est pas
  // encore chargé (quelques centaines de ms). Pendant ce temps on garde l'ancien index pour le décor (miroir) et la
  // musique : sinon l'image se retournait et la musique de l'étape suivante démarrait AVANT le « OK » de tout le monde.
  const [hold, setHold] = useState<{ exp: string; settled: number }>({ exp: "", settled: -1 });
  const stepIndex = activeExpedition?.current_step_index ?? 0;
  const holdExp = activeExpedition?.id ?? "";
  if (hold.exp !== holdExp) setHold({ exp: holdExp, settled: stepIndex });
  const heldIdx = hold.exp === holdExp ? Math.min(hold.settled, stepIndex) : stepIndex;
  const settleHold = (i: number) => setHold((h) => (h.settled >= i ? h : { ...h, settled: i }));
  const asyncDoneRef = useRef<number>(-1);

  // Musique par type d'étape (SQL 050) : narratif / combat / danger / boss ; vide = musique de la scène.
  // Si deux étapes de même type s'enchaînent, le choix ne change pas : la musique continue sans redémarrer.
  useEffect(() => {
    if (!inExpeditionScene) return;
    // Pendant l'affichage du résultat de l'étape précédente, l'étape suivante est déjà connue du
    // serveur : on ne change PAS la musique avant le « OK » de tout le monde.
    if (outcomeInfo && stepMusicRef.current !== null) return;
    if (heldIdx < stepIndex) return;   // résultat de l'étape précédente pas encore affiché : on ne touche à rien
    const ev = eventForStep(activeExpedition?.route, activeExpedition?.current_step_index ?? 0, activeExpedition?.id);
    const isBoss = ev.id === "boss-final" || ev.id === "mini-boss";
    const inCombat = !outcomeInfo && (!!activeCombatId || ev.kind === "combat");
    const danger = !outcomeInfo && ((runStep as any)?.step_type === "danger_imminent" || (runStep as any)?.step_type === "epreuve");
    const kind = !activeExpedition ? null : inCombat ? (isBoss ? "boss" : "combat") : danger ? "danger" : "narrative";
    const spec = (kind ? (scene as any)[`music_${kind}`] : "") || scene.music_url;
    if (spec === stepMusicRef.current) return;
    stepMusicRef.current = spec;
    playMusic(spec, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inExpeditionScene, scene.id, activeExpedition?.id, activeExpedition?.current_step_index, activeCombatId, !!outcomeInfo, heldIdx, (runStep as any)?.step_type, scene.music_url, (scene as any).music_narrative, (scene as any).music_combat, (scene as any).music_danger, (scene as any).music_boss]);

  // Lancement détecté (statut 'active') : on mémorise l'expédition.
  useEffect(() => {
    if (openExpedition?.status === "active") setActiveExpedition(openExpedition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openExpedition?.id, openExpedition?.status]);

  // Page (re)chargée pendant une expédition déjà lancée : on la retrouve.
  useEffect(() => {
    if (!party) return;
    let cancelled = false;
    fetchActiveExpeditionForParty(party.id)
      .then((exp) => {
        if (!cancelled && exp) setActiveExpedition(exp);
      })
      .catch((e) => console.error("fetchActiveExpeditionForParty failed", e));
    return () => {
      cancelled = true;
    };
  }, [party?.id]);

  // Chaque client téléporte SON personnage (pas d'écriture sur les autres).
  useEffect(() => {
    if (!character || !activeExpedition || activeExpedition.status !== "active" || inExpeditionScene || teleportingRef.current) return;
    teleportingRef.current = true;
    fetchExpeditionScene()
      .then(async (expScene) => {
        if (!expScene) {
          setExpeditionSceneMissing(true);
          return;
        }
        setExpeditionSceneMissing(false);
        await teleportToScene(expScene, { x: 50, y: 70 });
      })
      .catch((e) => console.error("Teleport to expedition scene failed", e))
      .finally(() => {
        teleportingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExpedition?.id, inExpeditionScene, character?.id]);

  // Étape narrative (rencontre écrite) si une rencontre approuvée existe, sinon ancienne étape d'exemple.
  const syncStep = async (expId: string, idx: number, ev: (typeof PLACEHOLDER_EVENTS)[number]) => {
    if (ev.kind === "event" && ev.id !== "camp") {
      try {
        const ns = await openNarrativeStep(expId, idx);
        if (ns && ns.community_event_id) {
          const ne = await fetchNarrativeEvent(ns.community_event_id);
          if (ne) return { step: ns as ExpeditionStep, narrative: ne };
        }
      } catch (e) {
        console.error("Narrative step failed, fallback to legacy", e);
      }
    }
    const step = await ensureExpeditionStep(expId, idx, ev.kind, ev.situation);
    return { step, narrative: null as NarrativeEvent | null };
  };

  const currentEvent = eventForStep(activeExpedition?.route, stepIndex, activeExpedition?.id);
  const expeditionPhase = currentEvent.kind;
  // Ceux qui doivent voter : les membres vivants et encore dans l'expédition (un mort qui regarde n'est pas attendu).
  const participantCount = Math.max(
    1,
    party
      ? partyMembers.filter((m) => {
          if (m.status !== "joined") return false;
          const st = runStats.find((r) => r.character_id === m.character_id);
          return !st || ((st.pv_current ?? 1) > 0 && !st.left_expedition_at);
        }).length
      : 1,
  );
  const [voteTick, setVoteTick] = useState(0); // +1 quand MON vote est bien enregistré côté serveur (relance la résolution)
  const myVote = character ? (stepVotes.find((v) => v.character_id === character.id)?.choice_key ?? null) : null;

  // Étape courante : on la crée/retrouve, on lit les votes puis on écoute en
  // direct (changement d'étape, de statut et votes). Aucun polling.
  useEffect(() => {
    if (!inExpeditionScene || !character || !activeExpedition || activeExpedition.status !== "active") return;
    const expId = activeExpedition.id;
    const idx = activeExpedition.current_step_index;
    const ev = eventForStep(activeExpedition.route, idx, activeExpedition.id);
    let cancelled = false;
    let channel: PresenceChannel | null = null;
    setRunStep(null);
    setNarrativeEvent(null);
    setStepVotes([]);
    (async () => {
      try {
        const { step, narrative } = await syncStep(expId, idx, ev);
        if (cancelled) return;
        setNarrativeEvent(narrative);
        setRunStep(step);
        const reloadVotes = async () => {
          const v = await fetchStepVotes(step.id);
          if (!cancelled) setStepVotes(v);
        };
        const refreshExpedition = async () => {
          const e = await fetchExpeditionById(expId);
          if (!cancelled && e) setActiveExpedition(e);
        };
        await reloadVotes();
        channel = subscribeToExpeditionRun(expId, step.id, refreshExpedition, reloadVotes);
      } catch (e) {
        console.error("Expedition step sync failed", e);
      }
    })();
    return () => {
      cancelled = true;
      if (channel) leaveScenePresence(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExpedition?.id, activeExpedition?.current_step_index, activeExpedition?.status, inExpeditionScene, character?.id]);

  // Résolution : dès que tout le monde a voté, ou à la fin du délai (les
  // absents restent passifs). Le serveur ne résout qu'une fois, sous verrou.
  useEffect(() => {
    if (!runStep || runStep.resolved || !activeExpedition) return;
    const expId = activeExpedition.id;
    const stepId = runStep.id;
    const deadline = runStep.vote_deadline ? new Date(runStep.vote_deadline).getTime() : null;
    let cancelled = false;
    let retryTimer: number | undefined;
    const tryResolve = async (attempt: number) => {
      try {
        const res = await resolveExpeditionStep(stepId);
        if (cancelled) return;
        if (res) {
          const e = await fetchExpeditionById(expId);
          if (!cancelled && e) setActiveExpedition(e);
        } else if (deadline !== null && Date.now() >= deadline && attempt < 3) {
          // Horloge légèrement en avance sur celle du serveur : on réessaie.
          retryTimer = window.setTimeout(() => void tryResolve(attempt + 1), 2000);
        }
      } catch (e) {
        console.error("Resolve step failed", e);
      }
    };
    if (stepVotes.length >= participantCount) void tryResolve(0);
    let timer: number | undefined;
    if (deadline !== null) timer = window.setTimeout(() => void tryResolve(0), Math.max(0, deadline - Date.now()) + 300);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [runStep?.id, stepVotes.length, participantCount, voteTick]);

  // Fin d'expédition (vote « Rentrer maintenant » gagnant) : retour à l'auberge.
  useEffect(() => {
    if (!activeExpedition || activeExpedition.status === "active") return;
    // Un combat est encore affiché (rejeu du dernier tour, résultat) : on attend qu'il soit fermé.
    if (activeCombatId) return;
    const wasInside = inExpeditionScene;
    const endStatus = activeExpedition.status;
    if (wasInside) {
      // Musique + son de fin : échec (groupe tombé) ou réussite (retour à l'auberge).
      if (endStatus === "completed_wipe") {
        uiSound("fail");
        startJingle(JINGLE_FAIL[Math.floor(Math.random() * JINGLE_FAIL.length)]!);
      } else {
        uiSound("success");
        startJingle(JINGLE_SUCCESS);
      }
      setEndBanner(
        endStatus === "completed_wipe"
          ? { title: "L'expédition est terminée", text: "Le groupe est tombé. Vous revenez à l'auberge." }
          : { title: "L'expédition est terminée", text: "Le groupe rentre à l'auberge avec ce qu'il a trouvé." },
      );
    }
    setActiveCombatId(null);
    setOutcomeInfo(null);
    setActiveExpedition(null);
    setRunStep(null);
    setStepVotes([]);
    if (!wasInside) return;
    (async () => {
      try {
        const home = await fetchSceneByName("auberge");
        await teleportToScene(home, { x: 50, y: 70 });
      } catch (e) {
        console.error("Return home failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExpedition?.status, activeCombatId]);

  const handleExpeditionVote = async (choiceKey: string) => {
    if (!character || !runStep || runStep.resolved || choiceKey === myVote) return;
    const stepId = runStep.id;
    setStepVotes((prev) => [
      ...prev.filter((v) => v.character_id !== character.id),
      { character_id: character.id, choice_key: choiceKey },
    ]);
    try {
      await castStepVote(stepId, character.id, choiceKey);
      setVoteTick((n) => n + 1);
    } catch (e) {
      console.error("Cast vote failed", e);
      try {
        setStepVotes(await fetchStepVotes(stepId));
      } catch {
        /* ignoré : le prochain événement Realtime resynchronisera */
      }
    }
  };

  // Compagnons actifs du groupe : rechargés à chaque nouvelle étape / fin de combat (pas de polling).
  const groupKey = groupIds.join(",");
  useEffect(() => {
    if (!inExpeditionScene || !groupKey) {
      setPartyCompanions({});
      return;
    }
    let cancelled = false;
    void fetchPartyCompanions(groupKey.split(",")).then((m) => { if (!cancelled) setPartyCompanions(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [inExpeditionScene, groupKey, stepIndex, activeCombatId, outcomeInfo]);

  const statOf = (id: string) => runStats.find((r) => r.character_id === id);
  const combatAllies: CombatAlly[] = character
    ? (party ? partyMembers.filter((m) => m.status === "joined") : []).length > 0
      ? partyMembers
          .filter((m) => m.status === "joined")
          .map((m) => {
            const st = statOf(m.character_id);
            return {
              characterId: m.character_id,
              name: m.name,
              imageUrl: m.image_url,
              hpCurrent: st?.pv_current ?? m.pv_current ?? 20,
              hpMax: st?.pv_max ?? m.pv_max ?? 20,
              pmCurrent: st?.pm_current ?? null,
              pmMax: st?.pm_max ?? null,
              isSelf: m.character_id === character.id,
              companion: partyCompanions[m.character_id] ?? null,
            };
          })
      : [
          {
            characterId: character.id,
            name: character.name,
            imageUrl: character.image_url,
            hpCurrent: statOf(character.id)?.pv_current ?? 20,
            hpMax: statOf(character.id)?.pv_max ?? 20,
            pmCurrent: statOf(character.id)?.pm_current ?? null,
            pmMax: statOf(character.id)?.pm_max ?? null,
            isSelf: true,
            companion: partyCompanions[character.id] ?? null,
          },
        ]
    : [];
  const demoEvent: ExpeditionEvent = {
    typeLabel: currentEvent.typeLabel,
    risk: currentEvent.risk,
    situation: currentEvent.situation,
    voterCount: participantCount,
    choices: currentEvent.choices.map((c) => ({
      ...c,
      votes: stepVotes.filter((v) => v.choice_key === c.key).length,
    })),
  };
  // PV / PM réels du groupe (table expedition_participants), en direct.
  useEffect(() => {
    if (!inExpeditionScene || !activeExpedition || activeExpedition.status !== "active") return;
    const expId = activeExpedition.id;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetchRunStats(expId);
        if (!cancelled) setRunStats(r);
      } catch (e) {
        console.error("fetchRunStats failed", e);
      }
    };
    void load();
    const ch = subscribeToRunStats(expId, () => void load());
    return () => {
      cancelled = true;
      leaveScenePresence(ch);
    };
  }, [activeExpedition?.id, activeExpedition?.status, inExpeditionScene]);

  // Entrée dans une étape : résultat de l'étape précédente (texte, PV), et
  // démarrage d'un vrai combat si l'étape en est un ou si l'issue l'a déclenché.
  useEffect(() => {
    if (!inExpeditionScene || !character || !activeExpedition || activeExpedition.status !== "active") return;
    const expId = activeExpedition.id;
    const idx = activeExpedition.current_step_index;
    const ev = eventForStep(activeExpedition.route, idx, activeExpedition.id);
    let cancelled = false;
    let outcomeShown = false;
    (async () => {
      try {
        setCombatError(null);
        let latest = await fetchLatestCombat(expId);
        if (cancelled) return;
        if (latest?.status === "active") {
          setActiveCombatId(latest.id);
          return;
        }
        if (idx > 0) {
          const prev = await fetchStepOutcome(expId, idx - 1);
          if (cancelled) return;
          if (prev?.outcome_text) {
            const nd = prev.outcome_data;
            const isNarr = !!prev.step_type && prev.step_type !== "legacy" && !!prev.id;
            const nameMap: Record<string, string> = Object.fromEntries(partyMembers.map((m) => [m.character_id, m.name]));
            if (character) nameMap[character.id] = nameMap[character.id] ?? character.name;
            outcomeShown = true;
            setOutcomeInfo({
              stepIndex: idx - 1,
              narrative: isNarr
                ? {
                    stepId: prev.id as string,
                    success: prev.step_outcome === "success",
                    hits: (nd?.hit ?? []).map((h) => ({ name: nameMap[h.c] ?? "Un équipier", lost: h.n })),
                    potion: !!nd?.potion,
                  }
                : undefined,
              text: prev.outcome_text,
              pvLossPct: prev.outcome_pv_loss_pct ?? 0,
              reward: prev.outcome_reward,
              triggersCombat: prev.outcome_triggers_combat,
              xp: prev.outcome_xp ?? 0,
            });
          }
          // Combat déclenché par l'issue : seulement s'il n'a pas déjà eu lieu depuis.
          if (
            prev?.outcome_triggers_combat &&
            prev.resolved_at &&
            (!latest || new Date(latest.created_at).getTime() < new Date(prev.resolved_at).getTime() - 1000)
          ) {
            const c = await startCombat(expId, false);
            if (!cancelled) setActiveCombatId(c.id);
            return;
          }
        }
        if (ev.kind === "combat") {
          const c = await startCombat(expId, ev.id === "boss-final", ev.id === "mini-boss");
          if (!cancelled) setActiveCombatId(c.id);
        }
        void latest;
        latest = null;
      } catch (e) {
        console.error("combat start failed", e);
        if (!cancelled) setCombatError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      } finally {
        // Le chargement de cette étape est terminé : sans résultat à afficher, on passe à l'étape tout de suite.
        if (!cancelled) {
          asyncDoneRef.current = idx;
          if (!outcomeShown) settleHold(idx);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExpedition?.id, activeExpedition?.current_step_index, activeExpedition?.status, inExpeditionScene, character?.id]);

  // Le résultat a été fermé (tout le monde est passé) : l'étape suivante peut s'afficher.
  useEffect(() => {
    if (!outcomeInfo && asyncDoneRef.current === stepIndex) settleHold(stepIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!outcomeInfo, stepIndex]);
  // Filet de sécurité : si le chargement traîne, on n'attend pas plus de 10 s.
  useEffect(() => {
    if (heldIdx >= stepIndex) return;
    const t = window.setTimeout(() => settleHold(stepIndex), 10000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldIdx, stepIndex]);

  // Le résultat reste affiché jusqu'au « OK ». Chacun fait « OK » à son rythme : son personnage traverse
  // l'écran vers la droite, et les autres joueurs le VOIENT traverser (message en direct, sans base de
  // données). Le décor, la musique et l'étape suivante ne changent qu'une fois que tout le monde est passé.
  const [acks, setAcks] = useState<Record<number, string[]>>({});
  const ackChannelRef = useRef<PresenceChannel | null>(null);
  const addAck = (idx: number, cid: string) =>
    setAcks((prev) => ((prev[idx] ?? []).includes(cid) ? prev : { ...prev, [idx]: [...(prev[idx] ?? []), cid] }));
  useEffect(() => {
    if (!inExpeditionScene || !activeExpedition || activeExpedition.status !== "active") return;
    const ch = scenesClient
      .channel(`expedition-ack:${activeExpedition.id}`)
      .on("broadcast", { event: "ack" }, ({ payload }) => {
        if (payload && typeof payload.idx === "number" && typeof payload.cid === "string") addAck(payload.idx, payload.cid);
      })
      .subscribe();
    ackChannelRef.current = ch;
    return () => {
      ackChannelRef.current = null;
      leaveScenePresence(ch);
    };
  }, [activeExpedition?.id, activeExpedition?.status, inExpeditionScene]);
  const outIdx = outcomeInfo ? outcomeInfo.stepIndex : null;
  const leavingIds = outIdx !== null ? (acks[outIdx] ?? []) : [];
  const iAcked = !!character && leavingIds.includes(character.id);
  // Joueurs attendus : ceux qui sont encore en vie et dans l'expédition (moi inclus).
  const requiredIds = combatAllies
    .filter((a) => a.isSelf || ((statOf(a.characterId)?.pv_current ?? 1) > 0 && !statOf(a.characterId)?.left_expedition_at))
    .map((a) => a.characterId);
  const allAcked = outIdx !== null && requiredIds.length > 0 && requiredIds.every((id) => leavingIds.includes(id));
  const closeOutcome = () => {
    if (!outcomeInfo || !character || iAcked) return;
    addAck(outcomeInfo.stepIndex, character.id);
    void ackChannelRef.current?.send({ type: "broadcast", event: "ack", payload: { idx: outcomeInfo.stepIndex, cid: character.id } });
  };
  const closeOutcomeRef = useRef(closeOutcome);
  closeOutcomeRef.current = closeOutcome;
  // Tout le monde est passé : on laisse finir la traversée (1,7 s) puis on change d'étape.
  useEffect(() => {
    if (!allAcked) return;
    const t = window.setTimeout(() => setOutcomeInfo(null), 1700);
    return () => window.clearTimeout(t);
  }, [allAcked, outIdx]);
  // Sécurités : un joueur absent ne bloque pas le groupe. 120 s sans « OK » → OK automatique ;
  // 45 s après MON « OK », on passe à la suite même si quelqu'un n'a pas répondu.
  useEffect(() => {
    if (!outcomeInfo) return;
    const t = window.setTimeout(() => closeOutcomeRef.current(), 120000);
    return () => window.clearTimeout(t);
  }, [outcomeInfo]);
  useEffect(() => {
    if (!iAcked || allAcked) return;
    const t = window.setTimeout(() => setOutcomeInfo(null), 45000);
    return () => window.clearTimeout(t);
  }, [iAcked, allAcked, outIdx]);
  const bgMirrored = (outcomeInfo ? outcomeInfo.stepIndex : heldIdx) % 2 === 1;

  // Fin d'un combat gagné : on relit l'expédition et l'étape (le serveur a pu
  // faire avancer l'étape ou redonner 180 s au prochain vote).
  const handleCombatFinished = async () => {
    setActiveCombatId(null);
    if (!activeExpedition) return;
    try {
      const e = await fetchExpeditionById(activeExpedition.id);
      if (e) setActiveExpedition(e);
      if (e && e.status === "active") {
        const ev = eventForStep(e.route, e.current_step_index, e.id);
        const { step, narrative } = await syncStep(e.id, e.current_step_index, ev);
        setNarrativeEvent(narrative);
        setRunStep(step);
        setStepVotes(await fetchStepVotes(step.id));
      }
    } catch (err) {
      console.error("after combat refresh failed", err);
    }
  };

  // Félicitations de niveau : on compare au dernier niveau « vu » (mémorisé dans ce navigateur), au retour au village.
  useEffect(() => {
    if (!character || inExpeditionScene || activeExpedition) return;
    let cancelled = false;
    (async () => {
      try {
        const b = await fetchMyBuild(character.id);
        if (cancelled || !b) return;
        const k = `obw-level-seen-${character.id}`;
        let seen = 1;
        try { seen = Number(localStorage.getItem(k) ?? "1") || 1; } catch { /* stockage indisponible */ }
        if (b.level > seen) {
          void randomLevelLine().then((l) => { if (!cancelled) setLevelLine(l); });
          setLevelInfo(null);
          void fetchLevelUpInfo(character.id, b.level).then((i) => { if (!cancelled) setLevelInfo(i); });
          setLevelUp(b.level);
          playLevelUpJingle(volumeRef.current, mutedRef.current);
        } else {
          void rememberVitals(character.id, b.level);
        }
      } catch { /* ignoré */ }
    })();
    return () => { cancelled = true; };
  }, [character?.id, inExpeditionScene, activeExpedition?.id, endBanner]);
  // En cours d'expédition : petite bannière dès qu'un combat se termine avec un nouveau niveau (l'écran complet vient au retour).
  useEffect(() => {
    if (!character || !inExpeditionScene || activeCombatId) return;
    let cancelled = false;
    void (async () => {
      try {
        const b = await fetchMyBuild(character.id);
        if (cancelled || !b) return;
        let seen = 1;
        try { seen = Number(localStorage.getItem(`obw-level-seen-${character.id}`) ?? "1") || 1; } catch { /* ignoré */ }
        if (b.level > seen && b.level > levelBannerShownRef.current) {
          levelBannerShownRef.current = b.level;
          setLevelBanner(b.level);
          playLevelUpJingle(volumeRef.current, mutedRef.current);
          window.setTimeout(() => setLevelBanner(null), 6200);
        }
      } catch { /* ignoré */ }
    })();
    return () => { cancelled = true; };
  }, [activeCombatId, inExpeditionScene, character?.id]);
  const closeLevelUp = () => {
    if (character && levelUp) {
      try { localStorage.setItem(`obw-level-seen-${character.id}`, String(levelUp)); } catch { /* ignoré */ }
      if (levelInfo) writeSnap(character.id, levelUp, levelInfo.pv, levelInfo.pm);
    }
    setLevelUp(null);
  };

  // Choix de l'axe : proposé dès qu'on est de retour hors expédition avec le niveau 3.
  useEffect(() => {
    if (!character || inExpeditionScene || activeExpedition) return;
    let cancelled = false;
    (async () => {
      try {
        const b = await fetchMyBuild(character.id);
        if (cancelled || !b || !b.axis_choice_pending) return;
        const [axes, powers] = await Promise.all([fetchGameAxes(), fetchGamePowers()]);
        if (cancelled) return;
        setAxisChoice({ axes: axes.filter((a) => a.family === b.family && a.playable !== false && !a.axis_key.startsWith("apprenti")), powers });
      } catch (e) {
        console.error("axis check failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [character?.id, inExpeditionScene, activeExpedition?.id]);

  const handleChooseAxis = async (axisKey: string) => {
    if (!character) return;
    setAxisBusy(true);
    setAxisError(null);
    try {
      await chooseAxis(character.id, axisKey);
      setAxisChoice(null);
      setRenameAxis(axisKey);
    } catch (e) {
      setAxisError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
    } finally {
      setAxisBusy(false);
    }
  };

  // ---------- Mise à jour locale des pairs (marche calculée nous-mêmes, pas confiance au réseau) ----------
  // isFullRoster=true pour un instantané complet (sync Presence, recalage
  // périodique) : un pair connu absent de newPeers a vraiment quitté. false
  // pour la position d'un seul pair reçue via Broadcast pendant une marche :
  // les autres pairs ne sont juste pas concernés par ce message précis et ne
  // doivent surtout pas être traités comme partis (sinon TOUT le monde se
  // ferait reprogrammer un retrait à chaque pas de n'importe qui).
  const handlePeerUpdate = (newPeers: Record<string, PeerState>, isFullRoster: boolean) => {
    // On ne journalise que les instantanés complets qui changent vraiment
    // (sinon chaque pas de marche, très fréquent, noierait le journal).
    if (isFullRoster) {
      const keys = Object.keys(newPeers).sort().join(",");
      if (keys !== lastLoggedPeerKeysRef.current) {
        lastLoggedPeerKeysRef.current = keys;
        logPresence(`pairs vus : ${Object.keys(newPeers).length}${keys ? ` [${keys.slice(0, 40)}]` : ""}`);
      }
    }
    // On fusionne plutôt que de remplacer : un pair en attente de retrait
    // (grâce ci-dessous) doit rester affiché même s'il n'est plus dans
    // newPeers pour l'instant.
    // La présence ne rafraîchit qu'aux arrivées : en pleine marche d'un pair,
    // elle contient encore son ancienne position et le ferait revenir en
    // arrière (allers-retours). On ne garde donc que les états plus récents
    // que le dernier reçu (horloge t de l'émetteur, comparée seulement à elle-même).
    const fresh: Record<string, PeerState> = {};
    Object.entries(newPeers).forEach(([key, peer]) => {
      const last = peerLastTRef.current[key];
      if (peer.t != null && last != null && peer.t <= last) return;
      if (peer.t != null) peerLastTRef.current[key] = peer.t;
      fresh[key] = peer;
    });
    setPeers((prev) => ({ ...prev, ...fresh }));
    const rect = sceneRef.current?.getBoundingClientRect();

    Object.entries(fresh).forEach(([key, peer]) => {
      const prev = prevPeerPosRef.current[key];
      prevPeerPosRef.current[key] = peer.position;

      if (!prev || !rect) return;
      if (prev.x === peer.position.x && prev.y === peer.position.y) return;

      const dist = distanceInPx(rect, prev, peer.position);
      if (dist < 1) return;
      // Durée choisie par l'émetteur (même vitesse pour tous, quel que soit
      // l'écran) ; calcul local seulement en secours.
      const ms = peer.duration > 0 ? peer.duration : walkDurationMs(dist);

      if (Math.abs(peer.position.x - prev.x) > 0.01) {
        setPeerFacingRight((f) => ({ ...f, [key]: peer.position.x > prev.x }));
      }

      setPeerDuration((d) => ({ ...d, [key]: ms }));
      setPeerWalking((w) => ({ ...w, [key]: true }));

      if (peerWalkTimers.current[key]) window.clearTimeout(peerWalkTimers.current[key]);
      peerWalkTimers.current[key] = window.setTimeout(() => {
        setPeerWalking((w) => ({ ...w, [key]: false }));
      }, ms + 150); // marge : le pas suivant arrive avec un peu de latence, pas de micro-arrêt
    });

    if (!isFullRoster) return; // un message Broadcast ne concerne qu'un seul pair, jamais un retrait

    Object.keys(prevPeerPosRef.current).forEach((key) => {
      if (key in newPeers) {
        // De retour avant la fin du délai de grâce : on annule le retrait prévu.
        if (peerRemoveTimers.current[key]) {
          window.clearTimeout(peerRemoveTimers.current[key]);
          delete peerRemoveTimers.current[key];
        }
        return;
      }
      if (peerRemoveTimers.current[key]) return; // retrait déjà programmé
      peerRemoveTimers.current[key] = window.setTimeout(() => {
        logPresence(`retrait définitif après délai de grâce: ${key.slice(0, 8)}…`);
        delete peerRemoveTimers.current[key];
        delete prevPeerPosRef.current[key];
        delete peerLastTRef.current[key];
        if (peerWalkTimers.current[key]) window.clearTimeout(peerWalkTimers.current[key]);
        delete peerWalkTimers.current[key];
        setPeers((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }, PEER_GONE_GRACE_MS);
    });
  };

  // ---------- Emotes ----------
  const [emotes, setEmotes] = useState<Record<string, EmoteKey>>({});
  const [emoteMenuOpen, setEmoteMenuOpen] = useState(false);
  const emoteTimers = useRef<Record<string, number>>({});
  const lastEmoteAt = useRef(0);
  const clearEmote = (characterId: string) => {
    if (emoteTimers.current[characterId]) window.clearTimeout(emoteTimers.current[characterId]);
    delete emoteTimers.current[characterId];
    setEmotes((e) => {
      if (!(characterId in e)) return e;
      const n = { ...e };
      delete n[characterId];
      return n;
    });
  };
  const playEmote = (characterId: string, key: EmoteKey) => {
    if (emoteTimers.current[characterId]) window.clearTimeout(emoteTimers.current[characterId]);
    setEmotes((e) => ({ ...e, [characterId]: key }));
    emoteTimers.current[characterId] = window.setTimeout(() => clearEmote(characterId), EMOTES[key].ms);
  };
  const handleEmoteReceived = (p: EmotePayload) => {
    if (!p || !(p.key in EMOTES) || p.characterId === character?.id) return;
    playEmote(p.characterId, p.key as EmoteKey);
  };
  const handleEmoteReceivedRef = useRef(handleEmoteReceived);
  handleEmoteReceivedRef.current = handleEmoteReceived;
  const sendEmote = (key: EmoteKey) => {
    if (!character || walking) return;
    const now = Date.now();
    if (now - lastEmoteAt.current < EMOTE_COOLDOWN_MS) return;
    lastEmoteAt.current = now;
    playEmote(character.id, key);
    if (channelRef.current) broadcastEmote(channelRef.current, { characterId: character.id, key });
    markActive();
  };
  // Une emote s'arrête dès que le personnage (ou un autre joueur) se remet en marche, et à chaque changement de lieu.
  useEffect(() => {
    if (walking && character) clearEmote(character.id);
  }, [walking]);
  useEffect(() => {
    Object.values(peers).forEach((p) => { if (p.walking) clearEmote(p.characterId); });
  }, [peers]);
  useEffect(() => {
    Object.keys(emoteTimers.current).forEach((id) => window.clearTimeout(emoteTimers.current[id]));
    emoteTimers.current = {};
    setEmotes({});
    setEmoteMenuOpen(false);
  }, [scene.id]);

  const showBubble = (characterId: string, text: string) => {
    const expiresAt = Date.now() + CHAT_BUBBLE_MS;
    setBubbles((b) => ({ ...b, [characterId]: { text, expiresAt } }));
    if (bubbleTimers.current[characterId]) window.clearTimeout(bubbleTimers.current[characterId]);
    bubbleTimers.current[characterId] = window.setTimeout(() => {
      setBubbles((b) => {
        const next = { ...b };
        delete next[characterId];
        return next;
      });
    }, CHAT_BUBBLE_MS);
  };

  const handleChatReceived = (msg: ChatMessage) => {
    setChatLog((log) => [...log.slice(-(CHAT_LOG_SIZE - 1)), msg]);
    showBubble(msg.characterId, msg.text);
    bumpChatActivity();
  };

  // ---------- Présence multijoueur : rejoint le canal de la scène courante ----------
  useEffect(() => {
    if (!character) return;
    sceneIdRef.current = scene.id;
    prevPeerPosRef.current = {};
    peerLastTRef.current = {};
    Object.values(peerWalkTimers.current).forEach((t) => window.clearTimeout(t));
    peerWalkTimers.current = {};
    Object.values(peerRemoveTimers.current).forEach((t) => window.clearTimeout(t));
    peerRemoveTimers.current = {};
    setPeerWalking({});
    setPeerDuration({});

    awayRef.current = false;
    setSelfAway(false);

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let stableTimer: number | null = null;
    let reconnectAttempt = 0;
    // Délai minimum qu'une connexion doit tenir avant qu'on considère qu'elle
    // est vraiment stable et qu'on remette le compteur de tentatives à zéro.
    // SANS ce délai, un canal qui se referme aussitôt après chaque
    // "SUBSCRIBED" (vu en test : boucle toutes les 1s, indéfiniment) fait
    // repartir le compteur à 0 à chaque fois → le délai de reconnexion ne
    // dépasse jamais 1s et on martèle le serveur sans jamais laisser une
    // vraie chance à la connexion de se stabiliser.
    const STABLE_AFTER_MS = 8000;

    // On prend la reconnexion en main nous-mêmes plutôt que de compter sur
    // Supabase pour rejoindre le canal tout seul après une coupure : les
    // journaux de test montrent un canal qui passe à CLOSED et ne retente
    // ensuite plus jamais rien tout seul. Délai croissant (1s, 2s, 4s, 8s,
    // plafonné à 10s), qui n'est remis à zéro qu'après STABLE_AFTER_MS de
    // connexion effective — pas à chaque "SUBSCRIBED" isolé.
    const connect = (userId: string) => {
      if (cancelled) return;
      leaveScenePresence(channelRef.current);
      channelRef.current = joinScenePresence(
        scene.id,
        userId,
        handlePeerUpdate,
        handleChatReceived,
        // Chaque changement d'état du canal, visible dans le journal à
        // l'écran. Sur "SUBSCRIBED" (première fois ou après une coupure), on
        // republie systématiquement notre position pour rester visible. Sur
        // une fermeture, on programme nous-mêmes une reconnexion.
        (status, err) => {
          if (cancelled || loggingOutRef.current) return;
          logPresence(`état du canal : ${status}${err ? ` (${err.message})` : ""}`);
          if (status === "SUBSCRIBED") {
            if (stableTimer) window.clearTimeout(stableTimer);
            stableTimer = window.setTimeout(() => {
              reconnectAttempt = 0;
            }, STABLE_AFTER_MS);
            trackPresence(lastLogicalPosRef.current, 0, false);
            armAwayTimer();
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (stableTimer) window.clearTimeout(stableTimer);
            reconnectAttempt += 1;
            const delayMs = Math.min(1000 * 2 ** (reconnectAttempt - 1), 10000);
            logPresence(`reconnexion dans ${Math.round(delayMs / 1000)}s (tentative ${reconnectAttempt})`);
            if (reconnectTimer) window.clearTimeout(reconnectTimer);
            reconnectTimer = window.setTimeout(() => connect(userId), delayMs);
          }
        },
        (p) => handleEmoteReceivedRef.current(p),
      );
    };

    scenesClient.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session?.user) return;
      const userId = data.session.user.id;
      userIdRef.current = userId;
      connect(userId);
    });

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (stableTimer) window.clearTimeout(stableTimer);
      if (awayTimer.current) window.clearTimeout(awayTimer.current);
      Object.values(peerRemoveTimers.current).forEach((t) => window.clearTimeout(t));
      peerRemoveTimers.current = {};
      leaveScenePresence(channelRef.current);
      channelRef.current = null;
      setPeers({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, character?.id]);

  // ---------- Filet de sécurité : recalage local périodique ----------
  // Relit toutes les PRESENCE_RESYNC_MS l'état de présence déjà en cache dans
  // le navigateur (aucune requête réseau, c'est juste une relecture locale du
  // client Supabase) et le refusionne. Corrige silencieusement tout pair
  // resté "coincé" si jamais un événement "sync" avait été manqué.
  useEffect(() => {
    if (!character) return;
    const id = window.setInterval(() => {
      if (!channelRef.current || !userIdRef.current) return;
      handlePeerUpdate(readPeersFromChannel(channelRef.current, userIdRef.current), true);
    }, PRESENCE_RESYNC_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, character?.id]);

  // ---------- Réannonce au retour d'onglet / de réseau ----------
  // Un onglet mis en arrière-plan peut voir son WebSocket ralenti ou coupé
  // par le navigateur. Dès qu'il redevient actif (onglet revisible, réseau
  // qui revient), on renvoie une seule fois notre position — ça déclenche un
  // "sync" frais pour tout le monde — et on se recale localement tout de
  // suite plutôt que d'attendre le prochain passage du minuteur ci-dessus.
  useEffect(() => {
    const reannounce = () => {
      if (!channelRef.current || !characterRef.current) return;
      trackPresence(lastLogicalPosRef.current, 0, false);
      if (userIdRef.current) {
        handlePeerUpdate(readPeersFromChannel(channelRef.current, userIdRef.current), true);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") reannounce();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", reannounce);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", reannounce);
    };
  }, []);

  // J'ai changé d'arme (ou son réglage) : je recharge la mienne et je préviens les autres joueurs de la scène.
  const handleMyWeaponChanged = () => {
    myGearRef.current = Date.now();
    refreshWornWeapons();
    trackPresence(lastLogicalPosRef.current, 0, false);
  };

  const buildPeerState = (nextPos: Point, ms: number, isWalking: boolean): PeerState => ({
    characterId: characterRef.current!.id,
    name: characterRef.current!.name,
    image_url: characterRef.current!.image_url,
    position: nextPos,
    duration: ms,
    walking: isWalking,
    away: awayRef.current,
    pet: myPetRef.current,
    gear: myGearRef.current,
    t: Date.now(),
  });

  // Presence (track()) — réservée aux événements RARES : arrivée à
  // destination, (re)connexion, passage absent/de retour. Supabase limite
  // chaque connexion à 5 track() par 30 secondes et FERME le canal au-delà :
  // voir broadcastWalkStep ci-dessous pour les mises à jour fréquentes.
  const trackPresence = (nextPos: Point, ms: number, isWalking: boolean) => {
    if (!channelRef.current || !characterRef.current) return;
    if (!isChannelReady(channelRef.current)) {
      logPresence(`position NON envoyée (canal pas encore ouvert, state=${channelRef.current.state})`);
      return;
    }
    channelRef.current.track(buildPeerState(nextPos, ms, isWalking));
  };

  // Broadcast (send()) — pour CHAQUE étape intermédiaire d'un trajet. Pas de
  // limite de débit de ce type sur Broadcast (il ne maintient aucun état
  // synchronisé côté serveur, juste un relais de message), contrairement à
  // Presence ci-dessus.
  const broadcastWalkStep = (nextPos: Point, ms: number, isWalking: boolean) => {
    if (!channelRef.current || !characterRef.current || !userIdRef.current) return;
    if (!isChannelReady(channelRef.current)) {
      logPresence(`pas NON diffusé (canal pas encore ouvert, state=${channelRef.current.state})`);
      return;
    }
    broadcastMove(channelRef.current, userIdRef.current, buildPeerState(nextPos, ms, isWalking));
  };

  // ---------- État absent : (ré)arme le compte à rebours de 2 minutes ----------
  const armAwayTimer = () => {
    if (awayTimer.current) window.clearTimeout(awayTimer.current);
    awayTimer.current = window.setTimeout(() => {
      if (awayRef.current) return;
      awayRef.current = true;
      setSelfAway(true);
      trackPresence(lastLogicalPosRef.current, 0, false);
    }, AWAY_AFTER_MS);
  };

  // À appeler à chaque vraie action du joueur (déplacement, message).
  const markActive = () => {
    if (awayRef.current) {
      awayRef.current = false;
      setSelfAway(false);
      // Si le joueur repart à pied, le trackPresence du pas suivant écrase
      // aussitôt cet envoi ; pour un simple message tchat, c'est lui qui
      // annonce le retour.
      trackPresence(lastLogicalPosRef.current, 0, false);
    }
    armAwayTimer();
  };

  // ---------- Marche : avance la file d'attente de points (pathfinding) un par un ----------
  const runRef = useRef(false);
  const lastFloorClickRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const [running, setRunning] = useState(false);
  const stepWalk = (rect: DOMRect, onArrive?: () => void) => {
    if (!character) return;
    const next = walkQueueRef.current.shift();
    if (!next) {
      setWalking(false);
      setRunning(false);
      onArrive?.();
      return;
    }

    const origin = charSpriteRef.current ? currentSpritePercent(charSpriteRef.current, rect) : pos;
    const dist = distanceInPx(rect, origin, next);
    const ms = Math.round(walkDurationMs(dist) / (runRef.current ? RUN_FACTOR : 1));

    // Sens du sprite : seul le déplacement horizontal compte (un pas purement
    // vertical garde le sens précédent plutôt que de retourner le personnage
    // sans raison). On compare à la position LOGIQUE précédente (lastLogicalPosRef),
    // pas à une lecture DOM (getComputedStyle) : sur un chemin à plusieurs
    // petits segments, lire le DOM pendant que la transition CSS du segment
    // précédent est encore en train de se terminer donnait un signal de
    // direction bruité d'un segment à l'autre, et seul le dernier segment
    // (vers la destination finale) donnait une direction nette — d'où
    // l'impression que le personnage ne se retournait qu'une fois arrivé.
    const facingFrom = lastLogicalPosRef.current;
    if (Math.abs(next.x - facingFrom.x) > 0.01) {
      setFacingRight(next.x > facingFrom.x);
    }
    lastLogicalPosRef.current = next;

    setDuration(ms);
    setWalking(true);
    setPos(next);
    broadcastWalkStep(next, ms, true);

    walkTimer.current = window.setTimeout(() => {
      const isLast = walkQueueRef.current.length === 0;
      if (isLast) {
        saveCharacterPosition(character.id, next);
        trackPresence(next, 0, false);
      }
      stepWalk(rect, onArrive);
    }, ms);
  };

  // Point d'entrée unique pour se déplacer : calcule un chemin (contourne les
  // zones non marchables via findPath) et le suit pas à pas. Le dernier clic
  // prime toujours — s'il y avait déjà une marche en cours, on l'interrompt et
  // on repart de la position visuelle ACTUELLE (pas de l'ancienne destination).
  const startWalk = (target: Point, onArrive?: () => void, run = false) => {
    if (!character || !sceneRef.current) return;
    runRef.current = run;
    setRunning(run);
    const rect = sceneRef.current.getBoundingClientRect();
    markActive();

    if (walkTimer.current) {
      window.clearTimeout(walkTimer.current);
      walkTimer.current = null;
    }

    const origin = walking && charSpriteRef.current ? currentSpritePercent(charSpriteRef.current, rect) : pos;
    const waypoints = scene.walkable_zone
      ? findPath(origin, target, scene.walkable_zone, scene.obstacles)
      : [target];
    walkQueueRef.current = waypoints;
    // Interruption en pleine marche : on « fige » visuellement le sprite à sa position réelle avant de repartir.
    // Sinon, si la nouvelle cible est identique à l'ancienne, le navigateur garde l'ANCIENNE durée de transition
    // (trop lente) alors que le minuteur, lui, tombe plus tôt : le perso ne prend pas de vitesse, puis se téléporte.
    const el = charSpriteRef.current;
    if (walking && el) {
      const prev = { l: el.style.left, t: el.style.top, tr: el.style.transition };
      el.style.transition = "none";
      el.style.left = `${origin.x}%`;
      el.style.top = `${origin.y}%`;
      void el.offsetWidth;
      el.style.left = prev.l;
      el.style.top = prev.t;
      el.style.transition = prev.tr;
    }
    stepWalk(rect, onArrive);
  };

  // ---------- Déplacement classique (clic au sol) ----------
  // La zone marchable est maintenant une LISTE de pièces (voir scenes-supabase.ts) :
  // un clic est valide s'il tombe dans AU MOINS une pièce, et dans AUCUN obstacle.
  // Dessiner/éditer les pièces et obstacles se fait désormais depuis /admin ; ici
  // on ne fait que lire ce qui est enregistré.
  const handleSceneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!character || !scene.walkable_zone || !sceneRef.current) return;

    const rect = sceneRef.current.getBoundingClientRect();
    const target = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };

    const insideARoom = scene.walkable_zone.some((room) => pointInPolygon(target, room));
    if (!insideARoom) return;
    if ((scene.obstacles ?? []).some((hole) => pointInPolygon(target, hole))) return;

    // Double-clic (deux clics rapprochés dans le temps et dans l'espace) : on court un peu plus vite.
    const now = Date.now();
    const last = lastFloorClickRef.current;
    const isDouble = !!last && now - last.t < 350 && Math.hypot(((target.x - last.x) / 100) * rect.width, ((target.y - last.y) / 100) * rect.height) < 40;
    lastFloorClickRef.current = { t: now, x: target.x, y: target.y };
    void isDouble; // la course au double-clic est désactivée (trop de bugs visuels)
    startWalk(target, undefined, false);
  };

  // ---------- Changement de scène (appelé une fois la marche jusqu'à la sortie terminée) ----------
  const sleepMs = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
  // Après le changement : on attend que la nouvelle image et ses lieux soient prêts, puis le noir redescend.
  const settleFade = async () => {
    const t0 = Date.now();
    await sleepMs(140);
    while (!sceneReadyRef.current && Date.now() - t0 < 3000) await sleepMs(70);
    setFadeOut(false);
  };
  const changeScene = async (exit: SceneExit) => {
    if (!character) return;
    setFadeOut(true);
    const fadeDone = sleepMs(200);
    try {
      const [newScene, newExits] = await Promise.all([
        fetchScene(exit.to_scene_id),
        fetchSceneExits(exit.to_scene_id),
        fadeDone,
      ]).then(([a, b]) => [a, b] as const);
      const reverse = newExits.find((x) => x.to_scene_id === scene.id);
      const arrival = reverse ? reverse.position : { x: 50, y: 70 };

      stepMusicRef.current = null;
      if (!isExpeditionSceneName(newScene.name)) playMusic(newScene.music_url, true);   // expédition : la musique dépend du type d'étape

      setScene(newScene);
      setExits(newExits);
      setPos(arrival);
      lastLogicalPosRef.current = arrival;
      setWalking(false);

      const updated = { ...character, scene_id: newScene.id, position: arrival };
      setCharacter(updated);
      characterRef.current = updated;

      void settleFade();
      await moveCharacterToScene(character.id, newScene.id, arrival);
      trackPresence(arrival, 0, false);
    } catch (err) {
      console.error("Scene change failed", err);
      setFadeOut(false);
    }
  };

  // Téléporte le personnage dans une scène (sans passer par une sortie).
  const teleportToScene = async (newScene: Scene, arrival: Point) => {
    if (!character) return;
    setFadeOut(true);
    const fadeDone = sleepMs(200);
    let newExits: Awaited<ReturnType<typeof fetchSceneExits>>;
    try {
      [newExits] = await Promise.all([fetchSceneExits(newScene.id), fadeDone]);
    } catch (e) {
      setFadeOut(false);
      throw e;
    }
    stepMusicRef.current = null;
    if (!isExpeditionSceneName(newScene.name)) playMusic(newScene.music_url, true);
    setScene(newScene);
    setExits(newExits);
    setPos(arrival);
    lastLogicalPosRef.current = arrival;
    setWalking(false);
    const updated = { ...character, scene_id: newScene.id, position: arrival };
    setCharacter(updated);
    characterRef.current = updated;
    void settleFade();
    await moveCharacterToScene(character.id, newScene.id, arrival);
    trackPresence(arrival, 0, false);
  };

  // ---------- Clic sur une sortie : on marche jusqu'à elle, PUIS on change de scène ----------
  const handleExitClick = (e: React.MouseEvent, exit: SceneExit) => {
    e.stopPropagation();
    if (!character || !sceneRef.current) return;

    const rect = sceneRef.current.getBoundingClientRect();
    const origin = walking && charSpriteRef.current ? currentSpritePercent(charSpriteRef.current, rect) : pos;
    const dist = distanceInPx(rect, origin, exit.position);

    if (dist < 4) {
      if (walkTimer.current) window.clearTimeout(walkTimer.current);
      changeScene(exit);
      return;
    }

    startWalk(exit.position, () => changeScene(exit));
  };

  // Marche jusqu'à un endroit PUIS fait l'action (portail, forgeron…) : rien ne s'active de loin.
  // Marche vers un lieu cliquable (portail, forgeron, tas d'or…) mais s'arrête À PROXIMITÉ au lieu de marcher dessus
  // (ex. un tas d'or posé sur le comptoir : on s'en approche sans monter dessus). Distance d'approche ≈ 6 % de la largeur de la scène.
  // front = lieu en personnage (image) : on s'arrête DEVANT lui (plus bas à l'écran), avec une marge plus grande.
  const walkThen = (position: Point, action: () => void, front = false) => {
    if (!character || !sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const origin = walking && charSpriteRef.current ? currentSpritePercent(charSpriteRef.current, rect) : pos;
    const reach = rect.width * (front ? 0.07 : 0.06);
    const alreadyThere = front ? distanceInPx(rect, origin, position) <= reach * 1.6 && origin.y >= position.y : distanceInPx(rect, origin, position) <= reach;
    if (alreadyThere) {
      if (walkTimer.current) window.clearTimeout(walkTimer.current);
      walkQueueRef.current = [];
      action();
      return;
    }
    const isWalkable = (pt: Point) =>
      !!scene.walkable_zone &&
      scene.walkable_zone.some((room) => pointInPolygon(pt, room)) &&
      !(scene.obstacles ?? []).some((hole) => pointInPolygon(pt, hole));
    // Candidats : un anneau autour du lieu (rayon croissant) ; on garde celui qui est marchable et le plus proche de nous.
    let best: Point | null = null;
    let bestDist = Infinity;
    for (const k of front ? [0.7, 1, 1.5, 2.2] : [0.5, 0.8, 1.2, 2]) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        if (front && Math.sin(a) < 0.5) continue; // seulement l'arc du bas = devant le lieu
        const cand = {
          x: position.x + ((Math.cos(a) * reach * k) / rect.width) * 100,
          y: position.y + ((Math.sin(a) * reach * k) / rect.height) * 100,
        };
        if (!isWalkable(cand)) continue;
        const d = distanceInPx(rect, origin, cand);
        if (d < bestDist) {
          best = cand;
          bestDist = d;
        }
      }
      if (best) break;
    }
    // Aucun point marchable autour : on tente le lieu lui-même (ancien comportement).
    startWalk(best ?? position, action);
  };

  // ---------- Chat ----------
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !character || !channelRef.current) return;

    // Petite commande cachée pour activer/désactiver le panneau de diagnostic
    // de présence sans passer par le bouton — pratique en live. Ne part pas
    // dans le tchat des autres joueurs.
    if (text === "/debug") {
      togglePresenceDebug();
      setChatInput("");
      return;
    }

    // /danse, /saut… : emotes ; /emotes : la liste.
    const emoteCmd = /^\/(\S+)\s*$/.exec(text);
    if (emoteCmd) {
      const w = emoteCmd[1]!.toLowerCase();
      const ek = emoteFromCommand(w);
      if (ek) { sendEmote(ek); setChatInput(""); return; }
      if (w === "emotes" || w === "emote") {
        setChatLog((log) => [...log.slice(-(CHAT_LOG_SIZE - 1)), { characterId: "system", name: "Tchat", text: "Emotes : " + EMOTE_KEYS.map((k) => "/" + EMOTES[k].commands[0]).join("  "), ts: Date.now() }]);
        setChatInput("");
        return;
      }
    }

    // /g (ou /groupe) et /d (ou /dire) changent de canal ; suivis d'un texte, ils l'envoient aussi.
    let channel = chatChannel;
    let body = text;
    const cmd = /^\/(g|groupe|d|dire)(?:\s+([\s\S]*))?$/i.exec(text);
    if (cmd) {
      const wantGroup = cmd[1]!.toLowerCase().startsWith("g");
      if (wantGroup && !party) {
        setChatLog((log) => [...log.slice(-(CHAT_LOG_SIZE - 1)), { characterId: "system", name: "Tchat", text: "Tu n'es dans aucun groupe.", ts: Date.now() }]);
        setChatInput("");
        return;
      }
      channel = wantGroup ? "group" : "say";
      setChatChannel(channel);
      body = (cmd[2] ?? "").trim();
      if (!body) { setChatInput(""); return; }
    }
    if (channel === "group" && !party) channel = "say";
    const msg: ChatMessage = { characterId: character.id, name: character.name, text: body, ts: Date.now(), channel, ...(chatColor ? { color: chatColor } : {}) };
    setChatLog((log) => [...log.slice(-(CHAT_LOG_SIZE - 1)), msg]);
    if (channel === "group") {
      if (!groupChatRef.current || !sendGroupChat(groupChatRef.current, msg)) logPresence("message de groupe NON envoyé (canal pas encore ouvert)");
      void saveChatMessage(character.id, "group", null, party!.id, body, chatColor).catch(() => {});
    } else {
      showBubble(character.id, body);
      const sent = broadcastChatMessage(channelRef.current, msg);
      if (!sent) logPresence(`message NON envoyé (canal pas encore ouvert, state=${channelRef.current.state})`);
      void saveChatMessage(character.id, "say", scene.id, null, body, chatColor).catch(() => {});
    }
    setChatInput("");
    bumpChatActivity();
    markActive();
  };

  sceneReadyRef.current = !restoring && !!imgNatural && hotspotsLoaded && !!hotspotStyles;
  useEffect(() => {
    if (!booted && sceneReadyRef.current) setBooted(true);
  });

  if (checkingCharacter) {
    return (
      <div className="relative h-screen w-screen bg-black">
        <LoadingScreen visible />
      </div>
    );
  }

  if (deadInfo) {
    return <DeadScreen name={deadInfo.name} cause={deadInfo.cause} summary={deadInfo.summary} busy={deadBusy} error={deadError} onNewCharacter={() => void handleNewCharacterAfterDeath()} />;
  }

  if (loginRequired) {
    return (
      <LoginScreen
        onConnect={handleConnectProvider}
        farewellName={loggedOutInfo().loggedOut ? loggedOutInfo().name ?? "" : null}
        muted={muted}
        onToggleMute={toggleMute}
        volume={volume}
        onVolumeChange={handleVolumeChange}
      />
    );
  }

  if (!character) {
    return (
      <CharacterSelect
        assets={characterAssets}
        onChoose={handleCharacterChosen}
        muted={muted}
        onToggleMute={toggleMute}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        authIdentity={authIdentity}
        onConnect={handleConnectProvider}
        onDisconnect={handleDisconnect}
        error={characterError}
        busy={creatingCharacter}
      />
    );
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <LoadingScreen visible={!booted && !veilTimeout} />
      <div
        className="pointer-events-none absolute inset-0 z-[55] bg-black"
        style={{ opacity: fadeOut ? 1 : 0, transition: fadeOut ? "opacity 200ms ease-in" : "opacity 320ms ease-out" }}
      />
      <div
        ref={sceneRef}
        onClick={handleSceneClick}
        className="relative overflow-hidden"
        style={{
          width: sceneBoxSize.width,
          height: sceneBoxSize.height,
          // Curseur custom "par défaut" pour toute la scène (remplace le
          // curseur système). Hotspot (pointe active) réglé sur le coin
          // haut-gauche de la flèche dessinée. La classe .cursor-creature
          // (voir plus bas) est prête pour plus tard, quand on pourra
          // inspecter une créature ou un objet — pas encore utilisée.
          cursor: "url('/cursors/cursor-default.png') 1 1, default",
        }}
      >
        <style>{`
          @keyframes auberge-walk{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}} @keyframes auberge-hop{0%{transform:translateY(0) rotate(-4deg)}25%{transform:translateY(-4%) rotate(-4deg)}50%{transform:translateY(0) rotate(4deg)}75%{transform:translateY(-4%) rotate(4deg)}100%{transform:translateY(0) rotate(-4deg)}}
          .cursor-creature{cursor:url('/cursors/cursor-creature.png') 12 12, pointer;}
        `}</style>
        <img
          src={scene.image_url}
          alt={scene.name}
          onLoad={(e) => setImgNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {exits.map((exit) => (
          <button
            key={exit.id}
            type="button"
            onClick={(e) => handleExitClick(e, exit)}
            aria-label={exit.label ?? "Sortie"}
            title={exit.label ?? undefined}
            className="absolute z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fff3d6]/80 bg-black/30 backdrop-blur-sm transition-transform hover:scale-110"
            style={{ left: `${exit.position.x}%`, top: `${exit.position.y}%`, cursor: arrowCursor(exit.arrow_rotation) }}
          />
        ))}

        {character?.image_url && (
          <div
            ref={charSpriteRef}
            className="pointer-events-none absolute z-20"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              zIndex: bubbles[character.id] ? 35 : depthZ(pos.y),   // le plus bas à l'écran est devant ; un personnage qui parle passe devant pour que sa bulle reste visible
              // Largeur en fraction de la largeur RÉELLE de la scène affichée
              // (pas en pixels fixes) pour que le personnage suive les
              // changements de taille de la fenêtre en mode fenêtré.
              width: sceneBoxSize.width * CHARACTER_WIDTH_RATIO,
              // Échelle de profondeur : plus petit en haut du décor (loin), plus
              // grand en bas (près), interpolée en continu depuis la calibration
              // de la scène (computeDepthScale). On anime `transform: scale()`
              // (traité par la carte graphique, aucun recalcul de mise en page à
              // chaque frame) plutôt que `width` (qui, elle, force un recalcul de
              // layout à chaque frame) — c'est la façon fiable d'avoir un
              // grossissement garanti fluide, jamais saccadé. transformOrigin à
              // "50% 100%" (les pieds) pour que l'agrandissement se fasse à
              // partir du point au sol, sans faire dériver la position.
              transformOrigin: "50% 100%",
              transform: `translate(-50%, -100%) scale(${computeDepthScale(pos.y, scene.depth_scale)})`,
              transition: walking
                ? `left ${duration}ms linear, top ${duration}ms linear, transform ${duration}ms linear`
                : "none",
            }}
          >
            {bubbles[character.id] && <SpeechBubble text={bubbles[character.id].text} />}
            {/* Le miroir (scaleX) est sur ce wrapper, séparé de l'<img> qui porte
                l'animation d'oscillation de marche : l'animation CSS prend le
                contrôle total de `transform` sur l'élément qu'elle anime, donc
                mettre les deux transforms sur la même balise faisait disparaître
                le miroir tant que le personnage marchait (il ne redevenait
                visible qu'à l'arrêt, une fois l'animation coupée). */}
            <div style={{ transform: shouldMirror(imageFlips, character.image_url, facingRight) ? "scaleX(-1)" : "none" }}>
              <div style={emoteStyle(emotes[character.id])}>
                <WornSprite
                  src={character.image_url}
                  alt={character.name}
                  weapon={emotes[character.id] && EMOTES[emotes[character.id]!].hideWeapon ? undefined : wornWeapons[character.id]}
                  className="pointer-events-auto block w-full"
                  style={{
                    cursor: CURSOR_INTERACT,
                    transformOrigin: "50% 100%",
                    animation: walking ? (PLAYER_WALK_HOP ? "auberge-hop 520ms ease-in-out infinite" : "auberge-walk 250ms linear infinite") : "none",
                  }}
                  onClick={(e) => { e.stopPropagation(); setEmoteMenuOpen((o) => !o); }}
                />
              </div>
            </div>
            {emotes[character.id] && EMOTES[emotes[character.id]!].symbol && (
              <div className="pointer-events-none absolute left-1/2 top-0 text-2xl" style={{ animation: "emote-symbol 1.6s ease-out infinite" }}>{EMOTES[emotes[character.id]!].symbol}</div>
            )}
            {myPet && <PetSprite src={myPet} facingRight={facingRight} walking={walking} />}
            <NameTag name={character.name} away={selfAway} showName={SHOW_NAME_LABELS} />
          </div>
        )}

        {Object.entries(peers).map(([key, peer]) => {
          const isWalking = !!peerWalking[key];
          const ms = peerDuration[key] ?? 0;
          const isFacingRight = !!peerFacingRight[key];
          return (
            <div
              key={key}
              className="pointer-events-none absolute z-20"
              style={{
                left: `${peer.position.x}%`,
                top: `${peer.position.y}%`,
                zIndex: bubbles[peer.characterId] ? 35 : depthZ(peer.position.y),
                width: sceneBoxSize.width * CHARACTER_WIDTH_RATIO,
                transformOrigin: "50% 100%",
                transform: `translate(-50%, -100%) scale(${computeDepthScale(peer.position.y, scene.depth_scale)})`,
                transition: isWalking
                  ? `left ${ms}ms linear, top ${ms}ms linear, transform ${ms}ms linear`
                  : "none",
              }}
            >
              {bubbles[peer.characterId] && <SpeechBubble text={bubbles[peer.characterId].text} />}
              <div style={{ transform: shouldMirror(imageFlips, peer.image_url, isFacingRight) ? "scaleX(-1)" : "none" }}>
               <div style={emoteStyle(emotes[peer.characterId])}>
                {/* pointer-events-auto seulement sur l'image : le conteneur
                    reste pointer-events-none pour ne pas intercepter les
                    clics de déplacement destinés au sol derrière le pair. */}
                <WornSprite
                  src={peer.image_url}
                  alt={peer.name}
                  weapon={emotes[peer.characterId] && EMOTES[emotes[peer.characterId]!].hideWeapon ? undefined : wornWeapons[peer.characterId]}
                  className="pointer-events-auto block w-full"
                  style={{
                    cursor: CURSOR_INTERACT,
                    transformOrigin: "50% 100%",
                    animation: isWalking ? "auberge-walk 250ms linear infinite" : "none",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPeerMenu({ peerKey: key, peerName: peer.name, x: e.clientX, y: e.clientY });
                  }}
                />
               </div>
              </div>
              {emotes[peer.characterId] && EMOTES[emotes[peer.characterId]!].symbol && (
                <div className="pointer-events-none absolute left-1/2 top-0 text-2xl" style={{ animation: "emote-symbol 1.6s ease-out infinite" }}>{EMOTES[emotes[peer.characterId]!].symbol}</div>
              )}
              {peer.pet && <PetSprite src={peer.pet} facingRight={isFacingRight} walking={isWalking} />}
              <NameTag name={peer.name} away={!!peer.away} showName={SHOW_NAME_LABELS} />
            </div>
          );
        })}

        {peerMenu && (
          <PeerContextMenu
            peerName={peerMenu.peerName}
            x={peerMenu.x}
            y={peerMenu.y}
            onInvite={() => {
              const targetPeer = peers[peerMenu.peerKey];
              if (targetPeer) handleInvitePeer(targetPeer.characterId);
            }}
            onInspect={() => {
              const targetPeer = peers[peerMenu.peerKey];
              if (targetPeer) setInspectId(targetPeer.characterId);
            }}
            {...(inExpeditionScene ? {} : { onTrade: () => {
              const targetPeer = peers[peerMenu.peerKey];
              if (targetPeer) void handleTradeWith(targetPeer.characterId);
            } })}
            onClose={() => setPeerMenu(null)}
          />
        )}
        {inspectId && <InspectPanel characterId={inspectId} onClose={() => setInspectId(null)} />}
        {trade && !inExpeditionScene && (() => {
          const t = trade.trade;
          const iAmA = trade.me === "a";
          const other = iAmA ? t.name_b : t.name_a;
          if (t.status === "pending") {
            return iAmA
              ? <TradeWaiting name={other} onCancel={() => { void tradeCancel(t.id).catch(() => {}); closeTrade(); }} />
              : <TradeInvite name={other} onAnswer={(ok) => { void tradeRespond(t.id, ok).catch(() => {}); if (!ok) closeTrade(); }} />;
          }
          return <TradePanel state={trade} onClose={closeTrade} />;
        })()}

        {party && character && !inExpeditionScene && (
          <PartyPanel
            members={partyMembers}
            myCharacterId={character.id}
            isLeader={party.created_by_character_id === character.id}
            onLeave={handleLeaveParty}
            onKick={handleKickFromParty}
          />
        )}

        {pendingInvite && (
          <PartyInvitePopup
            inviterName={pendingInvite.inviterName}
            onAccept={handleAcceptInvite}
            onDecline={handleDeclineInvite}
          />
        )}

        {(scene.weapon_display?.length ?? 0) > 0 && !inExpeditionScene && (
          <WeaponDisplay points={scene.weapon_display!} boxWidth={sceneBoxSize.width} />
        )}
        {scene.name.toLowerCase() === "village" && (scene.pasture_zone?.length ?? 0) > 0 && (
          <Pasture zone={scene.pasture_zone!} depthScale={scene.depth_scale} boxWidth={sceneBoxSize.width} />
        )}

        {character && !inExpeditionScene && hotspots.filter((h) => h.kind !== "board" && !claimedGold.has(h.id) && (!h.kind.startsWith("gold") || !activeGold || activeGold.has(h.id))).map((h) => (
          <HotspotMarker key={h.id} hotspot={h} bubble={npcSpeech[h.id]} onClick={() => walkThen(h.position, () => (h.kind.startsWith("gold") ? collectGold(h) : setOpenHotspot(h)), !!hotspotStyles?.[h.kind]?.image_url)} />
        ))}
        {goldFloats.map((g) => (
          <div key={g.key} className="obw-gold-float pointer-events-none absolute z-40 -translate-x-1/2 text-xl font-extrabold" style={{ left: `${g.x}%`, top: `${g.y}%`, color: g.ok ? "#fde68a" : "#fca5a5", textShadow: "0 2px 4px #000, 0 0 8px rgba(0,0,0,0.6)" }}>
            {g.text}
          </div>
        ))}
        {openHotspot && (
          <HotspotPanel
            hotspot={openHotspot}
            onClose={() => setOpenHotspot(null)}
            character={character ? { id: character.id, name: character.name, imageUrl: character.image_url, visualAssetId: character.visual_asset_id } : null}
            onWeaponChanged={handleMyWeaponChanged}
            onInvite={(id) => void handleInvitePeer(id)}
          />
        )}

        {character && !expeditionLaunched && !inExpeditionScene &&
          scenePortals.map((portal) => {
            const mine = !openExpedition || (openExpedition.route ?? "court") === portal.route;
            return (
              <ExpeditionPortalMarker
                key={portal.id}
                position={portal.position}
                isSelfReady={selfReady && mine}
                readyCount={mine ? readyCount : 0}
                totalCount={groupIds.length}
                label={portal.route === "long" ? `Grand Safari Sylvestre · niv. ${longMinLevel}` : scenePortals.length > 1 ? "P'tite Balade en Forêt" : undefined}
                onClick={() => walkThen(portal.position, () => void handleTogglePortal(portal))}
              />
            );
          })}

        {inExpeditionScene && character && activeCombatId && !outcomeInfo && (
          <ExpeditionBattle
            key={activeCombatId}
            sceneImageUrl={scene.image_url}
            combatId={activeCombatId}
            mirrorBg={bgMirrored}
            characterId={character.id}
            allies={combatAllies}
            volume={volume}
            muted={muted}
            onFinished={() => void handleCombatFinished()}
          />
        )}

        {inExpeditionScene && character && (!!outcomeInfo || (!activeCombatId && expeditionPhase === "event")) && (
          <ExpeditionCombatView
            sceneImageUrl={scene.image_url}
            mirrorBg={bgMirrored}
            walkOutIds={leavingIds}
            eventNumber={(outcomeInfo ? stepIndex - 1 : stepIndex) + 1}
            progress={activeExpedition ? ((outcomeInfo ? stepIndex - 1 : stepIndex) + 1) / Math.max(1, expeditionLength(activeExpedition.route, activeExpedition.id)) : undefined}
            phase="event"
            event={demoEvent}
            myVote={myVote}
            votedCount={stepVotes.length}
            hideEvent={!!outcomeInfo || !!narrativeEvent || !runStep}
            voteDeadlineMs={runStep?.vote_deadline ? new Date(runStep.vote_deadline).getTime() : null}
            onVote={handleExpeditionVote}
            allies={combatAllies}
            enemies={[]}
            turn={1}
          />
        )}

        {inExpeditionScene && character && activeExpedition && !activeCombatId && currentEvent.id === "camp" && runStep && !outcomeInfo && (
          <CampPanel
            expeditionId={activeExpedition.id}
            characterId={character.id}
            members={combatAllies.map((a) => {
              const st = statOf(a.characterId);
              return { characterId: a.characterId, name: a.name, pv: st?.pv_current ?? 0, pvMax: st?.pv_max ?? 0, pm: st?.pm_current ?? 0, pmMax: st?.pm_max ?? 0, gone: !!st?.left_expedition_at };
            })}
          />
        )}

        {inExpeditionScene && character && !activeCombatId && expeditionPhase === "event" && narrativeEvent && runStep && !outcomeInfo && (
          <NarrativeStepPanel
            event={narrativeEvent}
            players={combatAllies
              .filter((a) => (statOf(a.characterId)?.pv_current ?? 1) > 0 && !statOf(a.characterId)?.left_expedition_at)
              .map((a) => ({ characterId: a.characterId, name: a.name }))}
            myCharacterId={character.id}
            myVote={myVote}
            votedCount={stepVotes.length}
            voterCount={participantCount}
            deadlineMs={runStep.vote_deadline ? new Date(runStep.vote_deadline).getTime() : null}
            onVote={handleExpeditionVote}
          />
        )}

        {inExpeditionScene && character && !activeCombatId && !outcomeInfo && expeditionPhase === "combat" && (
          <div
            className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-[#7a4a22]/70 bg-[#2b1406]/95 px-5 py-3 text-center text-sm font-bold text-[#fff3d6]"
            style={{ fontFamily: "'Baloo 2', cursive" }}
          >
            {combatError ? `Le combat n'a pas pu démarrer : ${combatError}` : "Le combat commence…"}
          </div>
        )}

        {inExpeditionScene && outcomeInfo && iAcked && !allAcked && (
          <div className="absolute left-1/2 top-[40%] z-40 -translate-x-1/2 rounded-full bg-black/65 px-4 py-1 text-xs font-bold text-[#fff3d6] md:left-[71%]" style={{ fontFamily: "'Baloo 2', cursive" }}>
            En attente des autres joueurs ({leavingIds.filter((id) => requiredIds.includes(id)).length}/{requiredIds.length})…
          </div>
        )}
        {inExpeditionScene && outcomeInfo && !iAcked && (
          <OutcomePanel
            outcome={outcomeInfo}
            myPvMax={character ? (runStats.find((r) => r.character_id === character.id)?.pv_max ?? null) : null}
            onClose={closeOutcome}
            loot={
              character && activeExpedition
                ? {
                    expeditionId: activeExpedition.id,
                    characterId: character.id,
                    names: { ...Object.fromEntries(partyMembers.map((m) => [m.character_id, m.name])), [character.id]: character.name },
                  }
                : undefined
            }
          />
        )}

        {inExpeditionScene && character && activeExpedition && !endBanner && !deadInfo && (statOf(character.id)?.pv_current ?? 1) <= 0 && (
          <div className="absolute left-3 top-16 z-40 w-[min(19rem,46%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6]/97 p-3 text-[#3a2410] shadow-xl" style={{ fontFamily: "'Baloo 2', cursive" }}>
            <div className="text-sm font-extrabold">🕯️ Tu es tombé·e</div>
            <p className="mt-1 text-xs leading-snug">
              Tes alliés peuvent peut-être te ressusciter au feu de camp avec une <b>larme de vie</b> — c'est très rare.
              Sinon, ton esprit sera relâché à la fin de l'expédition, ou dès que tu le décides.
            </p>
            <button
              type="button"
              disabled={deadBusy}
              onClick={() => {
                if (!window.confirm("Relâcher ton esprit ? Ton personnage rejoint la forêt pour de bon et tu perds tout ce qu'il possédait. Tu en dessineras un nouveau.")) return;
                setDeadBusy(true);
                releaseSpirit()
                  .then((n) => {
                    if (n < 1) throw new Error("Impossible de relâcher ton esprit pour l'instant : réessaie dans un instant.");
                    return fetchMyDeath(character.id).then((d) => setDeadInfo({ name: character.name, cause: d.cause ?? "Tombé au combat", summary: d.summary })).catch(() => setDeadInfo({ name: character.name, cause: "Tombé au combat" }));
                  })
                  .catch((e) => window.alert(e?.message ?? "Erreur"))
                  .finally(() => setDeadBusy(false));
              }}
              className="mt-2 rounded border-2 border-[#7a4a22] px-3 py-1 text-xs font-bold text-[#5e3818] hover:bg-[#7a4a22]/15 disabled:opacity-50"
            >
              Relâcher mon esprit
            </button>
          </div>
        )}

        {endBanner && <EndBanner
            title={endBanner.title}
            text={endBanner.text}
            onClose={() => {
              setEndBanner(null);
              void checkDeathNow();
            }}
          />}

        {levelUp && character && !endBanner && !inExpeditionScene && (
          <LevelUpModal name={character.name} level={levelUp} imageUrl={character.image_url} info={levelInfo} line={levelLine} onClose={closeLevelUp} onTalents={() => { closeLevelUp(); setTalentsOpen(true); }} />
        )}
        {levelBanner && inExpeditionScene && (
          <LevelUpBanner level={levelBanner} />
        )}

        {axisChoice && !levelUp && !endBanner && !inExpeditionScene && (
          <AxisChoiceModal axes={axisChoice.axes} powers={axisChoice.powers} busy={axisBusy} error={axisError} onChoose={(k) => void handleChooseAxis(k)} />
        )}

        {expeditionSceneMissing && (
          <div
            className="absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-lg border-2 border-[#ff9e9e]/70 bg-[#2b1406]/95 px-4 py-2 text-sm font-bold text-[#fff3d6]"
            style={{ fontFamily: "'Baloo 2', cursive" }}
          >
            L'expédition est lancée, mais aucune scène nommée « expedition » n'existe encore (à créer dans /admin).
          </div>
        )}

        {expeditionLaunched && !inExpeditionScene && !expeditionSceneMissing && (
          <div
            className="absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-lg border-2 border-[#9effa0]/70 bg-[#2b1406]/95 px-4 py-2 text-sm font-bold text-[#fff3d6]"
            style={{ fontFamily: "'Baloo 2', cursive" }}
          >
            Le groupe est au complet : l'expédition est lancée ! (le déroulé des étapes reste à construire)
          </div>
        )}

        <SoundControl
          muted={muted}
          onToggleMute={toggleMute}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          className="absolute right-5 top-5 z-30"
        />
        {/* Bouton très discret pour activer/désactiver le panneau de
            diagnostic réseau — mêmes infos que taper "/debug" dans le tchat.
            Un simple point, pas une icône voyante : pas destiné aux joueurs. */}
        <button
          type="button"
          onClick={togglePresenceDebug}
          title="Diagnostic réseau (ou tape /debug dans le tchat)"
          className="absolute right-5 top-16 z-30 h-2.5 w-2.5 rounded-full opacity-40 transition-opacity hover:opacity-90"
          style={{ background: presenceDebugOn ? "#9effa0" : "#fff3d6" }}
        />
        {character && emoteMenuOpen && !activeCombatId && (
          <div className="absolute bottom-16 left-1/2 z-40 grid w-max -translate-x-1/2 grid-cols-3 gap-1.5 rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-2 shadow-xl" style={{ fontFamily: "'Baloo 2', cursive" }} onClick={(e) => e.stopPropagation()}>
            {EMOTE_KEYS.map((k) => (
              <button key={k} type="button" disabled={walking} onClick={() => { sendEmote(k); setEmoteMenuOpen(false); }} className="flex w-24 flex-col items-center rounded-lg border border-[#7a4a22]/50 bg-white/40 px-1 py-1 text-xs font-bold text-[#3a2410] hover:bg-white/70 disabled:opacity-40" style={{ cursor: CURSOR_INTERACT }}>
                <span className="text-xl leading-none">{EMOTES[k].icon}</span>
                {EMOTES[k].label}
                <span className="text-[10px] font-normal opacity-60">/{EMOTES[k].commands[0]}</span>
              </button>
            ))}
          </div>
        )}
        {/* Barre d'icônes du bas : toutes de la même taille, alignées et centrées. */}
        {character && !activeCombatId && (() => {
          const boxPx = inExpeditionScene ? 30 : Math.round(Math.min(60, Math.max(34, sceneBoxSize.width * 0.05)));   // suit la taille de la scène
          const box = `${boxPx}px`;
          const items: { key: string; title: string; src: string; onClick: () => void }[] = [
            ...(!inExpeditionScene ? [{ key: "sheet", title: "Ma fiche de personnage", src: "/icons/sheet.png", onClick: () => setInspectId(character.id) }] : []),
            { key: "bag", title: "Inventaire", src: "/icons/bag.svg", onClick: () => setInventoryOpen(true) },
            ...(!inExpeditionScene ? [
              { key: "talents", title: "Talents", src: "/icons/target.png", onClick: () => setTalentsOpen(true) },
              { key: "groups", title: "Le Panneau des Aventuriers", src: "/icons/group.png", onClick: () => setBoardOpen(true) },
            ] : []),
          ];
          return (
            <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-end gap-2">
              {items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); it.onClick(); }}
                  title={it.title}
                  className="px-1 leading-none transition-transform hover:scale-110"
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.7))", cursor: CURSOR_INTERACT }}
                >
                  <img src={it.src} alt={it.title} draggable={false} style={{ height: box, width: box, objectFit: "contain" }} />
                </button>
              ))}
            </div>
          );
        })()}
        {character && !activeCombatId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHelpOpen(true);
            }}
            title="Signaler un bug, aide, confidentialité"
            className="absolute right-5 top-20 z-30 px-1 text-2xl leading-none transition-transform hover:scale-110"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.7))", cursor: CURSOR_DEFAULT }}
          >
            🐞
          </button>
        )}
        {character && !activeCombatId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAboutOpen(true);
            }}
            title="À propos / Soutien"
            className="absolute right-5 top-32 z-30 px-1 text-2xl leading-none transition-transform hover:scale-110"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.7))", cursor: CURSOR_DEFAULT }}
          >
            ❤️
          </button>
        )}
        {character && !inExpeditionScene && !activeCombatId && !boardOpen && <GroupAdBanner onOpen={() => setBoardOpen(true)} />}
        {boardOpen && character && !inExpeditionScene && (
          <GroupBoard character={{ id: character.id, name: character.name }} onClose={() => setBoardOpen(false)} onInvite={(id) => void handleInvitePeer(id)} />
        )}
        {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
        {referralReveal && character && !inExpeditionScene && <ReferralReveal onDone={() => setReferralReveal(false)} />}
        {helpOpen && character && <HelpDialog expeditionId={activeExpedition?.id ?? null} stepId={runStep?.id ?? null} onClose={() => setHelpOpen(false)} />}
        {welcomeOpen && character && (
          <WelcomeModal
            name={character.name}
            onClose={() => {
              setWelcomeOpen(false);
              try {
                localStorage.setItem("obliqworld-welcome-v1", "1");
              } catch {
                /* ignoré */
              }
            }}
          />
        )}
        {talentsOpen && character && !activeCombatId && !inExpeditionScene && (
          <TalentPanel characterId={character.id} onClose={() => setTalentsOpen(false)} />
        )}
        {renameAxis && character && !axisChoice && !inExpeditionScene && (
          <ClassNameModal characterId={character.id} axisKey={renameAxis} onDone={() => setRenameAxis(null)} />
        )}
        {inventoryOpen && character && !activeCombatId && (
          <InventoryPanel
            character={{ id: character.id, name: character.name, imageUrl: character.image_url, visualAssetId: character.visual_asset_id }}
            onClose={() => setInventoryOpen(false)}
            onWeaponChanged={handleMyWeaponChanged}
          />
        )}
        {character && !inExpeditionScene && !activeCombatId && <QuestTracker sceneId={scene.id} refreshKey={endBanner ? 1 : 0} />}
        <AccountBadge
          identity={authIdentity}
          onConnect={handleConnectProvider}
          onDisconnect={handleDisconnect}
          className="absolute left-5 top-5 z-30"
        />
        {presenceDebugOn && (
          <div
            className="pointer-events-none absolute bottom-2 left-2 z-30 max-w-[280px] rounded-md bg-black/70 p-2 font-mono text-[10px] leading-tight text-[#9effa0]"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {presenceLog.length === 0 ? "(journal de présence — en attente)" : presenceLog.join("\n")}
          </div>
        )}
      </div>

      {/* ---------- Chat calé en bas à gauche, flottant directement sur le décor ----------
          Plus de cadre parchemin : texte clair + ombre portée pour rester
          lisible sur n'importe quel fond, sombre ou clair. Conteneur
          pointer-events-none — seuls le log (pour le scroll) et le formulaire
          (input + bouton) réactivent les clics, pour ne pas voler de clics
          destinés au sol de la scène.
          Devient ~90% transparent après 15s sans nouveau message, et repasse
          net dès qu'on le survole (le survol relance aussi les 15s au moment
          où la souris ressort). */}
      <div className={`pointer-events-none absolute bottom-3 left-3 ${trade || boardOpen ? "z-[60]" : "z-40"}`} style={{ width: Math.max(150, Math.min(560, viewport.w / 2 - ((inExpeditionScene ? 1 : 4) * (inExpeditionScene ? 30 : Math.round(Math.min(60, Math.max(34, sceneBoxSize.width * 0.05)))) + 32) / 2 - 24)) }}>
        <div
          className="flex flex-col justify-end gap-1 px-2 py-1 transition-opacity duration-300"
          style={{
            opacity: chatIdle && !chatHovered ? CHAT_IDLE_OPACITY : 1,
            pointerEvents: "auto",
          }}
          onMouseEnter={() => setChatHovered(true)}
          onMouseLeave={() => {
            setChatHovered(false);
            bumpChatActivity();
          }}
        >
          <div
            ref={chatLogRef}
            className="no-scrollbar pointer-events-auto flex max-h-36 flex-col gap-0.5 overflow-y-auto pr-1 text-sm"
            style={{
              fontFamily: "'Baloo 2', cursive",
              color: "#fff3d6",
              textShadow: "0 1px 0 #2b1406, 0 1px 6px rgba(0, 0, 0, 0.85)",
            }}
          >
            {chatLog.length === 0 && <p className="opacity-70">Le t'chat est vide pour l'instant…</p>}
            {chatLog.map((m, i) => (
              <p key={i} style={m.channel === "group" ? { color: GROUP_CHAT_COLOR } : m.characterId === "system" ? { opacity: 0.75, fontStyle: "italic" } : undefined}>
                {m.channel === "group" && <span className="mr-1 text-[11px] font-extrabold uppercase">[Groupe]</span>}
                {m.characterId === "system" ? m.text : <><span className="font-bold" style={{ color: m.color ?? autoNameColor(m.characterId) }}>{m.name} :</span> {m.text}</>}
              </p>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="pointer-events-auto relative mt-1 flex gap-2">
            {emojiOpen && (
              <div className="absolute bottom-full right-0 mb-1 grid w-60 grid-cols-8 gap-0.5 rounded-lg bg-black/80 p-2 text-xl">
                {CHAT_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    className="rounded p-0.5 hover:bg-white/20"
                    onClick={() => {
                      setChatInput((v) => (v + em).slice(0, 200));
                      setEmojiOpen(false);
                      chatInputRef.current?.focus();
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
            <input
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              maxLength={200}
              placeholder={chatChannel === "group" ? "Message au groupe (/d pour général)…" : party ? "Écrire un message… (/g pour groupe, /d pour général)" : "Écrire un message…"}
              className="flex-1 rounded-md bg-black/35 px-2 py-1 text-sm outline-none placeholder:text-[#fff3d6]/50"
              style={{
                color: chatChannel === "group" ? GROUP_CHAT_COLOR : "#fff3d6",
                fontFamily: "'Baloo 2', cursive",
                textShadow: "0 1px 4px rgba(0, 0, 0, 0.7)",
              }}
            />
            {colorOpen && (
              <div className="absolute bottom-full right-0 mb-1 w-52 rounded-lg bg-black/80 p-2">
                <div className="mb-1 text-[11px] font-bold text-[#fff3d6]">Couleur de ton pseudo</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {NAME_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => pickChatColor(c)} className="h-6 w-6 rounded-full border-2" style={{ background: c, borderColor: chatColor === c ? "#fff" : "transparent" }} />
                  ))}
                </div>
                <button type="button" onClick={() => pickChatColor(null)} className="mt-1.5 text-[11px] font-bold text-[#fff3d6] underline">Couleur automatique</button>
              </div>
            )}
            <button
              type="button"
              title="Couleur de ton pseudo"
              onClick={() => { setColorOpen((o) => !o); setEmojiOpen(false); }}
              className="rounded-md bg-black/35 px-2 text-lg hover:bg-black/50"
            >
              <span style={{ display: "inline-block", width: "1.1rem", height: "1.1rem", borderRadius: "50%", background: chatColor ?? (character ? autoNameColor(character.id) : "#fff3d6"), border: "2px solid #fff3d6", verticalAlign: "middle" }} />
            </button>
            <button
              type="button"
              title="Emojis"
              onClick={() => { setEmojiOpen((o) => !o); setColorOpen(false); }}
              className="rounded-md bg-black/35 px-2 text-lg hover:bg-black/50"
            >
              😊
            </button>
            <button
              type="submit"
              className="rounded-md bg-black/35 px-3 text-sm font-bold text-[#fff3d6] hover:bg-black/50"
              style={{ textShadow: "0 1px 4px rgba(0, 0, 0, 0.7)" }}
            >
              Envoyer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const CHAT_EMOJIS = ["😀", "😂", "😍", "😎", "😢", "😡", "😮", "🤔", "😴", "😅", "😉", "😇", "👍", "👏", "🙏", "👋", "❤️", "🔥", "✨", "🎉", "💀", "⚔️", "🍺", "🐾"];

function SpeechBubble({ text }: { text: string }) {
  return (
    <div
      className="pointer-events-none absolute bottom-full left-1/2 z-[999] mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-xl border border-[#7a4a22]/70 bg-[#fff3d6] px-3 py-1.5 text-center text-sm text-[#2a180c] shadow-md"
      style={{ fontFamily: "'Baloo 2', cursive" }}
    >
      {text}
      <div
        className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent"
        style={{ borderTopColor: "#fff3d6" }}
      />
    </div>
  );
}

// Pseudo affiché sous les pieds du personnage ; "(ABS)" s'y ajoute quand le
// joueur est absent (aucun déplacement ni message depuis AWAY_AFTER_MS).
function NameTag({ name, away, showName }: { name: string; away: boolean; showName: boolean }) {
  const text = [showName ? name : "", away ? "(ABS)" : ""].filter(Boolean).join(" ");
  if (!text) return null;
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-full mt-1 w-max max-w-[220px] -translate-x-1/2 truncate text-center text-sm font-bold"
      style={{
        fontFamily: "'Baloo 2', cursive",
        color: "#fff3d6",
        opacity: away ? 0.75 : 1,
        textShadow: "0 1px 0 #572a0c, 0 0 6px rgba(43, 20, 6, 0.8)",
      }}
    >
      {text}
    </div>
  );
}

export default Index;
