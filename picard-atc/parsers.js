/* ============================================================
   PICARD-ATC — Lecture des fichiers Picard (Excel)
   Les 3 fichiers sont lus tels qu'ils sont produits, sans réglage :
   - « Tableau commercial quotidien »     (CO 0015 A) → jours + societeMois
   - « Valorisation portefeuille »        (CO 0016 A) → portefeuille
   - « Répartition budget ATC »                       → commerciaux + atcMois
   Tout se passe dans le navigateur : le fichier n'est envoyé nulle part.
   ============================================================ */

const MOIS_FEUILLE = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
const isNum = v => typeof v === 'number' && !isNaN(v);
const serialToIso = n => { const d = new Date(Math.round((n - 25569) * 864e5)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const grid = ws => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });

function readWorkbook(buf) { return XLSX.read(buf, { type: 'array', cellDates: false }); }

// Repère le type de fichier d'après son contenu
function detectKind(wb) {
    const names = wb.SheetNames.map(norm);
    const firstCells = n => grid(wb.Sheets[wb.SheetNames[n]]).slice(0, 10).flat().filter(v => typeof v === 'string').map(norm).join(' ');
    if (names.includes('budget 2026') || names.some(n => /^budget \d{4}$/.test(n)) || firstCells(0).includes('mensuel')) return 'repartition';
    if (names.includes('01') || firstCells(0).includes('valorisation du portefeuille') || firstCells(0).includes('reste a livrer')) return 'portefeuille';
    if (names.includes('janvier') && /enregistre|tableau de bord commer/.test(firstCells(0))) return 'quotidien';
    return null;
}
const KIND_LABEL = { quotidien: 'Tableau commercial quotidien', portefeuille: 'Valorisation du portefeuille', repartition: 'Répartition budget ATC' };

function findCell(A, test, from = 0) {
    for (let r = from; r < A.length; r++) for (let c = 0; c < (A[r] || []).length; c++) if (typeof A[r][c] === 'string' && test(norm(A[r][c]))) return [r, c];
    return null;
}
const yearIn = (A, fallback) => { for (const row of A.slice(0, 8)) for (const v of row || []) { const m = typeof v === 'string' && v.match(/(20\d{2})/); if (m) return +m[1]; } return fallback; };

// ─── 1. Tableau commercial quotidien ────────────────────────
function parseQuotidien(wb) {
    const jours = [], mois = []; let annee = null;
    for (const name of wb.SheetNames) {
        const m = MOIS_FEUILLE[norm(name)]; if (!m) continue;
        const A = grid(wb.Sheets[name]);
        const h = findCell(A, s => s === 'enregistre par jour'); if (!h) continue;
        const cEnr = h[1], cFact = (A[h[0]] || []).findIndex(v => typeof v === 'string' && norm(v) === 'facture par jour');
        for (let r = h[0] + 1; r < A.length; r++) {
            const row = A[r] || [];
            if (isNum(row[0]) && row[0] > 40000 && row[0] < 70000 && isNum(row[cEnr])) {
                const d = serialToIso(row[0]); annee = annee || +d.slice(0, 4);
                jours.push({ d, enr: row[cEnr] || 0, fact: isNum(row[cFact]) ? row[cFact] : 0 });
            }
        }
        const val = (label, dr = 1, dc = 0) => { const p = findCell(A, s => s === label); return p && isNum(A[p[0] + dr]?.[p[1] + dc]) ? A[p[0] + dr][p[1] + dc] : null; };
        const info = findCell(A, s => s.startsWith('pour info'));
        const n1 = label => { if (!info) return null; const p = findCell(A, s => s === label, info[0]); return p && isNum(A[p[0]][p[1] + 1]) ? A[p[0]][p[1] + 1] : null; };
        const y = yearIn(A, annee);
        mois.push({ a: y, m, b_enr: val('budget enr'), b_fact: val('budget fact'), jours_ouvres: val('nombre de jours ouvres'), n1_enr: n1('real enr'), n1_fact: n1('real fact') });
    }
    return { annee: annee || mois[0]?.a, jours, mois };
}

