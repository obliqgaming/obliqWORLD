// « Inviter un joueur » : mon lien et mon code de parrainage, mes chiffres, et la saisie d'un code reçu (SQL 062).
import { useEffect, useState } from "react";
import { claimCode, fetchReferralStats, type ReferralStats } from "../lib/referral";

export const FONT = { fontFamily: "'Baloo 2', cursive" };
export const BTN = "rounded border-2 border-[#7a4a22] bg-[#7a4a22] px-2.5 py-0.5 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function InvitePanel({ onClose }: { onClose: () => void }) {
  const [st, setSt] = useState<ReferralStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    fetchReferralStats()
      .then(setSt)
      .catch((e: any) => setErr(e?.message?.includes("referral") ? "Pas encore activé (SQL 062)." : (e?.message ?? "Erreur")));
  }, []);
  const link = st ? `${window.location.origin}/?parrain=${st.code}` : "";
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignoré */
    }
  };
  const send = async () => {
    setMsg(null);
    try {
      const r = await claimCode(code);
      setMsg(r.ok ? "Code enregistré ! Ton parrain recevra une surprise quand tu auras fini ton premier dessin." : (r.reason ?? "Code refusé."));
      if (r.ok) setCode("");
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur");
    }
  };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3" style={FONT} onClick={onClose}>
      <div className="w-[min(28rem,96%)] rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-4 text-[#3a2410] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold">🎁 Inviter un joueur</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-3 py-0.5 text-xs font-bold hover:bg-[#7a4a22]/15">Fermer</button>
        </div>
        {err && <div className="mt-2 text-sm font-bold text-[#92400e]">{err}</div>}
        {!st && !err && <div className="mt-2 text-sm">Chargement…</div>}
        {st && (
          <>
            <div className="mt-2 text-sm">Quand un joueur que tu invites termine le dessin de son premier personnage, <b>tu reçois une surprise</b> (jusqu'à {st.max}).</div>
            <div className="mt-3 rounded-lg bg-white/45 p-2">
              <div className="text-[11px] font-extrabold uppercase text-[#7a4a22]">Ton lien</div>
              <div className="flex items-center gap-2">
                <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded border border-[#7a4a22]/60 bg-[#fff8e6] px-1.5 py-1 text-xs" />
                <button type="button" className={BTN} onClick={() => void copy("link", link)}>{copied === "link" ? "Copié ✔" : "Copier"}</button>
              </div>
              <div className="mt-2 text-[11px] font-extrabold uppercase text-[#7a4a22]">Ton code</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded border border-[#7a4a22]/60 bg-[#fff8e6] px-2 py-1 text-center text-lg font-extrabold tracking-widest">{st.code}</div>
                <button type="button" className={BTN} onClick={() => void copy("code", st.code)}>{copied === "code" ? "Copié ✔" : "Copier"}</button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-white/45 p-1.5"><div className="text-2xl font-extrabold leading-none">{st.invited}</div><div className="text-[11px]">invité{st.invited > 1 ? "s" : ""} arrivé{st.invited > 1 ? "s" : ""}</div></div>
              <div className="rounded-lg bg-white/45 p-1.5"><div className="text-2xl font-extrabold leading-none">{st.rewarded}<span className="text-sm font-bold opacity-60"> / {st.max}</span></div><div className="text-[11px]">surprises reçues</div></div>
            </div>
            <div className="mt-3 border-t border-[#7a4a22]/30 pt-2">
              <div className="text-[11px] font-extrabold uppercase text-[#7a4a22]">Tu as reçu un code de parrain ?</div>
              <div className="mt-1 flex gap-2">
                <input value={code} maxLength={12} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" className="min-w-0 flex-1 rounded border border-[#7a4a22]/60 bg-[#fff8e6] px-1.5 py-1 text-center text-sm font-bold tracking-widest" />
                <button type="button" className={BTN} disabled={!code.trim()} onClick={() => void send()}>Valider</button>
              </div>
              <div className="mt-1 text-[10px] opacity-70">À saisir avant de créer ton premier personnage.</div>
              {msg && <div className="mt-1 text-xs font-bold">{msg}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
