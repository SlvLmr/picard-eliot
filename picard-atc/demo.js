/* ============================================================
   PICARD-ATC — Mode démonstration
   Données FICTIVES (noms et montants), sur la structure exacte des
   fichiers Picard. Tant que Supabase n'est pas branché, l'admin peut
   aussi importer les vrais fichiers : ils restent alors uniquement
   dans ce navigateur (rien n'est publié).
   ============================================================ */

const DEMO_KEY = 'picard_atc_demo_v4';

// Budgets annuels fictifs en k€ : [serrures, diamant, hall, technica, eliot]
const DEMO_ATC = [
    ['IDF', 'Julien', 'Moreau', [2800, 1050, 300, 120, 1300]], ['IDF', 'Sophie', 'Lefèvre', [50, 1530, 5, 20, 50]], ['IDF', 'Thomas', 'Girard', [10, 45, 900, 170, 230]],
    ['NORD', 'Camille', 'Laurent', [270, 820, 130, 170, 40]], ['NORD', 'Antoine', 'Mercier', [80, 310, 45, 65, 6]], ['NORD', 'Chloé', 'Dubois', [6, 35, 640, 160, 6]], ['NORD', 'Maxime', 'Rousseau', [50, 570, 40, 40, 13]],
    ['OUEST', 'Inès', 'Garnier', [110, 275, 30, 170, 13]], ['OUEST', 'Hugo', 'Lambert', [200, 580, 30, 90, 21]], ['OUEST', 'Léa', 'Fontaine', [105, 290, 30, 50, 13]],
    ['RA', 'Nicolas', 'Perrin', [780, 810, 30, 125, 6]], ['RA', 'Emma', 'Roux', [100, 135, 50, 50, 6]], ['RA', 'Lucas', 'Faure', [55, 1700, 5, 20, 6]],
    ['PACA', 'Manon', 'Chevalier', [85, 490, 20, 20, 6]], ['PACA', 'Louis', 'Bonnet', [22, 740, 40, 40, 6]], ['PACA', 'Sarah', 'Guérin', [890, 720, 40, 40, 6]],
    ['NORD', 'Paul', 'Martin', [60, 420, 30, 60, 5]], ['IDF', 'Julie', 'Petit', [70, 380, 25, 50, 5]], ['IDF', 'Romain', 'Dubreuil', [40, 260, 380, 210, 10]], ['IDF', 'Claire', 'Vidal', [30, 220, 410, 260, 8]],
    ['DIR', '', 'Direction', [4300, 20, 25, 0, 1000]],
    ['DOM', '', 'DOM-TOM', [310, 140, 15, 25, 30]],
];
const COEF_MOIS = [0.0855, 0.0855, 0.094, 0.0987, 0.0684, 0.0893, 0.0897, 0.0329, 0.0987, 0.094, 0.0897, 0.0735];
const DEMO_FONCTIONS = ['ATC dédié', 'ATC dédié', 'ATC dédié', 'ATC dédié', 'ATC mixte', 'ATC dédié', 'ATC dédié', 'ATC dédié', 'ATC dédié', 'ATC dédié', 'Chef de secteur', 'ATC mixte',
    'ATC dédié', 'ATC mixte', 'ATC mixte', 'ATC mixte', 'ATC dédié', 'ATC dédié', 'ATC dédié', 'ATC dédié', 'Direction', 'Zone DOM-TOM'];
// Affectations fictives : secteur → n° de l'ATC dans DEMO_ATC (5 mixtes présents dans les 3 forces)
const DEMO_AFFECT = {
    serruriers: { benelux: [4], nord: [3], idfo: [1], idfe: [0], ouest: [8], atlantique: [7], est: [6], centre: [11], ra: [10], so: [15], med: [13], paca: [14], dom: [21] },
    menuisiers: { benelux: [4], nord: [5], idfo: [2], idfe: [17], grandouest: [9], est: [16], centre: [11], ra: [12], so: [15], med: [13], paca: [14], dom: [21] },
    marches: { benelux: [4], nord: [3], idf: [18, 19, 0, 1], ouest: [8], atlantique: [7], est: [6], centre: [11], ra: [10], so: [15], med: [13], paca: [14], dom: [21] },
};
const METROPOLES = ['75', '92', '93', '94', '13', '69', '59', '33', '31', '06', '44', '67', '34', '35', '76', '38', 'BE', 'CH', 'LU'];

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function demoRef() { let d = addDays(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), -1); while (!isWorkday(d)) d = addDays(d, -1); return d; }

