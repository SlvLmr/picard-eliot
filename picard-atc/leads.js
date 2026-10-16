/* ============================================================
   PICARD-ATC — Lead Management
   Leads reçus → attribués → traités → validés (ou perdus), par zone, source et ATC.
   Tant que le fichier des leads n'est pas importé, la rubrique tourne sur un jeu d'exemple généré.
   Format attendu (une ligne par lead) : { date, zone, source, cible, produit, atc, statut, delai (h), montant }
   ============================================================ */

const LEAD_ETAPES = [
    { k: 'recus', nom: 'Reçus', c: '#60a5fa', aide: 'leads entrants' },
    { k: 'attribues', nom: 'Attribués', c: '#a78bfa', aide: 'confiés à un ATC' },
    { k: 'traites', nom: 'Traités', c: '#f1c587', aide: 'client contacté' },
    { k: 'valides', nom: 'Validés', c: '#34d399', aide: 'transformés en commande' },
];
const LEAD_SOURCES = ['Site internet', 'Configurateur portes', 'Téléphone / agence', 'Salons & événements', 'Prescripteurs', 'Réseaux sociaux'];
const LEAD_CIBLES = [['Particulier', .56, 'serruriers'], ['Professionnel', .3, 'menuisiers'], ['Marché / collectivité', .14, 'marches']];
const LEAD_PRODUITS = [['diamant', .4], ['serrures', .34], ['technica', .16], ['hall', .1]];
const LEAD_SEUIL_H = 48; // au-delà, un lead non traité est en alerte
const L = { map: 'volume', orig: 'sources', todo: 'alerte', zone: null, todoAll: false, demoKey: null, demo: null };
try { const p = JSON.parse(localStorage.getItem('picard_atc_leads') || '{}'); if (p.map) L.map = p.map; if (p.orig) L.orig = p.orig; } catch (e) {}
const rememberLeads = () => { try { localStorage.setItem('picard_atc_leads', JSON.stringify({ map: L.map, orig: L.orig })); } catch (e) {} };

// ─── Données : fichier importé, sinon exemple ───────────────
const leadsReels = () => !!S.base.etats?.leads?.lignes;
function leadsTous() {
    if (leadsReels()) {
        const ratt = rattacheurEtats(S.base.commerciaux);
        return S.base.etats.leads.lignes.map(l => ({ ...l, id: l.id || ratt(l.atc) }));
    }
    const key = iso(S.ref) + '|' + S.base.commerciaux.length;
    if (L.demoKey !== key) { L.demo = leadsExemple(); L.demoKey = key; }
    return L.demo;
}
// Poids des zones (bassins de population) pour l'exemple
const LEAD_POIDS = { '75': 9, '92': 6, '93': 5, '94': 5, '78': 5, '91': 4, '95': 4, '77': 4, '13': 7, '69': 7, '59': 7, '33': 5, '31': 5, '06': 5, '44': 4.5,
    '34': 4, '67': 4, '62': 4, '83': 4, '76': 4, '38': 4, '35': 3.5, '57': 3, '74': 3, '30': 2.5, '29': 2.5, '64': 2.5, '63': 2.5, '45': 2.5, '37': 2.3, '49': 2.5, '21': 2.2,
    BE: 4, CH: 2.5, LU: 1.2, '971': .7, '972': .7, '974': .9, '973': .3, '976': .2, '975': .05, '987': .2, '988': .2 };
