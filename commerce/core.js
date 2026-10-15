/* ============================================================
   COMMERCE — Calculs partagés
   Périodes, jours ouvrés, objectifs au prorata, atterrissage,
   statuts, formats et lecture du fichier quotidien.
   ============================================================ */

// ─── Dates (toujours en heure locale, format AAAA-MM-JJ) ────
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

// Même jour un an plus tôt (29 févr. → 28 févr.)
function minusYear(d) {
    const r = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
    if (r.getMonth() !== d.getMonth()) return new Date(d.getFullYear() - 1, d.getMonth() + 1, 0);
    return r;
}

// Bornes d'une période autour de la date de référence (dernière date de données)
function periodBounds(period, ref) {
    const y = ref.getFullYear(), m = ref.getMonth();
    let debut, fin, label;
    if (period === 'mois') {
        debut = new Date(y, m, 1); fin = new Date(y, m + 1, 0);
        label = `${MOIS_LONG[m]} ${y}`;
    } else if (period === 'trimestre') {
        const q = Math.floor(m / 3);
        debut = new Date(y, q * 3, 1); fin = new Date(y, q * 3 + 3, 0);
        label = `T${q + 1} ${y}`;
    } else {
        debut = new Date(y, 0, 1); fin = new Date(y, 11, 31);
        label = `Année ${y}`;
    }
    return { period, debut, fin, ref, label, debutN1: minusYear(debut), refN1: minusYear(ref), finN1: minusYear(fin) };
}

// ─── Séries journalières ────────────────────────────────────
// rows : [[date, commercialId, ca, marge, commandes], ...]
function indexSeries(rows) {
    const byDay = new Map(); // date → { total:{}, [commercialId]:{} }
    for (const [d, c, ca, mg, nb] of rows) {
        let day = byDay.get(d);
        if (!day) { day = { total: { ca: 0, mg: 0, nb: 0 } }; byDay.set(d, day); }
        const k = c || '_';
        const e = day[k] || (day[k] = { ca: 0, mg: 0, nb: 0 });
        e.ca += +ca; e.mg += +mg; e.nb += +nb;
        day.total.ca += +ca; day.total.mg += +mg; day.total.nb += +nb;
    }
    return byDay;
}

function sumRange(byDay, debut, fin, who) {
    const s = { ca: 0, mg: 0, nb: 0 };
    const k = who || 'total';
    for (let d = new Date(debut); d <= fin; d = addDays(d, 1)) {
        const e = byDay.get(iso(d))?.[k];
        if (e) { s.ca += e.ca; s.mg += e.mg; s.nb += e.nb; }
    }
    return s;
}

// Cumul jour par jour (pour la trajectoire)
function cumulative(byDay, debut, fin, who) {
    const out = []; let acc = 0; const k = who || 'total';
    for (let d = new Date(debut); d <= fin; d = addDays(d, 1)) {
        acc += byDay.get(iso(d))?.[k]?.ca || 0;
        out.push([iso(d), acc]);
    }
    return out;
}

// ─── Objectifs ──────────────────────────────────────────────
// objectifs : [{commercial_id, annee, mois, montant}] ; ids : liste des commerciaux concernés
function objectifMois(objectifs, ids, annee, mois) {
    let s = 0;
    for (const o of objectifs) if (o.annee === annee && o.mois === mois && ids.has(o.commercial_id)) s += +o.montant;
    return s;
}

// Objectif total de la période et objectif « attendu à date » (prorata jours ouvrés)
function objectifPeriode(objectifs, ids, b) {
    let total = 0, aDate = 0;
    for (let d = new Date(b.debut.getFullYear(), b.debut.getMonth(), 1); d <= b.fin; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const o = objectifMois(objectifs, ids, d.getFullYear(), d.getMonth() + 1);
        total += o;
        const finMois = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        if (finMois <= b.ref) aDate += o;
        else if (d <= b.ref) aDate += o * workdaysBetween(d, b.ref) / Math.max(1, workdaysBetween(d, finMois));
    }
    return { total, aDate };
}