// ─── 2. Valorisation du portefeuille (reste à livrer) ───────
// Chaque colonne est classée d'après son en-tête (les libellés varient légèrement d'un mois à l'autre)
function classePortefeuille(h) {
    const n = norm(h); if (!n) return null;
    const ech = /\b2\b/.test(n.replace(/[a-z]+/g, ' ')) ? 'm2' : /\b1\b/.test(n.replace(/[a-z]+/g, ' ')) ? 'm1' : 'lm';
    if (n.startsWith('portefeuille total')) {
        const g = n.includes('techni') ? 'tech' : n.includes('hall') ? 'hall' : n.includes('serrure') ? 'serr' : n.includes('diamant') ? 'diam' : n.includes('tolerie') ? 'tol' : 'total';
        return 'pf_' + g;
    }
    if (n.includes('total') && n.includes('mois')) return ech + '_total';
    if (n.includes('diamant')) return ech + '_diam';
    if (n.includes('techni')) return ech + '_tech';
    if (n.includes('hall')) return ech + '_hall';
    if (n.includes('serrure')) return 'lm_serr';
    if (n.includes('tolerie')) return 'lm_tol';
    if (n.startsWith('livrable sur le mois')) return ech + '_serr'; // « Livrable sur le mois +1 / +2 » suivent les serrures
    if (n.startsWith('mois')) return ech + '_tol';                   // « mois + 1 / + 2 » suivent la tôlerie
    return null;
}

function parsePortefeuille(wb) {
    const jours = [];
    for (const name of wb.SheetNames) {
        const A = grid(wb.Sheets[name]);
        const h = findCell(A, s => s.startsWith('portefeuille total')); if (!h) continue;
        const cols = (A[h[0]] || []).map(classePortefeuille);
        for (let r = h[0] + 1; r < A.length; r++) {
            const row = A[r] || [];
            if (!(isNum(row[0]) && row[0] > 40000 && row[0] < 70000)) continue;
            const x = { d: serialToIso(row[0]) };
            cols.forEach((k, c) => { if (k && isNum(row[c])) x[k] = row[c]; });
            if (x.pf_total) jours.push(x);
        }
    }
    jours.sort((a, b) => a.d < b.d ? -1 : 1);
    return { jours };
}

// ─── 3. Répartition budget ATC ──────────────────────────────
const LIGNES_EQUIPE = { 'atc idf': 'IDF', 'atc nord': 'NORD', 'atc ouest': 'OUEST', 'atc rhone alpes': 'RA', 'paca': 'PACA', 'atc paca': 'PACA' };
const GAMME_COL = { serrures: 'serrures', diamant: 'diamant', hall: 'hall', technica: 'technica' };

