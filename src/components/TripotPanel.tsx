// Tripot du Grand Safari (SQL 156) : une seule partie par personne, avec les flouz trouvés pendant l'expédition.
// Le serveur lance le dé ; tout le monde voit la mise et le jet de chacun. Le groupe repart ensuite par le vote habituel.
import { useEffect, useRef, useState } from "react";
import { uiSound } from "../lib/ui-sounds";
import { getTripot, playTripot, type TripotOutcome, type TripotState } from "../lib/expedition-shops";

const BTN = "rounded border-2 border-[#7a4a22] bg-[#7a4a22] px-2 py-0.5 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";
const LABEL: Record<TripotOutcome, string> = { perdu: "Mise perdue", rendu: "Mise rendue", triple: "Mise triplée !", passe: "A passé son tour" };
const COLOR: Record<TripotOutcome, string> = { perdu: "#b91c1c", rendu: "#475569", triple: "#15803d", passe: "#64748b" };

export function TripotPanel({ expeditionId, characterId }: { expeditionId: string; characterId: string }) {
  const [st, setSt] = useState<TripotState | null>(null);
  const [bet, setBet] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const lock = useRef(false);

  const reload = async () => {
    try {
      setSt(await getTripot(expeditionId));
    } catch (e) {
      console.error("tripot refresh failed", e);
    }
  };
  useEffect(() => {
    void reload();
    const t = window.setInterval(() => void reload(), 4000); // on voit jouer les autres ; s'arrête quand le tripot se ferme
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expeditionId]);

  const mine = st?.players.find((p) => p.c === characterId) ?? null;
  const gold = st?.gold ?? 0;
  const amount = Math.max(0, Math.min(gold, Math.floor(Number(bet) || 0)));

  async function play(value: number) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const r = await playTripot(expeditionId, value);
      setSt(r);
      const me = r.players.find((p) => p.c === characterId);
      uiSound(me?.outcome === "perdu" ? "error" : "ok");
    } catch (e: any) {
      uiSound("error");
      setMsg(e?.message ?? "Erreur");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="absolute right-2 top-14 z-30 w-[min(21rem,50%)] rounded-lg border-2 border-[#7a4a22] bg-[#f1dfb6]/95 p-3 text-[#3a2410] shadow-xl" style={{ fontFamily: "'Baloo 2', cursive" }} onClick={(e) => e.stopPropagation()}>
      <div className="text-base font-extrabold">🎲 Tripot clandestin</div>
      <div className="text-xs leading-snug">
        Un coin sombre, des dés, des sourires en coin. <b>Une seule partie par personne</b>, et seulement avec les <b>flouz trouvés pendant cette expédition</b> (jamais ceux du village).
      </div>
      {st && (
        <div className="mt-1.5 rounded border border-[#7a4a22]/50 bg-white/40 p-1.5 text-xs leading-snug">
          <b>Le dé (1 à 100) :</b><br />
          1 à {st.lose_max} : ta mise est perdue<br />
          {st.lose_max + 1} à {st.refund_max} : ta mise t'est rendue<br />
          {st.refund_max + 1} à 100 : ta mise est multipliée par {st.mult}
        </div>
      )}
      {st && !mine && (
        <div className="mt-2 space-y-1">
          <div className="text-xs">Tu as <b>{gold} flouz</b> de cette expédition.</div>
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="number"
              min={0}
              max={gold}
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              placeholder="Ta mise"
              className="w-20 rounded border border-[#7a4a22] bg-white/80 px-1 py-0.5 text-xs"
            />
            <button type="button" disabled={busy || amount <= 0} className={BTN} onClick={() => void play(amount)}>Miser {amount > 0 ? `${amount} flouz` : ""}</button>
            <button type="button" disabled={busy} className={BTN} onClick={() => void play(0)}>Passer mon tour</button>
          </div>
        </div>
      )}
      {mine && (
        <div className="mt-2 text-xs font-bold" style={{ color: COLOR[mine.outcome] }}>
          {mine.outcome === "passe" ? "Tu as passé ton tour." : `Ton jet : ${mine.roll} → ${LABEL[mine.outcome]} (${mine.delta >= 0 ? "+" : ""}${mine.delta} flouz)`}
        </div>
      )}
      {st && st.players.length > 0 && (
        <div className="mt-2 space-y-0.5 text-xs">
          <div className="font-extrabold">Les parties</div>
          {st.players.map((p) => (
            <div key={p.c} className="flex flex-wrap items-baseline gap-x-1">
              <b>{p.n}</b>
              {p.outcome === "passe" ? (
                <span className="opacity-70">passe son tour</span>
              ) : (
                <>
                  <span>mise {p.bet}</span>
                  <span>· 🎲 {p.roll}</span>
                  <span className="font-bold" style={{ color: COLOR[p.outcome] }}>· {LABEL[p.outcome]} ({p.delta >= 0 ? "+" : ""}{p.delta})</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {st && st.waiting.length > 0 && <div className="mt-1.5 text-[11px] opacity-80">Ils n'ont pas encore joué : {st.waiting.join(", ")}.</div>}
      {mine && <div className="mt-1.5 text-[11px] opacity-80">Quand tout le monde a fini, votez pour reprendre la route.</div>}
      {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
    </div>
  );
}
