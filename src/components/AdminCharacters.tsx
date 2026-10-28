// Onglet « Personnages » de /admin : liste des personnages existants avec
// quelques outils (ressusciter, ancrage de la main, niveau / axe).
import { useEffect, useRef, useState } from "react";
import {
  adminDeleteCharacter,
  adminResurrect,
  adminSetHandAnchor,
  adminSetLevel,
  adminSetFamily,
  fetchAdminCharacters,
  type AdminCharacter,
} from "../lib/admin-characters";
import type { Point } from "../lib/scenes-supabase";

export function AdminCharacters() {
  const [chars, setChars] = useState<AdminCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [anchorFor, setAnchorFor] = useState<AdminCharacter | null>(null);
  const [levelFor, setLevelFor] = useState<AdminCharacter | null>(null);
  const [familyFor, setFamilyFor] = useState<AdminCharacter | null>(null);

  const reload = async () => {
    try {
      setChars(await fetchAdminCharacters());
    } catch (e) {
      console.error(e);
      setMsg("Impossible de lire les personnages — regarde la console (F12).");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      setMsg(`${label} ✅`);
      await reload();
    } catch (e: any) {
      console.error(e);
      setMsg(`Erreur : ${e?.message ?? "regarde la console (F12)"}`);
    }
  };

  const shown = chars.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-4 text-white">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Chercher un nom…" className="rounded bg-neutral-800 px-3 py-1 text-sm" />
        <span className="text-xs opacity-70">{shown.length} personnage(s)</span>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
      {loading ? (
        <p>Chargement…</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase opacity-60">
            <tr>
              <th className="p-1"></th>
              <th className="p-1">Nom</th>
              <th className="p-1">Famille / axe</th>
              <th className="p-1">Niveau · XP</th>
              <th className="p-1">État</th>
              <th className="p-1">Main</th>
              <th className="p-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="border-t border-neutral-800">
                <td className="p-1">{c.image_url ? <img src={c.image_url} alt="" className="h-12 w-12 rounded bg-neutral-800 object-contain" /> : null}</td>
                <td className="p-1 font-semibold">{c.name}</td>
                <td className="p-1">
                  {c.family ?? "—"}
                  {c.axis_key ? ` · ${c.axis_key}` : ""}
                </td>
                <td className="p-1">{c.level !== null ? `${c.level} · ${c.xp ?? 0} XP` : "—"}</td>
                <td className="p-1">{c.is_alive === false ? <span className="text-red-400">mort{c.death_cause ? ` (${c.death_cause})` : ""}</span> : "en vie"}</td>
                <td className="p-1">{c.hand_anchor ? `x ${c.hand_anchor.x} · y ${c.hand_anchor.y}` : <span className="text-amber-400">non placée</span>}</td>
                <td className="p-1">
                  <div className="flex flex-wrap gap-1">
                    {c.is_alive === false && (
                      <button type="button" className="rounded bg-emerald-700 px-2 py-0.5 text-xs" onClick={() => void run(`${c.name} ressuscité`, () => adminResurrect(c.id))}>
                        Ressusciter
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded bg-red-800 px-2 py-0.5 text-xs"
                      title="Supprime vraiment le personnage (il ne devient pas un monstre)"
                      onClick={() => {
                        if (window.confirm(`Supprimer DÉFINITIVEMENT « ${c.name} » ? (il ne deviendra pas un monstre)`)) void run(`${c.name} supprimé`, () => adminDeleteCharacter(c.id));
                      }}
                    >
                      Supprimer
                    </button>
                    <button type="button" className="rounded bg-neutral-700 px-2 py-0.5 text-xs" onClick={() => setAnchorFor(c)}>
                      Ancrage main
                    </button>
                    {c.level !== null && (
                      <button type="button" className="rounded bg-neutral-700 px-2 py-0.5 text-xs" onClick={() => setLevelFor(c)}>
                        Niveau / axe
                      </button>
                    )}
                    {c.family && (
                      <button type="button" className="rounded bg-neutral-700 px-2 py-0.5 text-xs" onClick={() => setFamilyFor(c)}>
                        Spécialisation
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {anchorFor && (
        <AnchorEditor
          character={anchorFor}
          onClose={() => setAnchorFor(null)}
          onSave={(p) =>
            void run(p ? "Ancrage enregistré" : "Ancrage retiré", async () => {
              await adminSetHandAnchor(anchorFor.visual_asset_id, p);
              setAnchorFor(null);
            })
          }
        />
      )}
      {familyFor && (
        <FamilyEditor
          character={familyFor}
          onClose={() => setFamilyFor(null)}
          onSave={(fam) =>
            void run(`${familyFor.name} passe en ${fam === "melee" ? "Mêlée" : "Magie"}`, async () => {
              await adminSetFamily(familyFor.id, fam);
              setFamilyFor(null);
            })
          }
        />
      )}
      {levelFor && (
        <LevelEditor
          character={levelFor}
          onClose={() => setLevelFor(null)}
          onSave={(level, reset) =>
            void run("Niveau mis à jour", async () => {
              await adminSetLevel(levelFor.id, level, reset);
              setLevelFor(null);
            })
          }
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-full w-[min(32rem,100%)] overflow-y-auto rounded-xl bg-neutral-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <b>{title}</b>
          <button type="button" onClick={onClose} className="text-neutral-400">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Glisse le repère sur le dessin du personnage, puis enregistre.
function AnchorEditor({ character, onClose, onSave }: { character: AdminCharacter; onClose: () => void; onSave: (p: Point | null) => void }) {
  const [p, setP] = useState<Point>(character.hand_anchor ?? { x: 66.7, y: 66.7 });
  const [drag, setDrag] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const move = (e: React.PointerEvent) => {
    if (!box.current) return;
    const r = box.current.getBoundingClientRect();
    setP({
      x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)) * 10) / 10,
      y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) * 10) / 10,
    });
  };
  return (
    <Modal title={`Ancrage de la main — ${character.name}`} onClose={onClose}>
      <p className="mb-2 text-xs text-neutral-400">Clique ou glisse sur le dessin : le point est l'endroit où une arme sera tenue.</p>
      <div
        ref={box}
        className="relative mx-auto aspect-square w-full max-w-[420px] touch-none select-none overflow-hidden rounded border border-neutral-700"
        style={{ background: "repeating-conic-gradient(#2a2a2a 0% 25%, #222 0% 50%) 50% / 16px 16px" }}
        onPointerDown={(e) => {
          setDrag(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => drag && move(e)}
        onPointerUp={() => setDrag(false)}
      >
        {character.image_url && <img src={character.image_url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain" />}
        <div className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500/80" style={{ left: `${p.x}%`, top: `${p.y}%` }} />
      </div>
      <div className="mt-2 text-xs">x {p.x} · y {p.y}</div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="rounded bg-emerald-700 px-3 py-1 text-sm" onClick={() => onSave(p)}>
          Enregistrer
        </button>
        {character.hand_anchor && (
          <button type="button" className="rounded bg-neutral-700 px-3 py-1 text-sm text-red-300" onClick={() => onSave(null)}>
            Retirer l'ancrage
          </button>
        )}
      </div>
    </Modal>
  );
}

function LevelEditor({ character, onClose, onSave }: { character: AdminCharacter; onClose: () => void; onSave: (level: number, resetAxis: boolean) => void }) {
  const [level, setLevel] = useState(character.level ?? 1);
  const [reset, setReset] = useState(false);
  return (
    <Modal title={`Niveau / axe — ${character.name}`} onClose={onClose}>
      <label className="block text-sm">
        Niveau{" "}
        <input type="number" min={1} max={12} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="w-20 rounded bg-neutral-800 px-2 py-1" />
      </label>
      <p className="mt-1 text-xs text-neutral-400">L'XP est alignée sur le palier du niveau. Niveau 3 ou plus sans axe : le choix d'axe s'ouvre au retour à l'auberge.</p>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} />
        Effacer l'axe déjà choisi{character.axis_key ? ` (${character.axis_key})` : ""} pour pouvoir le rechoisir
      </label>
      <button type="button" className="mt-3 rounded bg-emerald-700 px-3 py-1 text-sm" onClick={() => onSave(level, reset)}>
        Enregistrer
      </button>
    </Modal>
  );
}

function FamilyEditor({ character, onClose, onSave }: { character: AdminCharacter; onClose: () => void; onSave: (f: "melee" | "magie") => void }) {
  const [fam, setFam] = useState<"melee" | "magie">(character.family ?? "melee");
  return (
    <Modal title={`Spécialisation — ${character.name}`} onClose={onClose}>
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-1">
          <input type="radio" checked={fam === "melee"} onChange={() => setFam("melee")} /> Mêlée
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={fam === "magie"} onChange={() => setFam("magie")} /> Magie
        </label>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        L'axe choisi{character.axis_key ? ` (${character.axis_key})` : ""} est effacé ; à partir du niveau 3, le choix d'axe se rouvre. Une arme équipée d'un autre type est rangée.
      </p>
      <button type="button" disabled={fam === character.family} className="mt-3 rounded bg-emerald-700 px-3 py-1 text-sm disabled:opacity-40" onClick={() => onSave(fam)}>
        Enregistrer
      </button>
    </Modal>
  );
}
