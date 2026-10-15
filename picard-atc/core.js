/* ============================================================
   PICARD-ATC — Calculs partagés
   Modèle de données (issu des 3 fichiers Picard) :
   - atcMois : réalisé facturé, budget, quantités et réalisé N-1
               par ATC × mois × gamme (fichier « Répartition budget ATC »)
   - jours   : enregistré et facturé société, jour par jour
               (fichier « Tableau commercial quotidien »)
   - societeMois : budgets et réalisé N-1 société par mois
   - portefeuille : reste à livrer jour par jour, par gamme et échéance
               (fichier « Valorisation portefeuille »)
   ============================================================ */

// ─── Dates (heure locale, format AAAA-MM-JJ) ────────────────
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isWorkday = d => d.getDay() !== 0 && d.getDay() !== 6;
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function workdaysBetween(a, b) { // a et b inclus
    let n = 0;
    for (let d = new Date(a); d <= b; d = addDays(d, 1)) if (isWorkday(d)) n++;
    return n;
}

// ─── Référentiels ───────────────────────────────────────────
// Gammes du fichier : Serrures, Diamant (portes blindées), Hall, Technica (portes techniques).
// Eliot est suivi à part : il est compris dans le chiffre Serrures (le total du fichier ne l'ajoute pas).
const GAMMES = [
    { k: 'serrures', nom: 'Serrures', icon: 'ri-lock-2-line' },
    { k: 'diamant', nom: 'Portes blindées', sub: 'Diamant', icon: 'ri-shield-keyhole-line' },
    { k: 'technica', nom: 'Portes techniques', sub: 'Technica', icon: 'ri-door-lock-box-line' },
    { k: 'hall', nom: 'Portes de Hall', sub: 'Hall', icon: 'ri-building-4-line' },
    { k: 'eliot', nom: 'Eliot', sub: 'compris dans Serrures', icon: 'ri-bluetooth-connect-line' },
];
const CA_GAMMES = ['serrures', 'diamant', 'hall', 'technica'];
const gammeNom = k => GAMMES.find(g => g.k === k)?.nom || k;

const EQUIPES = [
    { code: 'IDF', nom: 'Île-de-France', couleur: '#0fb5d0' },
    { code: 'NORD', nom: 'Nord', couleur: '#5b8def' },
    { code: 'OUEST', nom: 'Ouest', couleur: '#9d8df1' },
    { code: 'RA', nom: 'Rhône-Alpes', couleur: '#00c896' },
    { code: 'PACA', nom: 'PACA', couleur: '#f2a65a' },
    { code: 'DIR', nom: 'Direction', couleur: '#8aa3ab' },
];
const equipeDe = code => EQUIPES.find(e => e.code === code) || { code, nom: code, couleur: '#8aa3ab' };

// Couleur d'un ATC : une nuance de la couleur de son équipe
function nuance(hex, i) {
    const c = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
    const f = [0, .28, -.22, .45, -.38][i % 5];
    const m = c.map(v => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)));
    return '#' + m.map(v => v.toString(16).padStart(2, '0')).join('');
}

// Zones proposées par défaut (à valider dans l'admin, onglet Secteurs), dans l'ordre des ATC du fichier
const ZONES_DEFAUT = {
    IDF: [['75', '92', '93', '94'], ['77', '91'], ['78', '95']],
    NORD: [['59', '62'], ['BE-BRU', 'BE-WBR', 'BE-VBR', 'BE-VAN', 'BE-VLI', 'BE-WLG', 'BE-WNA', 'BE-WHT', 'BE-WLX', 'BE-VWV', 'BE-VOV', 'LU'], ['80', '02', '60', '08', '51'], ['54', '55', '57', '67', '68', '88', '10', '52']],
    OUEST: [['29', '22', '56', '35'], ['44', '85', '49', '53', '72', '79', '86', '17', '16'], ['14', '50', '61', '27', '76', '28', '45', '41', '37', '36', '18']],
    RA: [['69', '01', '42', '38', '71', '21', '39', '25', '70', '90', '58', '89', '03'], ['63', '15', '43', '07', '26', '19', '23', '87'],
        ['73', '74', 'CH-GE', 'CH-VD', 'CH-VS', 'CH-NE', 'CH-FR', 'CH-JU', 'CH-BE', 'CH-BS', 'CH-BL', 'CH-SO', 'CH-AG', 'CH-LU', 'CH-ZG', 'CH-ZH', 'CH-SZ', 'CH-UR', 'CH-OW', 'CH-NW', 'CH-GL', 'CH-SH', 'CH-TG', 'CH-SG', 'CH-AR', 'CH-AI', 'CH-GR', 'CH-TI']],
    PACA: [['30', '34', '11', '66', '48', '12', '81', '31', '09', '65', '32', '82', '46', '47', '40', '64', '33', '24'], ['06', '83', '2A', '2B'], ['13', '84', '04', '05']],
    DIR: [['971', '972', '973', '974', '976', '975', '987', '988']],
};

// ─── Index des données ──────────────────────────────────────
// atcMois : [{ c, a, m, g, r, b, q, n1 }] (r = null pour un mois pas encore commencé)
function buildIndex(atcMois) {
    const idx = new Map();
    for (const x of atcMois) idx.set(`${x.c}|${x.a}|${x.m}|${x.g}`, x);
    return idx;
}

