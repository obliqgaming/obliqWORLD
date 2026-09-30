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
    return (
      <div
        className={`flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-bold text-[#fff3d6] ${className}`}
        style={{ fontFamily: "'Baloo 2', cursive" }}
      >
        {identity.avatarUrl && (
          <img src={identity.avatarUrl} alt="" className="h-5 w-5 rounded-full" draggable={false} />
        )}
        <span>
          Connecté{identity.displayName ? ` · ${identity.displayName}` : ""}
          {identity.provider ? ` (${identity.provider === "twitch" ? "Twitch" : "Discord"})` : ""}
        </span>
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
