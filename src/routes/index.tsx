import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  broadcastChatMessage,
  createCharacterWithAsset,
  fetchCharacterAssets,
  fetchMyCharacter,
  fetchScene,
  fetchSceneByName,
  fetchSceneExits,
  joinScenePresence,
  leaveScenePresence,
  moveCharacterToScene,
  pointInPolygon,
  saveCharacterPosition,
  scenesClient,
  type Character,
  type ChatMessage,
  type PeerState,
  type PresenceChannel,
  type Point,
  type Scene,
  type SceneExit,
  type VisualAsset,
} from "../lib/scenes-supabase";
import { CharacterSelect } from "../components/CharacterSelect";
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
const ACCEL_INTENSITY = 0.2; // ~80% de moins que l'accélération d'origine
const ACCEL_REFERENCE_PX = 900; // distance à partir de laquelle le bonus est à fond
const MIN_WALK_MS = 300;
const CHAT_BUBBLE_MS = 4500;
const CHAT_LOG_SIZE = 30;
const CHAT_IDLE_MS = 15000; // délai avant que le tchat devienne quasi transparent
const CHAT_IDLE_OPACITY = 0.1;

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
  // Debug: affiche la zone marchable réellement utilisée par le code (celle
  // enregistrée en base), pour comparer avec ce qui a été dessiné/voulu.
  const [showZoneDebug, setShowZoneDebug] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const mutedRef = useRef(false);

  const [scene, setScene] = useState<Scene>(initialScene);
  const [exits, setExits] = useState<SceneExit[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [checkingCharacter, setCheckingCharacter] = useState(true);
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
  const [peerWalking, setPeerWalking] = useState<Record<string, boolean>>({});
  const [peerDuration, setPeerDuration] = useState<Record<string, number>>({});

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
    next.volume = fade ? 0 : 1;

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
        next.volume = Math.min(1, i / steps);
        if (prev) prev.volume = Math.max(0, 1 - i / steps);
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
  };

  useEffect(() => () => {
    if (walkTimer.current) window.clearTimeout(walkTimer.current);
    Object.values(peerWalkTimers.current).forEach((t) => window.clearTimeout(t));
    Object.values(bubbleTimers.current).forEach((t) => window.clearTimeout(t));
  }, []);

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
    setPeers(newPeers);
    const rect = sceneRef.current?.getBoundingClientRect();

    Object.entries(newPeers).forEach(([key, peer]) => {
      const prev = prevPeerPosRef.current[key];
      prevPeerPosRef.current[key] = peer.position;

      if (!prev || !rect) return;
      if (prev.x === peer.position.x && prev.y === peer.position.y) return;

      const dist = distanceInPx(rect, prev, peer.position);
      if (dist < 1) return;
      const ms = walkDurationMs(dist);

      setPeerDuration((d) => ({ ...d, [key]: ms }));
      setPeerWalking((w) => ({ ...w, [key]: true }));

      if (peerWalkTimers.current[key]) window.clearTimeout(peerWalkTimers.current[key]);
      peerWalkTimers.current[key] = window.setTimeout(() => {
        setPeerWalking((w) => ({ ...w, [key]: false }));
      }, ms);
    });

    Object.keys(prevPeerPosRef.current).forEach((key) => {
      if (!(key in newPeers)) {
        delete prevPeerPosRef.current[key];
        if (peerWalkTimers.current[key]) window.clearTimeout(peerWalkTimers.current[key]);
        delete peerWalkTimers.current[key];
      }
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
    setPeerWalking({});
    setPeerDuration({});

    let cancelled = false;
    scenesClient.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session?.user) return;
      const userId = data.session.user.id;
      userIdRef.current = userId;

      leaveScenePresence(channelRef.current);
      channelRef.current = joinScenePresence(scene.id, userId, handlePeerUpdate, handleChatReceived);

      channelRef.current.track({
        characterId: character.id,
        name: character.name,
        image_url: character.image_url,
        position: pos,
        duration: 0,
        walking: false,
      } satisfies PeerState);
    });

    return () => {
      cancelled = true;
      leaveScenePresence(channelRef.current);
      channelRef.current = null;
      setPeers({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, character?.id]);

  const trackPresence = (nextPos: Point, ms: number, isWalking: boolean) => {
    if (!channelRef.current || !characterRef.current) return;
    channelRef.current.track({
      characterId: characterRef.current.id,
      name: characterRef.current.name,
      image_url: characterRef.current.image_url,
      position: nextPos,
      duration: ms,
      walking: isWalking,
    } satisfies PeerState);
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

    if (walkTimer.current) {
      window.clearTimeout(walkTimer.current);
      walkTimer.current = null;
    }

    const origin = walking && charSpriteRef.current ? currentSpritePercent(charSpriteRef.current, rect) : pos;
    const waypoints = scene.walkable_zone ? findPath(origin, target, scene.walkable_zone) : [target];
    walkQueueRef.current = waypoints;
    stepWalk(rect, onArrive);
  };

  // ---------- Déplacement classique (clic au sol) ----------
  const handleSceneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!character || !scene.walkable_zone || !sceneRef.current) return;

    const rect = sceneRef.current.getBoundingClientRect();
    const target = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    if (!pointInPolygon(target, scene.walkable_zone)) return;

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
    broadcastChatMessage(channelRef.current, msg);
    setChatInput("");
    bumpChatActivity();
  };

  if (checkingCharacter) {
    return <div className="flex h-screen w-screen items-center justify-center bg-black text-[#fff3d6]">Chargement…</div>;
  }

  if (!character) {
    return <CharacterSelect assets={characterAssets} onChoose={handleCharacterChosen} />;
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div
        ref={sceneRef}
        onClick={handleSceneClick}
        className="relative cursor-pointer overflow-hidden"
        style={{ width: sceneBoxSize.width, height: sceneBoxSize.height }}
      >
        <style>{`@keyframes auberge-walk{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}`}</style>
        <img
          src={scene.image_url}
          alt={scene.name}
          onLoad={(e) => setImgNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {showZoneDebug && scene.walkable_zone && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points={scene.walkable_zone.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="rgba(56,189,120,0.3)"
              stroke="rgba(16,150,72,0.95)"
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {exits.map((exit) => (
          <button
            key={exit.id}
            type="button"
            onClick={(e) => handleExitClick(e, exit)}
            aria-label={exit.label ?? "Sortie"}
            title={exit.label ?? undefined}
            className="absolute z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fff3d6]/80 bg-black/30 backdrop-blur-sm transition-transform hover:scale-110"
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
              width: 120,
              transform: "translate(-50%, -100%)",
              transition: walking ? `left ${duration}ms linear, top ${duration}ms linear` : "none",
            }}
          >
            {bubbles[character.id] && <SpeechBubble text={bubbles[character.id].text} />}
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
        )}

        {Object.entries(peers).map(([key, peer]) => {
          const isWalking = !!peerWalking[key];
          const ms = peerDuration[key] ?? 0;
          return (
            <div
              key={key}
              className="pointer-events-none absolute z-20"
              style={{
                left: `${peer.position.x}%`,
                top: `${peer.position.y}%`,
                width: 120,
                transform: "translate(-50%, -100%)",
                transition: isWalking ? `left ${ms}ms linear, top ${ms}ms linear` : "none",
              }}
            >
              {bubbles[peer.characterId] && <SpeechBubble text={bubbles[peer.characterId].text} />}
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

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Activer le son" : "Couper le son"}
          className="absolute right-5 top-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-xl text-[#fff3d6] backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          {muted ? "🔇" : "🔊"}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowZoneDebug((v) => !v);
          }}
          aria-label="Afficher la zone marchable (debug)"
          title="Afficher la zone marchable (debug)"
          className="absolute right-5 top-20 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-xl text-[#fff3d6] backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          🗺️
        </button>
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

export default Index;
