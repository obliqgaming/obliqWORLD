// La ferme : tes compagnons (créatures gagnées en butin). Un seul t'accompagne en expédition ;
// il prend la moitié des dégâts que tu reçois. À 0 PV il s'enfuit et se repose quelques expéditions.
import { useEffect, useState } from "react";
import { TIER_INFO, claimStarterCompanion, fetchMyCompanions, fetchStarterChoices, releaseCompanion, setActiveCompanion, type Companion, type StarterCompanion } from "../lib/companions";

const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function FarmPanel({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Companion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tab, setTab] = useState<"mine" | "buy">("mine");
  const [starters, setStarters] = useState<StarterCompanion[]>([]);

  const reload = async () => {
    try {
      setList(await fetchMyCompanions());
      setStarters(await fetchStarterChoices());
    } catch (e: any) {
      setMsg(e?.message?.includes("companions") ? "La ferme n'est pas encore activée (SQL 031)." : (e?.message ?? "Erreur"));
      setList([]);
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      window.dispatchEvent(new Event("obliq-companion-changed"));
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/55 p-2" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="max-h-full w-[min(40rem,98%)] overflow-y-auto rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">🐾 La ferme</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        <div className="mt-2 space-y-1.5 text-sm leading-snug">
          <div><b>Un seul compagnon</b> t'accompagne en expédition : il prend <b>la moitié des dégâts</b> que tu reçois.</div>
          <div>💤 À 0 PV, il s'enfuit <i>(il n'est jamais perdu)</i> et se repose : <b>3</b> expéditions (petit), <b>6</b> (moyen) ou <b>9</b> (grand).</div>
          <div>🎁 Les compagnons se gagnent <b>en butin</b> sur les créatures de la forêt, <i>très rarement</i>.</div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setTab("mine")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "mine" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>🐾 Mes compagnons</button>
          <button type="button" onClick={() => setTab("buy")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "buy" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>🛒 Acheter</button>
        </div>
        {tab === "buy" && (
          <div className="mt-3 rounded border border-[#7a4a22]/60 bg-white/40 p-3 text-sm">
            <b>Bientôt !</b> Les compagnons dessinés par les joueurs seront en vente ici.
          </div>
        )}
        {tab === "mine" && starters.length > 0 && (
          <div className="mt-3 rounded border-2 border-[#16a34a] bg-white/50 p-2">
            <div className="text-sm font-extrabold">🎁 Choisis ton premier compagnon <i>(gratuit, une seule fois)</i></div>
            <div className="mt-2 flex flex-wrap gap-2">
              {starters.map((c) => (
                <button key={c.id} type="button" disabled={busy} title={c.name} className="rounded border border-[#7a4a22] bg-white/60 p-1 hover:bg-[#7a4a22]/20 disabled:opacity-50" onClick={() => void act(() => claimStarterCompanion(c.id))}>
                  <img src={c.image_url} alt={c.name} className="h-16 w-16 object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}
        {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
        {list === null && <div className="mt-3 text-sm">Chargement…</div>}
        {tab === "mine" && <div className="mt-3 grid gap-2 md:grid-cols-2">
          {(list ?? []).map((c) => {
            const resting = c.rest_left > 0;
            const provisional = c.loot_expedition_id !== null;
            return (
              <div key={c.id} className={`flex gap-2 rounded border bg-white/40 p-2 ${c.active ? "border-[#166534] ring-2 ring-[#16a34a]" : "border-[#7a4a22]/60"}`}>
                <img src={c.image_url} alt="" className="h-16 w-16 shrink-0 object-contain" style={resting ? { filter: "grayscale(1)", opacity: 0.6 } : undefined} />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="truncate text-sm font-extrabold">{c.name}</div>
                  <div><b style={{ color: "#2b1406", background: TIER_INFO[c.tier].color, padding: "0 4px", borderRadius: 4 }}>{TIER_INFO[c.tier].label}</b> · {c.hp}/{c.hp_max} PV</div>
                  {resting && <div className="font-bold text-[#7a3a0e]">💤 Se repose encore {c.rest_left} expédition{c.rest_left > 1 ? "s" : ""}</div>}
                  {provisional && <div className="font-bold text-[#7a3a0e]">À toi à la fin de l'expédition</div>}
                  {c.active && !resting && <div className="font-bold text-[#166534]">✔ T'accompagne</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!c.active && <button type="button" disabled={busy || resting || provisional} className={BTN} onClick={() => void act(() => setActiveCompanion(c.id))}>Emmener</button>}
                    {c.active && <button type="button" disabled={busy} className={BTN} onClick={() => void act(() => setActiveCompanion(null))}>Laisser ici</button>}
                    {!provisional && (confirmId === c.id ? (
                      <button type="button" disabled={busy} className="rounded border-2 border-[#b91c1c] bg-[#b91c1c] px-2 py-1 text-xs font-bold text-white" onClick={() => void act(() => releaseCompanion(c.id))}>Confirmer : relâcher</button>
                    ) : (
                      <button type="button" disabled={busy} className="rounded border-2 border-[#b91c1c] px-2 py-1 text-xs font-bold text-[#b91c1c]" onClick={() => setConfirmId(c.id)}>Relâcher</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>}
      </div>
    </div>
  );
}
