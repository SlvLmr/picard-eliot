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
    ['DIR', '', 'Direction', [4300, 20, 25, 0, 1000]],
];
const COEF_MOIS = [0.0855, 0.0855, 0.094, 0.0987, 0.0684, 0.0893, 0.0897, 0.0329, 0.0987, 0.094, 0.0897, 0.0735];
const DEMO_FONCTIONS = ['ATC', 'Spécialiste Diamant', 'Spécialiste Hall', 'ATC', 'ATC', 'Spécialiste Hall', 'ATC', 'ATC', 'ATC', 'ATC', 'Chef de secteur', 'ATC', 'Spécialiste Diamant', 'ATC', 'ATC', 'ATC', 'Direction'];
const METROPOLES = ['75', '92', '93', '94', '13', '69', '59', '33', '31', '06', '44', '67', '34', '35', '76', '38', 'BE-BRU', 'CH-GE', 'CH-ZH', 'LU'];

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function demoRef() { let d = addDays(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), -1); while (!isWorkday(d)) d = addDays(d, -1); return d; }

// Référentiel : commerciaux, secteurs, potentiels
function demoInitialState() {
    const parEquipe = {};
    const commerciaux = DEMO_ATC.map(([eq, prenom, nom], i) => {
        const k = parEquipe[eq] = (parEquipe[eq] ?? -1) + 1;
        return { id: 'demo-' + i, code: `${nom.toUpperCase()} ${prenom}`.trim(), prenom, nom, equipe: eq, couleur: nuance(equipeDe(eq).couleur, k), fonction: DEMO_FONCTIONS[i],
            actif: true, ordre: i, clientele: [], objectif_marge: 34, iap_objectif: eq === 'DIR' ? 0 : 6 + (i % 4) * 2, iap_nouveaux: i % 3,
            email: prenom ? `${norm(prenom)}.${norm(nom).replace(/ /g, '')}@exemple.fr` : '', telephone: '' };
    });
    const secteurs = {}; const idx = {};
    commerciaux.forEach(c => { const k = idx[c.equipe] = (idx[c.equipe] ?? -1) + 1; (ZONES_DEFAUT[c.equipe]?.[k] || []).forEach(z => secteurs[z] = c.id); });
    return { reglages: { nom: 'PICARD-ATC', sous_titre: 'Pilotage du chiffre des ATC', lecture_publique: true, seuil_vert: 100, seuil_orange: 90,
        types_clientele: ['Serruriers', 'Menuisiers', 'Installateurs', 'Négoces & distributeurs', 'Entreprises du bâtiment', 'Grands comptes', 'Collectivités', 'Syndics & bailleurs'],
        fonctions: ['ATC', 'Spécialiste Diamant', 'Spécialiste Hall', 'Chef de secteur', 'Direction'] },
        commerciaux, secteurs, zonesInfo: demoZonesInfo(), imports: [], donnees: null };
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
            return { reglages: { ...state.reglages }, commerciaux: state.commerciaux.map(c => ({ ...c })), secteurs: { ...state.secteurs }, zonesInfo: { ...state.zonesInfo },
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
            for (const z in state.secteurs) if (state.secteurs[z] === id) delete state.secteurs[z];
            save();
        },
        async setSecteurs(list) { for (const { zone, commercial_id } of list) { if (commercial_id) state.secteurs[zone] = commercial_id; else delete state.secteurs[zone]; } save(); },
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
    if (remplacerDemo && state.commerciaux.every(c => String(c.id).startsWith('demo-'))) { state.commerciaux = []; state.secteurs = {}; }
    const ids = {}; const parEquipe = {};
    for (const p of personnes) {
        let c = state.commerciaux.find(x => x.code === p.code || norm(x.prenom + ' ' + x.nom) === norm(p.prenom + ' ' + p.nom));
        const k = parEquipe[p.equipe] = (parEquipe[p.equipe] ?? -1) + 1;
        if (!c) {
            c = { id: 'atc-' + Math.random().toString(36).slice(2, 9), code: p.code, prenom: p.prenom, nom: p.nom, equipe: p.equipe, couleur: nuance(equipeDe(p.equipe).couleur, k),
                fonction: p.equipe === 'DIR' ? 'Direction' : 'ATC', actif: true, ordre: state.commerciaux.length, clientele: [], iap_objectif: 0, iap_nouveaux: 0 };
            state.commerciaux.push(c);
            (ZONES_DEFAUT[p.equipe]?.[k] || []).forEach(z => { if (!state.secteurs[z]) state.secteurs[z] = c.id; });
        }
        ids[p.code] = c.id;
    }
    return ids;
}