// Référentiel : commerciaux, secteurs, potentiels
function demoInitialState() {
    const parEquipe = {};
    const commerciaux = DEMO_ATC.map(([eq, prenom, nom], i) => {
        const k = parEquipe[eq] = (parEquipe[eq] ?? -1) + 1;
        return { id: 'demo-' + i, code: `${nom.toUpperCase()} ${prenom}`.trim(), prenom, nom, equipe: eq, couleur: nuance(equipeDe(eq).couleur, k), fonction: DEMO_FONCTIONS[i],
            actif: true, ordre: i, clientele: [], objectif_marge: 34, iap_objectif: eq === 'DIR' || eq === 'DOM' ? 0 : 6 + (i % 4) * 2, iap_nouveaux: i % 3,
            email: prenom ? `${norm(prenom)}.${norm(nom).replace(/ /g, '')}@exemple.fr` : '', telephone: '' };
    });
    const affectations = {};
    for (const [f, secs] of Object.entries(DEMO_AFFECT)) { affectations[f] = {}; for (const [sec, ids] of Object.entries(secs)) affectations[f][sec] = ids.map(i => commerciaux[i].id); }
    return { reglages: { nom: 'PICARD-ATC', sous_titre: 'Pilotage du chiffre des ATC', lecture_publique: true, seuil_vert: 90, seuil_jaune: 85, seuil_orange: 60,
        types_clientele: ['Serruriers', 'Menuisiers', 'Installateurs', 'Négoces & distributeurs', 'Entreprises du bâtiment', 'Grands comptes', 'Collectivités', 'Syndics & bailleurs'],
        fonctions: ['ATC dédié', 'ATC mixte', 'Chef de secteur', 'Direction'] },
        commerciaux, affectations, zonesInfo: demoZonesInfo(), imports: [], donnees: null, palette: 2, v: 3 };
}

// Potentiel de marché et IAP par zone (exemple)
function demoZonesInfo() {
    const r = rng(77); const out = {};
    for (const z of CARTE.zones) {
        let p = z.dom ? 300 + r() * 600 : z.pays === 'CH' ? 150 + r() * 900 : z.pays === 'BE' ? 400 + r() * 800 : 400 + r() * 1000;
        if (METROPOLES.includes(z.code)) p *= 3 + r() * 2;
        p = Math.round(p) * 1000;
        out[z.code] = { potentiel: p, iap: Math.max(0, Math.round(p / 650000 * (0.4 + r() * 0.9))) };
    }
    return out;
}