// Somme sur des ATC, des mois et des gammes
function agg(idx, ids, annee, mois, gammes = CA_GAMMES) {
    const s = { r: 0, b: 0, q: 0, n1: 0, hasR: false };
    for (const c of ids) for (const m of mois) for (const g of gammes) {
        const x = idx.get(`${c}|${annee}|${m}|${g}`); if (!x) continue;
        if (x.r != null) { s.r += +x.r; s.hasR = true; }
        s.b += +x.b || 0; s.q += +x.q || 0; s.n1 += +x.n1 || 0;
    }
    return s;
}

// Période autour de la date de référence
function periodInfo(period, ref) {
    const y = ref.getFullYear(), m = ref.getMonth() + 1;
    const months = period === 'mois' ? [m] : period === 'trimestre' ? [0, 1, 2].map(i => Math.floor((m - 1) / 3) * 3 + 1 + i) : [...Array(12)].map((_, i) => i + 1);
    const debutMois = new Date(y, m - 1, 1), finMois = new Date(y, m, 0);
    const frac = workdaysBetween(debutMois, ref) / Math.max(1, workdaysBetween(debutMois, finMois)); // part du mois en cours écoulée
    const label = period === 'mois' ? `${MOIS_LONG[m - 1]} ${y}` : period === 'trimestre' ? `T${Math.floor((m - 1) / 3) + 1} ${y}` : `Année ${y}`;
    const fin = new Date(y, months[months.length - 1], 0);
    return { period, y, m, months, frac, label, ref, fin, joursRestants: workdaysBetween(addDays(ref, 1), fin) };
}

// Indicateurs d'une sélection (ensemble d'ATC) sur une période
function kpis(D, ids, p, { carnetMois = null, gammes = CA_GAMMES } = {}) {
    const passes = p.months.filter(x => x < p.m), cur = p.months.includes(p.m) ? [p.m] : [], futurs = p.months.filter(x => x > p.m);
    const aPasse = agg(D.idx, ids, p.y, passes, gammes), aCur = agg(D.idx, ids, p.y, cur, gammes), aFut = agg(D.idx, ids, p.y, futurs, gammes);
    const realise = aPasse.r + aCur.r;
    const budget = aPasse.b + aCur.b + aFut.b;
    const budgetADate = aPasse.b + aCur.b * p.frac;
    const n1 = aPasse.n1 + aCur.n1 * p.frac; // N-1 à date comparable
    const rythme = budgetADate ? realise / budgetADate * 100 : null;
    const r = rythme == null ? 1 : Math.max(0, Math.min(2, rythme / 100));
    // Atterrissage : mois en cours = réalisé + livrable du carnet (société) ou rythme actuel (ATC) ; mois suivants = budget × rythme
    const finMoisCourant = cur.length ? (carnetMois != null ? aCur.r + carnetMois : aCur.r + aCur.b * (1 - p.frac) * r) : 0;
    const projection = aPasse.r + finMoisCourant + aFut.b * r;
    const qte = aPasse.q + aCur.q;
    return {
        realise, budget, budgetADate, n1, rythme, projection, qte,
        atteinte: budget ? realise / budget * 100 : null,
        attendu: budget ? budgetADate / budget * 100 : null,
        evol: n1 ? (realise / n1 - 1) * 100 : null,
        ecartProjection: budget ? projection - budget : null,
        reste: Math.max(0, budget - realise),
        carnet: carnetMois != null,
    };
}

// Série mensuelle d'une sélection (pour les courbes)
function serieMois(D, ids, annee, gammes = CA_GAMMES) {
    return [...Array(12)].map((_, i) => agg(D.idx, ids, annee, [i + 1], gammes));
}

// Statut selon le rythme (réalisé / attendu à date)
function statut(rythme, reglages) {
    if (rythme == null) return { key: 'none', label: 'Sans budget', icon: 'ri-subtract-line' };
    if (rythme >= reglages.seuil_vert) return { key: 'ok', label: 'Dans les temps', icon: 'ri-checkbox-circle-fill' };
    if (rythme >= reglages.seuil_orange) return { key: 'warn', label: 'Vigilance', icon: 'ri-error-warning-fill' };
    return { key: 'late', label: 'En retard', icon: 'ri-alarm-warning-fill' };
}

// Données d'exemple déterministes (blocs non alimentés par les fichiers : clients, clientèle, marge)
function seedFrom(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

// ─── Formats ────────────────────────────────────────────────
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
function euros(v, { compact = true, sign = false } = {}) {
    if (v == null || isNaN(v)) return '—';
    const s = sign && v > 0 ? '+' : '';
    const a = Math.abs(v);
    if (compact && a >= 1e6) return s + nf1.format(v / 1e6).replace(/,0$/, '') + ' M€';
    if (compact && a >= 1e4) return s + nf0.format(v / 1e3) + ' k€';
    return s + nf0.format(v) + ' €';
}
const pct = (v, { sign = false, dec = 0 } = {}) => v == null || isNaN(v) ? '—' : (sign && v > 0 ? '+' : '') + (dec ? nf1 : nf0).format(v) + ' %';
const pts = v => v == null || isNaN(v) ? '—' : (v > 0 ? '+' : '') + nf1.format(v) + ' pt';
const dateCourte = d => `${d.getDate()} ${MOIS[d.getMonth()]}`;
const dateLongue = d => `${d.getDate()} ${MOIS_LONG[d.getMonth()]} ${d.getFullYear()}`;
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
