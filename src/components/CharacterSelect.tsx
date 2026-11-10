import { useEffect, useState, type ChangeEvent, type MouseEvent } from "react";
import { useDraftKey, loadDraftName, saveDraftName, loadDraftFamily, saveDraftFamily, clearDraft } from "../lib/drawing-drafts";
import { uploadDrawingAsCharacterAsset, type AuthIdentity, type CharacterFamily, type Point, type VisualAsset } from "../lib/scenes-supabase";
import { AccountBadge } from "./AccountBadge";
import { Hand } from "lucide-react";
import { DrawingCanvas } from "./DrawingCanvas";
import { SoundControl } from "./SoundControl";
import { claimCode } from "../lib/referral";

// Provisoire pendant le développement : permet de se connecter en invité avec un
// « personnage déjà existant ». À passer à false quand le jeu sera ouvert : les
// nouveaux joueurs devront alors dessiner leur personnage.
const DEV_ALLOW_EXISTING_CHARACTERS = false;

export function CharacterSelect({
  assets,
  onChoose,
  muted,
  onToggleMute,
  volume,
  onVolumeChange,
  authIdentity,
  onConnect,
  onDisconnect,
  error,
  busy,
  backdropUrl,
}: {
  assets: VisualAsset[];
  onChoose: (visualAssetId: string, name: string, family: CharacterFamily) => void;
  muted: boolean;
  onToggleMute: (e: MouseEvent) => void;
  volume: number;
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  authIdentity: AuthIdentity | null;
  onConnect: (provider: "twitch" | "discord") => void;
  onDisconnect: () => void;
  // Message à afficher si le chargement/la création du personnage a échoué,
  // et si une création est en cours (désactive "Confirmer" entre-temps).
  error?: string | null;
  busy?: boolean;
  /** Image de fond (le décor de l'auberge), floutée derrière l'écran. */
  backdropUrl?: string | undefined;
}) {
  const [name, setName] = useState("");
  // Famille choisie AVANT le dessin ; définitive une fois le personnage créé.
  const [family, setFamily] = useState<CharacterFamily | null>(null);
  const [saving, setSaving] = useState(false);
  // Brouillon du premier personnage : dessin, nom, spécialisation et repère de main sont gardés sur cet appareil jusqu'à la validation.
  const draftKey = useDraftKey("character");
  useEffect(() => {
    if (!draftKey) return;
    const n = loadDraftName(draftKey);
    if (n) setName(n);
    const f = loadDraftFamily(draftKey);
    if (f) setFamily(f);
  }, [draftKey]);
  useEffect(() => { if (draftKey) saveDraftName(draftKey, name); }, [draftKey, name]);
  useEffect(() => { if (draftKey) saveDraftFamily(draftKey, family); }, [draftKey, family]);
  const [tab, setTab] = useState<"draw" | "existing">("draw");
  const [selected, setSelected] = useState<string | null>(null);

  const [formMessage, setFormMessage] = useState<string | null>(null);
  // Code de parrain (SQL 062) : il doit être enregistré AVANT la création du premier personnage.
  const [refOpen, setRefOpen] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [refOk, setRefOk] = useState(false);
  const [refMsg, setRefMsg] = useState<string | null>(null);
  const submitRefCode = async (): Promise<boolean> => {
    if (refOk || !refCode.trim()) return true;
    try {
      const r = await claimCode(refCode);
      if (r.ok) {
        setRefOk(true);
        setRefMsg("Code enregistré ✔ ton parrain recevra une surprise.");
        return true;
      }
      // Le lien de parrain a déjà enregistré un code à la connexion : ce n'est pas une erreur, et ça ne doit pas bloquer la création.
      if ((r.reason ?? "").includes("déjà enregistré")) {
        setRefOk(true);
        setRefMsg("Ton code de parrain est déjà enregistré ✔");
        return true;
      }
      setRefMsg(r.reason ?? "Code refusé.");
    } catch (e: any) {
      setRefMsg(e?.message ?? "Connecte-toi d'abord pour utiliser un code.");
    }
    return false;
  };
  const handleDrawingExported = async (blob: Blob, handAnchor: Point | null) => {
    if (!family) {
      setFormMessage("Choisis ta spécialisation ci-dessous (Mêlée ou Magie), puis valide de nouveau ton dessin.");
      return;
    }
    setFormMessage(null);
    if (!(await submitRefCode())) {
      setRefOpen(true);
      setFormMessage("Le code de parrain est refusé : corrige-le ou vide le champ, puis valide de nouveau ton dessin.");
      return;
    }
    setSaving(true);
    try {
      const asset = await uploadDrawingAsCharacterAsset(blob, name, handAnchor);
      clearDraft(draftKey);
      onChoose(asset.id, name, family);
    } catch (e) {
      console.error("Drawing upload failed", e);
      setSaving(false);
    }
  };

  return (
    <div className="relative isolate flex h-screen w-screen justify-center overflow-y-auto bg-[#1a0f07] p-4">
      {/* Décor de l'auberge en fond, flouté et assombri (simple image déjà chargée par le jeu) : on voit où on arrive. */}
      {backdropUrl && (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <img src={backdropUrl} alt="" draggable={false} className="h-full w-full scale-105 object-cover blur-[3px]" />
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}
      <SoundControl
        muted={muted}
        onToggleMute={onToggleMute}
        volume={volume}
        onVolumeChange={onVolumeChange}
        className="absolute right-5 top-5 z-10"
      />
      <AccountBadge
        identity={authIdentity}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        className="absolute left-5 top-5 z-10"
      />

      <div
        className="m-auto w-full max-w-7xl text-[#3a2210]"
        style={{
          borderStyle: "solid",
          // Nouveau cadre (rectangle simple, sans lanterne/bannière qui dépassait du
          // cadre en bois de l'ancienne image et provoquait le chevauchement du texte
          // au rendu). Bordure mesurée directement sur le fichier source
          // (1672x941 px) : gauche 242, droite 244, haut 89, bas 101.
          // Important : border-width en % n'est pas fiable sur toutes les tailles
          // (le navigateur peut l'ignorer/l'écraser, ce qui rendait le cadre en bois
          // quasi invisible) — on utilise des valeurs fixes en px à la place, dans
          // les mêmes proportions que le fichier source.
          borderWidth: "48px 62px 54px 61px",
          borderImageSource: "url('/ui/character-frame.webp')",
          borderImageSlice: "89 244 101 242 fill",
          borderImageRepeat: "stretch",
        }}
      >
        <h2 className="mb-3 text-center text-2xl font-bold" style={{ fontFamily: "'Baloo 2', cursive" }}>
          Crée ton personnage
        </h2>

        {error && (
          <p className="mb-4 rounded-lg border-2 border-red-700/60 bg-red-900/20 px-3 py-2 text-center text-sm font-bold text-red-800">
            {error}
          </p>
        )}

        <p className="mb-3 text-center text-[13px] font-bold leading-snug">
          <Hand className="mr-1 inline h-4 w-4 align-[-3px] text-[#7a4a22]" />
          Ton personnage doit avoir une main (ou un membre) capable de tenir une arme :<br />place bien le repère de main sur le dessin.
        </p>

        <div className="grid gap-x-5 gap-y-4 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[1fr_26.5rem_1fr]">
          {/* Gauche : identité du personnage */}
          <div className="order-2 lg:order-1 lg:col-start-1 lg:row-start-1 xl:self-center">
            <p className="mb-1 text-center text-sm font-bold">Nom</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du personnage"
          maxLength={30}
          className="w-full rounded-lg border-2 border-[#7a4a22]/70 bg-white/60 px-3 py-2 text-sm font-medium text-[#3a2210] outline-none placeholder:font-normal placeholder:text-[#7a4a22]/80"
        />
            <div className="mt-4" />
        {/* Étape 1 : la famille (définitive) */}
        <p className="mb-2 text-center text-sm font-bold">Spécialisation <span className="font-medium opacity-75">(définitive)</span></p>
        <div className="mb-2 flex flex-col items-stretch gap-2">
          {(
            [
              { id: "melee", label: "Mêlée", desc: "Tu te bats au corps à corps." },
              { id: "magie", label: "Magie", desc: "Tu lances des sorts." },
            ] as { id: CharacterFamily; label: string; desc: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={saving || !!busy}
              onClick={() => setFamily(f.id)}
              className="flex w-full flex-col items-center gap-0.5 rounded-lg border-2 px-3 py-1.5 text-center transition hover:-translate-y-px"
              style={{
                background: f.id === "melee" ? "#8f2b1d" : "#4b3a8c",
                color: "#fff3d6",
                borderColor: family === f.id ? "#fde68a" : "#3a2210",
                boxShadow: family === f.id ? "0 0 0 2px #3a2210, 0 3px 0 #3a2210" : "0 2px 0 #3a2210",
                filter: family === f.id || family === null ? "none" : "saturate(0.5) brightness(0.85)",
              }}
            >
              <div className="flex items-center gap-1.5 text-base font-extrabold"><span className="text-lg leading-none">{f.id === "melee" ? "⚔️" : "✨"}</span>{f.label}</div>
              <div className="text-[11px] font-medium leading-tight opacity-90">{f.desc}</div>
            </button>
          ))}
        </div>

            <div className="mt-3">
<div className="mt-3 text-center">
            {!refOpen ? (
              <button type="button" onClick={() => setRefOpen(true)} className="text-xs font-bold text-[#7a4a22] underline">
                🎁 Un ami t'a invité ? Entre son code de parrain
              </button>
            ) : (
              <div className="mx-auto flex max-w-xs items-center gap-2">
                <input
                  value={refCode}
                  maxLength={12}
                  disabled={refOk}
                  onChange={(e) => { setRefCode(e.target.value.toUpperCase()); setRefMsg(null); }}
                  placeholder="CODE DE PARRAIN"
                  className="min-w-0 flex-1 rounded border-2 border-[#7a4a22]/70 bg-white/60 px-2 py-1 text-center text-sm font-bold tracking-widest outline-none"
                />
                <button type="button" disabled={refOk || !refCode.trim()} onClick={() => void submitRefCode()} className="rounded-lg bg-[#7a4a22] px-3 py-1 text-xs font-bold text-[#fff3d6] disabled:opacity-40">
                  Valider
                </button>
              </div>
            )}
            {refMsg && <p className="mt-1 text-xs font-bold text-[#92400e]">{refMsg}</p>}
          </div>
          {formMessage && <p className="mt-2 text-center text-sm font-bold text-[#92400e]">{formMessage}</p>}
            <p className="mt-3 text-center text-[10.5px] font-semibold text-red-700/90">
              <span className="whitespace-nowrap">Nom et dessin doivent respecter les règles de modération de Twitch :</span><br />rien d'offensant ni de choquant.
            </p>
            </div>
          </div>

          {/* Centre : le dessin, pile au milieu de l'écran */}
          <div className="order-1 min-w-0 lg:col-start-2 lg:row-start-1">
        {/* Étape 2 : le dessin (obligatoire) */}
        {DEV_ALLOW_EXISTING_CHARACTERS && (
          <div className="mb-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setTab("draw")}
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                tab === "draw" ? "bg-[#7a4a22] text-[#fff3d6]" : "bg-black/10 text-[#3a2210]"
              }`}
            >
              Dessiner le mien
            </button>
            <button
              type="button"
              onClick={() => setTab("existing")}
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                tab === "existing" ? "bg-[#7a4a22] text-[#fff3d6]" : "bg-black/10 text-[#3a2210]"
              }`}
            >
              Personnage existant (provisoire)
            </button>
          </div>
        )}
        {tab === "existing" && DEV_ALLOW_EXISTING_CHARACTERS && family ? (
          <div>
            <div className="grid max-h-72 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className={`overflow-hidden rounded-lg border-2 ${
                    selected === a.id ? "border-[#7a4a22]" : "border-transparent"
                  }`}
                >
                  <img src={a.image_url} alt={a.name} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!selected || !!busy}
              onClick={() => selected && onChoose(selected, name, family)}
              className="mt-4 w-full rounded-lg bg-[#7a4a22] py-2 font-bold text-[#fff3d6] disabled:opacity-40"
            >
              {busy ? "Création…" : "Confirmer"}
            </button>
          </div>
        ) : draftKey ? (
          <div className="xl:w-[40.5rem]">
            <DrawingCanvas draftKey={draftKey} onExport={handleDrawingExported} exporting={saving || !!busy} />
          </div>
        ) : null}

          </div>

        </div>
      </div>
    </div>
  );
}
