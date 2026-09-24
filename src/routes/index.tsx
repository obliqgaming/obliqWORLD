import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ensureCharacter,
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
  type PeerState,
  type PresenceChannel,
  type Point,
  type Scene,
  type SceneExit,
} from "../lib/scenes-supabase";

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

function Index() {
  const initialScene = Route.useLoaderData() as Scene;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const mutedRef = useRef(false);

  const [scene, setScene] = useState<Scene>(initialScene);
  const [exits, setExits] = useState<SceneExit[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [pos, setPos] = useState<Point>({ x: 50, y: 70 });
  const [walking, setWalking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peers, setPeers] = useState<Record<string, PeerState>>({});

  const walkTimer = useRef<number | null>(null);
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

  // ---------- Personnage ----------
  useEffect(() => {
    let cancelled = false;
    ensureCharacter(scene.id)
      .then((c) => {
        if (cancelled) return;
        setCharacter(c);
        characterRef.current = c;
        setPos(c.position);
      })
      .catch((e) => console.error("Character setup failed", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (walkTimer.current) window.clearTimeout(walkTimer.current);
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

  // ---------- Présence multijoueur : rejoint le canal de la scène courante ----------
  useEffect(() => {
    if (!character) return;
    sceneIdRef.current = scene.id;

    let cancelled = false;
    scenesClient.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session?.user) return;
      const userId = data.session.user.id;
      userIdRef.current = userId;

      leaveScenePresence(channelRef.current);
      channelRef.current = joinScenePresence(scene.id, userId, setPeers);

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

  // ---------- Déplacement classique (clic au sol) ----------
  const handleSceneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!character || walking || !scene.walkable_zone || !sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const target = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    if (!pointInPolygon(target, scene.walkable_zone)) return;

    const dxPx = ((target.x - pos.x) / 100) * rect.width;
    const dyPx = ((target.y - pos.y) / 100) * rect.height;
    const dist = Math.hypot(dxPx, dyPx);
    const maxDist = Math.hypot(rect.width, rect.height);
    const ms = Math.round(400 + Math.min(1, dist / (maxDist * 0.6)) * 200);

    setDuration(ms);
    setWalking(true);
    setPos(target);
    trackPresence(target, ms, true);

    walkTimer.current = window.setTimeout(() => {
      setWalking(false);
      saveCharacterPosition(character.id, target);
      trackPresence(target, 0, false);
    }, ms);
  };

  // ---------- Changement de scène via une sortie ----------
  const handleExitClick = async (e: React.MouseEvent, exit: SceneExit) => {
    e.stopPropagation();
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
    } catch (err) {
      console.error("Scene change failed", err);
    }
  };

  return (
    <div
      ref={sceneRef}
      onClick={handleSceneClick}
      className="relative h-screen w-screen cursor-pointer overflow-hidden"
    >
      <style>{`@keyframes auberge-walk{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}`}</style>
      <img
        src={scene.image_url}
        alt={scene.name}
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
          style={{ left: `${exit.position.x}%`, top: `${exit.position.y}%` }}
        />
      ))}

      {character?.image_url && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: 150,
            transform: "translate(-50%, -100%)",
            transition: walking ? `left ${duration}ms linear, top ${duration}ms linear` : "none",
          }}
        >
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

      {Object.entries(peers).map(([key, peer]) => (
        <div
          key={key}
          className="pointer-events-none absolute z-20"
          style={{
            left: `${peer.position.x}%`,
            top: `${peer.position.y}%`,
            width: 150,
            transform: "translate(-50%, -100%)",
            transition: peer.walking
              ? `left ${peer.duration}ms linear, top ${peer.duration}ms linear`
              : "none",
          }}
        >
          <img
            src={peer.image_url}
            alt={peer.name}
            draggable={false}
            className="block w-full"
            style={{
              transformOrigin: "50% 100%",
              animation: peer.walking ? "auberge-walk 250ms linear infinite" : "none",
            }}
          />
        </div>
      ))}

      <h1
        className="pointer-events-none absolute left-6 top-6 z-30 select-none text-5xl font-extrabold tracking-wide sm:text-6xl"
        style={{
          fontFamily: "'Baloo 2', cursive",
          color: "#fff3d6",
          textShadow:
            "0 2px 0 #b4531f, 0 4px 0 rgba(87, 42, 12, 0.55), 0 8px 22px rgba(43, 20, 6, 0.6)",
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
    </div>
  );
}
