/* ============================================================
   PICARD-ATC — États PDF quotidiens (production / ADV)
   - « Commandes non lancées en Fab et/ou non validées »  → attente
   - « Commandes par activité » (carnet en portes)          → carnet
   - « Livraison par ATC année en cours »                    → livraisons
   - « État des commandes BP validées par ATC »              → reconnu, ignoré (même carnet, trié par ATC)
   Les ATC n'y figurent que par leur nom de famille (parfois tronqué) : rattachement par nom ou alias.
   ============================================================ */

// Familles de produits des états → gamme du tableau de bord ; « 77 » = fabriqué chez Eliot, sinon chez Picard
const FAMILLES = {
    'DIAMANT': 'diamant', 'BPEG': 'diamant', 'LUNEA': 'diamant',
    'BLIND 77': 'eliot',
    'HALL 80': 'hall', 'HALL 77': 'hall',
    'TECHNICA': 'technica', 'TEK 77': 'technica',
};
const siteFamille = f => / 77$/.test(f) ? 'Eliot' : 'Picard';
const gammeFamille = f => FAMILLES[f] || null;

const ETAT_LABEL = {
    attente: 'Commandes non lancées / non validées',
    carnet: 'Carnet par activité',
    livraisons: 'Livraisons par ATC',
    encours: 'Commandes en cours par ATC',
};

// ─── Lecture du PDF : lignes de texte avec leur position ────
async function chargerPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = ok; s.onerror = () => ko(new Error('Lecteur PDF indisponible')); document.head.appendChild(s); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return window.pdfjsLib;
}
async function lignesPdf(buffer, lib) {
    lib = lib || await chargerPdfJs();
    const doc = await lib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
        const tc = await (await doc.getPage(p)).getTextContent();
        const its = tc.items.filter(i => i.str.trim()).map(i => ({ x: Math.round(i.transform[4]), y: Math.round(i.transform[5]), s: i.str.trim() }));
        its.sort((a, b) => b.y - a.y || a.x - b.x);
        let cur = null;
        for (const it of its) { if (!cur || Math.abs(cur.y - it.y) > 2) { cur = { p, y: it.y, c: [] }; out.push(cur); } cur.c.push(it); }
    }
    out.forEach(r => r.c.sort((a, b) => a.x - b.x));
    return out;
}

