import { useEffect, useState } from "react";
import { fetchAuthorNames } from "../lib/authors";

/** « Forgée par … » / « Écrite par … » — ne s'affiche que si le nom est connu. */
export function AuthorLine({ userId, label, className }: { userId?: string | null; label: string; className?: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    if (!userId) return;
    fetchAuthorNames([userId]).then((m) => {
      if (!off) setName(m[userId] ?? null);
    });
    return () => {
      off = true;
    };
  }, [userId]);
  if (!name) return null;
  return <div className={className ?? "opacity-70"}>{label} {name}</div>;
}
