import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ensureCharacter,
  fetchSceneByName,
  pointInPolygon,
  saveCharacterPosition,
  type Character,
  type Point,
  type Scene,
} from "../lib/scenes-supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auberge" },
      { name: "description", content: "La scène de l'Auberge — ambiance sonore et visuelle." },
      { property: "og:title", content: "Auberge" },
      { property: "og:description", content: "La scène de l'Auberge — ambiance sonore et visuelle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:image",
        content:
          "https://xbesddgqhvwcyjnoxtaz.supabase.co/storage/v1/object/public/scenes/obliqworld.png",
      },
      {
        name: "twitter:image",
        content:
          "https://xbesddgqhvwcyjnoxtaz.supabase.co/storage/v1/object/public/scenes/obliqworld.png",
      },
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
  const scene = Route.useLoaderData() as Scene;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const [character, setCharacter] = useState<Character | null>(null);
  const [pos, setPos] = useState<Point>({ x: 50, y: 70 });
  const [walking, setWalking] = useState(false);
  const [duration, setDuration] = useState(0);
  const walkTimer = useRef<number | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const audio = new Audio(scene.music_url);
    audio.loop = true;
    audioRef.current = audio;

    audio.play().catch(() => {
      setNeedsInteraction(true);
      const start = () => {
        audio.play().then(() => setNeedsInteraction(false)).catch(() => {});
        window.removeEventListener("pointerdown", start);
        window.removeEventListener("keydown", start);
      };
      window.addEventListener("pointerdown", start);
      window.addEventListener("keydown", start);
    });

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [scene.music_url]);

  useEffect(() => {
    let cancelled = false;
    ensureCharacter(scene.id)
      .then((c) => {
        if (cancelled) return;
        setCharacter(c);
        setPos(c.position);
      })
      .catch((e) => console.error("Character setup failed", e));
    return () => {
      cancelled = true;
    };
  }, [scene.id]);

  useEffect(() => () => {
    if (walkTimer.current) window.clearTimeout(walkTimer.current);
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
    if (needsInteraction) {
      audio.play().then(() => setNeedsInteraction(false)).catch(() => {});
    }
  };

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
    walkTimer.current = window.setTimeout(() => {
      setWalking(false);
      saveCharacterPosition(character.id, target);
    }, ms);
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

      {character?.image_url && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: 80,
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

      <h1
        className="pointer-events-none absolute left-6 top-6 select-none text-5xl font-extrabold tracking-wide sm:text-6xl"
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
        className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-xl text-[#fff3d6] backdrop-blur-sm transition-colors hover:bg-black/55"
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}
