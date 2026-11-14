// Écran plein cadre affiché aux joueurs (pas à l'admin) quand le mode maintenance est activé (SQL 118).
function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all font-bold text-amber-300 underline">{part}</a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-950 p-6 text-center text-neutral-100">
      <div className="max-w-md space-y-4">
        <p className="text-5xl">🛠️</p>
        <p className="text-2xl font-bold">Maintenance en cours</p>
        <p className="whitespace-pre-line text-base leading-relaxed text-neutral-200">{linkify(message)}</p>
      </div>
    </div>
  );
}