function leadsExemple() {
    const r = seedFrom('leads-' + iso(S.ref)); const y = S.ref.getFullYear();
    const zones = CARTE.zones.map(z => z.code).filter((c, i, a) => a.indexOf(c) === i);
    const croissance = Object.fromEntries(zones.map(z => [z, .65 + r() * .8])); // zones qui chauffent ou refroidissent cette année
    const poids = (z, an) => (LEAD_POIDS[z] ?? (0.6 + r() * 1.4)) * (an === y ? croissance[z] : 1);
    const cumul = an => { let s = 0; return zones.map(z => [z, s += poids(z, an)]); };
    const tables = { [y - 1]: cumul(y - 1), [y]: cumul(y) };
    const tirage = t => { const x = r() * t.at(-1)[1]; return t.find(e => e[1] >= x)[0]; };
    const pick = list => { let x = r(); for (const [v, p] of list) { if ((x -= p) <= 0) return v; } return list[0][0]; };
    const secs = Object.fromEntries(FORCES.map(f => [f.id, zoneSecteurs(f.id)]));
    const vitesse = {}; // chaque ATC a son rythme de prise en charge
    const out = []; let n = 0;
    for (let d = new Date(y - 1, 0, 1); d <= S.ref; d = addDays(d, 1)) {
        const wd = d.getDay(); const saison = 1 + .25 * Math.sin((d.getMonth() - 2) / 12 * 2 * Math.PI);
        const nb = Math.round((wd === 0 ? 5 : wd === 6 ? 10 : 32) * saison * (0.6 + r() * .8));
        const age = (S.ref - d) / 864e5;
        for (let i = 0; i < nb; i++) {
            const zone = tirage(tables[d.getFullYear()]); const cible = pick(LEAD_CIBLES.map(c => [c, c[1]]));
            const sec = secs[cible[2]][zone]; const id = sec ? idsSecteur(sec, cible[2])[0] || null : null;
            const v = id ? (vitesse[id] ??= .5 + r() * 1.6) : 1;
            let statut = 'recu', delai = null, montant = null;
            const pTraite = age >= 7 ? .94 : age >= 2 ? .72 / v : .3 / v;
            if (id && r() < (age >= 1 ? .97 : .7)) statut = 'attribue';
            if (statut === 'attribue' && r() < pTraite) {
                statut = 'traite'; delai = Math.max(1, Math.round((3 + r() * r() * 60) * v));
                const x = r(); const pVal = age >= 12 ? .28 : .1;
                if (x < pVal) { statut = 'valide'; montant = Math.round((1200 + r() * 7800) / 10) * 10; }
                else if (x < pVal + (age >= 12 ? .24 : .06)) statut = 'perdu';
            }
            const produit = pick(LEAD_PRODUITS);
            if (montant && produit === 'serrures') montant = Math.round(montant * .35 / 10) * 10;
            out.push({ n: ++n, date: iso(d), zone, source: pick(LEAD_SOURCES.map((s, j) => [s, [.3, .14, .2, .1, .16, .1][j]])), cible: cible[0], produit, id, statut, delai, montant });
        }
    }
    return out;
}

// ─── Calculs ────────────────────────────────────────────────
const leadTraite = l => ['traite', 'valide', 'perdu'].includes(l.statut);
const leadAge = l => (S.ref - parseIso(l.date)) / 36e5; // en heures
function leadsPeriode(decalage = 0) {
    const p = pinfo(); const y = p.y - decalage; const ids = S.who ? idsFor() : null;
    const finN1 = iso(new Date(y, S.ref.getMonth(), S.ref.getDate())); // N-1 : même date, pour comparer à périmètre égal
    return leadsTous().filter(l => {
        const ly = +l.date.slice(0, 4), lm = +l.date.slice(5, 7);
        return ly === y && p.months.includes(lm) && (!decalage || lm < p.m || l.date <= finN1) && (!ids || ids.has(l.id));
    });
}
function statsLeads(ls) {
    const t = ls.filter(leadTraite); const v = ls.filter(l => l.statut === 'valide');
    const att = ls.filter(l => !leadTraite(l) && l.statut !== 'perdu');
    return {
        recus: ls.length, attribues: ls.filter(l => l.statut !== 'recu').length, traites: t.length, valides: v.length,
        perdus: ls.filter(l => l.statut === 'perdu').length, enAttente: att.length, alerte: att.filter(l => leadAge(l) > LEAD_SEUIL_H).length,
        delai: t.filter(l => l.delai != null).length ? t.reduce((s, l) => s + (l.delai || 0), 0) / t.filter(l => l.delai != null).length : null,
        ca: v.reduce((s, l) => s + (+l.montant || 0), 0),
        transfo: ls.length ? v.length / ls.length * 100 : null, tTraite: ls.length ? t.length / ls.length * 100 : null,
    };
}
const parZone = ls => { const m = new Map(); for (const l of ls) { if (!m.has(l.zone)) m.set(l.zone, []); m.get(l.zone).push(l); } return m; };
const fmtDelai = h => h == null ? '—' : h < 48 ? `${nf0.format(h)} h` : `${nf1.format(h / 24)} j`;
const delaiCls = h => h == null ? '' : h <= 24 ? 'ok' : h <= LEAD_SEUIL_H ? 'warn' : 'late';
const zoneNom = z => zoneInfo.get(z)?.nom || z;

// Synthèse : carte « Leads »
function leadsDe() {
    if (!S.base) return null;
    const s = statsLeads(leadsPeriode()); return { ...s, exemple: !leadsReels() };
}

