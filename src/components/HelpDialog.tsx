// Aide de l'alpha : signaler un bug (avec l'expédition et l'étape en cours, sans autre donnée personnelle),
// demander la suppression de son compte, accéder à la page de confidentialité.
import { useState } from "react";
import { submitPlayerRequest } from "../lib/requests";
import { PrivacyDialog } from "./PrivacyDialog";

const FONT = { fontFamily: "'Baloo 2', cursive" };

export function HelpDialog({ expeditionId, stepId, onClose }: { expeditionId: string | null; stepId: string | null; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(kind: "bug" | "deletion") {
    setBusy(true);
    setMsg(null);
    try {
      await submitPlayerRequest(kind, kind === "bug" ? text : "", expeditionId, stepId);
      setMsg(kind === "bug" ? "✔ Merci ! Ton signalement est enregistré." : "✔ Ta demande de suppression est enregistrée. Elle sera traitée sous quelques jours.");
      if (kind === "bug") setText("");
    } catch (e: any) {
      setMsg(e?.message?.includes("player_request_submit") ? "Cette fonction n'est pas encore activée (SQL 027)." : (e?.message ?? "Envoi impossible"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-3" onClick={onClose}>
      <div className="w-[min(32rem,96%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-2xl" style={FONT} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">🐞 Aide et signalements</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-2 text-sm font-bold">Fermer</button>
        </div>
        <div className="mt-2 text-sm font-bold">Signaler un bug</div>
        <textarea
          value={text}
          maxLength={1000}
          rows={4}
          onChange={(e) => setText(e.target.value)}
          placeholder="Que faisais-tu ? Que s'est-il passé ?"
          className="mt-1 w-full rounded border-2 border-[#7a4a22] bg-[#fff8e6] p-1.5 text-sm"
        />
        <div className="mt-1 text-[11px] italic">
          {expeditionId ? "L'expédition et l'étape en cours sont jointes automatiquement." : "Aucune expédition en cours."} Aucune autre donnée personnelle n'est envoyée.
        </div>
        <button type="button" disabled={busy || text.trim().length < 5} onClick={() => void send("bug")} className="mt-2 rounded-lg border-2 border-[#166534] bg-[#16a34a] px-4 py-1 text-sm font-extrabold text-white disabled:opacity-50">
          Envoyer
        </button>
        <div className="mt-4 border-t border-[#b98a54] pt-3 text-sm">
          <div className="font-bold">Mes données</div>
          <button type="button" onClick={() => setPrivacy(true)} className="underline">Confidentialité</button>
          <div>
            <button type="button" disabled={busy} onClick={() => void send("deletion")} className="mt-1 rounded border-2 border-[#b91c1c] px-3 py-0.5 text-xs font-bold text-[#b91c1c] disabled:opacity-50">
              Demander la suppression de mon compte
            </button>
          </div>
        </div>
        {privacy && <PrivacyDialog onClose={() => setPrivacy(false)} />}
        {msg && <div className="mt-3 rounded bg-[#fff3d6] p-2 text-sm font-bold">{msg}</div>}
      </div>
    </div>
  );
}
