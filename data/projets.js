/* ============================================================
   PICARD2030 — Données des projets (source de vérité)

   Ce fichier peut être modifié :
   - à la main, ou par Claude (puis commit + push)
   - via l'admin de l'application → bouton « Exporter » qui
     régénère ce fichier à l'identique.

   Format des dates : AAAA-MM-JJ
   progress : 0 à 100 (avancement de la phase)
   ============================================================ */
window.PICARD2030_DATA = {
  "meta": {
    "name": "Picard2030",
    "updatedAt": "2026-10-14"
  },
  "poles": [
    { "id": "commerce", "name": "Commerce", "color": "#ea580c", "icon": "ri-store-2-line" },
    { "id": "production", "name": "Production", "color": "#2563eb", "icon": "ri-tools-line" }
  ],
  "projects": [
    {
      "id": "p-usine",
      "pole": "production",
      "name": "Modernisation de l'usine",
      "owner": "Direction industrielle",
      "color": "#2563eb",
      "description": "Nouvelle ligne d'usinage et automatisation de l'assemblage.",
      "phases": [
        { "name": "Étude & cahier des charges", "start": "2026-01-05", "end": "2026-04-30", "progress": 100 },
        { "name": "Appel d'offres fournisseurs", "start": "2026-05-01", "end": "2026-09-30", "progress": 90 },
        { "name": "Installation ligne", "start": "2026-10-01", "end": "2027-06-30", "progress": 10 },
        { "name": "Montée en cadence", "start": "2027-07-01", "end": "2027-12-31", "progress": 0 }
      ],
      "milestones": [
        { "name": "Choix du fournisseur", "date": "2026-09-30", "done": true },
        { "name": "Première pièce produite", "date": "2027-05-15", "done": false }
      ]
    },
    {
      "id": "p-erp",
      "pole": "production",
      "name": "Migration ERP",
      "owner": "DSI",
      "color": "#7c3aed",
      "description": "Remplacement de l'ERP historique, reprise des données et formation.",
      "phases": [
        { "name": "Cadrage", "start": "2026-02-01", "end": "2026-04-15", "progress": 100 },
        { "name": "Paramétrage", "start": "2026-04-16", "end": "2026-10-31", "progress": 55 },
        { "name": "Recette & formation", "start": "2026-11-01", "end": "2027-01-31", "progress": 0 },
        { "name": "Bascule", "start": "2027-02-01", "end": "2027-02-28", "progress": 0 }
      ],
      "milestones": [
        { "name": "Go / No-Go bascule", "date": "2027-01-25", "done": false }
      ]
    },
    {
      "id": "p-connecte",
      "pole": "commerce",
      "name": "Lancement gamme connectée",
      "owner": "Marketing produit",
      "color": "#0d9488",
      "description": "Conception et lancement d'une gamme de serrures connectées.",
      "phases": [
        { "name": "Prototypes", "start": "2026-03-01", "end": "2026-09-30", "progress": 100 },
        { "name": "Certification", "start": "2026-10-01", "end": "2027-03-31", "progress": 20 },
        { "name": "Industrialisation", "start": "2027-04-01", "end": "2027-10-31", "progress": 0 },
        { "name": "Lancement commercial", "start": "2027-11-01", "end": "2028-03-31", "progress": 0 }
      ],
      "milestones": [
        { "name": "Certification A2P", "date": "2027-03-15", "done": false },
        { "name": "Salon de lancement", "date": "2027-11-20", "done": false }
      ]
    },
    {
      "id": "p-site",
      "pole": "commerce",
      "name": "Refonte du site web",
      "owner": "Communication",
      "color": "#db2777",
      "description": "Nouveau site vitrine et espace professionnels.",
      "phases": [
        { "name": "Maquettes", "start": "2026-06-01", "end": "2026-08-31", "progress": 100 },
        { "name": "Développement", "start": "2026-09-01", "end": "2026-11-30", "progress": 30 },
        { "name": "Mise en ligne", "start": "2026-12-01", "end": "2026-12-15", "progress": 0 }
      ],
      "milestones": [
        { "name": "Mise en ligne", "date": "2026-12-15", "done": false }
      ]
    },
    {
      "id": "p-iso",
      "pole": "production",
      "name": "Certification ISO 14001",
      "owner": "Qualité / RSE",
      "color": "#16a34a",
      "description": "Démarche environnementale jusqu'à la certification.",
      "phases": [
        { "name": "Analyse environnementale", "start": "2027-01-01", "end": "2027-06-30", "progress": 0 },
        { "name": "Plan d'actions", "start": "2027-07-01", "end": "2028-06-30", "progress": 0 },
        { "name": "Audit de certification", "start": "2028-09-01", "end": "2028-10-31", "progress": 0 }
      ],
      "milestones": [
        { "name": "Certification obtenue", "date": "2028-11-30", "done": false }
      ]
    }
    ,{
      "id": "p-reseau",
      "pole": "commerce",
      "name": "Développement réseau distributeurs",
      "owner": "Direction commerciale",
      "color": "#f59e0b",
      "description": "Recrutement de nouveaux distributeurs et ouverture export.",
      "phases": [
        { "name": "Cartographie & ciblage", "start": "2026-04-01", "end": "2026-07-31", "progress": 100 },
        { "name": "Prospection France", "start": "2026-08-01", "end": "2027-03-31", "progress": 25 },
        { "name": "Ouverture export", "start": "2027-04-01", "end": "2028-12-31", "progress": 0 }
      ],
      "milestones": [
        { "name": "10 nouveaux distributeurs", "date": "2027-03-31", "done": false }
      ]
    }
  ]
};
