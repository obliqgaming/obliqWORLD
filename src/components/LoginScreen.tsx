// Écran d'accueil de l'alpha : connexion Twitch ou Discord (ou retour après déconnexion).
import { useState } from "react";
import { PrivacyDialog } from "./PrivacyDialog";

const FONT = { fontFamily: "'Baloo 2', cursive" };

export function LoginScreen({
  onConnect,
  farewellName = null,
}: {
  onConnect: (provider: "twitch" | "discord") => Promise<void> | void;
  /** null = première visite ; texte (même vide) = le joueur vient de se déconnecter. */
  farewellName?: string | null;
}) {
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
  const farewell = farewellName !== null;
  return (
    <div
      className="flex h-screen w-screen items-center justify-center p-4 text-[#fff3d6]"
      style={{ ...FONT, background: "radial-gradient(ellipse at 50% 35%, #4a2a10 0%, #1b0e05 60%, #0c0602 100%)" }}
    >
      <style>{`@keyframes ow-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      <div
        className="w-[min(30rem,100%)] rounded-xl border-2 border-[#a8742f] bg-[#2b1406]/90 p-8 text-center shadow-2xl"
        style={{ animation: "ow-fade 900ms ease-out both", boxShadow: "0 0 60px rgba(217,119,6,.25), inset 0 0 0 4px rgba(0,0,0,.25)" }}
      >
        <div className="text-4xl font-extrabold tracking-wide" style={{ textShadow: "0 0 18px rgba(253,230,138,.45)" }}>ObliqWorld</div>
        <div className="mx-auto my-3 h-px w-24 bg-gradient-to-r from-transparent via-[#fde68a] to-transparent" />
        <div className="text-sm font-bold uppercase tracking-[0.25em] text-[#fde68a]">Alpha privée</div>
        <div className="mt-5 space-y-1.5 text-base">
          {farewell ? (
            <>
              <p className="font-extrabold">À bientôt{farewellName ? `, ${farewellName}` : ""} !</p>
              <p className="text-sm"><i>Ton personnage et tes affaires t'attendent.</i></p>
            </>
          ) : (
            <>
              <p className="font-extrabold">Un petit monde à créer ensemble.</p>
              <p className="text-sm">Pour entrer, <b>connecte-toi avec Twitch ou Discord</b>.</p>
              <p className="text-xs"><i>Ton personnage, ton or et tes armes te suivent sur n'importe quel appareil.</i></p>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" disabled={busy !== null} onClick={() => void go("twitch")} className="rounded-lg bg-[#9146FF] px-4 py-2.5 font-extrabold text-white shadow disabled:opacity-50">
            {busy === "twitch" ? "…" : "Entrer avec Twitch"}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void go("discord")} className="rounded-lg bg-[#5865F2] px-4 py-2.5 font-extrabold text-white shadow disabled:opacity-50">
            {busy === "discord" ? "…" : "Entrer avec Discord"}
          </button>
        </div>
        {error && <div className="mt-3 rounded bg-[#5e1b1b] p-2 text-sm font-bold">{error}</div>}
        <p className="mt-6 text-[11px] opacity-70">
          Nous gardons ton identifiant de compte, ton pseudo et ton avatar Twitch/Discord, tes dessins et tes parties. Rien d'autre. <button type="button" onClick={() => setPrivacy(true)} className="underline">En savoir plus</button>
        </p>
      </div>
      {privacy && <PrivacyDialog onClose={() => setPrivacy(false)} />}
    </div>
  );
}
