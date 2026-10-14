# Picard2030

Timeline interactive pour suivre l'avancement du plan **Picard2030**.

## Structure

**Rubriques → Thèmes → Actions**

- **Rubriques** : *Commerce* et *Production* (on peut en ajouter d'autres).
- **Thèmes** : les grands chantiers de chaque rubrique.
- **Actions** : ce qui est fait concrètement dans chaque thème. Une action dont la date de début est égale à la date de fin est un **jalon**.

Chaque thème et chaque action a une **date de début**, une **date de fin**, un **avancement en %** et un **texte contextuel**, affiché au survol.

## Ouvrir l'outil

L'application se trouve dans le dossier **`picard2030/`**. Une fois en ligne, son adresse se termine donc par `/picard2030/`.

Pour l'utiliser en local, ouvrez `picard2030/index.html` dans un navigateur, sans installation.

## Ce qu'on y trouve

- **Onglets** : Vue d'ensemble, Commerce, Production.
- **Jauges d'avancement** à tous les niveaux. L'avancement se calcule automatiquement de bas en haut : action → thème → rubrique → global.
- **KPI** : avancement global, thèmes en cours, retards, échéances à venir, compte à rebours avant la prochaine échéance.
- **Timeline** (6 mois, une année ou le plan complet) : chaque thème se déplie pour montrer ses actions. On y voit les barres d'avancement, les points d'échéance, les jalons et la ligne « aujourd'hui ».
- **Info-bulles au survol** de chaque barre ou point : dates, avancement réel et attendu, météo, et texte contextuel.
- **Cartes thèmes** avec jauge, météo, temps écoulé / travail réalisé, et la liste des actions.
- **Rapport PDF** (bouton *Rapport PDF*) : version simplifiée en style infographie, à diffuser en interne.
  - Page 1 : synthèse, prochaines échéances et points d'attention.
  - Puis une page par rubrique, avec une timeline verticale.

### Météo

L'avancement réel est comparé à l'avancement attendu à la date du jour, en supposant une progression linéaire entre la date de début et la date de fin.

- ≥ −5 pts → *Dans les temps*
- entre −5 et −15 pts → *Vigilance*
- < −15 pts, ou une action dont la date de fin est dépassée sans être terminée → *En retard*

Ces seuils se règlent dans l'admin, onglet *Réglages*.

## Administration

Le bouton **Admin** ouvre quatre onglets. Chaque modification est **enregistrée automatiquement**.

| Onglet | Ce qu'on y règle |
|---|---|
| **Thèmes & actions** | Nom, rubrique, responsable, couleur, icône, dates et texte au survol du thème. Ses actions : nom, dates, avancement (curseur), texte au survol. Un thème peut être déplacé, dupliqué ou supprimé. |
| **Rubriques** | Ajouter, renommer ou réordonner les rubriques, choisir leur couleur et leur icône. |
| **Réglages** | Nom de l'outil, sous-titre, couleur principale, années du plan, seuils de la météo, horizon des échéances. |
| **Données** | Exporter, importer, ouvrir le rapport PDF, ou annuler ses modifications. |

## Mettre à jour les données

La source de vérité est **`picard2030/data/projets.js`**.

1. **Via Claude** : décrivez le changement (« ERP : paramétrage à 70 % », « ajoute une action au thème Réseau de distribution… »). Claude modifie le fichier, puis commit et push.
2. **Via l'admin** : les modifications sont d'abord enregistrées dans votre navigateur. Pour les partager, allez dans *Données → Exporter* et remplacez `picard2030/data/projets.js` par le fichier téléchargé.

## Fichiers

| Fichier | Rôle |
|---|---|
| `picard2030/index.html`, `app.js`, `styles.css` | Application interactive |
| `picard2030/core.js` | Calculs partagés (avancement, météo, échéances) |
| `picard2030/rapport.html`, `rapport.js`, `rapport.css` | Rapport A4 / PDF |
| `picard2030/data/projets.js` | Données |
