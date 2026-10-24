import { createFileRoute } from "@tanstack/react-router";
import { CONTACT_EMAIL } from "../lib/alpha-config";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({ meta: [{ title: "Confidentialité — ObliqWorld" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#1b0e05] px-4 py-8 text-[#fff3d6]" style={{ fontFamily: "'Baloo 2', cursive" }}>
      <div className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed">
        <h1 className="text-2xl font-extrabold">Confidentialité — ObliqWorld (alpha privée)</h1>
        <p>ObliqWorld est un jeu en cours de création, testé par un petit groupe de personnes invitées. Voici ce que nous gardons, pourquoi, et comment tout effacer.</p>

        <h2 className="text-lg font-bold">Ce que nous gardons</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ton identifiant de compte et, si tu te connectes avec Twitch ou Discord, ton pseudo et ton avatar.</li>
          <li>Ton personnage, ses statistiques, son or, ses armes et objets, tes parties (groupes, expéditions, votes).</li>
          <li>Les dessins que tu envoies (personnage, armes) et les textes que tu écris (nom du personnage, rencontres, signalements). <b>Ils sont visibles des autres joueurs dans le jeu.</b></li>
          <li>Tes signalements de bugs (texte, et l'expédition ou l'étape en cours si elles existent).</li>
        </ul>
        <p>Nous ne gardons ni ton adresse e-mail, ni de mot de passe : la connexion passe par Twitch ou Discord.</p>

        <h2 className="text-lg font-bold">Pourquoi</h2>
        <p>Uniquement pour faire fonctionner le jeu et corriger ses erreurs. Rien n'est vendu ni utilisé pour de la publicité.</p>

        <h2 className="text-lg font-bold">Où sont les données</h2>
        <p>Chez les services qui font tourner le jeu : Supabase (base de données et fichiers), Lovable (hébergement du site), et Twitch / Discord pour la connexion. Ces services peuvent stocker des données hors de l'Union européenne.</p>

        <h2 className="text-lg font-bold">Tes droits</h2>
        <p>Tu peux demander à voir, corriger ou supprimer tes données. Dans le jeu, le bouton 🐞 permet de demander la suppression de ton compte : nous effaçons ton compte, ton personnage, tes dessins et tes objets, dans un délai raisonnable.</p>
        {CONTACT_EMAIL && <p>Contact : {CONTACT_EMAIL}</p>}

        <h2 className="text-lg font-bold">Contenus créés par les joueurs</h2>
        <p>Les dessins et textes peuvent être relus et retirés par l'administrateur s'ils sont inappropriés. Merci de ne rien y mettre de personnel.</p>

        <p className="text-xs opacity-70">Ce texte décrit l'alpha et peut évoluer.</p>
        <a href="/" className="inline-block underline">← Retour au jeu</a>
      </div>
    </div>
  );
}
