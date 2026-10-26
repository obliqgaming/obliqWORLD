// Confidentialité de l'alpha, affichée en fenêtre (pas de page séparée à déployer).
import { CONTACT_EMAIL } from "../lib/alpha-config";

export function PrivacyDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="max-h-[90vh] w-[min(36rem,96%)] overflow-y-auto rounded-xl border-2 border-[#7a4a22] bg-[#f1dfb6] p-5 text-sm leading-relaxed text-[#3a2410] shadow-2xl"
        style={{ fontFamily: "'Baloo 2', cursive" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold">Confidentialité</div>
          <button type="button" onClick={onClose} className="rounded border border-[#7a4a22] px-2 text-sm font-bold">Fermer</button>
        </div>
        <p className="mt-2">ObliqWorld est un jeu en cours de création.</p>
        <div className="mt-3 font-extrabold">Ce que nous gardons</div>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ton identifiant Twitch ou Discord, ton pseudo et ton avatar.</li>
          <li>Tes dessins et textes (personnage, armes, rencontres, signalements).</li>
        </ul>
        <p className="mt-1">Nous ne gardons ni e-mail ni mot de passe : la connexion passe par Twitch ou Discord.</p>
        <div className="mt-3 font-extrabold">Pourquoi</div>
        <p>Uniquement pour faire fonctionner le jeu et corriger ses erreurs. Rien n'est vendu ni utilisé pour de la publicité.</p>
        <div className="mt-3 font-extrabold">Tes droits</div>
        <p>Tu peux demander à voir, corriger ou supprimer tes données. Le bouton 🐞 permet de demander la suppression de ton compte : ton compte, ton personnage, tes dessins et tes objets sont alors effacés.</p>
        {CONTACT_EMAIL && <p>Contact : {CONTACT_EMAIL}</p>}
        <p className="mt-3 text-xs opacity-70">Les dessins et textes inappropriés peuvent être retirés. Ce texte décrit l'alpha et peut évoluer.</p>
      </div>
    </div>
  );
}
