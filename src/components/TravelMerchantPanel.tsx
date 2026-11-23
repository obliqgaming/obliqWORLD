// Marchand itinérant Boursejoufflue (SQL 156) : prix doublés, payés avec les flouz de ta bourse.
import { useEffect, useRef, useState } from "react";
import { uiSound } from "../lib/ui-sounds";
import { CONSUMABLE_INFO, type ConsumableKind } from "../lib/consumables";
import { RARITY_INFO } from "../lib/weapons";
import { buyFromMerchant, getMerchant, type MerchantState } from "../lib/expedition-shops";

const BTN = "rounded border-2 border-[#7a4a22] bg-[#7a4a22] px-2 py-0.5 text-xs font-bold text-[#fff3d6] hover:bg-[#5e3818] disabled:opacity-50";

export function TravelMerchantPanel({ expeditionId }: { expeditionId: string }) {
  const [st, setSt] = useState<MerchantState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    getMerchant(expeditionId).then(setSt).catch((e) => console.error("merchant load failed", e));
  }, [expeditionId]);

  async function buy(kind: string, okText: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMsg(null);
    try {
      setSt(await buyFromMerchant(expeditionId, kind));
      uiSound("ok");
      setMsg(okText);
    } catch (e: any) {
      uiSound("error");
      setMsg(e?.message ?? "Erreur");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="absolute right-2 top-14 z-30 w-[min(21rem,50%)] max-h-[80%] overflow-y-auto rounded-lg border-2 border-[#7a4a22] bg-[#f1dfb6]/95 p-3 text-[#3a2410] shadow-xl" style={{ fontFamily: "'Baloo 2', cursive" }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <img src="/npc/boursejoufflue.webp" alt="Boursejoufflue" className="h-16 w-auto shrink-0" draggable={false} />
        <div className="text-base font-extrabold leading-tight">🛒 Boursejoufflue, marchand itinérant</div>
      </div>
      <div className="mt-1 text-xs leading-snug">
        « Prix doublés, mais pas de file d'attente ! » Tu paies avec les <b>flouz de ta bourse</b> : <b>{st?.gold ?? 0} flouz</b>. Comme le butin, ce que tu achètes est perdu si tu meurs.
      </div>
      <div className="mt-2 space-y-1.5">
        {(st?.offers ?? []).map((o) => {
          const isWeapon = o.kind === "weapon" && o.weapon;
          const info = isWeapon ? null : CONSUMABLE_INFO[o.kind as ConsumableKind];
          const soldOut = o.stock <= 0;
          const capped = !isWeapon && st ? o.mine >= st.max_per_player : false;
          const poor = (st?.gold ?? 0) < o.price;
          return (
            <div key={o.kind} className="rounded border border-[#7a4a22]/50 bg-white/40 p-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                {isWeapon && o.weapon!.image && <img src={o.weapon!.image} alt="" className="h-8 w-8 object-contain" />}
                <b>{isWeapon ? `⚔️ ${o.weapon!.name}` : `${info?.icon ?? ""} ${info?.name ?? o.kind}`}</b>
                {isWeapon && <span className="font-bold" style={{ color: RARITY_INFO[o.weapon!.rarity as keyof typeof RARITY_INFO]?.color }}>{RARITY_INFO[o.weapon!.rarity as keyof typeof RARITY_INFO]?.label ?? o.weapon!.rarity}</span>}
              </div>
              {!isWeapon && info && <div className="opacity-80">{info.text}</div>}
              {!isWeapon && o.mine > 0 && <div className="opacity-70">Tu en as acheté {o.mine}/{st?.max_per_player}.</div>}
              <div className="mt-1 flex items-center gap-2">
                <button type="button" className={BTN} disabled={busy || soldOut || capped || poor} onClick={() => void buy(o.kind, `✔ Acheté : ${isWeapon ? o.weapon!.name : info?.name}.`)}>
                  {soldOut ? "Vendu" : `Acheter · ${o.price} flouz`}
                </button>
                {poor && !soldOut && <span className="opacity-70">pas assez de flouz</span>}
              </div>
            </div>
          );
        })}
        {st && st.offers.length === 0 && <div className="text-xs">Boursejoufflue fouille ses sacs…</div>}
      </div>
      {msg && <div className="mt-2 text-xs font-bold text-[#92400e]">{msg}</div>}
      <div className="mt-2 text-[11px] opacity-80">Quand tout le monde a fini, votez pour reprendre la route.</div>
    </div>
  );
}
