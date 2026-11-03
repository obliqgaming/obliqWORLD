// Tableau « cherche un groupe » : annonces des joueurs, inscription d'un clic, invitation d'un clic par l'auteur.
import { PanelIcon } from "./GameIcons";
import { useEffect, useState } from "react";
import { leaveScenePresence } from "../lib/scenes-supabase";
import {
  deleteGroupAd, fetchGroupAds, fetchSeenToday, meetLabel, seenLabel, postGroupAd, signupGroupAd, subscribeGroupAds, unsignupGroupAd,
  type GroupAd, type GroupAdSignup, type SeenPlayer,
} from "../lib/group-ads";

const FONT = { fontFamily: "'Baloo 2', cursive" };
const BTN = "rounded-lg border-2 border-[#7a4a22] bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";
const BTN2 = "rounded-lg border-2 border-[#7a4a22] px-3 py-1 text-xs font-bold text-[#5e3818] hover:bg-[#7a4a22]/15 disabled:opacity-50";
const ROUTE = { court: "Expédition courte", long: "Expédition longue" } as const;

const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function GroupBoard({ character, onClose, onInvite }: { character: { id: string; name: string } | null; onClose: () => void; onInvite?: ((characterId: string) => void) | undefined }) {
  const [ads, setAds] = useState<GroupAd[]>([]);
  const [signups, setSignups] = useState<GroupAdSignup[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [route, setRoute] = useState<"" | "court" | "long">("");
  const [meet, setMeet] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"ads" | "seen">("ads");
  const [seen, setSeen] = useState<SeenPlayer[] | null>(null);
  useEffect(() => {
    if (tab !== "seen") return;
    let cancelled = false;
    void fetchSeenToday().then((l) => { if (!cancelled) setSeen(l); }).catch(() => { if (!cancelled) setSeen([]); });
    return () => { cancelled = true; };
  }, [tab]);

  const load = async () => {
    try {
      const r = await fetchGroupAds();
      setAds(r.ads); setSignups(r.signups);
    } catch { /* ignoré */ }
  };
  useEffect(() => {
    void import("../lib/scenes-supabase").then((m) => m.ensureUserId()).then(setMe).catch(() => {});
    void load();
    const ch = subscribeGroupAds(() => { void load(); });
    return () => { leaveScenePresence(ch); };
  }, []);

  const mine = ads.find((a) => a.user_id === me) ?? null;
  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { await fn(); await load(); } catch (e: any) { setMsg(e?.message ?? "Erreur"); } finally { setBusy(false); }
  };
  const mySignup = (adId: string) => signups.some((s) => s.ad_id === adId && s.user_id === me);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/55 p-2" style={FONT} onClick={(e) => e.stopPropagation()}>
      <div className="max-h-full w-[min(40rem,98%)] overflow-y-auto parchment-scroll rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold"><PanelIcon src="/icons/group.png" />Groupes</div>
          <button type="button" className={BTN2} onClick={onClose}>Fermer</button>
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setTab("ads")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "ads" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>📋 Annonces</button>
          <button type="button" onClick={() => setTab("seen")} className={`rounded px-3 py-1 text-sm font-bold ${tab === "seen" ? "bg-[#7a4a22] text-[#fff3d6]" : "border border-[#7a4a22]"}`}>👀 Vus aujourd'hui</button>
        </div>
        {tab === "seen" && (
          <div className="mt-3">
            <div className="text-sm font-extrabold">Joueurs vus aujourd'hui{seen ? ` (${seen.length})` : ""}</div>
            <div className="mt-2 grid gap-1.5">
              {seen === null && <div className="text-sm opacity-70">Chargement…</div>}
              {seen !== null && seen.length === 0 && <div className="text-sm opacity-70">Personne pour l'instant.</div>}
              {(seen ?? []).map((p) => (
                <div key={p.character_id} className="flex items-center gap-2 rounded-lg border border-[#b98a54] bg-[#f6e8c4] px-2 py-1.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <b>{p.name}</b>{p.is_me ? " (toi)" : ""}
                    <span className="text-xs" style={{ color: "#5e3818" }}> · {[p.level ? `niv. ${p.level}` : null, p.class_name].filter(Boolean).join(" · ") || "—"}</span>
                  </div>
                  <span className="text-xs opacity-80">{seenLabel(p.last_seen_at)}</span>
                  {!p.is_me && onInvite && (
                    <button type="button" disabled={invited[p.character_id]} className={BTN} onClick={() => { onInvite(p.character_id); setInvited((o) => ({ ...o, [p.character_id]: true })); }}>
                      {invited[p.character_id] ? "Invité" : "Inviter"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "ads" && character && (
          <div className="mt-3 rounded-lg border border-[#7a4a22]/50 bg-white/40 p-2">
            {mine ? (
              <>
                <div className="text-xs font-extrabold uppercase text-[#7a4a22]">Ton annonce</div>
                <div className="mt-1 text-sm font-bold">« {mine.text} »</div>
                <div className="text-[11px] opacity-80">
                  {[mine.route ? ROUTE[mine.route] : "Au choix", meetLabel(mine.meet_at) ?? "pas d'heure fixée"].join(" · ")}
                </div>
                <div className="mt-1.5 text-xs font-bold">Inscrits :</div>
                {signups.filter((s) => s.ad_id === mine.id).length === 0 && <div className="text-xs opacity-70">Personne pour l'instant.</div>}
                {signups.filter((s) => s.ad_id === mine.id).map((s) => (
                  <div key={s.user_id} className="mt-1 flex items-center gap-2 text-xs">
                    <span className="flex-1 font-bold">{s.name}<span className="font-normal opacity-80"> · {[s.level ? `niv. ${s.level}` : null, s.class_name].filter(Boolean).join(" · ")}</span></span>
                    {onInvite && <button type="button" disabled={invited[s.character_id]} className={BTN} onClick={() => { onInvite(s.character_id); setInvited((o) => ({ ...o, [s.character_id]: true })); }}>{invited[s.character_id] ? "Invité" : "Inviter"}</button>}
                  </div>
                ))}
                <button type="button" disabled={busy} className={`${BTN2} mt-2`} onClick={() => void act(() => deleteGroupAd())}>Retirer mon annonce</button>
              </>
            ) : (
              <>
                <div className="text-xs font-extrabold uppercase text-[#7a4a22]">Poster une annonce</div>
                <input value={text} maxLength={120} onChange={(e) => setText(e.target.value)} placeholder="Ex. : cherche un soigneur pour ce soir"
                  className="mt-1 w-full rounded border border-[#7a4a22] bg-white/70 px-2 py-1 text-sm" />
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <select value={route} onChange={(e) => setRoute(e.target.value as "" | "court" | "long")} className="rounded border border-[#7a4a22] bg-white/70 px-1.5 py-1">
                    <option value="">Expédition au choix</option>
                    <option value="court">Courte</option>
                    <option value="long">Longue</option>
                  </select>
                  <label className="flex items-center gap-1">Rendez-vous :
                    <input type="datetime-local" value={meet} min={toLocalInput(new Date())} onChange={(e) => setMeet(e.target.value)} className="rounded border border-[#7a4a22] bg-white/70 px-1 py-0.5" />
                  </label>
                  {meet && <button type="button" className="underline" onClick={() => setMeet("")}>sans heure</button>}
                </div>
                <button type="button" disabled={busy || !text.trim()} className={`${BTN} mt-2`}
                  onClick={() => void act(async () => { await postGroupAd(character.id, text, route || null, meet ? new Date(meet).toISOString() : null); setText(""); setMeet(""); })}>
                  Publier
                </button>
                <div className="mt-1 text-[11px] opacity-70">L'annonce reste même si tu te déconnectes, et disparaît toute seule (2 h après le rendez-vous, ou au bout de 24 h sans heure).</div>
              </>
            )}
          </div>
        )}

        {tab === "ads" && <div className="mt-3 text-xs font-extrabold uppercase text-[#7a4a22]">Annonces des autres joueurs</div>}
        {tab === "ads" && <div className="mt-1 grid gap-2">
          {ads.filter((a) => a.user_id !== me).length === 0 && <div className="text-sm opacity-70">Aucune annonce pour l'instant.</div>}
          {ads.filter((a) => a.user_id !== me).map((a) => {
            const n = signups.filter((s) => s.ad_id === a.id).length;
            const inn = mySignup(a.id);
            return (
              <div key={a.id} className="rounded-lg border border-[#b98a54] bg-[#f6e8c4] p-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">« {a.text} »</div>
                    <div className="text-[11px]" style={{ color: "#5e3818" }}>
                      {a.name}{[a.level ? ` · niv. ${a.level}` : "", a.class_name ? ` · ${a.class_name}` : ""].join("")} · {a.route ? ROUTE[a.route] : "Expédition au choix"} · {meetLabel(a.meet_at) ?? "pas d'heure fixée"} · {n} inscrit{n > 1 ? "s" : ""}
                    </div>
                  </div>
                  {character && (
                    <button type="button" disabled={busy} className={inn ? BTN2 : BTN} onClick={() => void act(() => (inn ? unsignupGroupAd(a.id) : signupGroupAd(a.id, character.id)))}>
                      {inn ? "Me désinscrire" : "Je m'inscris"}
                    </button>
                  )}
                </div>
                {inn && <div className="mt-1 text-[11px] font-bold" style={{ color: "#166534" }}>✔ Inscrit : l'auteur peut t'inviter dans son groupe.</div>}
              </div>
            );
          })}
        </div>}
        {msg && <div className="mt-2 text-center text-xs font-bold text-[#92400e]">{msg}</div>}
      </div>
    </div>
  );
}