// Lit une section (MENSUEL ou CUMUL) : renvoie les lignes ATC avec leurs valeurs par gamme
function lireSection(A, start) {
    const g = A[start + 1] || [], s = A[start + 2] || [];
    // Les titres de gamme sont décalés d'une colonne par rapport aux chiffres : on s'appuie sur les colonnes « REALISE »,
    // associées dans l'ordre aux gammes nommées sur la ligne du dessus (Serrures, Diamant, Hall, Technica)
    const ordre = []; g.forEach((v, c) => { const n = norm(v); if (GAMME_COL[n]) ordre.push(GAMME_COL[n]); });
    const kTotal = s.findIndex(v => norm(v) === 'total');
    const realises = []; s.forEach((v, c) => { if (norm(v) === 'realise' && (kTotal < 0 || c < kTotal)) realises.push(c); });
    const cols = {}; ordre.forEach((k, i) => { if (realises[i] != null) cols[k] = realises[i]; });
    // R2025 : libellés Serrures / Diamant / Hall / Technica sur la ligne des sous-titres
    const kN1 = g.findIndex(v => typeof v === 'string' && norm(v).startsWith('r2025'));
    const n1 = {};
    if (kN1 >= 0) for (let c = kN1; c < s.length; c++) { const n = norm(s[c]); if (GAMME_COL[n] && n1[GAMME_COL[n]] == null) n1[GAMME_COL[n]] = c; }
    const kE = g.findIndex(v => typeof v === 'string' && norm(v) === 'eliot');
    const lignes = []; let attente = [];
    for (let r = start + 3; r < A.length; r++) {
        const nom = A[r]?.[0]; if (typeof nom !== 'string' || !nom.trim()) { if (lignes.length || attente.length) continue; else continue; }
        const n = norm(nom);
        if (n.startsWith('total general')) break;
        if (n.startsWith('total')) continue;
        const row = A[r];
        const val = c => c != null && isNum(row[c]) ? row[c] : null;
        const data = {};
        for (const [k, c] of Object.entries(cols)) {
            const qte = norm(s[c + 2]) === 'qte' ? val(c + 2) : null;
            data[k] = { r: val(c), b: val(c + 1), q: qte, n1: val(n1[k]) };
        }
        if (kE >= 0) data.eliot = { r: val(kE), b: val(kE + 1), n1: norm(s[kE + 2]) === 'r2025' ? val(kE + 2) : null };
        if (LIGNES_EQUIPE[n]) { attente.forEach(l => l.equipe = LIGNES_EQUIPE[n]); lignes.push(...attente); attente = []; continue; }
        if (n === 'direction') { lignes.push({ nom: nom.trim(), equipe: 'DIR', data }); continue; }
        if (/^dom\b|dom ?tom|outre ?mer/.test(n)) { lignes.push({ nom: nom.trim(), equipe: 'DOM', data }); continue; }
        attente.push({ nom: nom.trim(), data });
    }
    return lignes;
}

function nomPrenom(label) {
    const parts = label.trim().split(/\s+/);
    const nomParts = parts.filter(p => p === p.toUpperCase() && /[A-Z]/.test(p));
    const prenom = parts.filter(p => !nomParts.includes(p)).join(' ');
    const cap = s => s.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
    if (!nomParts.length) return { prenom: '', nom: cap(label) };
    return { prenom: prenom || '', nom: cap(nomParts.join(' ')) };
}

function parseRepartition(wb) {
    const parMois = {}; let annee = null;
    for (const name of wb.SheetNames) {
        const m = MOIS_FEUILLE[norm(name)]; if (!m) continue;
        const A = grid(wb.Sheets[name]);
        const ms = findCell(A, s => s === 'mensuel'); if (!ms) continue;
        annee = annee || yearIn(A, null);
        const cu = findCell(A, s => s === 'cumul', ms[0] + 3);
        parMois[m] = { mensuel: lireSection(A, ms[0]), cumul: cu ? lireSection(A, cu[0]) : [] };
    }
    // Personnes, dans l'ordre du fichier
    const personnes = []; const vus = new Set();
    for (const m of Object.keys(parMois).sort((a, b) => a - b)) for (const l of parMois[m].mensuel) {
        if (vus.has(l.nom)) continue; vus.add(l.nom);
        personnes.push({ code: l.nom, equipe: l.equipe || 'DIR', ...(l.equipe === 'DIR' ? { prenom: '', nom: 'Direction' } : l.equipe === 'DOM' ? { prenom: '', nom: 'DOM-TOM' } : nomPrenom(l.nom)) });
    }
    // Lignes mois × gamme ; Eliot N-1 mensuel = différence des cumuls
    const lignes = [];
    for (const m of Object.keys(parMois).map(Number)) {
        const prev = parMois[m - 1];
        for (const l of parMois[m].mensuel) {
            for (const g of [...CA_GAMMES, 'eliot']) {
                const x = l.data[g]; if (!x) continue;
                let n1 = x.n1;
                if (g === 'eliot') {
                    const cuNow = parMois[m].cumul.find(c => c.nom === l.nom)?.data.eliot?.n1;
                    const cuPrev = prev?.cumul.find(c => c.nom === l.nom)?.data.eliot?.n1;
                    n1 = cuNow != null ? cuNow - (m > 1 ? (cuPrev || 0) : 0) : null;
                }
                lignes.push({ code: l.nom, a: annee, m, g, r: x.r, b: x.b || 0, q: x.q, n1: n1 || 0 });
            }
        }
    }
    return { annee, personnes, lignes };
}