// Courbe d'objectif cumulé, jour par jour (même prorata)
function objectifCumul(objectifs, ids, debut, fin) {
    const out = []; let acc = 0; let cache = {};
    for (let d = new Date(debut); d <= fin; d = addDays(d, 1)) {
        const key = d.getFullYear() * 100 + d.getMonth();
        if (!cache[key]) {
            const finMois = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            cache[key] = objectifMois(objectifs, ids, d.getFullYear(), d.getMonth() + 1) / Math.max(1, workdaysBetween(new Date(d.getFullYear(), d.getMonth(), 1), finMois));
        }
        if (isWorkday(d)) acc += cache[key];
        out.push([iso(d), acc]);
    }
    return out;
}

// ─── Indicateurs d'une période ──────────────────────────────
function computeKpis(byDay, objectifs, ids, who, b) {
    const n = sumRange(byDay, b.debut, b.ref, who);
    const n1 = sumRange(byDay, b.debutN1, b.refN1, who);
    const n1Full = sumRange(byDay, b.debutN1, b.finN1, who);
    const obj = objectifPeriode(objectifs, ids, b);
    const atteinte = obj.total ? n.ca / obj.total * 100 : null;      // % de l'objectif de la période
    const attendu = obj.total ? obj.aDate / obj.total * 100 : null;  // % attendu à date
    const rythme = obj.aDate ? n.ca / obj.aDate * 100 : null;        // réalisé / attendu à date
    // Atterrissage : on garde le rythme actuel sur ce qui reste de l'objectif ;
    // sans objectif, projection linéaire sur les jours ouvrés.
    let projection;
    if (obj.total && obj.aDate) projection = n.ca + (obj.total - obj.aDate) * (n.ca / obj.aDate);
    else {
        const ecoules = workdaysBetween(b.debut, b.ref), total = workdaysBetween(b.debut, b.fin);
        projection = ecoules ? n.ca / ecoules * total : n.ca;
    }
    return {
        ca: n.ca, marge: n.mg, commandes: n.nb,
        tauxMarge: n.ca ? n.mg / n.ca * 100 : null,
        panier: n.nb ? n.ca / n.nb : null,
        caN1: n1.ca, evol: n1.ca ? (n.ca / n1.ca - 1) * 100 : null,
        tauxMargeN1: n1.ca ? n1.mg / n1.ca * 100 : null,
        panierN1: n1.nb ? n1.ca / n1.nb : null, commandesN1: n1.nb,
        caN1Full: n1Full.ca,
        objectif: obj.total, objectifADate: obj.aDate,
        atteinte, attendu, rythme, projection,
        ecartProjection: obj.total ? projection - obj.total : null,
    };
}

// Taux de marge visé : moyenne des objectifs de marge, pondérée par l'objectif de CA de l'année
function objectifMarge(commerciaux, objectifs, ids, annee) {
    let num = 0, den = 0;
    for (const c of commerciaux) {
        if (!ids.has(c.id) || c.objectif_marge == null || c.objectif_marge === '') continue;
        const w = objectifs.filter(o => o.commercial_id === c.id && o.annee === annee).reduce((s, o) => s + +o.montant, 0) || 1;
        num += +c.objectif_marge * w; den += w;
    }
    return den ? num / den : null;
}

// Statut selon le rythme (réalisé / attendu à date)
function statut(rythme, reglages) {
    if (rythme == null) return { key: 'none', label: 'Sans objectif', icon: 'ri-subtract-line' };
    if (rythme >= reglages.seuil_vert) return { key: 'ok', label: 'Dans les temps', icon: 'ri-checkbox-circle-fill' };
    if (rythme >= reglages.seuil_orange) return { key: 'warn', label: 'Vigilance', icon: 'ri-error-warning-fill' };
    return { key: 'late', label: 'En retard', icon: 'ri-alarm-warning-fill' };
}

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

