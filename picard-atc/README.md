# PICARD-ATC — pilotage du chiffre des commerciaux

Tableau de bord du chiffre des ATC, alimenté par un fichier quotidien, avec carte interactive France, Belgique, Luxembourg, Suisse et outre-mer.

L'application est dans le dossier **`picard-atc/`**. En ligne : https://slvlmr.github.io/picard-eliot/picard-atc/
Elle fonctionne sans installation : pour un test en local, servez le dossier (par exemple `python3 -m http.server`) et ouvrez `/picard-atc/`.

## Ce qu'on y trouve

- **Menu de gauche** : toute l'équipe, puis chaque ATC avec son chiffre et son anneau d'atteinte de l'objectif (vert, orange, rouge). Un clic ouvre son secteur. Le menu propose une recherche par nom, code ou zone, et les flèches ↑ ↓ passent d'un ATC à l'autre.
- **Période** : mois, trimestre ou année. Le choix est mémorisé.
- **Signaux** : ce qui demande une décision. Atterrissage de l'équipe, ATC en retard sur leur rythme, zone en plus forte baisse, et pour un ATC le montant à faire par jour ouvré pour tenir l'objectif.
- **4 indicateurs** : chiffre d'affaires (vs N-1), atterrissage prévu (vs objectif, reste à faire), taux de marge (vs N-1 et objectif de marge), commandes et panier moyen.
- **Gammes** : Serrures, Portes blindées, Portes techniques, Portes de Hall, Eliot. Pour chacune : chiffre, part du CA, marge et évolution.
- **Jauges** : mois, trimestre, année. Le repère indique où l'on devrait être à date. Un clic sur une jauge change la période.
- **Trajectoire** : chiffre cumulé, objectif, N-1 et projection de fin de période, en courbes lissées.
- **Carte** : secteurs (une couleur par ATC), chiffre par zone ou évolution vs N-1. Zoom à la molette, déplacement à la souris, clic sur une zone pour ouvrir son ATC.
- **Mois par mois**, **classement** de l'équipe (ou zones du secteur pour un ATC), **top clients** et **répartition par type de clientèle**.
- Thème sombre par défaut, clair au choix (bouton ☀ / 🌙).

### Calculs

- **Objectif attendu à date** : objectifs mensuels, au prorata des jours ouvrés écoulés dans le mois en cours.
- **Rythme** = réalisé ÷ attendu à date. Statut : *Dans les temps* à partir de 100 %, *Vigilance* à partir de 90 %, *En retard* en dessous. Ces seuils se règlent dans l'admin.
- **Atterrissage** = réalisé + objectif restant × rythme actuel. Sans objectif, c'est une projection linéaire sur les jours ouvrés.
- **N-1** : même période, mêmes jours de l'année précédente.

## Administration

Le bouton **Admin** est réservé aux deux administrateurs (e-mail et mot de passe, Supabase Auth), comme sur Picard 2030. Chaque modification est enregistrée automatiquement.

| Onglet | Rôle |
|---|---|
| **Injection du jour** | Déposer le fichier Excel ou CSV. Les colonnes sont reconnues, l'aperçu signale les commerciaux et zones non reconnus, puis on injecte. Par défaut, les ventes des jours présents dans le fichier sont **remplacées** : on peut réinjecter un fichier corrigé sans doublon. L'historique permet de retirer une injection. |
| **Fiches ATC** | Pour chaque ATC : couleur, fonction, code du fichier, contacts, **types de clientèle**, **objectifs** (CA annuel réparti selon la saisonnalité N-1 ou mois par mois, taux de marge visé), secteur, notes. |
| **Secteurs** | Choisir un ATC puis cliquer ou glisser sur la carte pour lui attribuer des zones. Des boutons attribuent toute la Belgique, toute la Suisse, le Luxembourg ou l'outre-mer d'un coup. |
| **Objectifs** | Grille de toute l'équipe sur 12 mois, avec reprise du réalisé N-1 + x %. |
| **Réglages** | Nom de l'outil, seuils des statuts, gammes, types de clientèle, fonctions, tableau de bord public ou privé. |

## Fichier quotidien

Modèle : [`modele-import.csv`](modele-import.csv). Formats acceptés : `.xlsx`, `.xls` et `.csv` (séparateur `;` ou `,`, décimales à la française).

| Colonne | Obligatoire | Exemples d'en-têtes reconnus |
|---|---|---|
| CA HT | oui | CA, CA HT, Montant HT, Total HT |
| Date | non (sinon date choisie à l'import) | Date, Date facture, Date commande |
| Commercial | non (sinon titulaire de la zone) | Commercial, Vendeur, Code commercial |
| Zone | non | Code postal, CP, Département, Canton, Province |
| Pays | non (utile pour BE / CH / LU) | Pays |
| Client | non | Client, Raison sociale |
| Type de clientèle | non | Type client, Segment, Typologie |
| Gamme | non | Gamme, Famille produit |
| Marge | non | Marge, Marge brute |
| N° de commande | non (sinon une ligne = une commande) | N° commande, N° pièce, Facture |

Les zones sont lues à partir du code postal ou du département (France, Corse, DROM-COM), des provinces belges (code postal), du Luxembourg et des cantons suisses (code ou NPA ; le NPA est une approximation par tranches).

## Supabase (projet « COMMERCE »)

1. Créer le projet **COMMERCE** dans l'organisation Picard Serrures (région Francfort).
2. Exécuter [`sql/schema.sql`](sql/schema.sql) : tables, règles de sécurité (RLS), fonctions de lecture agrégée, injection et temps réel.
3. Créer les deux comptes administrateurs (les seuls autorisés par la base).
4. Renseigner l'URL et la clé publique dans [`config.js`](config.js).

Tant que `config.js` est vide, l'outil tourne en **mode démonstration** (11 ATC fictifs) et l'admin s'ouvre sans mot de passe, avec des données gardées dans le navigateur.

Une fois branché, toute injection est poussée **en temps réel** sur les écrans ouverts.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css`, `app.js` | Tableau de bord |
| `admin.js` | Administration |
| `core.js` | Calculs (périodes, objectifs, atterrissage) et lecture du fichier |
| `cloud.js` / `demo.js` | Données Supabase / démonstration |
| `config.js` | Connexion Supabase |
| `data/carte.js` | Carte pré-calculée (zones, frontières, encarts outre-mer) |
| `data/carte-build.mjs` | Script de génération de la carte (Natural Earth, domaine public) |
| `sql/schema.sql` | Schéma de la base |
