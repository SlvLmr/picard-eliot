# Picard2030

Timeline interactive pour suivre l'avancement du plan **Picard2030**.

## Structure

**Rubriques → Thèmes → Actions**

- **Rubriques** : *Commerce* et *Production* (on peut en ajouter d'autres).
- **Thèmes** : les grands chantiers de chaque rubrique.
- **Actions** : ce qui est fait concrètement dans chaque thème. Une action dont la date de début est égale à la date de fin est un **jalon**.

Chaque thème et chaque action a une **date de début**, une **date de fin**, un **avancement en %** et un **texte contextuel**, affiché au survol.
Une action peut être marquée **« date estimée »** (par exemple « fin 2026 ») pour la distinguer d'une date ferme.

## Ouvrir l'outil

L'application se trouve dans le dossier **`picard2030/`**. Une fois en ligne, son adresse se termine donc par `/picard2030/`.

Pour l'utiliser en local, ouvrez `picard2030/index.html` dans un navigateur, sans installation.

## Ce qu'on y trouve

La page est organisée en trois sections, accessibles depuis les raccourcis en haut à droite :

L'outil s'ouvre toujours sur la **vue d'ensemble**, avec la Timeline par thème (Commerce et Production côte à côte). Un **clic sur le logo** ramène à cette page.

1. **Timeline**, avec deux vues :
   - **Par thème** (par défaut) : l'infographie verticale des grands thèmes et de leurs jauges. Un clic sur une carte déroule ses actions supplémentaires et son texte complet, directement dans la carte.
   - **Agenda** : le vrai calendrier, avec un point par événement daté, regroupés par mois, et « Aujourd'hui » à sa vraie place.
     - Un seul type de point, à la couleur du thème. Le type (jalon, rendez-vous, échéance) et la mention « date estimée » sont écrits sur la carte.
     - Les échéances d'un même jour sont regroupées (par exemple « 27 échéances fin déc. ») et se déplient au clic.
     - Le compte à rebours passe en rouge à moins de 7 jours. Les événements des mois passés sont repliés.
2. **Indicateurs** : une carte par rubrique (jauge d'avancement, retards, vigilance, prochaine échéance, avancement de chaque thème).
3. **Gantt** : le détail des actions dans le temps (6 mois, une année ou le plan complet). Les thèmes se déplient, on y voit les points d'échéance, les jalons et la ligne « aujourd'hui ».

Partout, le **survol** d'une action, d'une barre ou d'un point affiche une info-bulle : dates, avancement réel et attendu, météo, et texte contextuel.

L'outil s'affiche en **mode clair** par défaut. Le bouton 🌙 / ☀ de l'en-tête bascule en mode sombre, et le choix est mémorisé dans le navigateur.

En haut de page, la **boîte à idées** (« Soumettez-nous vos idées, remarques ») ouvre un petit formulaire : type (idée, remarque, question), sujet et message. Le message est enregistré directement dans la base Supabase, sans passer par la messagerie. Il n'est lisible que par les administrateurs, dans l'onglet **Messages** de l'admin.

Le bouton **Rapport PDF** produit une version simplifiée A4 au style infographie, à diffuser en interne.

### Météo

L'avancement réel est comparé à l'avancement attendu à la date du jour, en supposant une progression linéaire entre la date de début et la date de fin.

- ≥ −5 pts → *Dans les temps*
- entre −5 et −15 pts → *Vigilance*
- < −15 pts, ou une action dont la date de fin est dépassée sans être terminée → *En retard*

Ces seuils se règlent dans l'admin, onglet *Réglages*.

## Administration

L'admin est **protégée par une connexion** (e-mail + mot de passe, via Supabase Auth). Seuls les comptes administrateurs déclarés dans la base y ont accès. La session reste ouverte sur le navigateur jusqu'à « Se déconnecter » (en bas de l'admin). Une pastille rouge sur le bouton Admin signale les nouveaux messages.

Le bouton **Admin** ouvre quatre onglets. Chaque modification est **enregistrée automatiquement**.

| Onglet | Ce qu'on y règle |
|---|---|
| **Messages** | Idées, remarques et questions reçues via la boîte à idées : filtrage, statut (nouveau / lu / traité), suppression. |
| **Thèmes & actions** | En-tête coloré avec la jauge du thème, mise à jour en direct. Paramètres du thème : rubrique, responsable, couleur, icône, dates, texte au survol. Les actions sont des cartes : nom, dates, avancement par curseur, bouton ✓ « terminée », texte au survol. Leur statut se met à jour pendant la saisie. Un thème peut être déplacé, dupliqué ou supprimé. |
| **Rubriques** | Ajouter, renommer ou réordonner les rubriques, choisir leur couleur et leur icône. |
| **Réglages** | Nom de l'outil, sous-titre, couleur principale, années du plan, seuils de la météo, horizon des échéances. |
| **Données** | Exporter, importer, ouvrir le rapport PDF, ou annuler ses modifications. |

## Mettre à jour les données

La source de vérité est **`picard2030/data/projets.js`**.

1. **Via Claude** : décrivez le changement (« ERP : paramétrage à 70 % », « ajoute une action au thème Réseau de distribution… »). Claude modifie le fichier, puis commit et push.
2. **Via l'admin** : les modifications sont d'abord enregistrées dans votre navigateur. Pour les partager, allez dans *Données → Exporter* et remplacez `picard2030/data/projets.js` par le fichier téléchargé.

## Logo

Le logo retenu est l'**emblème** : le carré Picard et « 2030 » en blanc, avec un trait en dégradé dont le halo est animé.

| Fichier | Usage |
|---|---|
| `picard2030/logo/picard2030-embleme.svg` | Emblème blanc animé, fond transparent (pour fonds foncés) |
| `picard2030/logo/picard2030-embleme-fixe.svg` | Même chose, sans animation (impression, documents) |
| `picard2030/logo/picard2030-embleme-fond.svg` / `-fond-fixe.svg` | Emblème sur carré bleu nuit, animé ou fixe |
| `picard2030/logo/favicon.svg` | Icône d'onglet |
| `picard2030/logo/propositions.html` | Planche des propositions initiales |

## Fichiers

| Fichier | Rôle |
|---|---|
| `picard2030/index.html`, `app.js`, `styles.css` | Application interactive |
| `picard2030/core.js` | Calculs partagés (avancement, météo, échéances) |
| `picard2030/cloud.js` | Connexion à Supabase (connexion admin, boîte à idées, messages) |
| `picard2030/rapport.html`, `rapport.js`, `rapport.css` | Rapport A4 / PDF |
| `picard2030/data/projets.js` | Données |
| `picard2030/logo/` | Logos (SVG) |

## Base de données (Supabase)

Projet Supabase **picard2030** (organisation Picard Serrures, région Francfort).

- Table `messages` : dépôt ouvert à tous, lecture, modification et suppression réservées aux administrateurs (règles RLS).
- Fonction `is_admin()` : liste des e-mails administrateurs.
- Comptes : uniquement les deux administrateurs. Toute autre création de compte est refusée par la base (déclencheur `inscriptions_reservees` sur `auth.users`).
- La clé utilisée dans `cloud.js` est la **clé publique** du projet. La sécurité repose sur les règles de la base, pas sur le secret de cette clé.
