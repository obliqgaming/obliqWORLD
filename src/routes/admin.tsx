import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ensureUserId,
  fetchAllScenes,
  fetchScene,
  updateSceneZones,
  type DepthScale,
  type Point,
  type Scene,
} from "../lib/scenes-supabase";

// Page d'admin volontairement non reliée au menu du jeu (accessible seulement
// en tapant l'URL /admin) : permet de dessiner les pièces (zone marchable), les
// obstacles (tables, meubles isolés) et la calibration de profondeur (taille du
// perso selon sa hauteur dans le décor) directement sur l'image de chaque
// scène, à la souris, et d'enregistrer en un clic dans Supabase.
//
// Filet de sécurité : tout le travail en cours est aussi sauvegardé dans le
// navigateur (localStorage) à chaque changement, par scène. Si tu oublies de
// cliquer "Enregistrer" et que tu fermes/rafraîchis l'onglet, ou changes de
// scène, le brouillon est toujours là au retour sur cette scène — la page te
// proposera de le reprendre.
export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Mode = "room" | "obstacle" | "depth";
type DepthKey = "y80" | "y100" | "y120";
type DepthDraft = { y80: number | null; y100: number | null; y120: number | null };

const EMPTY_DEPTH: DepthDraft = { y80: null, y100: null, y120: null };

function draftKey(sceneId: string) {
  return `obliqworld-admin-draft-${sceneId}`;
}

// Un "snapshot" couvre TOUT ce qui peut se perdre, y compris les points d'une
// forme en cours de tracé (pas encore "Terminée") — sinon un rafraîchissement
// en plein milieu d'un contour ferait perdre ces points-là.
type Snapshot = { rooms: Point[][]; obstacles: Point[][]; depthDraft: DepthDraft; draft: Point[] };
type StoredDraft = Snapshot & { mode: Mode; ts: number };

function loadStoredDraft(sceneId: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(sceneId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft;
  } catch {
    return null;
  }
}

