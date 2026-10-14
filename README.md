# Picard2030

Timeline interactive pour suivre l'avancement des projets du plan **Picard2030**, avec deux pôles : **Commerce** et **Production**.

## Ouvrir l'outil

L'application se trouve dans le dossier **`picard2030/`**. Une fois en ligne, son adresse se termine donc par `/picard2030/`. La racine du dépôt redirige vers ce dossier.

Pour l'utiliser en local, ouvrez `picard2030/index.html` dans un navigateur, sans installation ni serveur.

## Ce qu'on y trouve

- **Onglets** : Vue d'ensemble, Commerce, Production.
- **Cartes pôle** : jauge d'avancement, projets en retard ou en vigilance, prochain jalon.
- **KPI** : avancement global, projets en cours, retards, jalons à 90 jours, compte à rebours avant le prochain jalon.
- **Timeline (Gantt)** : zoom sur 6 mois, une année ou tout le plan 2026 → 2030 ; phases avec leur remplissage d'avancement, jalons, ligne « aujourd'hui », filtre par responsable.
- **Cartes projet** : jauge, météo (dans les temps / vigilance / en retard / à venir / terminé), et comparaison temps écoulé / travail réalisé / avancement attendu.
- **Fiche détaillée** au clic sur un projet.

### Comment la météo est calculée

- **Avancement réel** : moyenne de l'avancement des phases, pondérée par leur durée.
- **Avancement attendu** : ce qui aurait dû être fait à la date du jour si chaque phase avançait de façon linéaire.
- **Écart** : réel − attendu.
  - ≥ −5 pts → *Dans les temps*
  - entre −5 et −15 pts → *Vigilance*
  - < −15 pts, ou un jalon dépassé et non atteint → *En retard*

## Administration

Le bouton **Admin** ouvre quatre onglets. Chaque modification est **enregistrée automatiquement**.

| Onglet | Ce qu'on y règle |
|---|---|
| **Projets** | Nom, pôle, responsable, couleur, description, ordre ; phases (dates, avancement avec un curseur) ; jalons (date, atteint). Un projet peut être dupliqué ou supprimé. |
| **Pôles** | Ajouter, renommer ou réordonner les pôles, choisir leur couleur et leur icône. |
| **Réglages** | Nom de l'outil, sous-titre, couleur principale, années du plan, seuils de la météo, horizon des jalons. |
| **Données** | Exporter, importer, ou annuler ses modifications locales. |

## Mettre à jour les données

La source de vérité est **`picard2030/data/projets.js`**.

1. **Via Claude** : décrivez le changement (« ERP : paramétrage à 70 % », « ajoute un projet Commerce… »). Claude modifie le fichier, puis commit et push.
2. **Via l'admin** : les modifications sont d'abord enregistrées dans votre navigateur, et un bandeau le signale. Pour les partager, allez dans *Données → Exporter* et remplacez `picard2030/data/projets.js` par le fichier téléchargé.