// ─── Rendu de la rubrique ───────────────────────────────────
function renderLeads() {
    const p = pinfo(); const ls = leadsPeriode(); const n1 = leadsPeriode(1);
    const s = statsLeads(ls), s1 = statsLeads(n1); const ex = leadsReels() ? '' : exemple;
    $('#leads-sub').innerHTML = `· ${esc(nomWho())} · ${p.label} ${ex}`;
    $('#leads-banner').innerHTML = leadsReels() ? '' : `<article class="card lead-banner"><span class="lb-ico"><i class="ri-radar-line"></i></span>
        <div><b>Aperçu avec des leads d'exemple</b><p>Dès l'import de votre fichier, la rubrique se remplit toute seule. Une ligne par lead : date de réception, département ou code postal, source, type de demandeur, produit, ATC, statut (reçu, traité, validé, perdu) et, si possible, la date du premier contact et le montant.</p></div>
        <button class="cta" data-leads-import><i class="ri-upload-2-line"></i><span>Importer</span></button></article>`;
    renderLeadKpis(s, s1);
    renderFunnel(s);
    renderLeadMap(ls, n1);
    renderLeadTrend(ls, n1);
    renderLeadOrigines(ls);
    renderLeadAtc(ls);
    renderLeadTodo(ls);
}

function renderLeadKpis(s, s1) {
    const p = pinfo();
    const ev = s1.recus ? (s.recus / s1.recus - 1) * 100 : null;
    const cards = [
        { l: 'Leads reçus', v: nf0.format(s.recus), r: `${delta(ev)}<span>vs ${p.y - 1} à date</span>` },
        { l: 'Délai de prise en charge', v: fmtDelai(s.delai), k: delaiCls(s.delai), r: `<span>moyenne du 1er contact · objectif ≤ ${LEAD_SEUIL_H} h</span>` },
        { l: 'Taux de transformation', v: pct(s.transfo, { dec: 1 }), r: `<span><b class="up">${nf0.format(s.valides)} validés</b> · ${nf0.format(s.traites - s.valides - s.perdus)} encore en cours</span>` },
        { l: 'En attente', v: nf0.format(s.enAttente), k: s.alerte ? 'late' : '', r: s.alerte ? `<span><b class="down-t">${nf0.format(s.alerte)} depuis plus de ${LEAD_SEUIL_H} h</b> · <button class="lnk" data-ltodo="alerte" data-scroll="lead-todo">voir</button></span>` : '<span>aucun lead en souffrance</span>' },
    ];
    $('#leads-kpis').innerHTML = cards.map((c, i) => `<article class="card kpi ${c.k ? 'kpi-' + c.k : ''}" style="animation-delay:${i * 40}ms"><div class="kpi-top">${c.l}</div><div class="kpi-val">${c.v}</div><div class="kpi-row">${c.r}</div></article>`).join('');
}

// Entonnoir : bande continue dont l'épaisseur suit le volume de chaque étape
function renderFunnel(s) {
    const vals = LEAD_ETAPES.map(e => s[e.k]); const max = vals[0] || 1; const n = vals.length; const W = 1000, H = 120;
    const h = v => Math.max(6, v / max * (H - 8)); const seg = W / n;
    let top = '', bot = '';
    vals.forEach((v, i) => {
        const x0 = i * seg + seg * .18, x1 = (i + 1) * seg - seg * .18, y = (H - h(v)) / 2;
        if (i === 0) top += `M0 ${y}L${x1} ${y}`; else { const yp = (H - h(vals[i - 1])) / 2; const xp = i * seg - seg * .18; top += `C${(xp + x0) / 2} ${yp} ${(xp + x0) / 2} ${y} ${x0} ${y}L${i === n - 1 ? W : x1} ${y}`; }
    });
    for (let i = n - 1; i >= 0; i--) {
        const x0 = i * seg + seg * .18, x1 = (i + 1) * seg - seg * .18, y = (H + h(vals[i])) / 2;
        if (i === n - 1) bot += `L${W} ${y}L${x0} ${y}`; else { const yn = (H + h(vals[i + 1])) / 2; const xn = (i + 1) * seg + seg * .18; bot += `C${(x1 + xn) / 2} ${yn} ${(x1 + xn) / 2} ${y} ${x1} ${y}L${i === 0 ? 0 : x0} ${y}`; }
    }
    const conv = i => vals[i - 1] ? vals[i] / vals[i - 1] * 100 : null;
    $('#leads-funnel').innerHTML = `<div class="fn-head"><h3 class="perf-title">Parcours des leads <span>${pinfo().label}</span></h3>
            <span class="fn-lost"><i class="ri-close-circle-line"></i>${nf0.format(s.perdus)} perdus · ${nf0.format(s.enAttente)} en attente</span></div>
        <div class="fn-steps">${LEAD_ETAPES.map((e, i) => `<div class="fn-step" style="--c:${e.c};animation-delay:${i * 60}ms">
            ${i ? `<span class="fn-conv" title="Passage depuis l'étape précédente"><i class="ri-arrow-right-line"></i>${pct(conv(i))}</span>` : ''}
            <span class="fn-name"><i></i>${e.nom}</span><b>${nf0.format(vals[i])}</b><small>${i ? pct(vals[i] / max * 100) + ' des reçus' : e.aide}</small></div>`).join('')}</div>
        <svg class="fn-band" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="fn-grad" x1="0" x2="1">${LEAD_ETAPES.map((e, i) => `<stop offset="${(i + .5) / n}" stop-color="${e.c}"/>`).join('')}</linearGradient></defs>
            <path d="${top}${bot}Z" fill="url(#fn-grad)"/></svg>`;
}

