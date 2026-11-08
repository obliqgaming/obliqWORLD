import { useState } from "react";
import type { AuthIdentity } from "../lib/scenes-supabase";

// Petit badge de statut de connexion, utilisé à la fois sur l'écran de choix
// de personnage et en jeu. Deux états :
// - invité (session anonyme) : deux boutons "Se connecter avec Twitch/Discord"
// - connecté : pseudo + avatar (si connus) et un lien "Se déconnecter"
export function AccountBadge({
  identity,
  onConnect,
  onDisconnect,
  className = "",
}: {
  identity: AuthIdentity | null;
  onConnect: (provider: "twitch" | "discord") => void;
  onDisconnect: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState<"twitch" | "discord" | "signout" | null>(null);

  if (!identity) return null;

  const handleConnect = async (provider: "twitch" | "discord") => {
    setBusy(provider);
    try {
      await onConnect(provider);
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    setBusy("signout");
    try {
      await onDisconnect();
    } finally {
      setBusy(null);
    }
  };

  if (!identity.isAnonymous) {
    // Version discrète : logo du service + « Se déconnecter », très transparent tant qu'on ne le survole pas (le pseudo reste en infobulle).
    const isTwitch = identity.provider === "twitch";
    const isDiscord = identity.provider === "discord";
    const info = `Connecté${identity.displayName ? ` · ${identity.displayName}` : ""}${isTwitch ? " (Twitch)" : isDiscord ? " (Discord)" : ""}`;
    return (
      <div
        title={info}
        className={`flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-bold text-[#fff3d6] opacity-30 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 ${className}`}
        style={{ fontFamily: "'Baloo 2', cursive" }}
      >
        {isTwitch && (
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#a970ff" aria-label="Twitch">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
          </svg>
        )}
        {isDiscord && (
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#7c89ff" aria-label="Discord">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
          </svg>
        )}
        {!isTwitch && !isDiscord && <span>Connecté</span>}
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={busy !== null}
          className="underline opacity-80 hover:opacity-100 disabled:opacity-40"
        >
          {busy === "signout" ? "…" : "Se déconnecter"}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => handleConnect("twitch")}
        disabled={busy !== null}
        className="rounded-full bg-[#9146FF] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        style={{ fontFamily: "'Baloo 2', cursive" }}
      >
        {busy === "twitch" ? "…" : "Se connecter avec Twitch"}
      </button>
      <button
        type="button"
        onClick={() => handleConnect("discord")}
        disabled={busy !== null}
        className="rounded-full bg-[#5865F2] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        style={{ fontFamily: "'Baloo 2', cursive" }}
      >
        {busy === "discord" ? "…" : "Se connecter avec Discord"}
      </button>
    </div>
  );
}
