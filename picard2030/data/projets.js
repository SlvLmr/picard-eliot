/* ============================================================
   PICARD2030 — Données (source de vérité)

   Structure : rubriques → thèmes → actions
   - rubriques : les grandes parties (Commerce, Production…)
   - themes    : les grands thèmes, rattachés à une rubrique
   - actions   : les actions de chaque thème

   Chaque thème et chaque action a une date de début, une date
   de fin et un texte « note » affiché au survol.
   Dates : AAAA-MM-JJ · progress : 0 à 100
   L'avancement d'un thème est calculé à partir de ses actions.

   Ce fichier peut être modifié à la main, par Claude, ou régénéré
   depuis l'admin (Données → Exporter).
   ============================================================ */
window.PICARD2030_DATA = {
  "meta": {
    "name": "Picard2030",
    "updatedAt": "2026-10-14"
  },
  "settings": {
    "title": "Picard2030",
    "subtitle": "Suivi des projets",
    "accent": "#0f766e",
    "planStart": 2026,
    "planEnd": 2030,
    "warnThreshold": 5,
    "lateThreshold": 15,
    "milestoneHorizon": 90
  },
  "rubriques": [
    { "id": "commerce", "name": "Commerce", "color": "#ea580c", "icon": "ri-store-2-line" },
    { "id": "production", "name": "Production", "color": "#2563eb", "icon": "ri-tools-line" }
  ],
  "themes": [
    {
      "id": "t-reseau",
      "rubrique": "commerce",
      "name": "Réseau de distribution",
      "owner": "Direction commerciale",
      "color": "#f59e0b",
      "icon": "ri-global-line",
      "start": "2026-04-01",
      "end": "2028-12-31",
      "note": "Objectif : +10 distributeurs en France d'ici mars 2027, puis ouverture de 3 pays export.",
      "actions": [
        { "name": "Cartographie & ciblage", "start": "2026-04-01", "end": "2026-07-31", "progress": 100, "note": "Base de 240 cibles qualifiées livrée en juillet." },
        { "name": "Prospection France", "start": "2026-08-01", "end": "2027-03-31", "progress": 25, "note": "4 signatures sur 10 visées. Relance des salons régionaux en cours." },
        { "name": "Ouverture export", "start": "2027-04-01", "end": "2028-12-31", "progress": 0, "note": "Pays pressentis : Belgique, Suisse, Espagne." }
      ]
    },
    {
      "id": "t-digital",
      "rubrique": "commerce",
      "name": "Digital & site web",
      "owner": "Communication",
      "color": "#db2777",
      "icon": "ri-computer-line",
      "start": "2026-06-01",
      "end": "2027-03-31",
      "note": "Nouveau site vitrine, espace professionnels et campagnes d'acquisition.",
      "actions": [
        { "name": "Maquettes", "start": "2026-06-01", "end": "2026-08-31", "progress": 100, "note": "Validées en comité le 28 août." },
        { "name": "Développement", "start": "2026-09-01", "end": "2026-11-30", "progress": 30, "note": "Retard de 2 semaines sur l'espace pro (connexion ERP)." },
        { "name": "Mise en ligne", "start": "2026-12-15", "end": "2026-12-15", "progress": 0, "note": "Jalon : bascule du nom de domaine." },
        { "name": "Campagnes d'acquisition", "start": "2027-01-01", "end": "2027-03-31", "progress": 0, "note": "" }
      ]
    },
    {
      "id": "t-connecte",
      "rubrique": "commerce",
      "name": "Lancement gamme connectée",
      "owner": "Marketing produit",
      "color": "#0d9488",
      "icon": "ri-lightbulb-line",
      "start": "2026-10-01",
      "end": "2028-03-31",
      "note": "Mise sur le marché de la gamme de serrures connectées.",
      "actions": [
        { "name": "Plan marketing", "start": "2026-10-01", "end": "2027-02-28", "progress": 20, "note": "Positionnement prix en cours de validation." },
        { "name": "Formation des commerciaux", "start": "2027-09-01", "end": "2027-10-31", "progress": 0, "note": "" },
        { "name": "Salon de lancement", "start": "2027-11-20", "end": "2027-11-20", "progress": 0, "note": "Jalon : présentation officielle de la gamme." },
        { "name": "Déploiement commercial", "start": "2027-11-21", "end": "2028-03-31", "progress": 0, "note": "" }
      ]
    },
    {
      "id": "t-usine",
      "rubrique": "production",
      "name": "Modernisation de l'usine",
      "owner": "Direction industrielle",
      "color": "#2563eb",
      "icon": "ri-building-4-line",
      "start": "2026-01-05",
      "end": "2027-12-31",
      "note": "Nouvelle ligne d'usinage et automatisation de l'assemblage. Budget : 2,4 M€.",
      "actions": [
        { "name": "Étude & cahier des charges", "start": "2026-01-05", "end": "2026-04-30", "progress": 100, "note": "" },
        { "name": "Appel d'offres fournisseurs", "start": "2026-05-01", "end": "2026-09-30", "progress": 100, "note": "Fournisseur retenu le 30 septembre." },
        { "name": "Installation ligne", "start": "2026-10-01", "end": "2027-06-30", "progress": 10, "note": "Génie civil démarré. Livraison machines prévue en février." },
        { "name": "Montée en cadence", "start": "2027-07-01", "end": "2027-12-31", "progress": 0, "note": "" }
      ]
    },
    {
      "id": "t-erp",
      "rubrique": "production",
      "name": "Système d'information (ERP)",
      "owner": "DSI",
      "color": "#7c3aed",
      "icon": "ri-database-2-line",
      "start": "2026-02-01",
      "end": "2027-02-28",
      "note": "Remplacement de l'ERP historique, reprise des données et formation des équipes.",
      "actions": [
        { "name": "Cadrage", "start": "2026-02-01", "end": "2026-04-15", "progress": 100, "note": "" },
        { "name": "Paramétrage", "start": "2026-04-16", "end": "2026-10-31", "progress": 55, "note": "Modules achats et stocks terminés ; production en cours." },
        { "name": "Recette & formation", "start": "2026-11-01", "end": "2027-01-31", "progress": 0, "note": "" },
        { "name": "Bascule", "start": "2027-02-01", "end": "2027-02-28", "progress": 0, "note": "Décision Go / No-Go fin janvier." }
      ]
    },
    {
      "id": "t-qualite",
      "rubrique": "production",
      "name": "Qualité & environnement",
      "owner": "Qualité / RSE",
      "color": "#16a34a",
      "icon": "ri-leaf-line",
      "start": "2027-01-01",
      "end": "2028-11-30",
      "note": "Démarche environnementale jusqu'à la certification ISO 14001.",
      "actions": [
        { "name": "Analyse environnementale", "start": "2027-01-01", "end": "2027-06-30", "progress": 0, "note": "" },
        { "name": "Plan d'actions", "start": "2027-07-01", "end": "2028-06-30", "progress": 0, "note": "" },
        { "name": "Audit de certification", "start": "2028-09-01", "end": "2028-10-31", "progress": 0, "note": "" },
        { "name": "Certification ISO 14001", "start": "2028-11-30", "end": "2028-11-30", "progress": 0, "note": "Jalon" }
      ]
    }
  ]
};
