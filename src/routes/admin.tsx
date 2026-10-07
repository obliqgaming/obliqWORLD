import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  connectIdentityProvider,
  createScene,
  createSceneExit,
  deleteSceneExit,
  ensureUserId,
  fetchAllScenes,
  fetchScene,
  fetchSceneExits,
  getAuthIdentity,
  listMusicFiles,
  updateSceneExitDestination,
  updateSceneExitPosition,
  updateSceneMusic,
  updateSceneZones,
  type AuthIdentity,
  type DepthScale,
  type MusicFile,
  type Point,
  type Scene,
  type SceneExit,
} from "../lib/scenes-supabase";

// Page d'admin : permet de dessiner les pièces (zone marchable), les
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
  component: AdminGate,
});

// Identifiant Supabase (auth.uid(), compte Twitch obliqpainting) du seul
// compte autorisé à ouvrir cette page. ATTENTION : ce contrôle, à lui seul,
// n'est qu'un confort d'interface — n'importe qui qui connaît l'API Supabase
// pourrait contourner cet écran en appelant directement les fonctions
// d'écriture. La VRAIE protection vient de la policy RLS d'écriture sur
// `scenes` et `scene_exits`, restreinte au même compte côté base de données
// (voir "only admin can update scene zones" / "...scene exit position").
const ADMIN_USER_ID = "03fcd13f-b0a1-4092-ba83-0469c035b09c";

function isAuthorizedAdmin(identity: AuthIdentity | null): boolean {
  if (!identity || identity.isAnonymous) return false;
  return identity.userId === ADMIN_USER_ID;
}

function AdminGate() {
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    getAuthIdentity()
      .then(setIdentity)
      .catch((err) => console.error("admin: lecture identité impossible", err))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#1a0f07] text-[#fff3d6]">
        Vérification…
      </div>
    );
  }

  if (!isAuthorizedAdmin(identity)) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#1a0f07] px-4 text-center text-[#fff3d6]">
        <p className="text-lg font-bold">Accès réservé</p>
        <p className="max-w-sm text-sm opacity-80">
          Cette page n'est accessible qu'au compte Twitch obliqpainting.
        </p>
        <button
          type="button"
          disabled={connecting}
          onClick={async () => {
            setConnecting(true);
            try {
              await connectIdentityProvider("twitch");
            } catch (err) {
              console.error("admin: connexion Twitch impossible", err);
              setConnecting(false);
            }
          }}
          className="rounded-full bg-[#9146FF] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {connecting ? "…" : "Se connecter avec Twitch"}
        </button>
      </div>
    );
  }

  return <AdminPage />;
}

