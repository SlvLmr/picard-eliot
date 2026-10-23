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
    "updatedAt": "2026-10-15"
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
    {
      "id": "commerce",
      "name": "Commerce",
      "color": "#e8b08a",
      "icon": "ri-store-2-line"
    },
    {
      "id": "production",
      "name": "Production",
      "color": "#9fbbe6",
      "icon": "ri-tools-line",
      "example": true,
      "hidden": true
    }
  ],
  "themes": [
    {
      "id": "c-recrutement",
      "rubrique": "commerce",
      "name": "Plan de recrutement",
      "owner": "",
      "color": "#e6c891",
      "icon": "ri-user-heart-line",
      "note": "Ouverture de 3 nouveaux postes : IDF Est (fenêtriers), Centre-Ouest (serruriers), Ouest (serruriers). Secteur Nord en arbitrage pour fin 2027.",
      "actions": [
        {
          "name": "Cartographie sectorielle",
          "start": "2026-09-01",
          "end": "2026-09-30",
          "progress": 100,
          "note": "À confirmer : considérée comme faite, les 3 secteurs étant identifiés.",
          "estimated": true
        },
        {
          "name": "Processus de recrutement des 3 nouveaux postes",
          "start": "2026-09-01",
          "end": "2026-12-31",
          "progress": 40,
          "note": "IDF Est (fenêtriers) · Centre-Ouest (serruriers) · Ouest (serruriers). Avancement estimé, à confirmer.",
          "estimated": true
        },
        {
          "name": "Construction du parcours d'intégration",
          "start": "2026-10-14",
          "end": "2026-11-30",
          "progress": 0,
          "note": "",
          "estimated": false
        },
        {
          "name": "Passation (mode opératoire)",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Parcours départ à la retraite",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Secteur Nord : arbitrage",
          "start": "2027-12-31",
          "end": "2027-12-31",
          "progress": 0,
          "note": "Jalon : décision sur l'ouverture du secteur Nord.",
          "estimated": true
        }
      ]
    },
    {
      "id": "c-organisation",
      "rubrique": "commerce",
      "name": "Organisation générale",
      "owner": "",
      "color": "#e8b08a",
      "icon": "ri-settings-5-line",
      "note": "Nouveaux secteurs, outils de suivi, rémunération et animation de la force commerciale.",
      "actions": [
        {
          "name": "Séminaire stratégique Picard 2030 : lancement",
          "start": "2027-01-04",
          "end": "2027-01-04",
          "progress": 0,
          "note": "Jalon de départ de Picard 2030. Pendant la réunion commerciale, semaine du 4 au 8 janvier 2027.",
          "estimated": true
        },
        {
          "name": "Présentation individuelle des nouveaux secteurs",
          "start": "2026-10-01",
          "end": "2026-11-15",
          "progress": 70,
          "note": "Avancement noté à 70 % au 14/10.",
          "estimated": false
        },
        {
          "name": "Création d'un support de suivi (tous segments)",
          "start": "2026-10-01",
          "end": "2026-12-31",
          "progress": 0,
          "note": "Initialement prévu pour Hall & Tech, étendu à tous les segments.",
          "estimated": true
        },
        {
          "name": "Nouvelle grille de rémunération / objectifs",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Réunion commerciale : présentation des objectifs individuels",
          "start": "2027-01-04",
          "end": "2027-01-08",
          "progress": 0,
          "note": "Semaine du 4 au 8 janvier 2027. Sessions : séminaire, Lyon, Marseille, Paris (Eliot).",
          "estimated": false
        },
        {
          "name": "Animation de la force commerciale",
          "start": "2027-01-01",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Passation des secteurs",
          "start": "2026-11-16",
          "end": "2027-03-31",
          "progress": 0,
          "note": "Jusqu'à fin mars 2027.",
          "estimated": true
        }
      ]
    },
    {
      "id": "c-iap",
      "rubrique": "commerce",
      "name": "Refonte du programme IAP",
      "owner": "",
      "color": "#e7aab9",
      "icon": "ri-hand-coin-line",
      "note": "Refonte complète du programme IAP pour Picard 2030. Échéance : fin 2026.",
      "actions": [
        {
          "name": "Groupe de travail Storistes : RDV cabinet externe",
          "start": "2026-10-19",
          "end": "2026-10-19",
          "progress": 0,
          "note": "Jalon. À confirmer : rattachement au programme IAP.",
          "estimated": false
        },
        {
          "name": "Définir le modèle de partenariat IAP Picard 2030",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Confirmer la nouvelle charte IAP (showroom enseigne)",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Refonte du contrat IAP (engagements, réciprocité)",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Refonte de la politique tarifaire & BFA",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Construire le parcours de performance IAP",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Construire le plan de recrutement / zones Picard 2030",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Construire le parcours d'intégration IAP",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Définir le modèle ambassadeurs / parrainage",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Définir et construire un comité stratégique IAP",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Plan marketing opérationnel IAP",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        }
      ]
    },
    {
      "id": "c-mkt-produits",
      "rubrique": "commerce",
      "name": "Marketing produits",
      "owner": "",
      "color": "#b9abe6",
      "icon": "ri-lightbulb-line",
      "note": "Serrures (CP : Laurent Guillard), portes palières (cabinet externe, avec Eliot), Hall & Tech (chef produit : Christophe Kuti).",
      "actions": [
        {
          "name": "Serrures : plan d'action gammes serrures et cylindres",
          "start": "2026-10-09",
          "end": "2026-10-09",
          "progress": 100,
          "note": "Jalon du 09/10. CP Serrures : Laurent Guillard.",
          "estimated": false
        },
        {
          "name": "Réunion cylindre Flexy",
          "start": "2026-10-22",
          "end": "2026-10-22",
          "progress": 0,
          "note": "Jalon. Cylindre Nord A2P 3*.",
          "estimated": false
        },
        {
          "name": "Serrures : rationalisation des gammes Ermétis, P10 et P30",
          "start": "2026-10-22",
          "end": "2026-12-31",
          "progress": 0,
          "note": "Lancée le 22/10, livrable fin décembre. CP Serrures : Laurent Guillard.",
          "estimated": true
        },
        {
          "name": "Portes palières : cabinet externe (avec Eliot)",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "En cours de discussion. Point d'attention : coordination avec Eliot.",
          "estimated": true
        },
        {
          "name": "Hall & Tech : Christophe Kuti, chef produit",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        }
      ]
    },
    {
      "id": "c-reflex-confort",
      "rubrique": "commerce",
      "name": "Marketing produits · Reflet / Confort",
      "owner": "",
      "color": "#d5cbf0",
      "icon": "ri-lightbulb-line",
      "note": "Thème rattaché à Marketing produits. Dates non précisées dans les notes : fin 2026 par défaut.",
      "actions": [
        {
          "name": "Tarification",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Installation des prototypes chez 5 IAP",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "Portes test chez 5 Installateurs Agréés Picard (IAP), avec engagement de confidentialité.",
          "estimated": true
        },
        {
          "name": "Tarification publique validée",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Ressources",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        }
      ]
    },
    {
      "id": "c-mkt-operationnel",
      "rubrique": "commerce",
      "name": "Marketing opérationnel",
      "owner": "",
      "color": "#93cfdd",
      "icon": "ri-line-chart-line",
      "note": "Livrable : janvier 2027.",
      "actions": [
        {
          "name": "Plan marketing des campagnes promo nationales",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Plan d'animation des réseaux",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        }
      ]
    },
    {
      "id": "c-communication",
      "rubrique": "commerce",
      "name": "Communication",
      "owner": "",
      "color": "#9fbbe6",
      "icon": "ri-megaphone-line",
      "note": "Livrable : janvier 2027. Inclut la newsletter bimensuelle Picard 2030.",
      "actions": [
        {
          "name": "Campagnes TV nationales",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Campagnes digitales",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Salons",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Ressources",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Presse",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Communication interne",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "Site web, réseaux sociaux, newsletters. Suivi Picard 2030 (newsletter bimensuelle), guide des bonnes pratiques, événements internes.",
          "estimated": true
        }
      ]
    },
    {
      "id": "c-service-client",
      "rubrique": "commerce",
      "name": "Service client",
      "owner": "",
      "color": "#92cfc3",
      "icon": "ri-team-line",
      "note": "Livrable : janvier 2027.",
      "actions": [
        {
          "name": "Groupe de travail : organisation service client / SAV",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Communication client SAV",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Gestion du SAV fenêtriers",
          "start": "2026-10-14",
          "end": "2027-01-31",
          "progress": 0,
          "note": "Groupe de travail avec Régis Di Dia et Léo Gaday.",
          "estimated": true
        }
      ]
    },
    {
      "id": "c-eliot",
      "rubrique": "commerce",
      "name": "Eliot",
      "owner": "",
      "color": "#acd5a6",
      "icon": "ri-global-line",
      "note": "Repositionnement d'Eliot : raison d'être, gamme, modèle, règles commerciales, puis développement national 2027-2028.",
      "actions": [
        {
          "name": "Redéfinir la raison d'être d'Eliot",
          "start": "2026-10-14",
          "end": "2026-10-31",
          "progress": 100,
          "note": "Coché ✓ dans les notes (échéance 31/10). À confirmer.",
          "estimated": false
        },
        {
          "name": "Définir les segments de marché prioritaires",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Refonte de la gamme Eliot",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Construire le modèle Eliot",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Définir les règles commerciales de vente",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Plan de stabilisation IDF avec Sécuristes de France",
          "start": "2026-10-14",
          "end": "2026-12-31",
          "progress": 0,
          "note": "Date non précisée : fin 2026 par défaut.",
          "estimated": true
        },
        {
          "name": "Consolider le plan de croissance 2027",
          "start": "2027-01-01",
          "end": "2027-12-31",
          "progress": 0,
          "note": "",
          "estimated": true
        },
        {
          "name": "Construire le développement national",
          "start": "2027-01-01",
          "end": "2028-12-31",
          "progress": 0,
          "note": "2027 à 2028.",
          "estimated": true
        }
      ]
    },
    {
      "id": "t-usine",
      "rubrique": "production",
      "name": "Modernisation de l'usine",
      "owner": "Direction industrielle",
      "color": "#9fbbe6",
      "icon": "ri-building-4-line",
      "start": "2026-01-05",
      "end": "2027-12-31",
      "note": "Nouvelle ligne d'usinage et automatisation de l'assemblage. Budget : 2,4 M€.",
      "actions": [
        {
          "name": "Étude & cahier des charges",
          "start": "2026-01-05",
          "end": "2026-04-30",
          "progress": 100,
          "note": ""
        },
        {
          "name": "Appel d'offres fournisseurs",
          "start": "2026-05-01",
          "end": "2026-09-30",
          "progress": 100,
          "note": "Fournisseur retenu le 30 septembre."
        },
        {
          "name": "Installation ligne",
          "start": "2026-10-01",
          "end": "2027-06-30",
          "progress": 10,
          "note": "Génie civil démarré. Livraison machines prévue en février."
        },
        {
          "name": "Montée en cadence",
          "start": "2027-07-01",
          "end": "2027-12-31",
          "progress": 0,
          "note": ""
        }
      ]
    },
    {
      "id": "t-erp",
      "rubrique": "production",
      "name": "Système d'information (ERP)",
      "owner": "DSI",
      "color": "#b9abe6",
      "icon": "ri-database-2-line",
      "start": "2026-02-01",
      "end": "2027-02-28",
      "note": "Remplacement de l'ERP historique, reprise des données et formation des équipes.",
      "actions": [
        {
          "name": "Cadrage",
          "start": "2026-02-01",
          "end": "2026-04-15",
          "progress": 100,
          "note": ""
        },
        {
          "name": "Paramétrage",
          "start": "2026-04-16",
          "end": "2026-10-31",
          "progress": 55,
          "note": "Modules achats et stocks terminés ; production en cours."
        },
        {
          "name": "Recette & formation",
          "start": "2026-11-01",
          "end": "2027-01-31",
          "progress": 0,
          "note": ""
        },
        {
          "name": "Bascule",
          "start": "2027-02-01",
          "end": "2027-02-28",
          "progress": 0,
          "note": "Décision Go / No-Go fin janvier."
        }
      ]
    },
    {
      "id": "t-qualite",
      "rubrique": "production",
      "name": "Qualité & environnement",
      "owner": "Qualité / RSE",
      "color": "#acd5a6",
      "icon": "ri-leaf-line",
      "start": "2027-01-01",
      "end": "2028-11-30",
      "note": "Démarche environnementale jusqu'à la certification ISO 14001.",
      "actions": [
        {
          "name": "Analyse environnementale",
          "start": "2027-01-01",
          "end": "2027-06-30",
          "progress": 0,
          "note": ""
        },
        {
          "name": "Plan d'actions",
          "start": "2027-07-01",
          "end": "2028-06-30",
          "progress": 0,
          "note": ""
        },
        {
          "name": "Audit de certification",
          "start": "2028-09-01",
          "end": "2028-10-31",
          "progress": 0,
          "note": ""
        },
        {
          "name": "Certification ISO 14001",
          "start": "2028-11-30",
          "end": "2028-11-30",
          "progress": 0,
          "note": "Jalon"
        }
      ]
    }
  ]
};
