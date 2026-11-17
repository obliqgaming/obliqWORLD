// « Avant de partir à l'aventure » : avertissements à accepter (nouveaux comptes, comptes existants, nouvelle version majeure),
// consultables ensuite via l'icône 📖. + petit rappel de la charte de modération pour les outils de création.
import { useState } from "react";

export const DISCORD_URL = "https://discord.gg/MWKhGyZHY9";
/** À augmenter quand les avertissements changent de façon majeure : tout le monde devra les accepter de nouveau. */
export const WARNINGS_VERSION = 1;

const FONT = { fontFamily: "'Baloo 2', cursive" };

function Num({ n, color }: { n: number; color: string }) {
  return (
    <span className="mr-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: color }}>
      {n}
    </span>
  );
}

function Section({ n, color, title, children }: { n: number; color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border-l-4 bg-white/45 p-3" style={{ borderLeftColor: color }}>
      <div className="flex items-center text-base font-extrabold" style={{ color }}>
        <Num n={n} color={color} />
        {title}
      </div>
      <div className="mt-1 space-y-1.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function DiscordLink({ children }: { children?: React.ReactNode }) {
  return (
    <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#4752c4] underline">
      {children ?? "Discord"}
    </a>
  );
}

/** Rappel affiché dans les outils de dessin et d'écriture (forge, compagnons, rencontres). */
export function ModerationReminder({ className = "" }: { className?: string }) {
  return (
    <div className={`text-xs font-bold text-[#7a4a22] ${className}`}>
      📜 Pensez à consulter la charte de modération sur <DiscordLink>Discord</DiscordLink> avant de contribuer.
    </div>
  );
}

export function AdventureWarnings({ mode, onAccept, onClose }: { mode: "gate" | "view"; onAccept?: () => void; onClose?: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3">
      <div
        className="flex max-h-[94vh] w-[min(38rem,96%)] flex-col overflow-hidden rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] text-[#3a2410] shadow-2xl"
        style={FONT}
      >
        <div className="overflow-y-auto p-5">
          <div className="text-center text-2xl font-extrabold text-[#b45309]">⚠️ AVANT DE PARTIR À L'AVENTURE</div>
          <p className="mt-3 rounded-lg bg-[#fde68a]/70 p-3 text-center text-sm font-bold">
            ObliqWorld est un projet <b>indépendant</b>, <b>gratuit</b> et développé par <b>une seule personne</b>, sur son temps libre et ses propres ressources.
            Voici quelques petites choses à savoir avant de nous rejoindre :
          </p>

          <Section n={1} color="#b91c1c" title="La mort fait partie du jeu">
            <p>
              ObliqWorld est en <b>alpha</b>. Vous allez mourir à cause de <b>bugs</b>, de <b>problèmes d'équilibrage</b> ou de <b>vos propres erreurs</b>. Vos personnages pourraient
              disparaître et vos dessins perdre leur fonction initiale.
            </p>
            <p>
              Les personnages morts deviennent notamment des <b>ennemis à affronter</b> : vos efforts ne sont donc jamais tout à fait perdus.
            </p>
          </Section>

          <Section n={2} color="#7e22ce" title="Vous n'êtes pas à l'abri des surprises">
            <p>
              <b>Araignées</b>, <b>clowns</b> ou tout autre sujet subjectivement sensible peuvent être présents : dans un univers basé sur la contribution, aucune garantie d'éviter
              certains contenus ne peut être donnée.
            </p>
          </Section>

          <Section n={3} color="#0f766e" title="Vos contributions sont soumises à modération">
            <p>
              La <b>charte de modération</b> est consultable sur notre <DiscordLink>Discord</DiscordLink> et peut évoluer à tout moment. Prenez-en connaissance avant de contribuer.
            </p>
            <p>
              Une création refusée <b>ne sera pas nécessairement remboursée</b>. Le temps investi ne garantit pas son acceptation. Les nouvelles situations non prévues pourront faire
              l'objet de nouvelles règles.
            </p>
          </Section>

          <Section n={4} color="#c2410c" title="Sans garantie de pérennité">
            <p>
              Le jeu peut être <b>modifié, interrompu ou arrêté à tout moment</b>, faute de temps, de moyens, d'envie ou si sa direction ne correspond plus à mes attentes. Aucune garantie
              de disponibilité, de patchs, de conservation des données ou de progression n'est promise.
            </p>
          </Section>

          <Section n={5} color="#1d4ed8" title="Avis des joueurs">
            <p>Les suggestions et retours constructifs sont toujours bienvenus, sans garantie qu'ils soient retenus ou qu'une réponse leur soit apportée.</p>
            <p>
              Merci de garder à l'esprit qu'il n'y a <b>pas d'équipe</b> derrière le jeu ni de <b>service client</b> : les sollicitations insistantes, exigences, pressions et reproches
              n'ont pas leur place ici.
            </p>
          </Section>

          <Section n={6} color="#15803d" title="Et concernant l'avenir ?">
            <p>
              Le jeu est actuellement <b>entièrement gratuit</b>. D'éventuelles options payantes facultatives pourraient voir le jour un jour, mais aucune n'est prévue actuellement. Elles ne
              devront <b>jamais bloquer l'accès au jeu de base ou à sa progression</b> et répondront à un besoin technique pour maintenir le jeu si besoin.
            </p>
          </Section>

          <p className="mt-4 rounded-lg bg-[#bbf7d0]/60 p-3 text-center text-sm font-bold">
            ObliqWorld est une invitation à contribuer à un petit monde commun dans lequel traîner et t'chater, l'aspect ludique avec progression n'est qu'une <b>gourmandise spéculative</b>,
            soyez tolérants !
          </p>
          <p className="mt-3 text-center text-lg font-extrabold text-[#166534]">Et surtout : Bonne aventure ! 🌲</p>
        </div>

        <div className="border-t-2 border-[#7a4a22]/40 bg-[#e8d3a0] p-3">
          {mode === "gate" ? (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-extrabold">
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="h-5 w-5 cursor-pointer accent-[#16a34a]" />
                J'ai VRAIMENT lu et compris ces avertissements
              </label>
              <button
                type="button"
                disabled={!checked}
                onClick={() => onAccept?.()}
                className="mt-2 w-full rounded-lg border-2 border-[#166534] bg-[#16a34a] px-5 py-2 text-base font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                En avant !
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <DiscordLink>💬 Rejoindre le Discord (charte de modération)</DiscordLink>
              <button type="button" onClick={() => onClose?.()} className="rounded-lg border-2 border-[#7a4a22] px-4 py-1.5 text-sm font-extrabold hover:bg-[#7a4a22]/10">
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