function snapshotEquals(a: Snapshot, b: Snapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function AdminPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState<string>("");
  const [scene, setScene] = useState<Scene | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);

  const [rooms, setRooms] = useState<Point[][]>([]);
  const [obstacles, setObstacles] = useState<Point[][]>([]);
  const [depthDraft, setDepthDraft] = useState<DepthDraft>(EMPTY_DEPTH);
  const [armedDepthKey, setArmedDepthKey] = useState<DepthKey | null>(null);

  const [mode, setMode] = useState<Mode>("room");
  const [draft, setDraft] = useState<Point[]>([]);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<StoredDraft | null>(null);

  // Dernier état connu comme "identique à la base" (juste après chargement ou
  // juste après un enregistrement réussi) — sert à savoir s'il y a des
  // modifications non enregistrées (pour le bandeau d'avertissement et le
  // blocage de fermeture d'onglet). Un enregistrement ne touche que
  // rooms/obstacles/depthDraft (une forme en cours, non terminée, n'est jamais
  // envoyée en base), donc `draft` y reste tel quel : s'il restait des points
  // en cours au moment de "Enregistrer", ils continuent à compter comme non
  // enregistrés, à raison.
  const lastSavedRef = useRef<Snapshot | null>(null);

  const boxRef = useRef<HTMLDivElement | null>(null);

  const isDirty =
    !!scene && !!lastSavedRef.current && !snapshotEquals({ rooms, obstacles, depthDraft, draft }, lastSavedRef.current);

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
    setArmedDepthKey(null);
    setStatus(null);
    setRecoverable(null);
    fetchScene(sceneId)
      .then((s) => {
        setScene(s);
        const dbRooms = s.walkable_zone ? s.walkable_zone.map((room) => room.map((p) => ({ ...p }))) : [];
        const dbObstacles = s.obstacles ? s.obstacles.map((hole) => hole.map((p) => ({ ...p }))) : [];
        const dbDepth: DepthDraft = s.depth_scale
          ? { y80: s.depth_scale.y80, y100: s.depth_scale.y100, y120: s.depth_scale.y120 }
          : EMPTY_DEPTH;

        setRooms(dbRooms);
        setObstacles(dbObstacles);
        setDepthDraft(dbDepth);
        const dbSnapshot: Snapshot = { rooms: dbRooms, obstacles: dbObstacles, depthDraft: dbDepth, draft: [] };
        lastSavedRef.current = dbSnapshot;

        // Un brouillon local différent de ce qui est en base ? On le propose.
        const stored = loadStoredDraft(sceneId);
        if (stored && !snapshotEquals(stored, dbSnapshot)) {
          setRecoverable(stored);
        }
      })
      .catch((err) => console.error("fetchScene a échoué", err));
  }, [sceneId]);

  // Sauvegarde locale automatique à chaque modification — y compris les points
  // d'une forme pas encore terminée — pour un oubli de clic sur "Enregistrer",
  // un rafraîchissement accidentel, ou un changement de scène. Nettoie le
  // brouillon local dès que l'état rejoint exactement ce qui est déjà en base.
  useEffect(() => {
    if (!sceneId || !lastSavedRef.current) return;
    const current: Snapshot = { rooms, obstacles, depthDraft, draft };
    if (snapshotEquals(current, lastSavedRef.current)) {
      try {
        localStorage.removeItem(draftKey(sceneId));
      } catch {
        // ignore
      }
      return;
    }
    try {
      localStorage.setItem(draftKey(sceneId), JSON.stringify({ ...current, mode, ts: Date.now() }));
    } catch {
      // stockage plein/indisponible — tant pis, ce n'est qu'un filet de sécurité
    }
  }, [rooms, obstacles, depthDraft, draft, mode, sceneId]);

  // Empêche de fermer/rafraîchir l'onglet sans s'en rendre compte s'il y a des
  // modifications non enregistrées.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const applyRecoveredDraft = () => {
    if (!recoverable) return;
    setRooms(recoverable.rooms);
    setObstacles(recoverable.obstacles);
    setDepthDraft(recoverable.depthDraft);
    setDraft(recoverable.draft);
    setMode(recoverable.mode);
    setRecoverable(null);
  };
  const discardRecoveredDraft = () => {
    if (sceneId) {
      try {
        localStorage.removeItem(draftKey(sceneId));
      } catch {
        // ignore
      }
    }
    setRecoverable(null);
  };

  const aspect = imgNatural ? imgNatural.w / imgNatural.h : 16 / 9;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const p: Point = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };

    if (mode === "depth") {
      if (!armedDepthKey) return;
      setDepthDraft((d) => ({ ...d, [armedDepthKey]: p.y }));
      setArmedDepthKey(null);
      return;
    }

    setDraft((pts) => [...pts, p]);
  };

  const finishShape = () => {
    if (draft.length < 3) return;
    if (mode === "room") setRooms((list) => [...list, draft]);
    else if (mode === "obstacle") setObstacles((list) => [...list, draft]);
    setDraft([]);
  };
  const cancelShape = () => setDraft([]);
  const removeRoom = (i: number) => setRooms((list) => list.filter((_, idx) => idx !== i));
  const removeObstacle = (i: number) => setObstacles((list) => list.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!scene) return;
    setSaving(true);
    setStatus(null);
    const depthScale: DepthScale | null =
      depthDraft.y80 != null && depthDraft.y100 != null && depthDraft.y120 != null
        ? { y80: depthDraft.y80, y100: depthDraft.y100, y120: depthDraft.y120 }
        : null;
    try {
      await updateSceneZones(scene.id, rooms, obstacles, depthScale);
      // Une forme en cours (pas encore "Terminée") n'est jamais envoyée en base
      // — si `draft` contient encore des points, ils restent non enregistrés à
      // raison, donc on garde le brouillon local plutôt que de le supprimer.
      lastSavedRef.current = { rooms, obstacles, depthDraft, draft };
      try {
        if (draft.length === 0) {
          localStorage.removeItem(draftKey(scene.id));
        } else {
          localStorage.setItem(
            draftKey(scene.id),
            JSON.stringify({ rooms, obstacles, depthDraft, draft, mode, ts: Date.now() }),
          );
        }
      } catch {
        // ignore
      }
      setStatus(draft.length === 0 ? "Enregistré ✅" : "Enregistré ✅ (une forme est encore en cours, pense à la terminer)");
    } catch (err) {
      console.error(err);
      setStatus("Erreur à l'enregistrement — regarde la console (F12). Rien n'est perdu, le brouillon reste sauvegardé localement.");
    } finally {
      setSaving(false);
    }
  };

  const depthLabel: Record<DepthKey, string> = {
    y80: "80% (loin)",
    y100: "100% (normal)",
    y120: "120% (près)",
  };
  const depthColor: Record<DepthKey, string> = {
    y80: "rgba(96,165,250,0.95)",
    y100: "rgba(226,232,240,0.95)",
    y120: "rgba(249,115,22,0.95)",
  };

  return (
    <div className="min-h-screen bg-neutral-900 p-6 text-[#fff3d6]">
      <h1 className="mb-1 text-2xl font-bold">Admin — pièces, obstacles &amp; profondeur</h1>
      <p className="mb-4 text-sm opacity-70">
        Page non reliée au jeu (uniquement accessible via cette URL). Choisis une scène, dessine, enregistre.
      </p>

      {recoverable && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded bg-amber-900/70 px-3 py-2 text-sm">
          <span>
            Un brouillon non enregistré a été trouvé pour cette scène (
            {new Date(recoverable.ts).toLocaleTimeString()}). Le reprendre ?
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={applyRecoveredDraft} className="rounded bg-emerald-700 px-3 py-1">
              Reprendre le brouillon
            </button>
            <button type="button" onClick={discardRecoveredDraft} className="rounded bg-neutral-700 px-3 py-1">
              Ignorer
            </button>
          </div>
        </div>
      )}

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
            🏠 Pièce
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
          <button
            type="button"
            onClick={() => {
              setMode("depth");
              setDraft([]);
              setArmedDepthKey(null);
            }}
            className={`rounded px-3 py-1 text-sm ${mode === "depth" ? "bg-blue-700" : "bg-neutral-800"}`}
          >
            📏 Profondeur
          </button>
        </div>

        {mode !== "depth" && (
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
        )}

        <div className="ml-auto flex items-center gap-3">
          {isDirty && <span className="text-xs text-amber-400">⚠️ modifications non enregistrées</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving || !scene}
            className="rounded bg-blue-700 px-4 py-1 text-sm font-semibold disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : "💾 Enregistrer"}
          </button>
        </div>
      </div>

      {mode === "depth" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded bg-neutral-800 px-3 py-2 text-sm">
          <span className="opacity-70">
            Clique un bouton puis clique sur l'image à la hauteur voulue. Progressif entre les 3 repères — pas
            besoin d'être pixel-perfect.
          </span>
          {(["y80", "y100", "y120"] as DepthKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setArmedDepthKey(key)}
              className="rounded px-3 py-1 text-xs font-semibold"
              style={{
                background: armedDepthKey === key ? depthColor[key] : "rgba(255,255,255,0.08)",
                color: armedDepthKey === key ? "#1a1a1a" : "#fff3d6",
              }}
            >
              {depthLabel[key]}
              {depthDraft[key] != null ? ` — ${depthDraft[key]!.toFixed(1)}%` : " — non placé"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDepthDraft(EMPTY_DEPTH)}
            className="rounded bg-neutral-700 px-3 py-1 text-xs"
          >
            Réinitialiser
          </button>
        </div>
      )}

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
              {mode === "depth" &&
                (["y80", "y100", "y120"] as DepthKey[]).map((key) =>
                  depthDraft[key] != null ? (
                    <line
                      key={key}
                      x1={0}
                      x2={100}
                      y1={depthDraft[key]!}
                      y2={depthDraft[key]!}
                      stroke={depthColor[key]}
                      strokeWidth={0.3}
                      strokeDasharray="1.2,1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null,
                )}
            </svg>
          </div>
        )}

        <div className="w-64 shrink-0 text-sm">
          <p className="mb-1 font-semibold">Pièces ({rooms.length})</p>
          <ul className="mb-4 space-y-1">
            {rooms.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded bg-neutral-800 px-2 py-1">
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
          <ul className="mb-4 space-y-1">
            {obstacles.map((o, i) => (
              <li key={i} className="flex items-center justify-between rounded bg-neutral-800 px-2 py-1">
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

          <p className="mb-1 font-semibold">Profondeur</p>
          <ul className="space-y-1">
            {(["y80", "y100", "y120"] as DepthKey[]).map((key) => (
              <li key={key} className="rounded bg-neutral-800 px-2 py-1">
                {depthLabel[key]} : {depthDraft[key] != null ? `${depthDraft[key]!.toFixed(1)}%` : "non placé"}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
