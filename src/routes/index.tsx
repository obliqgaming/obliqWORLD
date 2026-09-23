import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { fetchSceneByName, type Scene } from "../lib/scenes-supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auberge" },
      { name: "description", content: "La scène de l'Auberge — ambiance sonore et visuelle." },
      { property: "og:title", content: "Auberge" },
      { property: "og:description", content: "La scène de l'Auberge — ambiance sonore et visuelle." },
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

  useEffect(() => {
    const audio = new Audio(scene.music_url);
    audio.loop = true;
    audioRef.current = audio;

    audio.play().catch(() => {
      // Autoplay with sound blocked: start on first user interaction.
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

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
    if (needsInteraction) {
      audio.play().then(() => setNeedsInteraction(false)).catch(() => {});
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <img
        src={scene.image_url}
        alt={scene.name}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <h1
        className="absolute left-6 top-6 select-none text-5xl font-extrabold tracking-wide sm:text-6xl"
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
