// Éditeur de rencontres : tirage payant (type + risque au hasard), écriture en 3 textes,
// boîte aux lettres (l'or gagné quand les autres jouent ta rencontre) et historique.
import { uiSound } from "../lib/ui-sounds";
import { Coin } from "./GameIcons";
import { useCallback, useEffect, useState } from "react";
import { fetchMyGold } from "../lib/loot";
import {
  EXAMPLES, RISK_LABEL, STATUS_LABEL, TYPE_LABEL,
  collectEncounterGold, fetchEncounterCost, fetchMyEncounters, startEncounterDraw, submitEncounter,
  type CommunityEvent,
} from "../lib/encounters";

const FONT = { fontFamily: "'Baloo 2', cursive" };
const MAX = 300;
const MIN = 10;

export function EncounterEditor({ onClose }: { onClose: () => void }) {
  const [mine, setMine] = useState<CommunityEvent[]>([]);
  const [gold, setGold] = useState(0);
  const [cost, setCost] = useState(6);
  const [draft, setDraft] = useState<CommunityEvent | null>(null);
  const [sit, setSit] = useState("");
  const [ok, setOk] = useState("");
  const [ko, setKo] = useState("");
  const [mode, setMode] = useState<"partage" | "isole">("partage");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await fetchMyEncounters();
      setMine(list);
      setGold(await fetchMyGold());
      setCost(await fetchEncounterCost());
      setDraft((d) => d ?? list.find((e) => e.status === "drafting") ?? null);
    } catch (e: any) {
      setMsg(e?.message?.includes("community_events") ? "Lance d'abord le SQL 022 dans Supabase." : (e?.message ?? "Erreur de chargement"));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const pending = mine.reduce((n, e) => n + (e.author_gold_pending ?? 0), 0);

  async function draw() {
    setBusy(true);
    setMsg(null);
    try {
      const e = await startEncounterDraw();
      setDraft(e);
      setSit("");
      setOk("");
      setKo("");
      setMode("partage");
      await reload();
    } catch (e: any) {
      setMsg(e?.message ?? "Tirage impossible");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    try {
      const e = await submitEncounter(draft.id, sit, ok, ko, mode);
      uiSound("success");
      setDraft(null);
      setMsg(e.status === "approved" ? "✔ Ta rencontre est publiée : d'autres expéditions pourront la tirer !" : "✔ Ta rencontre est envoyée, elle sera relue avant d'être publiée.");
      await reload();
    } catch (e: any) {
      setMsg(e?.message ?? "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  async function collect() {
    setBusy(true);
    try {
      const n = await collectEncounterGold();
      setMsg(n > 0 ? `+${n} or récupéré${n > 1 ? "s" : ""} dans ta boîte aux lettres.` : "Rien à récupérer pour l'instant.");
      await reload();
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const ex = draft ? EXAMPLES[draft.step_type] : null;
  const field = (label: string, v: string, set: (s: string) => void, placeholder: string, tone?: "ok" | "ko") => (
    <label className="mt-2 block text-xs font-bold" style={tone ? { color: tone === "ok" ? "#047857" : "#b91c1c" } : undefined}>
      {label} <span className={v.trim().length < MIN ? "text-[#b91c1c]" : "text-[#5e3818]"}>({v.length}/{MAX})</span>
      <textarea
        value={v}
        maxLength={MAX}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        className="mt-0.5 w-full rounded border-2 border-[#7a4a22] bg-[#fff8e6] p-1.5 text-sm font-normal text-[#3a2410]"
      />
    </label>
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-3" onClick={onClose}>
      <div className="max-h-[92%] w-[min(40rem,96%)] overflow-y-auto parchment-scroll rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-2xl" style={FONT} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">✍ Écrire une rencontre</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-2 text-sm font-bold">Fermer</button>
        </div>

        {!draft && (
          <>
            <div className="mt-2 space-y-1 text-sm">
              <div>🎲 Tu <b>tires au hasard</b> un type de rencontre et un niveau de risque.</div>
              <div>✍ Tu écris <b>la situation</b> et <b>les deux issues</b>.</div>
              <div><Coin /> Chaque fois que des aventuriers la jouent, <b>tu gagnes de l'or</b> <i>(dans ta boîte aux lettres)</i>.</div>
            </div>
            <div className="mt-2 rounded border border-[#b98a54] bg-[#f6e8c4] p-2 text-xs italic">
              Une écriture trop fainéante ou incongrue sera rejetée.
            </div>
            <button type="button" disabled={busy || gold < cost} onClick={() => void draw()} className="mt-3 rounded-lg border-2 border-[#166534] bg-[#16a34a] px-4 py-1.5 text-sm font-extrabold text-white disabled:opacity-50">
              🎲 Tirer une rencontre ({cost} or)
            </button>
            <span className="ml-2 text-xs font-bold">Tu as {gold} or</span>

            <div className="mt-4 rounded border-2 border-[#b98a54] bg-[#f6e8c4] p-2">
              <div className="text-xs font-extrabold uppercase tracking-wide">📬 Boîte aux lettres</div>
              <div className="mt-1 text-sm">
                {pending > 0 ? <>Tes rencontres t'ont rapporté <b>{pending} or</b>.</> : "Rien à récupérer pour l'instant."}
              </div>
              {pending > 0 && (
                <button type="button" disabled={busy} onClick={() => void collect()} className="mt-1 rounded border-2 border-[#92400e] bg-[#f59e0b] px-3 py-0.5 text-xs font-extrabold">Récupérer</button>
              )}
            </div>

            <div className="mt-4 text-xs font-extrabold uppercase tracking-wide">Mes rencontres</div>
            {mine.filter((e) => e.status !== "drafting").length === 0 && <div className="mt-1 text-sm italic">Aucune pour l'instant.</div>}
            {mine.filter((e) => e.status !== "drafting").map((e) => (
              <div key={e.id} className="mt-1.5 rounded border border-[#b98a54] bg-[#f6e8c4] p-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span>{TYPE_LABEL[e.step_type]} · {RISK_LABEL[e.risk_level]}</span>
                  <span>{STATUS_LABEL[e.status]}{e.status === "approved" ? ` · jouée ${e.times_played} fois` : ""}</span>
                </div>
                <div className="mt-0.5 line-clamp-2">{e.situation_text}</div>
              </div>
            ))}
          </>
        )}

        {draft && ex && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-extrabold">
              <span className="rounded bg-[#7a4a22] px-2 py-0.5 text-[#fff3d6]">{TYPE_LABEL[draft.step_type]}</span>
              <span className="rounded bg-[#fde68a] px-2 py-0.5">{RISK_LABEL[draft.risk_level]}</span>
              <span className="text-xs font-bold">(tirage payé : tu peux fermer et reprendre plus tard)</span>
            </div>
            <div className="mt-1 text-xs">{ex.hint}</div>
            <div className="mt-2 rounded border border-[#b98a54] bg-[#f6e8c4] p-2 text-xs italic">
              Une écriture trop fainéante ou incongrue sera rejetée.
            </div>
            {field("La situation", sit, setSit, ex.situation)}
            {field("✅ SI LE GROUPE RÉUSSIT (aucune perte de PV)", ok, setOk, ex.success, "ok")}
            {field("❌ SI LE GROUPE ÉCHOUE (le groupe perd des PV)", ko, setKo, ex.failure, "ko")}
            {draft.step_type !== "epreuve" ? (
              <label className="mt-2 block text-xs font-bold">
                En cas d'échec, les dégâts sont…
                <select value={mode} onChange={(e) => setMode(e.target.value as "partage" | "isole")} className="ml-2 rounded border-2 border-[#7a4a22] bg-[#fff8e6] px-1 py-0.5 text-sm">
                  <option value="partage">partagés (un peu pour chacun)</option>
                  <option value="isole">isolés (un seul est touché, plus fort)</option>
                </select>
              </label>
            ) : (
              <div className="mt-2 text-xs font-bold">En cas d'échec, seul le désigné est touché.</div>
            )}
            <button
              type="button"
              disabled={busy || sit.trim().length < MIN || ok.trim().length < MIN || ko.trim().length < MIN}
              onClick={() => void send()}
              className="mt-3 rounded-lg border-2 border-[#166534] bg-[#16a34a] px-4 py-1.5 text-sm font-extrabold text-white disabled:opacity-50"
            >
              Envoyer ma rencontre
            </button>
          </>
        )}
        {msg && <div className="mt-3 rounded bg-[#fff3d6] p-2 text-sm font-bold">{msg}</div>}
      </div>
    </div>
  );
}
