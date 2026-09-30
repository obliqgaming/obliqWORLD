import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  broadcastChatMessage,
  computeDepthScale,
  connectIdentityProvider,
  createCharacterWithAsset,
  getAuthIdentity,
  fetchCharacterAssets,
  fetchMyCharacter,
  fetchScene,
  fetchSceneByName,
  fetchSceneExits,
  DEBUG_PRESENCE,
  isChannelReady,
  joinScenePresence,
  readPeersFromChannel,
  leaveScenePresence,
  moveCharacterToScene,
  pointInPolygon,
  saveCharacterPosition,
  scenesClient,
  signOutToGuest,
  type AuthIdentity,
  type Character,
  type ChatMessage,
  type PeerState,
  type PresenceChannel,
  type Point,
  type Scene,
  type SceneExit,
  type VisualAsset,
} from "../lib/scenes-supabase";
import { AccountBadge } from "../components/AccountBadge";
import { CharacterSelect } from "../components/CharacterSelect";
import { SoundControl } from "../components/SoundControl";
import { findPath } from "../lib/pathfinding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auberge" },
      { name: "description", content: "Explorez le monde — auberge, village, forêt." },
      { property: "og:title", content: "Auberge" },
      { property: "og:description", content: "Explorez le monde — auberge, village, forêt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap",
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
  const [authIdentity, setAuthIdentity] = useState<AuthIdentity | null>(null);
  // Journal visible à l'écran (dernières lignes), pour diagnostiquer sans
  // avoir besoin d'ouvrir la console du navigateur (F12).
  const [presenceLog, setPresenceLog] = useState<string[]>([]);
  const lastLoggedPeerKeysRef = useRef<string>("");
  const logPresence = (line: string) => {
    if (DEBUG_PRESENCE) console.debug(`[presence] ${line}`);
    setPresenceLog((l) => [...l.slice(-19), `${new Date().toLocaleTimeString()} ${line}`]);
  };
  const [characterAssets, setCharacterAssets] = useState<VisualAsset[]>([]);
  const [pos, setPos] = useState<Point>({ x: 50, y: 70 });
  const [walking, setWalking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peers, setPeers] = useState<Record<string, PeerState>>({});

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
  const peerWalkTimers = useRef<Record<string, number>>({});
  const peerRemoveTimers = useRef<Record<string, number>>({});
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
  const [chatInput, setChatInput] = useState("");
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
  const playMusic = (url: string, fade: boolean) => {
    const prev = audioRef.current;
    const next = new Audio(url);
    next.loop = true;
    next.muted = mutedRef.current;
    next.volume = fade ? 0 : volumeRef.current;

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

  useEffect(() => {
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
    try {
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
    fetchMyCharacter()
      .then((c) => {
        if (cancelled) return;
        if (c) {
          setCharacter(c);
          characterRef.current = c;
          setPos(c.position);
          lastLogicalPosRef.current = c.position;
        } else {
          fetchCharacterAssets().then((assets) => {
            if (!cancelled) setCharacterAssets(assets);
          });
        }
      })
      .catch((e) => console.error("Character lookup failed", e))
      .finally(() => {
        if (!cancelled) setCheckingCharacter(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCharacterChosen = async (visualAssetId: string, name: string) => {
    const c = await createCharacterWithAsset(scene.id, visualAssetId, name);
    setCharacter(c);
    characterRef.current = c;
    setPos(c.position);
    lastLogicalPosRef.current = c.position;
  };

  useEffect(() => () => {
    if (walkTimer.current) window.clearTimeout(walkTimer.current);
    Object.values(peerWalkTimers.current).forEach((t) => window.clearTimeout(t));
    Object.values(bubbleTimers.current).forEach((t) => window.clearTimeout(t));
  }, []);

  // ---------- Tchat propre à chaque scène : on vide le log affiché quand on
  // change de scène (le canal réseau était déjà séparé par scène, mais le
  // log local gardait les anciens messages affichés par-dessus) ----------
  useEffect(() => {
    setChatLog([]);
    setChatInput("");
  }, [scene.id]);

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

  // ---------- Mise à jour locale des pairs (marche calculée nous-mêmes, pas confiance au réseau) ----------
  const handlePeerUpdate = (newPeers: Record<string, PeerState>) => {
    // On ne journalise que si la liste change vraiment (sinon le recalage
    // périodique, silencieux et sans coût réseau, noierait le journal sous
    // des lignes identiques toutes les 4 secondes).
    const keys = Object.keys(newPeers).sort().join(",");
    if (keys !== lastLoggedPeerKeysRef.current) {
      lastLoggedPeerKeysRef.current = keys;
      logPresence(`pairs vus : ${Object.keys(newPeers).length}${keys ? ` [${keys.slice(0, 40)}]` : ""}`);
    }
    // On fusionne plutôt que de remplacer : un pair en attente de retrait
    // (grâce ci-dessous) doit rester affiché même s'il n'est plus dans
    // newPeers pour l'instant.
    setPeers((prev) => ({ ...prev, ...newPeers }));
    const rect = sceneRef.current?.getBoundingClientRect();

    Object.entries(newPeers).forEach(([key, peer]) => {
      const prev = prevPeerPosRef.current[key];
      prevPeerPosRef.current[key] = peer.position;

      if (!prev || !rect) return;
      if (prev.x === peer.position.x && prev.y === peer.position.y) return;

      const dist = distanceInPx(rect, prev, peer.position);
      if (dist < 1) return;
      const ms = walkDurationMs(dist);

      if (Math.abs(peer.position.x - prev.x) > 0.01) {
        setPeerFacingRight((f) => ({ ...f, [key]: peer.position.x > prev.x }));
      }

      setPeerDuration((d) => ({ ...d, [key]: ms }));
      setPeerWalking((w) => ({ ...w, [key]: true }));

      if (peerWalkTimers.current[key]) window.clearTimeout(peerWalkTimers.current[key]);
      peerWalkTimers.current[key] = window.setTimeout(() => {
        setPeerWalking((w) => ({ ...w, [key]: false }));
      }, ms);
    });

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
    Object.values(peerWalkTimers.current).forEach((t) => window.clearTimeout(t));
    peerWalkTimers.current = {};
    Object.values(peerRemoveTimers.current).forEach((t) => window.clearTimeout(t));
    peerRemoveTimers.current = {};
    setPeerWalking({});
    setPeerDuration({});

    awayRef.current = false;
    setSelfAway(false);

    let cancelled = false;
    scenesClient.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session?.user) return;
      const userId = data.session.user.id;
      userIdRef.current = userId;

      leaveScenePresence(channelRef.current);
      channelRef.current = joinScenePresence(
        scene.id,
        userId,
        handlePeerUpdate,
        handleChatReceived,
        // Chaque changement d'état du canal, visible dans le journal à
        // l'écran. Sur "SUBSCRIBED" (première fois ou après une coupure), on
        // republie systématiquement notre position pour rester visible.
        (status, err) => {
          logPresence(`état du canal : ${status}${err ? ` (${err.message})` : ""}`);
          if (status === "SUBSCRIBED") {
            trackPresence(lastLogicalPosRef.current, 0, false);
            armAwayTimer();
          }
        },
      );
    });

    return () => {
      cancelled = true;
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
      handlePeerUpdate(readPeersFromChannel(channelRef.current, userIdRef.current));
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
        handlePeerUpdate(readPeersFromChannel(channelRef.current, userIdRef.current));
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

  const trackPresence = (nextPos: Point, ms: number, isWalking: boolean) => {
    if (!channelRef.current || !characterRef.current) return;
    if (!isChannelReady(channelRef.current)) {
      logPresence(`position NON envoyée (canal pas encore ouvert, state=${channelRef.current.state})`);
      return;
    }
    channelRef.current.track({
      characterId: characterRef.current.id,
      name: characterRef.current.name,
      image_url: characterRef.current.image_url,
      position: nextPos,
      duration: ms,
      walking: isWalking,
      away: awayRef.current,
    } satisfies PeerState);
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
  const stepWalk = (rect: DOMRect, onArrive?: () => void) => {
    if (!character) return;
    const next = walkQueueRef.current.shift();
    if (!next) {
      setWalking(false);
      onArrive?.();
      return;
    }

    const origin = charSpriteRef.current ? currentSpritePercent(charSpriteRef.current, rect) : pos;
    const dist = distanceInPx(rect, origin, next);
    const ms = walkDurationMs(dist);

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
    trackPresence(next, ms, true);

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
  const startWalk = (target: Point, onArrive?: () => void) => {
    if (!character || !sceneRef.current) return;
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

    startWalk(target);
  };

  // ---------- Changement de scène (appelé une fois la marche jusqu'à la sortie terminée) ----------
  const changeScene = async (exit: SceneExit) => {
    if (!character) return;
    try {
      const [newScene, newExits] = await Promise.all([
        fetchScene(exit.to_scene_id),
        fetchSceneExits(exit.to_scene_id),
      ]);
      const reverse = newExits.find((x) => x.to_scene_id === scene.id);
      const arrival = reverse ? reverse.position : { x: 50, y: 70 };

      playMusic(newScene.music_url, true);

      setScene(newScene);
      setExits(newExits);
      setPos(arrival);
      lastLogicalPosRef.current = arrival;
      setWalking(false);

      const updated = { ...character, scene_id: newScene.id, position: arrival };
      setCharacter(updated);
      characterRef.current = updated;

      await moveCharacterToScene(character.id, newScene.id, arrival);
      trackPresence(arrival, 0, false);
    } catch (err) {
      console.error("Scene change failed", err);
    }
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

  // ---------- Chat ----------
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !character || !channelRef.current) return;

    const msg: ChatMessage = { characterId: character.id, name: character.name, text, ts: Date.now() };
    setChatLog((log) => [...log.slice(-(CHAT_LOG_SIZE - 1)), msg]);
    showBubble(character.id, text);
    const sent = broadcastChatMessage(channelRef.current, msg);
    if (!sent) logPresence(`message NON envoyé (canal pas encore ouvert, state=${channelRef.current.state})`);
    setChatInput("");
    bumpChatActivity();
    markActive();
  };

  if (checkingCharacter) {
    return <div className="flex h-screen w-screen items-center justify-center bg-black text-[#fff3d6]">Chargement…</div>;
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
      />
    );
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
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
          cursor: "url('/cursors/cursor-default.png') 2 2, pointer",
        }}
      >
        <style>{`
          @keyframes auberge-walk{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
          .cursor-creature{cursor:url('/cursors/cursor-creature.png') 24 24, pointer;}
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
            className="cursor-creature absolute z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fff3d6]/80 bg-black/30 backdrop-blur-sm transition-transform hover:scale-110"
            style={{ left: `${exit.position.x}%`, top: `${exit.position.y}%` }}
          />
        ))}

        {character?.image_url && (
          <div
            ref={charSpriteRef}
            className="pointer-events-none absolute z-20"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
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
            <div style={{ transform: facingRight ? "scaleX(-1)" : "none" }}>
              <img
                src={character.image_url}
                alt={character.name}
                draggable={false}
                className="block w-full"
                style={{
                  transformOrigin: "50% 100%",
                  animation: walking ? "auberge-walk 250ms linear infinite" : "none",
                }}
              />
            </div>
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
                width: sceneBoxSize.width * CHARACTER_WIDTH_RATIO,
                transformOrigin: "50% 100%",
                transform: `translate(-50%, -100%) scale(${computeDepthScale(peer.position.y, scene.depth_scale)})`,
                transition: isWalking
                  ? `left ${ms}ms linear, top ${ms}ms linear, transform ${ms}ms linear`
                  : "none",
              }}
            >
              {bubbles[peer.characterId] && <SpeechBubble text={bubbles[peer.characterId].text} />}
              <div style={{ transform: isFacingRight ? "scaleX(-1)" : "none" }}>
                <img
                  src={peer.image_url}
                  alt={peer.name}
                  draggable={false}
                  className="block w-full"
                  style={{
                    transformOrigin: "50% 100%",
                    animation: isWalking ? "auberge-walk 250ms linear infinite" : "none",
                  }}
                />
              </div>
              <NameTag name={peer.name} away={!!peer.away} showName={SHOW_NAME_LABELS} />
            </div>
          );
        })}

        <h1
          className="pointer-events-none absolute left-6 top-6 z-30 select-none text-5xl font-extrabold tracking-wide sm:text-6xl"
          style={{
            fontFamily: "'Baloo 2', cursive",
            color: "#fff3d6",
            textShadow: "0 2px 0 #b4531f, 0 4px 0 rgba(87, 42, 12, 0.55), 0 8px 22px rgba(43, 20, 6, 0.6)",
            transform: "rotate(-2deg)",
          }}
        >
          {scene.name}
        </h1>

        <SoundControl
          muted={muted}
          onToggleMute={toggleMute}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          className="absolute right-5 top-5 z-30"
        />
        <AccountBadge
          identity={authIdentity}
          onConnect={handleConnectProvider}
          onDisconnect={handleDisconnect}
          className="absolute left-5 top-5 z-30"
        />
        {DEBUG_PRESENCE && (
          <div
            className="pointer-events-none absolute bottom-2 left-2 z-30 max-w-[280px] rounded-md bg-black/70 p-2 font-mono text-[10px] leading-tight text-[#9effa0]"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {presenceLog.length === 0 ? "(journal de présence — en attente)" : presenceLog.join("\n")}
          </div>
        )}
      </div>

      {/* ---------- Chat calé en bas à gauche, habillé avec le cadre parchemin ----------
          IMPORTANT : ce conteneur décoratif est pointer-events-none — seuls le
          log (pour le scroll) et le formulaire (input + bouton) réactivent les
          clics. Ça évite que le cadre (même s'il est plus grand que ce qu'on
          voit) ne vole des clics destinés au sol de la scène.
          Devient ~90% transparent après 15s sans nouveau message, et repasse
          net dès qu'on le survole (le survol relance aussi les 15s au moment
          où la souris ressort). */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-40 w-[min(560px,88vw)]">
        <div
          className="flex flex-col justify-center transition-opacity duration-300"
          style={{
            minHeight: 260, // deux fois plus d'espace utile qu'avant pour lire plusieurs lignes
            borderStyle: "solid",
            borderWidth: "40px 62px 36px 74px",
            borderImageSource: "url('/ui/chat-frame.png')",
            borderImageSlice: "130 230 120 260 fill",
            borderImageRepeat: "stretch",
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
            className="pointer-events-auto flex max-h-36 flex-col gap-0.5 overflow-y-auto pr-1 text-sm"
            style={{ fontFamily: "'Baloo 2', cursive", color: "#3a2210" }}
          >
            {chatLog.length === 0 && <p className="text-[#6b4a2c]/70">Le t'chat est vide pour l'instant…</p>}
            {chatLog.map((m, i) => (
              <p key={i}>
                <span className="font-bold text-[#7a3a12]">{m.name} :</span> {m.text}
              </p>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="pointer-events-auto mt-1 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              maxLength={200}
              placeholder="Écrire un message…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#6b4a2c]/50"
              style={{ color: "#2a180c", fontFamily: "'Baloo 2', cursive" }}
            />
            <button type="submit" className="text-sm font-bold text-[#7a3a12] hover:text-[#4a2408]">
              Envoyer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SpeechBubble({ text }: { text: string }) {
  return (
    <div
      className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-xl border border-[#7a4a22]/70 bg-[#fff3d6] px-3 py-1.5 text-center text-sm text-[#2a180c] shadow-md"
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
