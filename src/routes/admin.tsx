import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ensureUserId,
  fetchAllScenes,
  fetchScene,
  updateSceneZones,
  type Point,
  type Scene,
} from "../lib/scenes-supabase";

// Page d'admin volontairement non reliée au menu du jeu (accessible seulement
// en tapant l'URL /admin) : permet de dessiner les pièces (zone marchable) et
// les obstacles (tables, meubles isolés) directement sur l'image de chaque
// scène, à la souris, et d'enregistrer en un clic dans Supabase — sans passer
// par le SQL editor.
export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Mode = "room" | "obstacle";

function AdminPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState<string>("");
  const [scene, setScene] = useState<Scene | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);

  const [rooms, setRooms] = useState<Point[][]>([]);
  const [obstacles, setObstacles] = useState<Point[][]>([]);
  const [mode, setMode] = useState<Mode>("room");
  const [draft, setDraft] = useState<Point[]>([]);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const boxRef = useRef<HTMLDivElement | null>(null);

  // Session anonyme nécessaire pour pouvoir écrire (la policy RLS d'update
  // exige un utilisateur connecté, même anonyme — comme pour le reste du jeu).
  useEffect(() => {
    ensureUserId().catch((err) => console.error("admin: connexion anonyme impossible", err));
  }, []);

  useEffect(() => {
    fetchAllScenes()
      .then((list) => {
        setScenes(list);
        if (list[0]) setSceneId(list[0].id);
      })
      .catch((err) => console.error("fetchAllScenes a échoué", err));
  }, []);

  useEffect(() => {
    if (!sceneId) return;
    setImgNatural(null);
    setDraft([]);
    setStatus(null);
    fetchScene(sceneId)
      .then((s) => {
        setScene(s);
        setRooms(s.walkable_zone ? s.walkable_zone.map((room) => room.map((p) => ({ ...p }))) : []);
        setObstacles(s.obstacles ? s.obstacles.map((hole) => hole.map((p) => ({ ...p }))) : []);
      })
      .catch((err) => console.error("fetchScene a échoué", err));
  }, [sceneId]);

  const aspect = imgNatural ? imgNatural.w / imgNatural.h : 16 / 9;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const p: Point = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    setDraft((pts) => [...pts, p]);
  };

  const finishShape = () => {
    if (draft.length < 3) return;
    if (mode === "room") setRooms((list) => [...list, draft]);
    else setObstacles((list) => [...list, draft]);
    setDraft([]);
  };
  const cancelShape = () => setDraft([]);
  const removeRoom = (i: number) => setRooms((list) => list.filter((_, idx) => idx !== i));
  const removeObstacle = (i: number) => setObstacles((list) => list.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!scene) return;
    setSaving(true);
    setStatus(null);
    try {
      await updateSceneZones(scene.id, rooms, obstacles);
      setStatus("Enregistré ✅");
    } catch (err) {
      console.error(err);
      setStatus("Erreur à l'enregistrement — regarde la console (F12).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 p-6 text-[#fff3d6]">
      <h1 className="mb-1 text-2xl font-bold">Admin — pièces &amp; obstacles</h1>
      <p className="mb-4 text-sm opacity-70">
        Page non reliée au jeu (uniquement accessible via cette URL). Choisis une scène, dessine, enregistre.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">Scène :</label>
        <select
          value={sceneId}
          onChange={(e) => setSceneId(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
        >
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="ml-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("room");
              setDraft([]);
            }}
            className={`rounded px-3 py-1 text-sm ${mode === "room" ? "bg-emerald-700" : "bg-neutral-800"}`}
          >
            🏠 Pièce (zone marchable)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("obstacle");
              setDraft([]);
            }}
            className={`rounded px-3 py-1 text-sm ${mode === "obstacle" ? "bg-red-700" : "bg-neutral-800"}`}
          >
            🪑 Obstacle
          </button>
        </div>

        <div className="ml-2 flex gap-2">
          <button
            type="button"
            onClick={finishShape}
            disabled={draft.length < 3}
            className="rounded bg-amber-700 px-3 py-1 text-sm disabled:opacity-40"
          >
            Terminer la forme ({draft.length} pts)
          </button>
          <button
            type="button"
            onClick={cancelShape}
            disabled={draft.length === 0}
            className="rounded bg-neutral-800 px-3 py-1 text-sm disabled:opacity-40"
          >
            Annuler la forme
          </button>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || !scene}
          className="ml-auto rounded bg-blue-700 px-4 py-1 text-sm font-semibold disabled:opacity-40"
        >
          {saving ? "Enregistrement…" : "💾 Enregistrer"}
        </button>
      </div>

      {status && <p className="mb-3 text-sm">{status}</p>}

      <div className="flex flex-wrap gap-6">
        {scene && (
          <div
            ref={boxRef}
            onClick={handleClick}
            className="relative cursor-crosshair overflow-hidden rounded border border-neutral-700"
            style={{ width: "min(1100px, 92vw)", aspectRatio: String(aspect) }}
          >
            <img
              src={scene.image_url}
              alt={scene.name}
              onLoad={(e) => setImgNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {rooms.map((room, i) => (
                <polygon
                  key={`room-${i}`}
                  points={room.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(56,189,120,0.3)"
                  stroke="rgba(16,150,72,0.95)"
                  strokeWidth={0.35}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {obstacles.map((hole, i) => (
                <polygon
                  key={`obstacle-${i}`}
                  points={hole.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(220,38,38,0.35)"
                  stroke="rgba(180,20,20,0.95)"
                  strokeWidth={0.35}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {draft.length > 0 && (
                <polyline
                  points={draft.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="rgba(250,204,21,0.95)"
                  strokeWidth={0.4}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {draft.map((p, i) => (
                <circle key={`draft-${i}`} cx={p.x} cy={p.y} r={0.5} fill="rgba(250,204,21,1)" />
              ))}
            </svg>
          </div>
        )}

        <div className="w-64 shrink-0 text-sm">
          <p className="mb-1 font-semibold">Pièces ({rooms.length})</p>
          <ul className="mb-4 space-y-1">
            {rooms.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded bg-neutral-800 px-2 py-1"
              >
                <span>
                  Pièce {i + 1} ({r.length} pts)
                </span>
                <button type="button" onClick={() => removeRoom(i)} className="text-red-400 hover:text-red-300">
                  🗑
                </button>
              </li>
            ))}
            {rooms.length === 0 && <li className="opacity-50">Aucune pour l'instant</li>}
          </ul>

          <p className="mb-1 font-semibold">Obstacles ({obstacles.length})</p>
          <ul className="space-y-1">
            {obstacles.map((o, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded bg-neutral-800 px-2 py-1"
              >
                <span>
                  Obstacle {i + 1} ({o.length} pts)
                </span>
                <button
                  type="button"
                  onClick={() => removeObstacle(i)}
                  className="text-red-400 hover:text-red-300"
                >
                  🗑
                </button>
              </li>
            ))}
            {obstacles.length === 0 && <li className="opacity-50">Aucun pour l'instant</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
