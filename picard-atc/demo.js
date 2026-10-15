/* ============================================================
   COMMERCE — Mode démonstration
   Données fictives générées dans le navigateur, tant que
   Supabase n'est pas configuré (config.js). Les modifications
   faites dans l'admin sont gardées dans ce navigateur.
   ============================================================ */

const DEMO_KEY = 'picard_atc_demo_v3';

const DEMO_EQUIPE = [
    ['Camille', 'Laurent', 'CLA', '#0fb5d0', ['75', '77', '78', '91', '92', '93', '94', '95'], 3.6],
    ['Julien', 'Moreau', 'JMO', '#00e3a0', ['59', '62', '80', '02', '60', 'BE-BRU', 'BE-WBR', 'BE-VBR', 'BE-VAN', 'BE-VLI', 'BE-WLG', 'BE-WNA', 'BE-WHT', 'BE-WLX', 'BE-VWV', 'BE-VOV'], 2.9],
    ['Sophie', 'Lefèvre', 'SLE', '#5b8def', ['08', '51', '10', '52', '54', '55', '57', '67', '68', '88', 'LU'], 2.4],
    ['Thomas', 'Girard', 'TGI', '#9d8df1', ['01', '38', '69', '73', '74', '42', '07', '26', 'CH-GE', 'CH-VD', 'CH-VS', 'CH-NE', 'CH-FR', 'CH-JU', 'CH-BE', 'CH-BS', 'CH-BL', 'CH-SO', 'CH-AG', 'CH-LU', 'CH-ZG', 'CH-ZH', 'CH-SZ', 'CH-UR', 'CH-OW', 'CH-NW', 'CH-GL', 'CH-SH', 'CH-TG', 'CH-SG', 'CH-AR', 'CH-AI', 'CH-GR', 'CH-TI'], 3.1],
    ['Léa', 'Fontaine', 'LFO', '#f2a65a', ['04', '05', '06', '13', '83', '84', '2A', '2B'], 2.7],
    ['Antoine', 'Mercier', 'AME', '#2ec4a6', ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'], 2.5],
    ['Chloé', 'Dubois', 'CDU', '#7fb3ff', ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'], 2.3],
    ['Maxime', 'Rousseau', 'MRO', '#1aa3c9', ['22', '29', '35', '56', '44', '49', '53', '72', '85'], 2.6],
    ['Inès', 'Garnier', 'IGA', '#7ee8c6', ['14', '27', '50', '61', '76', '18', '28', '36', '37', '41', '45'], 2.2],
    ['Hugo', 'Lambert', 'HLA', '#b3a6ff', ['03', '15', '43', '63', '21', '25', '39', '58', '70', '71', '89', '90'], 1.9],
    ['Manon', 'Chevalier', 'MCH', '#f28fa8', ['971', '972', '973', '974', '976', '975', '987', '988'], 1.1],
];
// Performance de l'année en cours par rapport à l'objectif (fictif) et croissance vs N-1
const DEMO_PERF = [1.06, 0.93, 1.02, 1.12, 0.84, 0.98, 1.0, 0.89, 1.04, 0.95, 1.09];
const SAISON = [0.85, 0.95, 1.1, 1.05, 1.0, 1.1, 1.0, 0.55, 1.05, 1.15, 1.1, 0.95];
const CLIENTS = ['Serrurerie', 'Menuiserie', 'Quincaillerie', 'Bâtiment', 'Fermetures', 'Habitat', 'Sécurité', 'Agencement', 'Construction', 'Rénovation'];
const SEGMENT_DE = { Serrurerie: 'Serruriers', Menuiserie: 'Menuisiers', Quincaillerie: 'Négoces & distributeurs', 'Bâtiment': 'Entreprises du bâtiment', Fermetures: 'Installateurs',
    Habitat: 'Négoces & distributeurs', 'Sécurité': 'Installateurs', Agencement: 'Menuisiers', Construction: 'Entreprises du bâtiment', 'Rénovation': 'Entreprises du bâtiment' };
const DEMO_FONCTIONS = ['ATC', 'ATC', 'ATC', 'Chef de secteur', 'ATC', 'ATC', 'ATC', 'ATC', 'ATC', 'ATS', 'Agent commercial'];
const DEMO_CLIENTELE = [['Serruriers', 'Grands comptes', 'Collectivités'], ['Négoces & distributeurs', 'Installateurs'], ['Serruriers', 'Menuisiers'], ['Grands comptes', 'Installateurs', 'Industriels'],
    ['Serruriers', 'Entreprises du bâtiment'], ['Menuisiers', 'Négoces & distributeurs'], ['Serruriers', 'Installateurs'], ['Menuisiers', 'Entreprises du bâtiment'], ['Négoces & distributeurs'], ['Serruriers', 'Collectivités'], ['Négoces & distributeurs', 'Entreprises du bâtiment']];
const GAMMES = ['Serrures', 'Portes blindées', 'Portes techniques', 'Portes de Hall', 'Eliot'];
const GAMME_POIDS = [0.42, 0.24, 0.14, 0.12, 0.08];
const GAMME_MARGE = [0.02, -0.03, 0.01, -0.01, 0.06];
const SUFFIXES = ['du Centre', 'Moderne', 'Pro', '& Fils', 'Services', 'Alliance', 'Duval', 'Martin', 'Bernard', 'Lemoine', 'Perrin', 'Robin', 'Faure', 'Morel', 'Blanc'];

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function demoInitialState() {
    const commerciaux = DEMO_EQUIPE.map(([prenom, nom, code, couleur], i) => ({
        id: 'demo-' + code.toLowerCase(), prenom, nom, code, couleur, actif: true, ordre: i,
        fonction: DEMO_FONCTIONS[i], clientele: DEMO_CLIENTELE[i], objectif_marge: [35, 32, 34, 36, 33, 34, 35, 33, 32, 34, 30][i], notes: '',
        email: `${norm(prenom)}.${norm(nom).replace(/ /g, '')}@exemple.fr`, telephone: `06 ${String(10 + i * 7).padStart(2, '0')} ${String(20 + i * 3).padStart(2, '0')} ${String(30 + i).padStart(2, '0')} ${String(40 + i * 5).padStart(2, '0')}`,
    }));
    const secteurs = {};
    DEMO_EQUIPE.forEach(([, , code, , zones]) => zones.forEach(z => secteurs[z] = 'demo-' + code.toLowerCase()));
    const y = new Date().getFullYear();
    const objectifs = [];
    DEMO_EQUIPE.forEach(([, , code, , , annuel]) => {
        const somme = SAISON.reduce((a, b) => a + b, 0);
        for (const an of [y - 1, y]) for (let m = 1; m <= 12; m++) {
            objectifs.push({ commercial_id: 'demo-' + code.toLowerCase(), annee: an, mois: m, montant: Math.round(annuel * 1e6 * (an === y ? 1 : 0.94) * SAISON[m - 1] / somme / 1000) * 1000 });
        }
    });
    return { reglages: { nom: 'PICARD-ATC', sous_titre: 'Pilotage du chiffre des commerciaux', lecture_publique: true, seuil_vert: 100, seuil_orange: 90,
        gammes: ['Serrures', 'Portes blindées', 'Portes techniques', 'Portes de Hall', 'Eliot'],
        types_clientele: ['Serruriers', 'Menuisiers', 'Installateurs', 'Négoces & distributeurs', 'Entreprises du bâtiment', 'Grands comptes', 'Collectivités', 'Industriels'],
        fonctions: ['ATC', 'ATS', 'Chef de secteur', 'Responsable grands comptes', 'Agent commercial'] }, commerciaux, secteurs, objectifs, imports: [], ventesImportees: [] };
}

// Ventes fictives : du 1er janvier N-1 jusqu'au dernier jour ouvré écoulé
function demoVentes() {
    const r = rng(2030);
    const today = new Date(); let ref = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), -1);
    while (!isWorkday(ref)) ref = addDays(ref, -1);
    const y = ref.getFullYear(), somme = SAISON.reduce((a, b) => a + b, 0);
    const lignes = [];
    DEMO_EQUIPE.forEach(([, , code, , zones, annuel], i) => {
        const id = 'demo-' + code.toLowerCase();
        const clients = Array.from({ length: 26 }, (_, k) => `${CLIENTS[(k + i * 3) % CLIENTS.length]} ${SUFFIXES[(k * 7 + i) % SUFFIXES.length]}`);
        const poids = clients.map((_, k) => 1 / (k + 1.6)); const tp = poids.reduce((a, b) => a + b, 0);
        const zonesPoids = zones.map((_, k) => 1 / (k + 1.2)); const tz = zonesPoids.reduce((a, b) => a + b, 0);
        const pick = (arr, w, t) => { let x = r() * t; for (let k = 0; k < arr.length; k++) { x -= w[k]; if (x <= 0) return arr[k]; } return arr[0]; };
        for (let d = new Date(y - 1, 0, 1); d <= ref; d = addDays(d, 1)) {
            if (!isWorkday(d)) continue;
            const an = d.getFullYear(), m = d.getMonth();
            const jours = workdaysBetween(new Date(an, m, 1), new Date(an, m + 1, 0));
            const perf = an === y ? DEMO_PERF[i] * (1 + (r() - 0.5) * 0.08 + (m >= 8 ? (DEMO_PERF[i] - 1) * 0.6 : 0)) : 0.94 * (0.97 + r() * 0.06);
            const jour = annuel * 1e6 * SAISON[m] / somme / jours * perf;
            const nb = 2 + Math.floor(r() * 4);
            for (let k = 0; k < nb; k++) {
                const ca = Math.round(jour / nb * (0.4 + r() * 1.2));
                const client = pick(clients, poids, tp);
                // Gamme : Eliot progresse fortement cette année, les portes de Hall reculent
                const gp = GAMME_POIDS.map((w, g) => w * (an === y ? [1, 1, 1.05, 0.85, 1.6][g] : 1) * (1 + ((i + g) % 4) * 0.12));
                const gi = GAMMES.indexOf(pick(GAMMES, gp, gp.reduce((a, b) => a + b, 0)));
                lignes.push([iso(d), id, pick(zones, zonesPoids, tz), client, ca, Math.round(ca * (0.27 + r() * 0.13 + (i % 3) * 0.02 + GAMME_MARGE[gi])), 1, undefined, SEGMENT_DE[client.split(' ')[0]] || null, GAMMES[gi]]);
            }
        }
    });
    return lignes;
}

