// Invitation de groupe reçue — popup simple accepter/refuser (§5, revu le
// 2026-10-14). Nom de l'inviteur affiché via le créateur du groupe, pas
// stocké séparément : fetchPartyMembers renvoie déjà tous les membres, donc
// l'appelant passe directement le nom trouvé dedans.
export function PartyInvitePopup({
  inviterName,
  onAccept,
  onDecline,
}: {
  inviterName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      className="absolute left-1/2 top-24 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border-2 border-[#7a4a22]/70 bg-[#2b1406]/95 px-4 py-2.5 text-[#fff3d6]"
      style={{ fontFamily: "'Baloo 2', cursive" }}
    >
      <span className="text-sm">
        <span className="font-bold">{inviterName}</span> t'invite à rejoindre son groupe
      </span>
      <button
        type="button"
        onClick={onAccept}
        className="rounded-full bg-[#7a4a22] px-3 py-1 text-xs font-bold hover:bg-[#8f5a2c]"
      >
        Accepter
      </button>
      <button
        type="button"
        onClick={onDecline}
        className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold hover:bg-black/50"
      >
        Refuser
      </button>
    </div>
  );
}