// ─── Outils ─────────────────────────────────────────────────
const MOIS_COURTS = { janv: 1, fevr: 2, mars: 3, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8, sept: 9, oct: 10, nov: 11, dec: 12 };
const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function dateEtat(s) { // « 15/10/2026 » ou « 17-sept.-26 » → AAAA-MM-JJ
    let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = /^(\d{1,2})-([a-zéû]+)\.?-(\d{2})$/i.exec(s); if (!m) return null;
    const mo = MOIS_COURTS[sansAccent(m[2].toLowerCase())]; if (!mo) return null;
    return `20${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
const MOIS_FR = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
function dateDuPied(rows) { // « jeudi 15 octobre 2026 » en pied de page
    for (const r of rows) for (const c of r.c) {
        const m = /(\d{1,2}) ([a-zéû]+) (\d{4})/i.exec(c.s); const mo = m && MOIS_FR[sansAccent(m[2].toLowerCase())];
        if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return null;
}
// Ligne de commande : n° de commande à gauche, suivi du n° de ligne (CD26/…, DC…, DEVIS…, ou numérique)
const estLigneCmd = r => r.c[0].x < 40 && r.c.length > 3 && r.c.some(c => c.x >= 70 && c.x < 112 && /^\d+$/.test(c.s));
const texte = (r, x0, x1) => r.c.filter(c => c.x >= x0 && c.x < x1).map(c => c.s).join(' ').replace(/\s+/g, ' ').trim();

function detecterEtat(rows) {
    const tete = rows.slice(0, 8).map(r => r.c.map(c => c.s).join(' ')).join(' ').toUpperCase();
    if (tete.includes('NON LAN') && tete.includes('VALID')) return 'attente';
    if (tete.includes('COMMANDES PAR ACTIVITE')) return 'carnet';
    if (tete.includes('LIVRAISON PAR ATC')) return 'livraisons';
    if (tete.includes('ETAT DES COMMANDES')) return 'encours';
    return null;
}

// ─── 1. Commandes non lancées / non validées ───────────────
// Bloc par ATC (son nom seul sur une ligne), puis : commande · ligne · [BLOQUE] · saisie · validée · client · réf.
// Sans date de validation : commande non validée ; avec : validée, en attente d'un délai.
function lireAttente(rows) {
    const lignes = []; let atc = '';
    for (const r of rows) {
        const c0 = r.c[0];
        if (r.c.length === 1 && c0.x < 40 && /^[A-ZÉÈ' -]{3,}$/.test(c0.s)) { atc = c0.s; continue; }
        if (!estLigneCmd(r)) continue;
        const dates = r.c.filter(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c.s));
        lignes.push({
            atc, cmd: c0.s.replace(/\s+S\d$/, ''), l: +(r.c.find(c => c.x >= 70 && c.x < 90 && /^\d+$/.test(c.s))?.s || 0),
            bloque: r.c.some(c => c.s === 'BLOQUE'),
            saisie: dateEtat(dates.find(c => c.x < 130)?.s || ''), validee: dateEtat(dates.find(c => c.x >= 130)?.s || ''),
            client: texte(r, 170, 340), ref: texte(r, 340, 2000),
        });
    }
    return { date: dateDuPied(rows), lignes };
}

// ─── 2. Carnet par activité ─────────────────────────────────
// Bloc par famille (« DIAMANT   397 »), puis : commande · ligne · ATC · client · réf · qté · désignation · validée · délai client · nouveau délai fab
function lireCarnet(rows) {
    const lignes = []; const annonces = {}; let fam = null; let prec = null;
    for (const r of rows) {
        const c0 = r.c[0];
        if (r.c.length <= 3 && c0.x < 40 && FAMILLES[c0.s] !== undefined) { fam = c0.s; const n = r.c.find(c => /^\d+$/.test(c.s)); annonces[fam] = n ? +n.s : null; continue; }
        if (r.c.length === 1 && c0.s === 'BLOQUE' && prec) { prec.bloque = true; continue; }
        if (!estLigneCmd(r) || !fam) continue;
        const dates = r.c.filter(c => c.x >= 640 && dateEtat(c.s));
        const d = x0 => dateEtat(dates.find(c => c.x >= x0 && c.x < x0 + 40)?.s || '');
        prec = {
            fam, cmd: c0.s.toUpperCase(), l: +(r.c.find(c => c.x >= 95 && c.x < 112)?.s || 0), atc: texte(r, 112, 160),
            client: texte(r, 160, 295).replace(/\bBLOQUE\b/, '').trim(), bloque: r.c.some(c => c.s === 'BLOQUE'),
            ref: texte(r, 295, 485), qte: +(r.c.find(c => c.x >= 485 && c.x < 500)?.s || 1),
            des: texte(r, 500, 640), valide: d(650), dclient: d(700), dfab: d(750),
        };
        lignes.push(prec);
    }
    return { date: dateDuPied(rows), lignes, annonces };
}

// ─── 3. Livraisons par ATC (année en cours) ────────────────
// « Mois 10  268 », puis ATC + total, puis familles + quantité
function lireLivraisons(rows) {
    const lignes = []; let annee = null, mois = null, atc = null; const totaux = {};
    for (const r of rows) {
        const s = r.c.map(c => c.s);
        if (!annee && /^20\d\d$/.test(s[0])) { annee = +s[0]; continue; }
        if (s[0] === 'Mois') { mois = +s[1]; totaux[mois] = +s[2]; continue; }
        if (!mois) continue;
        if (r.c[0].x > 120 && r.c[0].x < 200 && /^[A-ZÉÈ' -]{3,}$/.test(s[0]) && s.length === 2) { atc = s[0]; continue; }
        if (r.c[0].x >= 300 && FAMILLES[s[0]] !== undefined && /^\d+$/.test(s[1]) && atc) lignes.push({ m: mois, atc, fam: s[0], q: +s[1] });
    }
    return { date: dateDuPied(rows), annee, lignes, totaux };
}

async function lireEtatPdf(buffer, lib) {
    const rows = await lignesPdf(buffer, lib);
    const kind = detecterEtat(rows);
    if (!kind) throw new Error("Ce PDF n'est pas un des états reconnus");
    if (kind === 'encours') return { kind, data: null };
    return { kind, data: ({ attente: lireAttente, carnet: lireCarnet, livraisons: lireLivraisons })[kind](rows) };
}

// ─── Rattachement des noms des états aux fiches ATC ────────
// Ordre : alias de la fiche (ex. ASSIER), puis nom de famille exact, puis nom tronqué (SIRJACOB → SIRJACOBS).
// Si plusieurs fiches portent le même nom, on préfère celle qui n'a pas d'alias (son alias la désigne ailleurs).
function rattacheurEtats(commerciaux) {
    const N = s => sansAccent(String(s || '')).toUpperCase().replace(/[^A-Z]/g, '');
    const cache = new Map();
    return nom => {
        const k = N(nom); if (!k) return null;
        if (cache.has(k)) return cache.get(k);
        let c = commerciaux.find(x => (x.alias || []).some(a => N(a) === k));
        if (!c) { const m = commerciaux.filter(x => N(x.nom) === k); c = m.find(x => !(x.alias || []).length) || m[0]; }
        if (!c && k.length >= 6) { const m = commerciaux.filter(x => N(x.nom).startsWith(k) || (x.alias || []).some(a => N(a).startsWith(k))); if (m.length === 1) c = m[0]; }
        cache.set(k, c?.id || null); return c?.id || null;
    };
}