function createDemoStore() {
    let state;
    try { state = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) {}
    if (!state?.commerciaux || !state.reglages?.gammes) state = demoInitialState();
    const base = demoVentes();
    const listeners = [];
    const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch (e) {} listeners.forEach(f => f()); };
    // Lignes : [date, commercial, zone, client, ca, marge, commandes, import_id, segment, gamme]
    const all = () => base.concat(state.ventesImportees);
    const replacedDates = () => new Set(state.imports.filter(i => i.mode === 'remplacer').flatMap(i => i.dates || []));
    const rows = () => { const rd = replacedDates(); return all().filter(l => !rd.has(l[0]) || l[7]); };
    const between = (l, a, b) => l[0] >= a && l[0] <= b;

    return {
        mode: 'demo',
        async init() { return true; },
        async session() { return { isAdmin: true, email: 'mode démo' }; },
        async signIn() {}, async signOut() {},
        onChange(f) { listeners.push(f); },
        async loadBase() {
            const r = rows(); const last = r.reduce((m, l) => l[0] > m ? l[0] : m, '');
            return {
                reglages: { ...state.reglages }, commerciaux: state.commerciaux.map(c => ({ ...c })), secteurs: { ...state.secteurs }, objectifs: state.objectifs.slice(),
                etat: { derniere_date: last, dernier_import: state.imports[0]?.created_at || null },
            };
        },
        async serieJour(a, b) {
            const m = new Map();
            for (const l of rows()) if (between(l, a, b)) {
                const k = l[0] + '|' + l[1]; const e = m.get(k) || m.set(k, [l[0], l[1], 0, 0, 0]).get(k);
                e[2] += l[4]; e[3] += l[5] || 0; e[4] += l[6];
            }
            return [...m.values()];
        },
        async parZone(a, b, c) {
            const m = new Map();
            for (const l of rows()) if (l[2] && between(l, a, b) && (!c || l[1] === c)) {
                const e = m.get(l[2]) || m.set(l[2], [l[2], 0, 0, 0]).get(l[2]); e[1] += l[4]; e[2] += l[5] || 0; e[3] += l[6];
            }
            return [...m.values()];
        },
        async topClients(a, b, c, n = 8) {
            const m = new Map();
            for (const l of rows()) if (l[3] && between(l, a, b) && (!c || l[1] === c)) {
                const e = m.get(l[3]) || m.set(l[3], [l[3], 0, 0]).get(l[3]); e[1] += l[4]; e[2] += l[6];
            }
            return [...m.values()].sort((x, y) => y[1] - x[1]).slice(0, n);
        },
        async parGamme(a, b, c) {
            const m = new Map();
            for (const l of rows()) if (between(l, a, b) && (!c || l[1] === c)) {
                const k = l[9] || 'Non renseignée'; const e = m.get(k) || m.set(k, [k, 0, 0, 0]).get(k); e[1] += l[4]; e[2] += l[5] || 0; e[3] += l[6];
            }
            return [...m.values()].sort((x, y) => y[1] - x[1]);
        },
        async parSegment(a, b, c) {
            const m = new Map();
            for (const l of rows()) if (between(l, a, b) && (!c || l[1] === c)) {
                const k = l[8] || 'Non renseigné'; const e = m.get(k) || m.set(k, [k, 0, 0]).get(k); e[1] += l[4]; e[2] += l[6];
            }
            return [...m.values()].sort((x, y) => y[1] - x[1]);
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
            state.objectifs = state.objectifs.filter(o => o.commercial_id !== id); save();
        },
        async setSecteurs(list) { for (const { zone, commercial_id } of list) { if (commercial_id) state.secteurs[zone] = commercial_id; else delete state.secteurs[zone]; } save(); },
        async saveObjectifs(list) {
            for (const o of list) {
                const e = state.objectifs.find(x => x.commercial_id === o.commercial_id && x.annee === o.annee && x.mois === o.mois);
                if (e) e.montant = o.montant; else state.objectifs.push({ ...o });
            }
            save();
        },
        async listImports() { return state.imports.map(i => ({ ...i })); },
        async deleteImport(id) {
            state.imports = state.imports.filter(i => i.id !== id);
            state.ventesImportees = state.ventesImportees.filter(l => l[7] !== id); save();
        },
        async injecter(meta, lignes, onProgress) {
            const id = 'imp-' + Date.now();
            if (meta.mode === 'remplacer') state.ventesImportees = state.ventesImportees.filter(l => !meta.dates.includes(l[0]));
            for (const l of lignes) state.ventesImportees.push([l.date, l.commercial_id, l.zone, l.client, l.ca, l.marge ?? 0, l.commandes ?? 1, id, l.segment || null, l.gamme || null]);
            state.imports.unshift({ id, fichier: meta.fichier, mode: meta.mode, dates: meta.dates, date_min: meta.date_min, date_max: meta.date_max, lignes: lignes.length, montant: lignes.reduce((s, l) => s + l.ca, 0), par: 'mode démo', created_at: new Date().toISOString() });
            onProgress?.(1); save(); return id;
        },
        resetDemo() { localStorage.removeItem(DEMO_KEY); state = demoInitialState(); save(); },
    };
}
