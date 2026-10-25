// Écran d'accueil de l'alpha : connexion Twitch ou Discord obligatoire.
import { useState } from "react";
import { PrivacyDialog } from "./PrivacyDialog";

const FONT = { fontFamily: "'Baloo 2', cursive" };

export function LoginScreen({ onConnect }: { onConnect: (provider: "twitch" | "discord") => Promise<void> | void }) {
  const [busy, setBusy] = useState<"twitch" | "discord" | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go(p: "twitch" | "discord") {
    setBusy(p);
    setError(null);
    try {
      await onConnect(p);
    } catch {
      setError("La connexion a échoué. Réessaie, ou ouvre le site publié si tu es dans l'aperçu Lovable.");
      setBusy(null);
    }
  }
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#1b0e05] p-4 text-[#fff3d6]" style={FONT}>
      <div className="w-[min(32rem,100%)] rounded-xl border-2 border-[#7a4a22] bg-[#2b1406] p-6 text-center shadow-xl">
        <div className="text-2xl font-extrabold">ObliqWorld</div>
        <div className="mt-1 text-sm font-bold text-[#fde68a]">Alpha privée</div>
        <div className="mt-3 space-y-1 text-sm">
          <p>Pour jouer, <b>connecte-toi avec Twitch ou Discord</b>.</p>
          <p><i>Ton personnage, ton or et tes armes sont retrouvés sur n'importe quel appareil.</i></p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" disabled={busy !== null} onClick={() => void go("twitch")} className="rounded-lg bg-[#9146FF] px-4 py-2 font-extrabold text-white disabled:opacity-50">
            {busy === "twitch" ? "…" : "Se connecter avec Twitch"}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void go("discord")} className="rounded-lg bg-[#5865F2] px-4 py-2 font-extrabold text-white disabled:opacity-50">
            {busy === "discord" ? "…" : "Se connecter avec Discord"}
          </button>
        </div>
        {error && <div className="mt-3 rounded bg-[#5e1b1b] p-2 text-sm font-bold">{error}</div>}
        <p className="mt-4 text-[11px] opacity-70">
          Nous gardons ton identifiant de compte, ton pseudo et ton avatar Twitch/Discord, tes dessins et tes parties. Rien d'autre. <button type="button" onClick={() => setPrivacy(true)} className="underline">En savoir plus</button>
        </p>
      </div>
      {privacy && <PrivacyDialog onClose={() => setPrivacy(false)} />}
    </div>
  );
}
