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

La page est organisée en trois sections, accessibles depuis les raccourcis en haut à droite :

1. **Timeline** : une infographie verticale des grands thèmes, dans l'ordre chronologique, avec un repère « Aujourd'hui ».
   - En vue d'ensemble, Commerce et Production sont côte à côte.
   - Dans une rubrique, les thèmes alternent à gauche et à droite.
   - Chaque thème affiche sa jauge, sa météo, son texte et ses actions.
2. **Indicateurs** : compteurs animés, jauges par rubrique, météo des thèmes et des actions, prochaines échéances et points d'attention.
3. **Gantt** : le détail des actions dans le temps (6 mois, une année ou le plan complet). Les thèmes se déplient, on y voit les points d'échéance, les jalons et la ligne « aujourd'hui ».

Partout, le **survol** d'une action, d'une barre ou d'un point affiche une info-bulle : dates, avancement réel et attendu, météo, et texte contextuel.

Le bouton **Rapport PDF** produit une version simplifiée A4 au style infographie, à diffuser en interne.

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
| **Thèmes & actions** | En-tête coloré avec la jauge du thème, mise à jour en direct. Paramètres du thème : rubrique, responsable, couleur, icône, dates, texte au survol. Les actions sont des cartes : nom, dates, avancement par curseur, bouton ✓ « terminée », texte au survol. Leur statut se met à jour pendant la saisie. Un thème peut être déplacé, dupliqué ou supprimé. |
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
