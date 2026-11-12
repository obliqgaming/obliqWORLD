// Choix du chemin sur la carte d'expédition : fenêtre centrée, deux grosses cartes, chacun clique, les noms s'affichent
// sur les cartes, la majorité l'emporte (égalité : un joueur tiré au sort parmi les ex æquo décide, publiquement).
// En dessous : jauge du Boucan et petits aperçus (non cliquables) des prochains pas.
import { useCallback, useEffect, useRef, useState } from "react";
import { MAP_NODE_INFO, decideExpeditionMap, getExpeditionMap, voteExpeditionMap, type MapNodeType, type MapState } from "../lib/expedition-map";

const FONT = { fontFamily: "'Baloo 2', cursive" };

export function ExpeditionMapChoice({
  expeditionId,
  layer,
  myCharacterId,
  names,
  initial,
  onResolved,
}: {
  expeditionId: string;
  layer: number;
  myCharacterId: string;
  names: Record<string, string>;
  initial?: MapState | null;
  onResolved: (type: MapNodeType, slot: number) => void;
}) {
  const [st, setSt] = useState<MapState | null>(initial ?? null);
  const [now, setNow] = useState(() => Date.now());
  const skewRef = useRef(0);
  const doneRef = useRef(false);
  const lastDecideRef = useRef(0);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getExpeditionMap(expeditionId, layer, true);
      if (s.server_now) skewRef.current = new Date(s.server_now).getTime() - Date.now();
      setSt(s);
    } catch (e) {
      console.error("map get failed", e);
    }
  }, [expeditionId, layer]);

  // Lecture régulière (pas de temps réel pour cette fenêtre : quelques secondes de vote seulement).
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const chosen = st?.chosen_slot ?? null;
  const deadlineMs = st?.deadline ? new Date(st.deadline).getTime() : null;
  const left = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - (now + skewRef.current)) / 1000)) : null;
  const votes = st?.votes ?? [];
  const aliveIds = st?.alive ?? [];
  const votedAlive = votes.filter((v) => aliveIds.includes(v.c)).length;
  const everyoneVoted = aliveIds.length > 0 && votedAlive >= aliveIds.length;

  // Tout le monde a voté, ou le temps est écoulé : on demande la décision (le serveur la prend une seule fois).
  useEffect(() => {
    if (!st || chosen !== null) return;
    const timeUp = left !== null && left <= 0;
    if (!everyoneVoted && !timeUp) return;
    if (Date.now() - lastDecideRef.current < 1500) return;
    lastDecideRef.current = Date.now();
    void decideExpeditionMap(expeditionId, layer).then(refresh).catch((e) => console.error("map decide failed", e));
  }, [st, chosen, everyoneVoted, left, expeditionId, layer, refresh]);

  // Décision prise : on laisse le résultat affiché un instant (surtout si égalité), puis on avance.
  useEffect(() => {
    if (chosen === null || !st?.nodes || doneRef.current) return;
    const node = st.nodes.find((n) => n.slot === chosen);
    if (!node) return;
    const t = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onResolved(node.type, chosen);
    }, st.tiebreaker ? 3500 : 2200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, st?.nodes, st?.tiebreaker]);

  const myVote = votes.find((v) => v.c === myCharacterId)?.slot ?? null;
  const canVote = chosen === null && aliveIds.includes(myCharacterId);
  const vote = async (slot: number) => {
    if (!canVote) return;
    setErr(null);
    // Affichage immédiat de mon vote, confirmé à la prochaine lecture.
    setSt((cur) => (cur ? { ...cur, votes: [...(cur.votes ?? []).filter((v) => v.c !== myCharacterId), { c: myCharacterId, slot }] } : cur));
    try {
      await voteExpeditionMap(expeditionId, layer, slot);
      void refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      void refresh();
    }
  };

  if (!st || !st.nodes || st.nodes.length === 0) return null;
  const thr = Math.max(1, st.threshold ?? 8);
  const boucan = st.boucan ?? 0;
  const pct = Math.min(100, Math.round((boucan / thr) * 100));
  const heavy = pct >= 70 && !st.chef_done;
  const tieName = st.tiebreaker ? names[st.tiebreaker] ?? "Un équipier" : null;
  const chosenNode = chosen !== null ? st.nodes.find((n) => n.slot === chosen) : null;

  return (
    <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/35 p-2" style={FONT}>
      <div className="w-[min(46rem,96%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6]/97 p-4 text-[#3a2410] shadow-2xl">
        <div className="text-center text-[11px] font-bold uppercase tracking-widest text-[#7a4a22]">Embranchement</div>
        <div className="text-center text-xl font-extrabold">Quel chemin prendre ?</div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {st.nodes.map((n) => {
            const info = MAP_NODE_INFO[n.type];
            const voters = votes.filter((v) => v.slot === n.slot && aliveIds.includes(v.c));
            const isMine = myVote === n.slot;
            const isChosen = chosen === n.slot;
            const dim = chosen !== null && !isChosen;
            return (
              <button
                key={n.slot}
                type="button"
                disabled={!canVote}
                onClick={() => void vote(n.slot)}
                className="flex min-h-[10.5rem] flex-col items-center rounded-xl border-4 px-2 py-3 text-center shadow transition-transform enabled:hover:scale-[1.02]"
                style={{
                  background: "#fff3d6",
                  borderColor: isChosen ? "#16a34a" : isMine ? "#fde047" : info.color,
                  outline: isMine && chosen === null ? "3px solid #fde047" : "none",
                  opacity: dim ? 0.45 : 1,
                }}
              >
                <span className="text-5xl leading-none">{info.icon}</span>
                <span className="mt-1 text-lg font-extrabold" style={{ color: info.color }}>{info.label}</span>
                <span className="mt-1 text-xs font-semibold leading-snug">{info.text}</span>
                <span className="mt-auto flex min-h-[1.5rem] flex-wrap items-center justify-center gap-1 pt-2">
                  {voters.map((v) => (
                    <span key={v.c} className="rounded-full bg-[#7a4a22] px-2 py-0.5 text-[11px] font-bold text-[#fff3d6]">
                      {names[v.c] ?? "?"}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-center gap-4 rounded-lg bg-[#7a4a22]/15 py-1.5 text-base font-extrabold">
          <span>🗳 {votedAlive}/{aliveIds.length} votes</span>
          {left !== null && chosen === null && <span style={{ color: left <= 20 ? "#b91c1c" : undefined }}>⏱ {left} s</span>}
        </div>

        {chosenNode && (
          <div className="mt-2 text-center text-sm font-extrabold text-[#166534]">
            {tieName
              ? `Égalité ! Le sort désigne ${tieName} : ${MAP_NODE_INFO[chosenNode.type].icon} ${MAP_NODE_INFO[chosenNode.type].label}.`
              : `Le groupe a choisi : ${MAP_NODE_INFO[chosenNode.type].icon} ${MAP_NODE_INFO[chosenNode.type].label}.`}
          </div>
        )}
        {err && <div className="mt-1 text-center text-xs font-bold text-[#b91c1c]">{err}</div>}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[12rem] flex-1">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#7a4a22]">
              <span>Le Boucan</span>
              <span>{pct} %</span>
            </div>
            <div className="mt-0.5 h-3 overflow-hidden rounded-full border border-[#7a4a22]/60 bg-[#7a4a22]/20">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 70 ? "#b91c1c" : pct >= 40 ? "#d97706" : "#65a30d" }} />
            </div>
            {st.chef_pending && !st.chef_done ? (
              <div className="mt-0.5 text-[11px] font-bold text-[#b91c1c]">Le Chef-Patron est sur vos talons : le prochain combat sera pour lui !</div>
            ) : heavy ? (
              <div className="mt-0.5 text-[11px] font-bold text-[#b91c1c]">Des pas lourds approchent…</div>
            ) : null}
          </div>
          {(st.preview ?? []).length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a4a22]">Ensuite</span>
              {(st.preview ?? []).map((p) => (
                <span key={p.layer} className="flex items-center gap-0.5 rounded-lg border border-[#7a4a22]/50 bg-[#fff3d6]/70 px-1.5 py-0.5 text-lg opacity-80" title="Aperçu : pas cliquable">
                  {p.nodes.map((t, i) => (
                    <span key={i} title={MAP_NODE_INFO[t]?.label}>{MAP_NODE_INFO[t]?.icon ?? "❔"}</span>
                  ))}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