// ─── Lecture du fichier quotidien ───────────────────────────
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Colonnes reconnues automatiquement (en-têtes usuels)
const COLONNES = {
    date: ['date', 'jour', 'date facture', 'date commande', 'date piece', 'date de facture', 'date document', 'date vente'],
    commercial: ['commercial', 'vendeur', 'representant', 'rep', 'code commercial', 'commercial code', 'nom commercial', 'technico commercial', 'attache commercial', 'agent'],
    zone: ['departement', 'dept', 'dep', 'code postal', 'cp', 'zone', 'secteur', 'canton', 'province', 'code departement', 'postal'],
    pays: ['pays', 'country', 'code pays'],
    segment: ['type client', 'type de client', 'segment', 'categorie client', 'famille client', 'typologie', 'typologie client', 'canal', 'type clientele', 'clientele'],
    gamme: ['gamme', 'gamme produit', 'famille', 'famille produit', 'famille article', 'ligne produit', 'univers', 'categorie produit', 'article famille'],
    client: ['client', 'raison sociale', 'nom client', 'customer', 'societe', 'enseigne'],
    ca: ['ca', 'ca ht', 'montant', 'montant ht', 'total ht', 'chiffre d affaires', 'chiffre affaires', 'net ht', 'ca net', 'vente ht', 'ventes'],
    marge: ['marge', 'marge brute', 'mb', 'marge ht', 'marge euros'],
    piece: ['n commande', 'num commande', 'numero commande', 'commande', 'n piece', 'piece', 'n facture', 'facture', 'numero piece', 'no commande'],
    commandes: ['nb commandes', 'nombre commandes', 'nb cde', 'commandes', 'nb'],
};

function detectColumns(headers) {
    const map = {}; const used = new Set();
    const H = headers.map(h => norm(h));
    for (const [key, syns] of Object.entries(COLONNES)) {
        let idx = H.findIndex((h, i) => !used.has(i) && syns.includes(h));
        if (idx < 0) idx = H.findIndex((h, i) => !used.has(i) && syns.some(s => s.length > 2 && (h.startsWith(s + ' ') || h.endsWith(' ' + s))));
        if (idx >= 0) { map[key] = headers[idx]; used.add(idx); }
    }
    return map;
}

function parseNumber(v) {
    if (typeof v === 'number') return v;
    if (v == null || v === '') return null;
    let s = String(v).replace(/[\s  €]/g, '').replace(/CHF|EUR/gi, '');
    if (/,\d{1,2}$/.test(s) || (s.includes(',') && !s.includes('.'))) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

function parseDate(v) {
    if (v instanceof Date && !isNaN(v)) return iso(v);
    if (typeof v === 'number' && v > 20000 && v < 80000) return iso(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4)); // série Excel
    const s = String(v ?? '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return iso(new Date(+m[1], +m[2] - 1, +m[3]));
    m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return iso(new Date(y, +m[2] - 1, +m[1])); }
    return null;
}