// Chiffres : budgets, réalisé, N-1, quantités, jours, carnet
function demoDonnees(commerciaux) {
    const r = rng(2026); const ref = demoRef(); const y = ref.getFullYear(), refM = ref.getMonth() + 1;
    const frac = workdaysBetween(new Date(y, refM - 1, 1), ref) / workdaysBetween(new Date(y, refM - 1, 1), new Date(y, refM, 0));
    const atcMois = [];
    DEMO_ATC.forEach(([, , , bud], i) => {
        const c = commerciaux[i]?.id; if (!c) return;
        const perf = 0.82 + r() * 0.32, croissance = 0.02 + r() * 0.1;
        ['serrures', 'diamant', 'hall', 'technica', 'eliot'].forEach((g, gi) => {
            const perfG = perf * (g === 'eliot' ? 0.95 + r() * 0.25 : 0.9 + r() * 0.2);
            for (let m = 1; m <= 12; m++) {
                const b = Math.round(bud[gi] * 1000 * COEF_MOIS[m - 1]);
                const bruit = 0.85 + r() * 0.3;
                const rv = m < refM ? Math.round(b * perfG * bruit) : m === refM ? Math.round(b * perfG * bruit * frac) : null;
                const n1 = Math.round(b / (1 + croissance) * (0.9 + r() * 0.2));
                const prix = { serrures: 5800, diamant: 2600, hall: 3400 }[g];
                atcMois.push({ c, a: y, m, g, r: rv, b, q: prix && rv != null ? Math.round(rv / prix) : null, n1 });
            }
        });
    });
    // Société : jours ouvrés (enregistré / facturé) et budgets mensuels
    const societeMois = [], jours = [];
    for (let m = 1; m <= 12; m++) {
        const sum = k => atcMois.filter(x => x.m === m && x.g !== 'eliot').reduce((s, x) => s + (+x[k] || 0), 0);
        const deb = new Date(y, m - 1, 1), fin = new Date(y, m, 0);
        const jo = workdaysBetween(deb, fin);
        societeMois.push({ a: y, m, b_enr: sum('b'), b_fact: sum('b'), jours_ouvres: jo, n1_enr: Math.round(sum('n1') * 1.03), n1_fact: sum('n1') });
        if (m > refM) continue;
        const total = sum('r'); const nj = m === refM ? workdaysBetween(deb, ref) : jo;
        let k = 0;
        for (let d = new Date(deb); d <= (m === refM ? ref : fin); d = addDays(d, 1)) {
            if (!isWorkday(d)) continue; k++;
            const f = total / nj * (0.55 + r() * 0.9);
            jours.push({ d: iso(d), fact: Math.round(f), enr: Math.round(total / nj * (0.5 + r() * 1.1) * 1.03) });
        }
    }
    // Carnet de commandes : reste à livrer jour par jour
    const portefeuille = []; let pf = 2.55e6;
    for (const j of jours) {
        const d = parseIso(j.d); const jm = d.getDate() / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        pf = Math.max(2.1e6, Math.min(3.2e6, pf + (j.enr - j.fact) * 0.6 + (r() - 0.5) * 40000));
        const parts = { tech: 0.12, hall: 0.18, serr: 0.31, diam: 0.34, tol: 0.05 };
        const x = { d: j.d, pf_total: Math.round(pf) };
        for (const [g, p] of Object.entries(parts)) {
            const v = pf * p * (0.9 + r() * 0.2);
            x['pf_' + g] = Math.round(v);
            x['lm_' + g] = Math.round(v * (0.82 - jm * 0.45));
            x['m1_' + g] = Math.round(v * (0.12 + jm * 0.35));
            x['m2_' + g] = Math.round(v * (0.04 + jm * 0.06));
        }
        for (const e of ['lm', 'm1', 'm2']) x[e + '_total'] = Object.keys(parts).reduce((s, g) => s + x[e + '_' + g], 0);
        portefeuille.push(x);
    }
    return { atcMois, jours, societeMois, portefeuille };
}

