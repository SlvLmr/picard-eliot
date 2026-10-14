# Picard2030

Timeline interactive pour suivre l'avancement des projets du plan **Picard2030**, avec deux pôles : **Commerce** et **Production**.

## Ouvrir l'outil

Ouvrez `index.html` dans un navigateur, sans installation ni serveur. Le site peut aussi être publié tel quel (GitHub Pages, Netlify…).

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

## Mettre à jour les données

La source de vérité est **`data/projets.js`**.

1. **Via Claude** : décrivez le changement (« ERP : paramétrage à 70 % », « ajoute un projet Commerce… »). Claude modifie `data/projets.js`, puis commit et push.
2. **Via l'admin** (bouton *Admin*) : créer, modifier ou supprimer des projets, phases et jalons. Les modifications sont d'abord enregistrées dans votre navigateur (un bandeau le signale). Cliquez ensuite sur **Exporter** et remplacez `data/projets.js` par le fichier téléchargé pour les partager.

Le bouton **Importer** recharge un fichier `projets.js` ou `.json`.