// Provinces belges par code postal
function provinceBE(cp) {
    if (cp < 1300) return 'BE-BRU'; if (cp < 1500) return 'BE-WBR'; if (cp < 2000) return 'BE-VBR';
    if (cp < 3000) return 'BE-VAN'; if (cp < 3500) return 'BE-VBR'; if (cp < 4000) return 'BE-VLI';
    if (cp < 5000) return 'BE-WLG'; if (cp < 6000) return 'BE-WNA'; if (cp < 6600) return 'BE-WHT';
    if (cp < 7000) return 'BE-WLX'; if (cp < 8000) return 'BE-WHT'; if (cp < 9000) return 'BE-VWV';
    return 'BE-VOV';
}
// Cantons suisses par NPA (approximation par tranches principales)
const NPA_CH = [[1200, 'CH-VD'], [1300, 'CH-GE'], [1400, 'CH-VD'], [1470, 'CH-VD'], [1700, 'CH-FR'], [1800, 'CH-FR'], [1880, 'CH-VD'], [2000, 'CH-VS'], [2400, 'CH-NE'], [2500, 'CH-NE'], [2800, 'CH-BE'], [3000, 'CH-JU'],
    [3900, 'CH-BE'], [4000, 'CH-VS'], [4100, 'CH-BS'], [4500, 'CH-BL'], [4700, 'CH-SO'], [5000, 'CH-SO'], [5700, 'CH-AG'], [6000, 'CH-AG'], [6300, 'CH-LU'], [6400, 'CH-ZG'], [6500, 'CH-SZ'], [7000, 'CH-TI'],
    [8000, 'CH-GR'], [8200, 'CH-ZH'], [8300, 'CH-SH'], [8500, 'CH-ZH'], [8600, 'CH-TG'], [8700, 'CH-ZH'], [8900, 'CH-SG'], [9000, 'CH-ZH'], [9100, 'CH-SG'], [9500, 'CH-AR'], [10000, 'CH-SG']];
const provinceCH = cp => (NPA_CH.find(([max]) => cp < max) || [0, 'CH-ZH'])[1];

// Trouve la zone de la carte à partir d'un code, d'un nom ou d'un code postal
function makeZoneResolver(zones) {
    const byCode = new Map(), byName = new Map();
    for (const z of zones) {
        byCode.set(z.code.toUpperCase(), z.code);
        byName.set(norm(z.nom), z.code);
        if (z.code.includes('-')) byCode.set(z.code.split('-')[1], z.code); // « GE », « BRU »… (ambigu, utilisé en dernier recours)
    }
    return function resolve(valeur, pays) {
        if (valeur == null || valeur === '') return null;
        const raw = String(valeur).trim();
        const p = norm(pays);
        const isBE = /^(be|bel|belgique|belgium|belgie)$/.test(p), isCH = /^(ch|che|suisse|switzerland|schweiz)$/.test(p), isLU = /^(lu|lux|luxembourg)$/.test(p);
        if (isLU || /^L-?\d{4}$/i.test(raw)) return 'LU';
        const up = raw.toUpperCase();
        if (/^(BE|CH)-[A-Z]{2,3}$/.test(up) && byCode.has(up)) return up;
        if (isCH && byCode.has('CH-' + up)) return 'CH-' + up;
        if (isBE && byCode.has('BE-' + up)) return 'BE-' + up;
        const digits = raw.replace(/\s/g, '');
        if (/^\d{4}$/.test(digits) && (isBE || isCH)) return isBE ? provinceBE(+digits) : provinceCH(+digits);
        if (/^\d{4,5}$/.test(digits) && !isBE && !isCH) { // code postal français (4 chiffres = 0 initial perdu)
            const cp = digits.padStart(5, '0');
            if (cp.startsWith('97') || cp.startsWith('98')) { const d = cp.slice(0, 3); return byCode.has(d) ? d : null; }
            if (cp.startsWith('20')) return +cp.slice(0, 3) < 202 ? '2A' : '2B';
            return byCode.has(cp.slice(0, 2)) ? cp.slice(0, 2) : null;
        }
        if (/^\d{1,3}$/.test(digits)) { const d = digits.length === 1 ? '0' + digits : digits; if (byCode.has(d)) return d; }
        if (byCode.has(up)) return byCode.get(up);
        return byName.get(norm(raw)) || null;
    };
}

function makeCommercialResolver(commerciaux) {
    const m = new Map();
    for (const c of commerciaux) {
        [c.code, c.email, `${c.prenom} ${c.nom}`, `${c.nom} ${c.prenom}`, c.nom, `${c.prenom?.[0]} ${c.nom}`, `${c.prenom?.[0]}${c.nom}`]
            .filter(Boolean).forEach(k => { const n = norm(k); if (n && !m.has(n)) m.set(n, c.id); });
    }
    return v => m.get(norm(v)) || null;
}