// ─── Carte chaud / froid ────────────────────────────────────
const tempColor = t => interpolate(['#3b82f6', '#2a4677', '#2c2c33', '#8a4a22', '#fb923c'], (t + 1) / 2); // −1 froid … +1 chaud
const heatColor = t => interpolate(['#1e2a4a', '#2563eb', '#8b5cf6', '#f59e0b', '#ef4444'], t);
const LEAD_MODES = {
    volume: { nom: 'Volume', titre: 'Leads reçus', chaud: 'Zones les plus chaudes', froid: 'Zones les plus froides' },
    tendance: { nom: 'Tendance', titre: 'Évolution', chaud: 'Zones qui chauffent', froid: 'Zones qui refroidissent' },
    transfo: { nom: 'Transformation', titre: 'Taux de validation', chaud: 'Meilleure transformation', froid: 'Transformation la plus faible' },
    attente: { nom: 'En attente', titre: 'Non traités', chaud: 'Le plus de leads en attente', froid: null },
};
function zoneStats(ls, n1) {
    const a = parZone(ls), b = parZone(n1); const out = new Map();
    for (const z of new Set([...a.keys(), ...b.keys()])) {
        const s = statsLeads(a.get(z) || []); const prev = (b.get(z) || []).length;
        out.set(z, { ...s, n1: prev, evol: prev >= 5 ? (s.recus / prev - 1) * 100 : null });
    }
    return out;
}
function leadValeur(st, mode) {
    if (!st) return null;
    return mode === 'volume' ? st.recus : mode === 'tendance' ? st.evol : mode === 'transfo' ? (st.recus >= 5 ? st.transfo : null) : st.enAttente;
}
function renderLeadMap(ls, n1) {
    const svgs = [$('#lead-map'), $('#lead-idf')];
    for (const svg of svgs) if (!svg.dataset.ready) { buildMap(svg, { badges: false }); svg.dataset.ready = 1; bindLeadMap(svg); }
    const idf = zoneBox(SECTEURS.idf?.zones || ['75', '77', '78', '91', '92', '93', '94', '95']);
    if (idf) { const pad = 8; $('#lead-idf').setAttribute('viewBox', `${idf[0] - pad} ${idf[1] - pad} ${idf[2] - idf[0] + pad * 2} ${idf[3] - idf[1] + pad * 2}`); }
    const zs = zoneStats(ls, n1); L.zs = zs;
    const vals = [...zs.values()].map(st => leadValeur(st, L.map)).filter(v => v != null);
    const max = Math.max(1, ...vals.map(Math.abs));
    const fill = z => {
        const v = leadValeur(zs.get(z), L.map); if (v == null) return 'var(--zone-empty)';
        if (L.map === 'tendance') return tempColor(Math.max(-1, Math.min(1, v / 40)));
        if (L.map === 'transfo') return interpolate(['#1f2e2a', '#0f766e', '#10b981', '#a7f3d0'], Math.min(1, v / Math.max(1, ...vals)));
        if (L.map === 'attente') return v ? interpolate(['#3a2226', '#9f1239', '#f43f5e', '#fda4af'], Math.sqrt(v / max)) : 'var(--zone-empty)';
        return v ? heatColor(Math.sqrt(v / max)) : 'var(--zone-empty)';
    };
    const mine = S.who ? new Set(zonesFor()) : null; const secs = zoneSecteurs(S.force);
    for (const svg of svgs) {
        for (const p of svg.querySelectorAll('path.z')) { const z = p.dataset.zone; p.style.fill = fill(z); p.classList.toggle('dim', !!mine && !mine.has(z)); p.classList.toggle('zsel', L.zone === z); }
        for (const r of svg.querySelectorAll('.inset-box')) r.style.fill = fill(r.dataset.zone);
        svg.classList.toggle('has-sel', !!mine);
        paintBorders(svg, z => secs[z], mine ? z => mine.has(z) : null);
    }
    // Un ATC choisi : la carte se cadre sur ses secteurs (l'encart Île-de-France n'a alors plus lieu d'être)
    const box = mine && zoneBox([...mine].filter(z => zoneInfo.get(z)?.inset === undefined));
    if (box) { const pad = Math.max(box[2] - box[0], box[3] - box[1]) * .12; $('#lead-map').setAttribute('viewBox', `${box[0] - pad} ${box[1] - pad} ${box[2] - box[0] + pad * 2} ${box[3] - box[1] + pad * 2}`); }
    else $('#lead-map').setAttribute('viewBox', `0 0 ${CARTE.w} ${CARTE.h}`);
    $('.lead-idf').hidden = !!box;
    $('#lead-map').classList.toggle('cadre', !!box);
    $$('#lead-map-mode button').forEach(b => b.classList.toggle('on', b.dataset.lmap === L.map));
    const lg = $('#lead-legend');
    if (L.map === 'volume') lg.innerHTML = `<strong>Leads reçus</strong><div class="ramp" style="background:linear-gradient(90deg,${[0, .25, .5, .75, 1].map(heatColor).join(',')})"></div><div class="ramp-lbl"><span><i class="ri-snowy-line"></i> froid</span><span>chaud <i class="ri-fire-line"></i></span></div>`;
    else if (L.map === 'tendance') lg.innerHTML = `<strong>vs ${pinfo().y - 1}</strong><div class="ramp" style="background:linear-gradient(90deg,${[-1, -.5, 0, .5, 1].map(tempColor).join(',')})"></div><div class="ramp-lbl"><span>−40 %</span><span>0</span><span>+40 %</span></div>`;
    else if (L.map === 'transfo') lg.innerHTML = `<strong>Validés / reçus</strong><div class="ramp" style="background:linear-gradient(90deg,#1f2e2a,#0f766e,#10b981,#a7f3d0)"></div><div class="ramp-lbl"><span>0 %</span><span>${pct(Math.max(0, ...vals))}</span></div>`;
    else lg.innerHTML = `<strong>Leads non traités</strong><div class="ramp" style="background:linear-gradient(90deg,#3a2226,#9f1239,#f43f5e,#fda4af)"></div><div class="ramp-lbl"><span>0</span><span>${nf0.format(max)}</span></div>`;
    renderLeadSide();
}
function renderLeadSide() {
    const box = $('#lead-side'); const zs = L.zs; const M = LEAD_MODES[L.map];
    if (L.zone) {
        const st = zs.get(L.zone) || statsLeads([]); const ls = leadsPeriode().filter(l => l.zone === L.zone);
        const sec = S.zoneSect?.[L.zone] || zoneSecteurs(S.force)[L.zone]; const ids = sec ? idsSecteur(sec) : [];
        const src = Object.entries(ls.reduce((m, l) => (m[l.source] = (m[l.source] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
        box.innerHTML = `<header><h3 class="perf-title">${esc(zoneNom(L.zone))} <span>${/^\d/.test(L.zone) ? L.zone : ''}</span></h3><button class="pt-x" data-lzone="" title="Fermer"><i class="ri-close-line"></i></button></header>
            <h4>${sec ? `Secteur ${esc(SECTEURS[sec].nom)}` : 'Hors secteur'}</h4>
            ${ids.map(id => `<button class="pt-atc" data-who="${id}">${avatarWho(id)}${esc(fullName(commercial(id)))}<i class="ri-arrow-right-line"></i></button>`).join('')}
            <div class="pt-big">${nf0.format(st.recus)}<small>leads reçus · ${st.evol == null ? 'tendance non significative' : `<b class="${st.evol >= 0 ? 'ok' : 'late'}">${pct(st.evol, { sign: true })}</b> vs ${pinfo().y - 1}`}</small></div>
            <div class="pt-grid">
                <span>Traités<b>${pct(st.tTraite)}</b></span><span>Validés<b>${nf0.format(st.valides)} · ${pct(st.transfo)}</b></span>
                <span>Délai moyen<b class="${delaiCls(st.delai)}">${fmtDelai(st.delai)}</b></span><span>En attente<b class="${st.alerte ? 'late' : ''}">${nf0.format(st.enAttente)}</b></span>
                <span class="pt-wide">CA validé<b>${euros(st.ca)}</b></span>
            </div>
            ${src.length ? `<div class="pt-sep"><h5>Sources principales</h5>${src.map(([n, v]) => `<div class="pt-row"><span>${esc(n)}</span><b>${nf0.format(v)}</b></div>`).join('')}</div>` : ''}`;
        return;
    }
    const rows = [...zs].map(([z, st]) => ({ z, v: leadValeur(st, L.map), st })).filter(x => x.v != null && zoneInfo.get(x.z)?.inset === undefined && (!S.who || new Set(zonesFor()).has(x.z)));
    rows.sort((a, b) => b.v - a.v);
    const fmt = v => L.map === 'volume' || L.map === 'attente' ? nf0.format(v) : L.map === 'tendance' ? pct(v, { sign: true }) : pct(v);
    const maxV = Math.max(1, ...rows.map(x => Math.abs(x.v)));
    const liste = (xs, cls) => xs.map((x, i) => `<button class="lz-row" data-lzone="${x.z}" style="animation-delay:${i * 30}ms"><span class="lz-code ${cls}">${esc(zoneShort(x.z))}</span>
        <span class="lz-main"><span>${esc(zoneNom(x.z))}</span><span class="bar"><span class="${cls}" data-w="${Math.abs(x.v) / maxV * 100}"></span></span></span><b>${fmt(x.v)}</b></button>`).join('');
    const tend = L.map === 'tendance'; const nChaud = Math.min(5, Math.ceil(rows.length / 2));
    const chauds = rows.slice(0, nChaud).filter(x => !tend || x.v > 0);
    const froids = M.froid ? rows.slice(nChaud).reverse().slice(0, 5).filter(x => !tend || x.v < 0) : [];
    box.innerHTML = `<header><h3 class="perf-title">${M.titre} <span>par zone</span></h3></header>
        <div class="lz-block"><h5><i class="ri-fire-line hot"></i>${M.chaud}</h5>${liste(chauds, 'hot') || '<p class="muted small">Aucune zone</p>'}</div>
        ${M.froid ? `<div class="lz-block"><h5><i class="ri-snowy-line cold"></i>${M.froid}</h5>${liste(froids, 'cold') || '<p class="muted small">Aucune zone</p>'}</div>` : ''}
        <p class="pt-hint">Cliquez une zone pour son détail. Les zones « froides » sont des pistes de prospection : peu de demandes entrantes au regard du territoire.</p>`;
    growBars(box);
}
function bindLeadMap(svg) {
    const tip = $('#tip');
    svg.addEventListener('mousemove', e => {
        const t = e.target.closest('[data-zone]'); if (!t) return tip.classList.remove('show');
        const z = t.dataset.zone; const st = L.zs?.get(z);
        tip.innerHTML = `<h4>${esc(zoneNom(z))} <small class="muted">${/^\d/.test(z) ? z : ''}</small></h4>
            <div class="t-row"><span>Leads reçus</span><b>${nf0.format(st?.recus || 0)}</b></div>
            ${st ? `<div class="t-row"><span>vs ${pinfo().y - 1}</span><b>${st.evol == null ? '—' : pct(st.evol, { sign: true })}</b></div>
            <div class="t-row"><span>Traités</span><b>${pct(st.tTraite)}</b></div><div class="t-row"><span>Validés</span><b>${nf0.format(st.valides)}</b></div>
            <div class="t-row"><span>En attente</span><b>${nf0.format(st.enAttente)}</b></div>` : ''}`;
        placeTip(e);
    });
    svg.addEventListener('mouseleave', () => tip.classList.remove('show'));
    svg.addEventListener('click', e => { const t = e.target.closest('[data-zone]'); leadZone(t && L.zone !== t.dataset.zone ? t.dataset.zone : null); });
}
function leadZone(z) {
    L.zone = z || null;
    for (const p of $$('#lead-map path.z, #lead-idf path.z')) p.classList.toggle('zsel', L.zone === p.dataset.zone);
    renderLeadSide();
}

// ─── Évolution ──────────────────────────────────────────────
function renderLeadTrend(ls, n1) {
    const p = pinfo(); let labels, cle;
    if (S.period === 'annee') { labels = MOIS.map(m => m.replace('.', '')); cle = l => +l.date.slice(5, 7) - 1; }
    else if (S.period === 'trimestre') { const d0 = new Date(p.y, p.months[0] - 1, 1); const nb = Math.ceil((new Date(p.y, p.months[2], 0) - d0) / 6048e5);
        labels = [...Array(nb)].map((_, i) => 'S' + (i + 1)); cle = l => { const d = parseIso(l.date); return Math.min(nb - 1, Math.floor((new Date(p.y, d.getMonth(), d.getDate()) - d0) / 6048e5)); }; }
    else { const nj = new Date(p.y, p.m, 0).getDate(); labels = [...Array(nj)].map((_, i) => String(i + 1)); cle = l => +l.date.slice(8, 10) - 1; }
    const z = () => labels.map(() => 0);
    const ser = { valide: z(), cours: z(), perdu: z(), attente: z() }, prev = z();
    for (const l of ls) { const k = cle(l); ser[l.statut === 'valide' ? 'valide' : l.statut === 'perdu' ? 'perdu' : leadTraite(l) ? 'cours' : 'attente'][k]++; }
    for (const l of n1) prev[cle(l)]++;
    const finN1 = labels.map((_, i) => S.period === 'mois' ? null : prev[i]);
    const cols = { valide: '#34d399', cours: '#f1c587', perdu: '#4b5563', attente: '#60a5fa' };
    const noms = { valide: 'Validés', cours: 'Traités, en cours', perdu: 'Perdus', attente: 'Non traités' };
    $('#lead-trend-sub').textContent = `· ${S.period === 'annee' ? 'par mois' : S.period === 'trimestre' ? 'par semaine' : 'par jour'}`;
    $('#lead-trend-legend').innerHTML = Object.keys(cols).map(k => `<span><i class="lg-dot" style="background:${cols[k]}"></i>${noms[k]}</span>`).join('') + (S.period !== 'mois' ? legendHtml([[String(p.y - 1), css('--n1'), 1]]) : '');
    chartOf('chart-leads').setOption({
        animationDuration: 700, grid: { left: 4, right: 8, top: 14, bottom: 2, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,.03)' } },
            formatter: ps => { const i = ps[0].dataIndex; const tot = Object.keys(ser).reduce((s, k) => s + ser[k][i], 0);
                return `<b>${S.period === 'mois' ? labels[i] + ' ' + MOIS_LONG[p.m - 1] : S.period === 'annee' ? MOIS_LONG[i] : labels[i]}</b> · ${tot} leads<br>` + Object.keys(ser).filter(k => ser[k][i]).map(k => `<i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${cols[k]};margin-right:6px"></i>${noms[k]} : <b>${ser[k][i]}</b>`).join('<br>') + (finN1[i] != null ? `<br>${p.y - 1} : <b>${finN1[i]}</b>` : ''); } },
        xAxis: { type: 'category', data: labels, ...baseAxis(), splitLine: { show: false } },
        yAxis: { type: 'value', ...baseAxis(), splitNumber: 4, minInterval: 1 },
        series: [
            ...Object.keys(ser).map((k, j, a) => ({ name: noms[k], type: 'bar', stack: 'l', data: ser[k], barMaxWidth: 26, itemStyle: { color: cols[k], borderRadius: j === a.length - 1 ? [4, 4, 0, 0] : 0 } })),
            ...(S.period !== 'mois' ? [{ name: String(p.y - 1), type: 'line', data: finN1, ...smooth, lineStyle: { width: 1.4, type: [4, 4], color: css('--n1') }, itemStyle: { color: css('--n1') } }] : []),
        ],
    }, true);
}

// ─── Origine des leads ──────────────────────────────────────
function renderLeadOrigines(ls) {
    const champ = { sources: 'source', cibles: 'cible', produits: 'produit' }[L.orig];
    const g = new Map(); for (const l of ls) { const k = l[champ] || 'Non renseigné'; if (!g.has(k)) g.set(k, []); g.get(k).push(l); }
    const rows = [...g].map(([k, xs]) => ({ k, n: xs.length, s: statsLeads(xs) })).sort((a, b) => b.n - a.n);
    const max = rows[0]?.n || 1; const tot = ls.length || 1;
    $$('#lead-orig-mode button').forEach(b => b.classList.toggle('on', b.dataset.lorig === L.orig));
    $('#lead-orig').innerHTML = rows.map((x, i) => `<div class="lrow static" style="animation-delay:${i * 25}ms">
        <span class="l-main"><span class="l-name">${esc(champ === 'produit' ? gammeNom(x.k) : x.k)}</span><span class="bar"><span class="gold" data-w="${x.n / max * 100}"></span></span></span>
        <span class="l-val">${nf0.format(x.n)}<small>${pct(x.n / tot * 100)} · <b class="ok">${pct(x.s.transfo)}</b> validés</small></span></div>`).join('') || '<p class="empty">Aucun lead sur la période</p>';
    growBars($('#lead-orig'));
}

// ─── Par ATC ────────────────────────────────────────────────
function renderLeadAtc(ls) {
    const g = new Map(); for (const l of ls) { const k = l.id || ''; if (!g.has(k)) g.set(k, []); g.get(k).push(l); }
    const rows = [...g].map(([id, xs]) => ({ id, s: statsLeads(xs) })).sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1) || b.s.recus - a.s.recus);
    const n = v => v ? nf0.format(v) : '<span class="muted">—</span>';
    $('#lead-atc').innerHTML = `<table class="tbl tbl-atc"><thead><tr><th>ATC</th><th class="num">Reçus</th><th style="width:20%">Traités</th><th class="num m-hide">Délai moyen</th><th class="num">Validés</th><th class="num m-hide">Transfo.</th><th class="num">En attente</th><th class="num m-hide">CA validé</th></tr></thead><tbody>
        ${rows.map(({ id, s }, i) => { const c = id && commercial(id);
            const k = { atteinte: s.tTraite }; const st = statut(s.tTraite, S.base.reglages);
            return `<tr ${c ? `data-who="${id}"` : ''} class="${S.who === id ? 'on' : ''}" style="animation-delay:${i * 18}ms">
            <td>${c ? `<span class="cell-who">${avatarWho(id, 'sm')}<span><b>${esc(fullName(c))}</b><small>${esc(typeAtc(id))}</small></span></span>` : `<span class="cell-who"><span class="avatar sm all"><i class="ri-question-line"></i></span><span><b>Non attribués</b><small>sans ATC sur la zone</small></span></span>`}</td>
            <td class="num">${nf0.format(s.recus)}</td>
            <td><span class="cell-bar">${barHtml(k)}<b class="${st.key}">${pct(s.tTraite)}</b></span></td>
            <td class="num m-hide"><b class="${delaiCls(s.delai)}">${fmtDelai(s.delai)}</b></td>
            <td class="num">${n(s.valides)}</td><td class="num m-hide">${pct(s.transfo)}</td>
            <td class="num">${s.alerte ? `<b class="late" title="dont ${s.alerte} depuis plus de ${LEAD_SEUIL_H} h">${s.enAttente}</b>` : n(s.enAttente)}</td>
            <td class="num m-hide">${s.ca ? euros(s.ca) : '<span class="muted">—</span>'}</td></tr>`; }).join('')}
        </tbody></table>`;
    growBars($('#lead-atc'));
}

// ─── À traiter ──────────────────────────────────────────────
function renderLeadTodo(ls) {
    const att = ls.filter(l => !leadTraite(l) && l.statut !== 'perdu');
    const listes = { alerte: att.filter(l => leadAge(l) > LEAD_SEUIL_H), libres: att.filter(l => !l.id), tous: att };
    const xs = listes[L.todo].sort((a, b) => a.date.localeCompare(b.date));
    $('#lead-todo-mode').innerHTML = [['alerte', `+ de ${LEAD_SEUIL_H} h`], ['libres', 'Non attribués'], ['tous', 'Tous']].map(([k, n]) => `<button data-ltodo="${k}" class="${L.todo === k ? 'on' : ''}">${n}<span class="tab-n">${listes[k].length}</span></button>`).join('');
    $('#lead-todo-sub').textContent = `· ${nf0.format(att.length)} leads en attente`;
    const vus = L.todoAll ? xs : xs.slice(0, 12);
    const age = l => { const h = leadAge(l); const j = Math.floor(h / 24); return `<span class="age ${h > 120 ? 'late' : h > LEAD_SEUIL_H ? 'warn' : 'ok'}">${j ? `${j} j` : "aujourd'hui"}</span>`; };
    $('#lead-todo').innerHTML = !xs.length ? `<p class="empty"><i class="ri-checkbox-circle-line"></i> Rien en attente ici</p>` : `<table class="tbl tbl-cmd"><thead><tr><th>Reçu</th><th>Zone</th><th class="m-hide">Demandeur</th><th class="m-hide">Produit</th><th class="m-hide">Source</th><th>ATC</th></tr></thead><tbody>
        ${vus.map(l => { const c = l.id && commercial(l.id); return `<tr><td>${age(l)}<small class="muted"> ${dateCourte(parseIso(l.date))}</small></td>
            <td><button class="lnk" data-lzone="${l.zone}" data-scroll="lead-map">${esc(zoneNom(l.zone))}</button></td>
            <td class="m-hide">${esc(l.cible || '—')}${l.client ? `<small class="muted"> · ${esc(l.client)}</small>` : ''}</td><td class="m-hide">${esc(gammeNom(l.produit) || '—')}</td><td class="m-hide muted">${esc(l.source || '—')}</td>
            <td>${c ? `<button class="cell-who lnk" data-who="${l.id}">${avatarWho(l.id, 'xs')}${esc(fullName(c))}</button>` : '<span class="pill-free">À attribuer</span>'}</td></tr>`; }).join('')}
        </tbody></table>${xs.length > 12 ? `<button class="lnk lead-more" data-ltodo-all>${L.todoAll ? 'Réduire' : `Voir les ${xs.length - 12} autres`}<i class="ri-arrow-${L.todoAll ? 'up' : 'down'}-s-line"></i></button>` : ''}`;
}

// ─── Interactions ───────────────────────────────────────────
document.addEventListener('click', e => {
    if (e.target.closest('#admin, #login')) return;
    const m = e.target.closest('[data-lmap]'); if (m) { L.map = m.dataset.lmap; rememberLeads(); return renderLeadMap(leadsPeriode(), leadsPeriode(1)); }
    const o = e.target.closest('[data-lorig]'); if (o) { L.orig = o.dataset.lorig; rememberLeads(); return renderLeadOrigines(leadsPeriode()); }
    const t = e.target.closest('[data-ltodo]'); if (t) { L.todo = t.dataset.ltodo; L.todoAll = false; renderLeadTodo(leadsPeriode()); }
    if (e.target.closest('[data-ltodo-all]')) { L.todoAll = !L.todoAll; return renderLeadTodo(leadsPeriode()); }
    const z = e.target.closest('[data-lzone]'); if (z) leadZone(z.dataset.lzone);
    const sc = e.target.closest('[data-scroll]'); if (sc) $('#' + sc.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (e.target.closest('[data-leads-import]')) { A.tab = 'import'; $('#btn-admin').click(); }
});
