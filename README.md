# Picard2030

> Le dépôt contient aussi l'outil **PICARD-ATC** (pilotage du chiffre des commerciaux), dans le dossier [`picard-atc/`](picard-atc/README.md).

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

**Charte** : fond noir, cartes sombres arrondies à filet fin, police Inter, un seul accent doré (bouton Admin, rubrique active, courbes, repère « aujourd'hui »). Les couleurs de statut (rouge, orange, vert) sont conservées. Le bouton ☀ de l'en-tête passe en mode clair, et le choix est mémorisé dans le navigateur.

Dans la barre des rubriques, le **bloc brun** affiche la date des données et ouvre l'admin pour les mettre à jour. Une rubrique cochée **Exemple** (admin, onglet *Rubriques*) porte une étiquette violette, et un bandeau violet rappelle que ses données sont des exemples. Une rubrique cochée **Masquée** n'apparaît ni sur le site public ni dans le rapport, mais reste modifiable dans l'admin. C'est le cas de Production pour l'instant. Quand il ne reste qu'une rubrique visible, les onglets disparaissent et la page affiche directement cette rubrique.

En haut de page, la **boîte à idées** (« Soumettez-nous vos idées, remarques ») ouvre un petit formulaire : type (idée, remarque, question), sujet et message. Le message est enregistré directement dans la base Supabase, sans passer par la messagerie. Il n'est lisible que par les administrateurs, dans l'onglet **Messages** de l'admin.

Le bouton **Rapport PDF** produit un rapport A4 dans la même charte, à diffuser en interne :
- page 1 : avancement global, écart avec le prévu à date, courbe de trajectoire prévue et point réalisé, une carte par rubrique, météo des thèmes, prochaines échéances et points d'attention ;
- une page par rubrique : une ligne par thème avec 5 étapes horizontales (fait, en cours, en retard, à venir), plus la courbe de la rubrique quand la place le permet.

Le sélecteur **Fond noir / Fond clair (impression)** choisit la variante.

Le bouton **Newsletter** ouvre la lettre Picard 2030, générée automatiquement à partir des données publiées et pensée pour tous les publics : chiffre clé, frise « La route Picard 2030 », grands chantiers en mots simples, prochain rendez-vous, ce qui est fait et ce qui arrive. Seul le mot d'introduction se saisit à la main.
- **Export HTML** : fichier à importer dans Brevo. Il contient les liens Brevo « Voir dans le navigateur » et « Se désinscrire ».
- **Copier le code** : même contenu, à coller dans l'éditeur HTML de Brevo.
- **Copier pour Outlook** : la lettre mise en forme, à coller dans un nouveau message.

Le regroupement des thèmes en grands chantiers et leurs libellés se règlent en haut de `newsletter.js` (liste `AXES`). Un nouveau thème apparaît tout seul, sous son propre nom.

Le bouton « Je partage mon idée » de la lettre ouvre **`idee.html`**, une page dédiée qui contient uniquement le formulaire d'idée. On peut y présélectionner un sujet avec `idee.html?sujet=Nos%20produits`.

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

La source de vérité est la **version partagée**, enregistrée dans la base Supabase (table `donnees`). Tous les visiteurs la voient, et le rapport PDF aussi.

1. **Via l'admin** : chaque modification d'un administrateur connecté est **publiée immédiatement pour tous**. L'état s'affiche en bas de l'admin (« Publié pour tous »).
2. **Via Claude** : décrivez le changement (« ERP : paramétrage à 70 % », « ajoute une action au thème… »). Claude met à jour la version partagée.

`picard2030/data/projets.js` ne sert plus que de secours : il s'affiche si la base est injoignable, ou tant qu'aucune version n'a été publiée.

**Modifications faites avant la mise en commun** : elles sont restées dans le navigateur de leur auteur. À sa prochaine visite connecté, le site lui demande s'il veut les publier pour tous (OK) ou les abandonner (Annuler). Une modification non publiée affiche aussi le bandeau « Publier pour tous ».

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
| `picard2030/cloud.js` | Connexion à Supabase (connexion admin, données partagées, boîte à idées, messages) |
| `picard2030/rapport.html`, `rapport.js`, `rapport.css` | Rapport A4 / PDF |
| `picard2030/newsletter.html`, `newsletter.js` | Newsletter (aperçu, export Brevo, copie Outlook) |
| `picard2030/data/projets.js` | Données de secours (si la base est injoignable) |
| `picard2030/logo/` | Logos (SVG) |

## Base de données (Supabase)

Projet Supabase **picard2030** (organisation Picard Serrures, région Francfort).

- Table `messages` : dépôt ouvert à tous, lecture, modification et suppression réservées aux administrateurs (règles RLS).
- **Transmission des idées par e-mail** : chaque nouveau message déclenche (via `pg_net`) la fonction `idee-email`, qui l'envoie à l'adresse de l'équipe Picard 2030 par l'API de Brevo. Un message n'est transmis qu'une fois (colonne `transmis_le`). La fonction a besoin du secret **`BREVO_API_KEY`** (Supabase → Edge Functions → Secrets). Le secret facultatif `IDEE_EXPEDITEUR` fixe l'expéditeur, qui doit être un expéditeur validé dans Brevo ; par défaut, c'est l'adresse de l'équipe. Sans clé, les idées restent dans l'admin et aucun e-mail ne part.
- Table `donnees` : une ligne `plan` avec toutes les données. Lecture publique (données et date seulement, pas l'auteur) ; ajout et modification réservés aux administrateurs. La date et l'auteur de chaque modification sont enregistrés automatiquement.
- Fonction `is_admin()` : liste des e-mails administrateurs.
- Comptes : uniquement les deux administrateurs. Toute autre création de compte est refusée par la base (déclencheur `inscriptions_reservees` sur `auth.users`).
- La clé utilisée dans `cloud.js` est la **clé publique** du projet. La sécurité repose sur les règles de la base, pas sur le secret de cette clé.