function createDemoStore() {
    let state;
    try { state = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) {}
    if (!state?.commerciaux) state = demoInitialState();
    if (state.palette !== 2) {   // couleurs d'ATC recalculées sur le camaïeu de bleu des équipes
        const rang = {}; state.commerciaux.forEach(c => { const k = rang[c.equipe] = (rang[c.equipe] ?? -1) + 1; c.couleur = nuance(equipeDe(c.equipe).couleur, k); });
        state.palette = 2;
    }
    { const f = fusionnerZones({}, state.zonesInfo); // carte à une zone par pays pour BE / CH
      if (f.change) state.zonesInfo = state.zonesSaisies ? f.zonesInfo : demoZonesInfo(); }
    if (state.v !== 3 && state.affectations && state.commerciaux.every(c => String(c.id).startsWith('demo-'))) state = { ...demoInitialState(), donnees: state.donnees, imports: state.imports }; // ajout de la zone DOM-TOM
    if (!state.affectations) { // passage aux forces commerciales : la démo est régénérée, de vraies fiches gardent leurs données
        if (state.commerciaux.every(c => String(c.id).startsWith('demo-'))) state = { ...demoInitialState(), donnees: state.donnees, imports: state.imports };
        else state.affectations = {};
        delete state.secteurs;
    }
    if (state.reglages.seuil_jaune == null) Object.assign(state.reglages, { seuil_vert: 90, seuil_jaune: 85, seuil_orange: 60 });
    const listeners = [];
    const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch (e) { console.warn('Stockage local plein', e); } listeners.forEach(f => f()); };
    let cache = null;
    const donnees = () => state.donnees || cache || (cache = demoDonnees(state.commerciaux));

    return {
        mode: 'demo',
        async init() { return true; },
        async session() { return { isAdmin: true, email: 'mode démo' }; },
        async signIn() {}, async signOut() {},
        onChange(f) { listeners.push(f); },
        async loadAll() {
            const d = donnees();
            const last = d.jours.reduce((m, j) => j.d > m ? j.d : m, '');
            return { reglages: { ...state.reglages }, commerciaux: state.commerciaux.map(c => ({ ...c })), affectations: JSON.parse(JSON.stringify(state.affectations || {})), zonesInfo: { ...state.zonesInfo },
                ...d, etat: { derniere_date: last || null, dernier_import: state.imports[0]?.created_at || null, source: state.donnees ? 'fichiers' : 'demo', zonesExemple: !state.zonesSaisies } };
        },
        // ─── Admin ───
        async saveReglages(p) { Object.assign(state.reglages, p); save(); },
        async saveCommercial(c) {
            if (!c.id) { c.id = 'demo-' + Math.random().toString(36).slice(2, 9); state.commerciaux.push(c); }
            else Object.assign(state.commerciaux.find(x => x.id === c.id), c);
            save(); return c;
        },
        async deleteCommercial(id) {
            state.commerciaux = state.commerciaux.filter(c => c.id !== id);
            for (const f in state.affectations) for (const s in state.affectations[f]) state.affectations[f][s] = state.affectations[f][s].filter(x => x !== id);
            save();
        },
        async setAffectation(force, secteur, ids) { (state.affectations[force] ||= {})[secteur] = [...ids]; save(); },
        async setZoneInfo(zone, info) {
            // Première saisie réelle : on efface les valeurs d'exemple pour ne garder que les vraies
            if (!state.zonesSaisies) { state.zonesInfo = {}; state.zonesSaisies = true; }
            state.zonesInfo[zone] = { ...state.zonesInfo[zone], ...info }; save();
        },
        async listImports() { return state.imports.map(i => ({ ...i })); },
        // Import des fichiers Picard : les données restent dans ce navigateur
        async importer(kind, data, meta) {
            if (!state.donnees) state.donnees = { atcMois: [], jours: [], societeMois: [], portefeuille: [] };
            const D = state.donnees;
            if (kind === 'quotidien') {
                const days = new Set(data.jours.map(j => j.d)); D.jours = D.jours.filter(j => !days.has(j.d)).concat(data.jours).sort((a, b) => a.d < b.d ? -1 : 1);
                const ms = new Set(data.mois.map(x => x.a + '-' + x.m)); D.societeMois = D.societeMois.filter(x => !ms.has(x.a + '-' + x.m)).concat(data.mois);
            } else if (kind === 'portefeuille') {
                const days = new Set(data.jours.map(j => j.d)); D.portefeuille = D.portefeuille.filter(j => !days.has(j.d)).concat(data.jours).sort((a, b) => a.d < b.d ? -1 : 1);
            } else if (kind === 'repartition') {
                const ids = rattacher(state, data.personnes, true);
                const rows = data.lignes.map(l => ({ c: ids[l.code], a: l.a, m: l.m, g: l.g, r: l.r, b: l.b, q: l.q, n1: l.n1 }));
                const keys = new Set(rows.map(x => `${x.c}|${x.a}|${x.m}|${x.g}`));
                D.atcMois = D.atcMois.filter(x => !keys.has(`${x.c}|${x.a}|${x.m}|${x.g}`)).concat(rows);
            }
            state.imports.unshift({ id: 'imp-' + Date.now(), type: kind, fichier: meta.fichier, lignes: meta.lignes, created_at: new Date().toISOString(), par: 'ce navigateur' });
            save();
        },
        resetDemo() { localStorage.removeItem(DEMO_KEY); state = demoInitialState(); cache = null; save(); },
    };
}

// Rattache les personnes du fichier aux fiches ATC (création si besoin, zones proposées par défaut)
// En mode démo avec de vrais fichiers, les fiches fictives sont remplacées par les vraies.
function rattacher(state, personnes, remplacerDemo) {
    if (remplacerDemo && state.commerciaux.every(c => String(c.id).startsWith('demo-'))) { state.commerciaux = []; state.affectations = {}; }
    const ids = {}; const parEquipe = {};
    for (const p of personnes) {
        let c = state.commerciaux.find(x => x.code === p.code || norm(x.prenom + ' ' + x.nom) === norm(p.prenom + ' ' + p.nom));
        const k = parEquipe[p.equipe] = (parEquipe[p.equipe] ?? -1) + 1;
        if (!c) {
            c = { id: 'atc-' + Math.random().toString(36).slice(2, 9), code: p.code, prenom: p.prenom, nom: p.nom, equipe: p.equipe, couleur: nuance(equipeDe(p.equipe).couleur, k),
                fonction: p.equipe === 'DIR' ? 'Direction' : p.equipe === 'DOM' ? 'Zone DOM-TOM' : 'ATC', actif: true, ordre: state.commerciaux.length, clientele: [], iap_objectif: 0, iap_nouveaux: 0 };
            state.commerciaux.push(c); // secteurs : à affecter dans l'admin (onglet Secteurs)
        }
        ids[p.code] = c.id;
    }
    return ids;
}