type Mode = "room" | "obstacle" | "depth" | "exit";
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

  const [exits, setExits] = useState<SceneExit[]>([]);
  const [draggingExitId, setDraggingExitId] = useState<string | null>(null);
  const [savingExitId, setSavingExitId] = useState<string | null>(null);
  const [exitStatus, setExitStatus] = useState<string | null>(null);
  // "placingExit" = armé pour poser un nouveau portail au prochain clic sur
  // l'image (plutôt qu'au chargement, pour ne pas en créer un par accident).
  const [placingExit, setPlacingExit] = useState(false);

  // ---------- Musiques disponibles (bucket Supabase `music`) ----------
  const [musicFiles, setMusicFiles] = useState<MusicFile[]>([]);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [sceneMusicUrl, setSceneMusicUrl] = useState("");
  const [savingMusic, setSavingMusic] = useState(false);
  const [musicStatus, setMusicStatus] = useState<string | null>(null);

  // ---------- Création de nouvelle scène (ex: un étage de l'auberge) ----------
  const [showNewScene, setShowNewScene] = useState(false);
  const [newSceneName, setNewSceneName] = useState("");
  const [newSceneMusic, setNewSceneMusic] = useState("");
  const [newSceneFile, setNewSceneFile] = useState<File | null>(null);
  const [creatingScene, setCreatingScene] = useState(false);
  const [newSceneError, setNewSceneError] = useState<string | null>(null);

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

  // Liste des morceaux disponibles dans le bucket `music`, pour les menus
  // déroulants (nouvelle scène + musique de la scène courante) plutôt qu'un
  // copier-coller d'URL.
  useEffect(() => {
    listMusicFiles()
      .then(setMusicFiles)
      .catch((err) => {
        console.error("listMusicFiles a échoué", err);
        setMusicError("Impossible de lister les musiques — regarde la console (F12).");
      });
  }, []);

  useEffect(() => {
    if (!sceneId) return;
    setImgNatural(null);
    setDraft([]);
    setArmedDepthKey(null);
    setStatus(null);
    setRecoverable(null);
    setExitStatus(null);
    setExits([]);
    setMusicStatus(null);
    fetchScene(sceneId)
      .then((s) => {
        setScene(s);
        setSceneMusicUrl(s.music_url || "");
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
    fetchSceneExits(sceneId)
      .then(setExits)
      .catch((err) => console.error("fetchSceneExits a échoué", err));
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

    if (mode === "exit") {
      // Hors pose d'un nouveau portail, un clic en mode "exit" ne fait rien —
      // les portails existants se déplacent par glisser-déposer, pas par clic.
      if (placingExit) void handleCreateExitAt(p);
      return;
    }

    if (mode === "depth") {
      if (!armedDepthKey) return;
      setDepthDraft((d) => ({ ...d, [armedDepthKey]: p.y }));
      setArmedDepthKey(null);
      return;
    }

    setDraft((pts) => [...pts, p]);
  };

  // Pose un nouveau portail au point cliqué, avec une destination par défaut
  // (la première autre scène de la liste — à changer ensuite dans le panneau
  // de droite). S'il n'existe pas encore d'autre scène, on prévient plutôt que
  // de créer un portail qui boucle sur lui-même sans le vouloir.
  const handleCreateExitAt = async (p: Point) => {
    setPlacingExit(false);
    if (!scene) return;
    const defaultTarget = scenes.find((s) => s.id !== scene.id);
    if (!defaultTarget) {
      setExitStatus("Crée d'abord une autre scène avant d'ajouter un portail.");
      return;
    }
    setExitStatus(null);
    try {
      const created = await createSceneExit(scene.id, defaultTarget.id, p, null);
      setExits((list) => [...list, created]);
      setExitStatus(`Portail créé ✅ — choisis sa destination dans la liste à droite.`);
    } catch (err) {
      console.error(err);
      setExitStatus("Erreur en créant le portail — regarde la console (F12).");
    }
  };

  const handleExitDestinationChange = async (exitId: string, toSceneId: string) => {
    setExits((list) => list.map((x) => (x.id === exitId ? { ...x, to_scene_id: toSceneId } : x)));
    setSavingExitId(exitId);
    try {
      await updateSceneExitDestination(exitId, { to_scene_id: toSceneId });
      setExitStatus("Destination mise à jour ✅");
    } catch (err) {
      console.error(err);
      setExitStatus("Erreur en changeant la destination — regarde la console (F12).");
    } finally {
      setSavingExitId(null);
    }
  };

  const handleExitLabelChange = async (exitId: string, label: string) => {
    setExits((list) => list.map((x) => (x.id === exitId ? { ...x, label } : x)));
    try {
      await updateSceneExitDestination(exitId, { label: label || null });
    } catch (err) {
      console.error(err);
      setExitStatus("Erreur en enregistrant le libellé — regarde la console (F12).");
    }
  };

  const handleDeleteExit = async (exitId: string) => {
    if (!window.confirm("Supprimer ce portail ?")) return;
    try {
      await deleteSceneExit(exitId);
      setExits((list) => list.filter((x) => x.id !== exitId));
    } catch (err) {
      console.error(err);
      setExitStatus("Erreur en supprimant le portail — regarde la console (F12).");
    }
  };

  const handleCreateScene = async () => {
    setNewSceneError(null);
    if (!newSceneName.trim()) {
      setNewSceneError("Donne un nom à la scène.");
      return;
    }
    if (!newSceneFile) {
      setNewSceneError("Choisis une image de fond.");
      return;
    }
    setCreatingScene(true);
    try {
      const created = await createScene(newSceneName.trim(), newSceneFile, newSceneMusic.trim() || null);
      setScenes((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSceneId(created.id);
      setShowNewScene(false);
      setNewSceneName("");
      setNewSceneMusic("");
      setNewSceneFile(null);
    } catch (err) {
      console.error(err);
      setNewSceneError("Erreur à la création — regarde la console (F12). Si c'est la première fois, vérifie que le bucket de stockage \"scenes\" existe bien dans Supabase.");
    } finally {
      setCreatingScene(false);
    }
  };

  const handleSaveSceneMusic = async () => {
    if (!scene) return;
    setSavingMusic(true);
    setMusicStatus(null);
    try {
      await updateSceneMusic(scene.id, sceneMusicUrl);
      setMusicStatus("Musique enregistrée ✅");
    } catch (err) {
      console.error(err);
      setMusicStatus("Erreur en enregistrant la musique — regarde la console (F12).");
    } finally {
      setSavingMusic(false);
    }
  };

  // ---------- Portails : glisser-déposer directement sur l'image, sauvegarde
  // immédiate en base au relâchement (indépendante du bouton "Enregistrer"
  // global, qui ne couvre que pièces/obstacles/profondeur) ----------
  const dragExit = (exitId: string, clientX: number, clientY: number) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const p: Point = {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
    setExits((list) => list.map((x) => (x.id === exitId ? { ...x, position: p } : x)));
  };

  const startDragExit = (e: React.MouseEvent, exitId: string) => {
    e.stopPropagation();
    setDraggingExitId(exitId);
    setExitStatus(null);

    const onMove = (ev: MouseEvent) => dragExit(exitId, ev.clientX, ev.clientY);
    const onUp = async (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDraggingExitId(null);
      dragExit(exitId, ev.clientX, ev.clientY);

      // On relit la position finale depuis le state juste mis à jour n'est pas
      // synchrone ; on recalcule la même valeur ici pour l'envoyer à Supabase.
      if (!boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const finalPos: Point = {
        x: Math.min(100, Math.max(0, ((ev.clientX - rect.left) / rect.width) * 100)),
        y: Math.min(100, Math.max(0, ((ev.clientY - rect.top) / rect.height) * 100)),
      };
      setSavingExitId(exitId);
      try {
        await updateSceneExitPosition(exitId, finalPos);
        setExitStatus("Portail déplacé ✅");
      } catch (err) {
        console.error(err);
        setExitStatus("Erreur en déplaçant le portail — regarde la console (F12).");
      } finally {
        setSavingExitId(null);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
    y80: "65% (loin)",
    y100: "100% (normal)",
    y120: "135% (près)",
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

        <button
          type="button"
          onClick={() => setShowNewScene((v) => !v)}
          className={`rounded px-3 py-1 text-sm ${showNewScene ? "bg-emerald-700" : "bg-neutral-800"}`}
        >
          ➕ Nouvelle scène
        </button>

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
          <button
            type="button"
            onClick={() => {
              setMode("exit");
              setDraft([]);
              setArmedDepthKey(null);
            }}
            className={`rounded px-3 py-1 text-sm ${mode === "exit" ? "bg-purple-700" : "bg-neutral-800"}`}
          >
            🚪 Portails
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

      {scene && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded bg-neutral-800 px-3 py-2 text-sm">
          <label className="text-xs opacity-70">🎵 Musique de "{scene.name}" :</label>
          <select
            value={sceneMusicUrl}
            onChange={(e) => setSceneMusicUrl(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
          >
            <option value="">— Aucune —</option>
            {musicFiles.map((f) => (
              <option key={f.name} value={f.url}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSaveSceneMusic}
            disabled={savingMusic || sceneMusicUrl === (scene.music_url || "")}
            className="rounded bg-emerald-700 px-3 py-1 text-xs font-semibold disabled:opacity-40"
          >
            {savingMusic ? "Enregistrement…" : "Enregistrer"}
          </button>
          {musicStatus && <span className="text-xs">{musicStatus}</span>}
          {musicError && <span className="text-xs text-red-400">{musicError}</span>}
        </div>
      )}

      {showNewScene && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded bg-neutral-800 px-3 py-3 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-70">Nom de la scène</label>
            <input
              type="text"
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              placeholder="ex: Auberge — 1er étage"
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-70">Image de fond</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewSceneFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-70">Musique (optionnel)</label>
            <select
              value={newSceneMusic}
              onChange={(e) => setNewSceneMusic(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            >
              <option value="">— Aucune —</option>
              {musicFiles.map((f) => (
                <option key={f.name} value={f.url}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreateScene}
            disabled={creatingScene}
            className="rounded bg-emerald-700 px-4 py-1 font-semibold disabled:opacity-40"
          >
            {creatingScene ? "Création…" : "Créer la scène"}
          </button>
          {newSceneError && <span className="w-full text-xs text-red-400">{newSceneError}</span>}
        </div>
      )}

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

      {mode === "exit" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded bg-neutral-800 px-3 py-2 text-sm">
          <span className="opacity-70">
            Glisse-dépose un portail existant pour le repositionner (sauvegardé automatiquement). Choisis sa
            destination dans la liste à droite.
          </span>
          <button
            type="button"
            onClick={() => setPlacingExit((v) => !v)}
            className={`rounded px-3 py-1 text-xs font-semibold ${placingExit ? "bg-purple-600" : "bg-neutral-700"}`}
          >
            {placingExit ? "Clique sur l'image pour le poser…" : "➕ Nouveau portail ici"}
          </button>
        </div>
      )}

      {status && <p className="mb-3 text-sm">{status}</p>}
      {exitStatus && <p className="mb-3 text-sm">{exitStatus}</p>}

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

            {exits.map((ex) => (
              <div
                key={ex.id}
                onMouseDown={(e) => mode === "exit" && !placingExit && startDragExit(e, ex.id)}
                title={ex.label ?? "Portail"}
                className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs"
                style={{
                  left: `${ex.position.x}%`,
                  top: `${ex.position.y}%`,
                  background: draggingExitId === ex.id ? "rgba(168,85,247,0.9)" : "rgba(168,85,247,0.6)",
                  borderColor: "rgba(216,180,254,0.95)",
                  cursor: mode === "exit" ? (placingExit ? "crosshair" : draggingExitId === ex.id ? "grabbing" : "grab") : "default",
                  boxShadow: savingExitId === ex.id ? "0 0 0 2px rgba(250,204,21,0.9)" : "none",
                }}
              >
                🚪
              </div>
            ))}
          </div>
        )}

        <div className="w-72 shrink-0 text-sm">
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
          <ul className="mb-4 space-y-1">
            {(["y80", "y100", "y120"] as DepthKey[]).map((key) => (
              <li key={key} className="rounded bg-neutral-800 px-2 py-1">
                {depthLabel[key]} : {depthDraft[key] != null ? `${depthDraft[key]!.toFixed(1)}%` : "non placé"}
              </li>
            ))}
          </ul>

          <p className="mb-1 font-semibold">Portails ({exits.length})</p>
          <ul className="space-y-2">
            {exits.map((ex) => (
              <li key={ex.id} className="rounded bg-neutral-800 px-2 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs opacity-60">
                    {ex.position.x.toFixed(1)}%, {ex.position.y.toFixed(1)}%
                    {savingExitId === ex.id ? " · ⏳" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExit(ex.id)}
                    className="text-red-400 hover:text-red-300"
                    title="Supprimer ce portail"
                  >
                    🗑
                  </button>
                </div>
                <input
                  type="text"
                  value={ex.label ?? ""}
                  onChange={(e) => handleExitLabelChange(ex.id, e.target.value)}
                  placeholder="Libellé (ex: Étage)"
                  className="mb-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
                />
                <select
                  value={ex.to_scene_id}
                  onChange={(e) => handleExitDestinationChange(ex.id, e.target.value)}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
                >
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      → {s.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
            {exits.length === 0 && <li className="opacity-50">Aucun pour cette scène</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
