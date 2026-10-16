# PICARD-ATC — pilotage du chiffre des commerciaux

Tableau de bord du chiffre des ATC, alimenté par un fichier quotidien, avec carte interactive France, Belgique, Luxembourg, Suisse et outre-mer.

L'application est dans le dossier **`picard-atc/`**. En ligne : https://slvlmr.github.io/picard-eliot/picard-atc/
Elle fonctionne sans installation : pour un test en local, servez le dossier (par exemple `python3 -m http.server`) et ouvrez `/picard-atc/`.

## Les données : 3 fichiers Picard

Les fichiers sont importés **tels quels** dans l'admin (onglet *Import des fichiers*). Chacun est reconnu automatiquement.

| Fichier | Ce qu'on en tire |
|---|---|
| **Tableau commercial quotidien** (CO 0015 A) | Enregistré et facturé société, jour par jour ; budgets mensuels ; réalisé 2025 |
| **Répartition budget ATC** | Pour chaque ATC (5 équipes + Direction) et chaque gamme : réalisé facturé, budget, quantités et réalisé 2025, mois par mois. Crée les fiches ATC au premier import. |
| **Valorisation du portefeuille** (CO 0016 A) | Carnet de commandes : reste à livrer par gamme et par site, échéancier mois / M+1 / M+2 |

Gammes : Serrures, Portes blindées (Diamant), Portes techniques (Technica), Portes de Hall, et **Eliot, compris dans Serrures** (le total du fichier ne l'ajoute pas).

Contrôle : le réalisé cumulé des ATC correspond au facturé du tableau quotidien, et le budget total à 23,75 M€.

Tant que Supabase n'est pas branché, les fichiers importés restent **uniquement dans le navigateur** : rien n'est envoyé ni publié. Le site public n'affiche que des données fictives.

## Ce qu'on y trouve

- **Menu de gauche** : toute la société, puis chaque équipe et ses ATC, avec l'anneau d'atteinte du budget.
- **Signaux** : atterrissage vs budget, ATC en retard sur leur rythme, gamme en recul.
- **Indicateurs** : facturé, atterrissage, prises de commande (société) ou quantités (équipe, ATC), **IAP** (installateurs agréés Picard : installés, objectif, recrutés dans l'année), taux de marge.
- **Gammes** : réalisé, part du chiffre, % du budget avec repère « attendu à date », évolution vs 2025.
- **Jauges** mois / trimestre / année, **trajectoire** (jour par jour pour la société sur le mois, cumul de l'année sinon), **mois par mois**.
- **Carte** : une **force commerciale** à la fois (Serruriers · IAP, Fenêtriers · Menuisiers, Marchés pro), avec ses secteurs en dégradés doux ; modes budget, évolution ou **potentiel**. L'encart **Potentiel** montre le potentiel de marché, les IAP et la couverture du secteur, ou d'une zone cliquée. Double-clic sur une zone : ouvre son ATC.
- **Carnet de commandes** : reste à livrer, par gamme, par site (Feuquières, Broglie), échéancier, évolution.
- **Classement** des ATC, ou détail par gamme pour un ATC ; **clients** et **clientèle**.

Les blocs marqués **« exemple »** (clients, clientèle, marge, potentiel et IAP par zone tant qu'ils ne sont pas saisis) ne sont pas alimentés par les fichiers : ils montrent la forme que prendra l'information.

### Calculs

- **Budget attendu à date** : mois écoulés + mois en cours au prorata des jours ouvrés.
- **Rythme** = facturé ÷ budget attendu à date. *Dans les temps* à partir de 100 %, *Vigilance* à partir de 90 %, *En retard* en dessous (réglable).
- **Atterrissage** : pour la société, mois en cours = facturé + livrable du mois (carnet) ; pour une équipe ou un ATC, au rythme actuel. Mois suivants = budget × rythme.
- **N-1** : 2025 sur la même période, le mois en cours au prorata.

## Administration

Réservée aux deux administrateurs (comme Picard 2030). Onglets : **Import des fichiers**, **Fiches ATC** (équipe, fonction, contacts, clientèle, IAP, budget par gamme), **Secteurs & potentiel** (pour chaque force, affecter un ou plusieurs ATC à chaque secteur ; saisir potentiel et IAP par zone), **Budgets** (lecture du fichier), **Réglages**.

Les découpages des trois forces sont fixés dans `core.js` (`FORCES`, `SECTEURS`) ; la Belgique, la Suisse et le Luxembourg y sont chacun une zone. Un ATC présent chez les Serruriers et les Menuisiers est un ATC **mixte**. Les ATC importés depuis le fichier sont à affecter dans l'onglet Secteurs.

## Supabase (projet « COMMERCE »)

1. Créer le projet **COMMERCE** (région Francfort).
2. Exécuter [`sql/schema.sql`](sql/schema.sql).
3. Créer les deux comptes administrateurs.
4. Renseigner l'URL et la clé publique dans [`config.js`](config.js).

Par défaut, le tableau de bord est **privé** (connexion obligatoire), car il contient de vrais noms et de vrais chiffres.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css`, `app.js` | Tableau de bord |
| `admin.js` | Administration |
| `parsers.js` | Lecture des 3 fichiers Picard |
| `core.js` | Calculs (périodes, budgets, atterrissage) et référentiels (gammes, équipes, forces commerciales et secteurs) |
| `cloud.js` / `demo.js` | Données Supabase / démonstration fictive et import local |
| `data/carte.js`, `data/carte-build.mjs` | Carte pré-calculée et son script de génération |
| `sql/schema.sql` | Schéma de la base |
