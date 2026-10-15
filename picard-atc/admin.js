/* ============================================================
   COMMERCE — Administration
   Accès : 2 comptes (Supabase Auth). En mode démo, accès direct.
   Onglets : Injection · Commerciaux · Secteurs · Objectifs · Réglages
   ============================================================ */
const A = { tab: 'import', file: null, paint: undefined, year: null, fiche: null };
const TABS = [
    ['import', 'ri-upload-cloud-2-line', 'Injection du jour'],
    ['commerciaux', 'ri-team-line', 'Fiches ATC'],
    ['secteurs', 'ri-map-2-line', 'Secteurs'],
    ['objectifs', 'ri-focus-3-line', 'Objectifs'],
    ['reglages', 'ri-equalizer-line', 'Réglages'],
];
const PALETTE = ['#0fb5d0', '#00e3a0', '#5b8def', '#9d8df1', '#f2a65a', '#2ec4a6', '#7fb3ff', '#1aa3c9', '#7ee8c6', '#b3a6ff', '#f28fa8', '#8aa3ab'];

function openModal(id) { const m = $('#' + id); m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); }
function closeModal(id) { const m = $('#' + id); m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }

async function openAdmin() {
    S.session = await S.store.session();
    if (!S.session.isAdmin) { $('#login-error').hidden = true; openModal('login'); setTimeout(() => $('#login-form [name=email]').focus(), 60); return; }
    $('#admin-user').textContent = S.session.email;
    $('#btn-logout').hidden = S.store.mode === 'demo';
    openModal('admin'); renderAdmin();
}

function setStatus(state, msg) {
    const el = $('#admin-status'); el.className = state;
    el.innerHTML = { saving: '<i class="ri-loader-4-line"></i> Enregistrement…', saved: '<i class="ri-check-line"></i> Enregistré', error: `<i class="ri-error-warning-line"></i> ${esc(msg || 'Erreur')}` }[state] || '<i class="ri-save-3-line"></i> Enregistrement automatique';
}
async function save(fn) {
    setStatus('saving');
    try { await fn(); setStatus('saved'); clearTimeout(save.t); save.t = setTimeout(() => setStatus(''), 2000); }
    catch (e) { setStatus('error', e.message); throw e; }
}
// Recharge le tableau de bord en arrière-plan après une modification
let dashT; function dirty() { clearTimeout(dashT); dashT = setTimeout(() => refresh(), 500); }

function renderAdmin() {
    $('#admin-tabs').innerHTML = TABS.map(([k, i, l]) => `<button data-tab="${k}" class="${A.tab === k ? 'on' : ''}"><i class="${i}"></i>${l}</button>`).join('');
    ({ import: tabImport, commerciaux: tabCommerciaux, secteurs: tabSecteurs, objectifs: tabObjectifs, reglages: tabReglages })[A.tab]();
}

// ═══ 1. Injection du fichier quotidien ═══════════════════════
function tabImport() {
    $('#admin-body').innerHTML = `
        <p class="a-intro">Déposez le <b>fichier des ventes</b> (Excel ou CSV). Les colonnes sont reconnues automatiquement ; vous vérifiez l'aperçu, puis vous injectez.
        Par défaut, les ventes des <b>jours présents dans le fichier sont remplacées</b> : vous pouvez réinjecter un fichier corrigé sans créer de doublon.
        <a href="modele-import.csv" download>Télécharger le modèle de fichier</a>.</p>
        <label class="drop" id="drop">
            <span class="drop-ico"><i class="ri-file-excel-2-line"></i></span>
            <strong>Glissez votre fichier ici</strong>
            <span class="muted">ou cliquez pour le choisir · .xlsx, .xls, .csv</span>
            <input type="file" id="file-in" accept=".xlsx,.xls,.csv,.txt">
        </label>
        <div id="preview"></div>
        <div class="a-section" style="margin-top:26px"><h3><i class="ri-history-line"></i>Dernières injections</h3><div id="imports" class="tbl-wrap"><div class="empty">Chargement…</div></div></div>`;
    const drop = $('#drop');
    $('#file-in').addEventListener('change', e => e.target.files[0] && readFile(e.target.files[0]));
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]));
    if (A.file) renderPreview();
    renderImports();
}

async function readFile(file) {
    if (!window.XLSX) { setStatus('error', 'Lecteur Excel indisponible (connexion internet ?)'); return; }
    try {
        const buf = await file.arrayBuffer();
        const texte = /\.(csv|txt)$/i.test(file.name);
        // CSV : on garde le texte brut (décimales à la française « 712,80 ») et on le convertit nous-mêmes
        const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: texte, codepage: 65001 });
        const sh = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sh, { defval: '', raw: true });
        if (!rows.length) throw new Error('Le fichier est vide.');
        const headers = Object.keys(rows[0]);
        A.file = { name: file.name, rows, headers, map: detectColumns(headers), mode: 'remplacer', dateDefaut: iso(lastWorkday()), alias: {} };
        renderPreview();
    } catch (e) { setStatus('error', 'Lecture impossible : ' + e.message); }
}
function lastWorkday() { let d = addDays(new Date(), -1); while (!isWorkday(d)) d = addDays(d, -1); return d; }

// Transforme les lignes du fichier en ventes agrégées (date × commercial × zone × client)
function buildLines() {
    const f = A.file; const m = f.map;
    const resolveZone = makeZoneResolver(CARTE.zones);
    const resolveCom = makeCommercialResolver(S.base.commerciaux);
    // Gamme : on rapproche le libellé du fichier de la liste des gammes (sans tenir compte des accents ni des majuscules)
    const gammes = new Map((S.base.reglages.gammes || []).map(g => [norm(g), g]));
    const resolveGamme = v => { const n = norm(v); if (!n) return ''; if (gammes.has(n)) return gammes.get(n); for (const [k, g] of gammes) if (n.includes(k) || k.includes(n)) return g; return String(v).trim(); };
    const agg = new Map(); const pieces = new Map();
    const stats = { lignes: 0, rejet: 0, sansCom: new Map(), sansZone: new Map(), dates: new Set(), ca: 0 };
    for (const r of f.rows) {
        const ca = parseNumber(m.ca ? r[m.ca] : null);
        if (ca == null) { stats.rejet++; continue; }
        const date = m.date ? parseDate(r[m.date]) : f.dateDefaut;
        if (!date) { stats.rejet++; continue; }
        const zoneRaw = m.zone ? r[m.zone] : '';
        const zone = resolveZone(zoneRaw, m.pays ? r[m.pays] : '');
        if (zoneRaw !== '' && !zone) stats.sansZone.set(String(zoneRaw), (stats.sansZone.get(String(zoneRaw)) || 0) + 1);
        const comRaw = m.commercial ? String(r[m.commercial] ?? '').trim() : '';
        let com = comRaw ? (f.alias[comRaw] ?? resolveCom(comRaw)) : null;
        if (!com && zone && f.alias[comRaw] !== '') com = S.base.secteurs[zone] || null; // à défaut, le titulaire du secteur
        if (!com) stats.sansCom.set(comRaw || '(vide)', (stats.sansCom.get(comRaw || '(vide)') || 0) + 1);
        const client = m.client ? String(r[m.client] ?? '').trim() : '';
        const segment = m.segment ? String(r[m.segment] ?? '').trim() : '';
        const gamme = m.gamme ? resolveGamme(r[m.gamme]) : '';
        const key = [date, com, zone, client, segment, gamme].join('|');
        const e = agg.get(key) || agg.set(key, { date, commercial_id: com, zone, client: client || null, segment: segment || null, gamme: gamme || null, ca: 0, marge: m.marge ? 0 : null, commandes: 0 }).get(key);
        e.ca += ca;
        if (m.marge) e.marge += parseNumber(r[m.marge]) || 0;
        if (m.piece) { const set = pieces.get(key) || pieces.set(key, new Set()).get(key); set.add(String(r[m.piece])); }
        else e.commandes += m.commandes ? (parseNumber(r[m.commandes]) || 0) : 1;
        stats.lignes++; stats.ca += ca; stats.dates.add(date);
    }
    for (const [k, set] of pieces) agg.get(k).commandes = set.size;
    const lignes = [...agg.values()].map(l => ({ ...l, ca: Math.round(l.ca * 100) / 100, marge: l.marge == null ? null : Math.round(l.marge * 100) / 100 }));
    return { lignes, stats };
}

function renderPreview() {
    const f = A.file; const { lignes, stats } = buildLines();
    const dates = [...stats.dates].sort();
    const opts = sel => `<option value="">— aucune —</option>` + f.headers.map(h => `<option ${h === sel ? 'selected' : ''}>${esc(h)}</option>`).join('');
    const LBL = { date: 'Date', commercial: 'Commercial', zone: 'Département / CP / zone', pays: 'Pays', client: 'Client', segment: 'Type de clientèle', gamme: 'Gamme produit', ca: 'CA HT *', marge: 'Marge', piece: 'N° de commande', commandes: 'Nb de commandes' };
    const coms = [...stats.sansCom.entries()].sort((a, b) => b[1] - a[1]);
    $('#preview').innerHTML = `<div class="preview">
        <div class="a-row" style="justify-content:space-between"><h3 style="font-size:15px"><i class="ri-file-list-3-line"></i> ${esc(f.name)} <span class="muted" style="font-weight:500">· ${f.rows.length} lignes lues</span></h3>
            <button class="btn btn-ghost btn-sm" id="pv-cancel"><i class="ri-close-line"></i>Annuler</button></div>
        <div class="pv-stats">
            <div class="pv-stat"><small>Chiffre d'affaires</small><strong>${euros(stats.ca, { compact: false })}</strong></div>
            <div class="pv-stat"><small>Période</small><strong>${dates.length ? (dates.length === 1 ? dateCourte(parseIso(dates[0])) : `${dateCourte(parseIso(dates[0]))} → ${dateCourte(parseIso(dates.at(-1)))}`) : '—'}</strong></div>
            <div class="pv-stat"><small>Lignes retenues</small><strong>${stats.lignes}</strong></div>
            <div class="pv-stat ${stats.rejet ? 'warn' : ''}"><small>Lignes ignorées</small><strong>${stats.rejet}</strong></div>
            <div class="pv-stat ${coms.length ? 'warn' : ''}"><small>Sans commercial</small><strong>${coms.reduce((s, c) => s + c[1], 0)}</strong></div>
            <div class="pv-stat ${stats.sansZone.size ? 'warn' : ''}"><small>Zones inconnues</small><strong>${stats.sansZone.size}</strong></div>
        </div>
        <div class="a-section"><h3><i class="ri-table-line"></i>Colonnes du fichier</h3>
            <div class="map-cols">${Object.keys(LBL).map(k => `<label class="field">${LBL[k]}<select data-col="${k}">${opts(f.map[k])}</select></label>`).join('')}
            ${f.map.date ? '' : `<label class="field">Date des ventes<input type="date" id="pv-date" value="${f.dateDefaut}"></label>`}</div>
        </div>
        ${coms.length ? `<div class="a-section"><h3><i class="ri-user-unfollow-line"></i>Commerciaux non reconnus</h3>
            <div class="map-cols">${coms.map(([n, c]) => `<label class="field">${esc(n)} <span class="muted">(${c} ligne${c > 1 ? 's' : ''})</span>
                <select data-alias="${esc(n)}"><option value="">Non attribué</option>${S.base.commerciaux.map(x => `<option value="${x.id}" ${f.alias[n] === x.id ? 'selected' : ''}>${esc(fullName(x))}</option>`).join('')}</select></label>`).join('')}</div></div>` : ''}
        ${stats.sansZone.size ? `<p class="muted"><i class="ri-map-pin-line"></i> Zones non reconnues (ventes comptées mais hors carte) : ${[...stats.sansZone.keys()].slice(0, 12).map(esc).join(', ')}${stats.sansZone.size > 12 ? '…' : ''}</p>` : ''}
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Commercial</th><th>Zone</th><th>Client</th><th class="num">CA HT</th><th class="num">Marge</th><th class="num">Cdes</th></tr></thead><tbody>
            ${lignes.slice(0, 40).map(l => `<tr class="${l.commercial_id ? '' : 'bad'}"><td>${dateCourte(parseIso(l.date))}</td><td>${l.commercial_id ? esc(fullName(commercial(l.commercial_id))) : 'Non attribué'}</td><td>${esc(zoneInfo.get(l.zone)?.nom || '—')}</td><td>${esc(l.client || '—')}</td><td class="num">${euros(l.ca, { compact: false })}</td><td class="num">${l.marge == null ? '—' : euros(l.marge, { compact: false })}</td><td class="num">${l.commandes}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="a-row" style="justify-content:space-between">
            <div class="a-row">
                <label class="switch"><input type="radio" name="pv-mode" value="remplacer" ${f.mode === 'remplacer' ? 'checked' : ''}> Remplacer les ventes des ${dates.length} jour${dates.length > 1 ? 's' : ''} du fichier</label>
                <label class="switch"><input type="radio" name="pv-mode" value="ajouter" ${f.mode === 'ajouter' ? 'checked' : ''}> Ajouter aux ventes existantes</label>
            </div>
            <button class="btn btn-primary" id="pv-go" ${lignes.length ? '' : 'disabled'}><i class="ri-rocket-2-line"></i>Injecter ${lignes.length} ligne${lignes.length > 1 ? 's' : ''}</button>
        </div>
        <div class="progress" id="pv-progress" hidden><span></span></div>
    </div>`;
    $$('#preview [data-col]').forEach(s => s.addEventListener('change', () => { f.map[s.dataset.col] = s.value || undefined; renderPreview(); }));
    $$('#preview [data-alias]').forEach(s => s.addEventListener('change', () => { f.alias[s.dataset.alias] = s.value || ''; renderPreview(); }));
    $('#pv-date')?.addEventListener('change', e => { f.dateDefaut = e.target.value; renderPreview(); });
    $$('#preview [name=pv-mode]').forEach(r => r.addEventListener('change', () => f.mode = r.value));
    $('#pv-cancel').onclick = () => { A.file = null; $('#preview').innerHTML = ''; };
    $('#pv-go').onclick = () => inject(lignes, dates);
}

async function inject(lignes, dates) {
    const f = A.file; const btn = $('#pv-go'); btn.disabled = true; btn.innerHTML = '<i class="ri-loader-4-line"></i>Injection…';
    const bar = $('#pv-progress'); bar.hidden = false;
    try {
        await save(() => S.store.injecter({ fichier: f.name, mode: f.mode, dates, date_min: dates[0], date_max: dates.at(-1) }, lignes, p => $('span', bar).style.width = (p * 100) + '%'));
        A.file = null; $('#preview').innerHTML = '';
        toast(`${lignes.length} lignes injectées · ${euros(lignes.reduce((s, l) => s + l.ca, 0))}`, 'ri-rocket-2-fill');
        renderImports(); dirty();
    } catch (e) { btn.disabled = false; btn.innerHTML = '<i class="ri-rocket-2-line"></i>Réessayer'; }
}

async function renderImports() {
    const list = await S.store.listImports();
    $('#imports').innerHTML = list.length ? `<table class="tbl"><thead><tr><th>Injecté</th><th>Fichier</th><th>Jours</th><th>Mode</th><th class="num">Lignes</th><th class="num">CA HT</th><th>Par</th><th></th></tr></thead><tbody>
        ${list.map(i => `<tr><td>${relative(new Date(i.created_at))}</td><td>${esc(i.fichier || '—')}</td><td>${i.date_min ? dateCourte(parseIso(i.date_min)) + (i.date_max && i.date_max !== i.date_min ? ' → ' + dateCourte(parseIso(i.date_max)) : '') : '—'}</td>
            <td><span class="pill ${i.mode === 'remplacer' ? 'ok' : ''}">${i.mode === 'remplacer' ? 'Remplace' : 'Ajout'}</span></td><td class="num">${i.lignes}</td><td class="num">${euros(+i.montant)}</td><td>${esc(i.par || '')}</td>
            <td><button class="btn btn-danger btn-sm" data-del-import="${i.id}" title="Retirer les ventes de cette injection"><i class="ri-delete-bin-6-line"></i></button></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><i class="ri-inbox-line"></i>Aucune injection pour l\'instant</div>';
    $$('[data-del-import]').forEach(b => b.onclick = async () => {
        if (!confirm('Retirer cette injection et toutes ses ventes ?')) return;
        await save(() => S.store.deleteImport(b.dataset.delImport)); renderImports(); dirty();
    });
}

// ═══ 2. Commerciaux : liste + fiche ATC ══════════════════════
function tabCommerciaux() {
    const list = S.base.commerciaux;
    if (!list.find(c => c.id === A.fiche)) A.fiche = list[0]?.id || null;
    $('#admin-body').innerHTML = `<div class="atc">
        <aside class="atc-list">
            <button class="btn btn-primary btn-block" id="add-com"><i class="ri-user-add-line"></i>Ajouter un ATC</button>
            <div class="atc-items">${list.map((c, i) => `<button class="atc-item ${c.id === A.fiche ? 'on' : ''} ${c.actif === false ? 'off' : ''}" data-fiche="${c.id}" style="animation-delay:${i * 20}ms">
                <span class="avatar" style="--c:${c.couleur}">${esc(initials(c))}</span>
                <span class="ti-text"><strong>${esc(fullName(c))}</strong><small>${esc(c.fonction || 'Fonction ?')} · ${zonesOf(c.id).length} zones</small></span></button>`).join('')}</div>
        </aside>
        <section class="fiche" id="fiche"></section></div>`;
    $$('[data-fiche]').forEach(b => b.onclick = () => { A.fiche = b.dataset.fiche; tabCommerciaux(); });
    $('#add-com').onclick = async () => {
        const used = new Set(list.map(c => c.couleur));
        const c = { prenom: 'Nouveau', nom: 'ATC', couleur: PALETTE.find(p => !used.has(p)) || PALETTE[list.length % PALETTE.length], actif: true, ordre: list.length, fonction: 'ATC', clientele: [] };
        await save(async () => { const saved = await S.store.saveCommercial(c); S.base.commerciaux.push(saved); A.fiche = saved.id; });
        tabCommerciaux(); dirty(); $('#fiche [data-f=prenom]')?.select();
    };
    if (A.fiche) renderFiche(list.find(c => c.id === A.fiche));
    else $('#fiche').innerHTML = '<div class="empty"><i class="ri-user-add-line"></i>Ajoutez votre premier ATC</div>';
}

function renderFiche(c) {
    const reg = S.base.reglages; const y = A.year || S.ref.getFullYear(); A.year = y;
    const list = S.base.commerciaux; const i = list.indexOf(c);
    const obj = m => S.base.objectifs.find(o => o.commercial_id === c.id && o.annee === y && o.mois === m)?.montant || 0;
    const real = m => sumRange(S.byDay, new Date(y - 1, m - 1, 1), new Date(y - 1, m, 0), c.id).ca;
    const annuel = [...Array(12)].reduce((s, _, m) => s + +obj(m + 1), 0);
    const zones = zonesOf(c.id);
    const pays = [...new Set(zones.map(z => zoneInfo.get(z)?.pays))].map(p => ({ FR: 'France', BE: 'Belgique', LU: 'Luxembourg', CH: 'Suisse' }[p])).filter(Boolean);
    const types = [...new Set([...(reg.types_clientele || []), ...(c.clientele || [])])];
    const fonctions = [...new Set([...(reg.fonctions || []), ...(c.fonction ? [c.fonction] : [])])];
    $('#fiche').innerHTML = `
        <header class="fiche-head" style="--c:${c.couleur}">
            <label class="fiche-color" title="Couleur de l'ATC sur la carte"><input type="color" value="${c.couleur}" data-f="couleur"><span class="avatar lg" style="--c:${c.couleur}">${esc(initials(c))}</span><i class="ri-palette-line"></i></label>
            <div class="fiche-id"><h3>${esc(fullName(c))}</h3><p>${esc(c.fonction || '')}${c.code ? ' · code ' + esc(c.code) : ''}</p></div>
            <label class="switch"><input type="checkbox" data-f="actif" ${c.actif !== false ? 'checked' : ''}> Actif</label>
        </header>

        <div class="fiche-grid">
        <div class="f-block"><h4><i class="ri-id-card-line"></i>Identité</h4>
            <div class="f-fields">
                <label class="field">Prénom<input data-f="prenom" value="${esc(c.prenom)}"></label>
                <label class="field">Nom<input data-f="nom" value="${esc(c.nom)}"></label>
                <label class="field">Fonction<select data-f="fonction"><option value="">—</option>${fonctions.map(f => `<option ${f === c.fonction ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
                <label class="field">Code dans le fichier<input data-f="code" value="${esc(c.code || '')}" placeholder="ex. CLA"></label>
                <label class="field">E-mail<input type="email" data-f="email" value="${esc(c.email || '')}"></label>
                <label class="field">Téléphone<input data-f="telephone" value="${esc(c.telephone || '')}"></label>
            </div></div>

        <div class="f-block"><h4><i class="ri-user-heart-line"></i>Type de clientèle</h4>
            <p class="muted f-help">Les clientèles que cet ATC développe. Elles apparaissent sur sa page et sont repérées dans la vue « Par clientèle ».</p>
            <div class="chips-pick">${types.map(t => `<button class="chip ${c.clientele?.includes(t) ? 'on' : ''}" data-clientele="${esc(t)}"><i class="${c.clientele?.includes(t) ? 'ri-check-line' : 'ri-add-line'}"></i>${esc(t)}</button>`).join('')}</div>
            <div class="a-row" style="margin-top:10px"><input id="new-type" placeholder="Autre type de clientèle…" style="flex:1"><button class="btn btn-sm" id="add-type"><i class="ri-add-line"></i>Ajouter</button></div>
        </div>

        <div class="f-block f-wide"><h4><i class="ri-focus-3-line"></i>Objectifs <span class="seg seg-sm" id="fiche-year">${[y - 1, y, y + 1].map(a => `<button data-y="${a}" class="${a === y ? 'on' : ''}">${a}</button>`).join('')}<span class="seg-glider"></span></span></h4>
            <div class="f-goals">
                <label class="field goal-big">Chiffre d'affaires annuel HT<span class="a-row"><input type="number" step="1000" min="0" id="f-annuel" value="${Math.round(annuel)}"><span class="muted">€</span></span>
                    <span class="muted f-help">Réalisé ${y - 1} : <b>${euros([...Array(12)].reduce((s, _, m) => s + real(m + 1), 0))}</b></span></label>
                <div class="a-row"><button class="btn btn-sm" id="f-split"><i class="ri-git-branch-line"></i>Répartir selon la saisonnalité ${y - 1}</button>
                    <span class="muted">ou</span><button class="btn btn-sm" id="f-n1">Réalisé ${y - 1} +</button><input type="number" id="f-pct" value="5" style="width:70px"><span class="muted">%</span></div>
                <label class="field goal-big">Taux de marge visé<span class="a-row"><input type="number" class="pct" step="0.5" min="0" max="100" data-f="objectif_marge" value="${c.objectif_marge ?? ''}" placeholder="ex. 35"><span class="muted">%</span></span></label>
            </div>
            <div class="f-months" id="f-months">${MOIS.map((m, k) => `<label class="f-month"><span class="mb"><i style="height:${annuel ? Math.round(obj(k + 1) / Math.max(...[...Array(12)].map((_, j) => +obj(j + 1) || 1)) * 100) : 0}%"></i></span><span>${m}</span><input type="number" step="500" min="0" data-m="${k + 1}" value="${Math.round(obj(k + 1))}" title="Réalisé ${MOIS_LONG[k]} ${y - 1} : ${euros(real(k + 1))}"></label>`).join('')}</div>
        </div>

        <div class="f-block"><h4><i class="ri-map-2-line"></i>Secteur</h4>
            <p class="f-big"><b>${zones.length}</b> zone${zones.length > 1 ? 's' : ''}${pays.length ? ' · ' + pays.join(', ') : ''}</p>
            <p class="muted f-help">${zones.slice(0, 18).map(z => esc(zoneInfo.get(z)?.nom || z)).join(', ')}${zones.length > 18 ? '…' : ''}</p>
            <button class="btn" id="f-paint"><i class="ri-brush-line"></i>Modifier ses zones sur la carte</button>
        </div>

        <div class="f-block"><h4><i class="ri-sticky-note-line"></i>Notes</h4>
            <textarea data-f="notes" rows="5" placeholder="Priorités, comptes clés, plan d'action…" style="width:100%;resize:vertical">${esc(c.notes || '')}</textarea>
        </div>
        </div>

        <footer class="fiche-foot">
            <span class="a-row"><button class="btn btn-sm" data-move="-1" ${i ? '' : 'disabled'}><i class="ri-arrow-up-line"></i>Monter</button>
            <button class="btn btn-sm" data-move="1" ${i < list.length - 1 ? '' : 'disabled'}><i class="ri-arrow-down-line"></i>Descendre</button></span>
            <button class="btn btn-danger btn-sm" id="f-del"><i class="ri-delete-bin-6-line"></i>Supprimer cet ATC</button>
        </footer>`;
    moveGlider($('#fiche-year'));
    const fiche = $('#fiche'); let t;
    const persist = () => { clearTimeout(t); t = setTimeout(() => save(() => S.store.saveCommercial(c)).then(dirty), 450); };
    fiche.oninput = e => {
        const f = e.target.dataset.f; if (!f) return;
        c[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? (e.target.value === '' ? null : +e.target.value) : e.target.value;
        if (f === 'couleur') { $$('.fiche-head .avatar, .atc-item.on .avatar').forEach(a => a.style.setProperty('--c', c.couleur)); }
        if (f === 'prenom' || f === 'nom') { $('.fiche-id h3').textContent = fullName(c); $('.atc-item.on strong').textContent = fullName(c); }
        persist();
    };
    fiche.onchange = e => { if (e.target.dataset.f === 'fonction' || e.target.dataset.f === 'couleur') tabCommerciaux(); };
    $$('[data-clientele]', fiche).forEach(b => b.onclick = () => {
        const v = b.dataset.clientele; const set = new Set(c.clientele || []);
        set.has(v) ? set.delete(v) : set.add(v); c.clientele = [...set]; persist(); renderFiche(c);
    });
    $('#add-type').onclick = async () => {
        const v = $('#new-type').value.trim(); if (!v) return;
        c.clientele = [...new Set([...(c.clientele || []), v])];
        if (!(reg.types_clientele || []).includes(v)) { reg.types_clientele = [...(reg.types_clientele || []), v]; save(() => S.store.saveReglages({ types_clientele: reg.types_clientele })); }
        persist(); renderFiche(c);
    };
    $('#new-type').addEventListener('keydown', e => { if (e.key === 'Enter') $('#add-type').click(); });
    $$('#fiche-year button').forEach(b => b.onclick = () => { A.year = +b.dataset.y; renderFiche(c); });
    const put = rows => { for (const o of rows) { const e = S.base.objectifs.find(x => x.commercial_id === o.commercial_id && x.annee === o.annee && x.mois === o.mois); if (e) e.montant = o.montant; else S.base.objectifs.push(o); } return save(() => S.store.saveObjectifs(rows)).then(dirty); };
    const split = total => { const base = [...Array(12)].map((_, m) => real(m + 1)); const sum = base.reduce((a, b) => a + b, 0);
        return base.map((v, m) => ({ commercial_id: c.id, annee: y, mois: m + 1, montant: Math.round(total * (sum ? v / sum : 1 / 12) / 100) * 100 })); };
    $('#f-annuel').addEventListener('change', e => put(split(+e.target.value || 0)).then(() => renderFiche(c)));
    $('#f-split').onclick = () => put(split(+$('#f-annuel').value || 0)).then(() => renderFiche(c));
    $('#f-n1').onclick = () => { const k = 1 + (+$('#f-pct').value || 0) / 100; put([...Array(12)].map((_, m) => ({ commercial_id: c.id, annee: y, mois: m + 1, montant: Math.round(real(m + 1) * k / 100) * 100 }))).then(() => renderFiche(c)); };
    $$('#f-months [data-m]').forEach(inp => inp.addEventListener('change', () => put([{ commercial_id: c.id, annee: y, mois: +inp.dataset.m, montant: Math.max(0, +inp.value || 0) }]).then(() => renderFiche(c))));
    $('#f-paint').onclick = () => { A.paint = c.id; A.tab = 'secteurs'; renderAdmin(); };
    $('#f-del').onclick = async () => {
        if (!confirm(`Supprimer ${fullName(c)} ? Ses secteurs seront libérés et ses objectifs supprimés. Ses ventes restent dans l'historique, sans commercial.`)) return;
        await save(() => S.store.deleteCommercial(c.id));
        S.base.commerciaux = list.filter(x => x.id !== c.id);
        for (const z in S.base.secteurs) if (S.base.secteurs[z] === c.id) delete S.base.secteurs[z];
        A.fiche = null; tabCommerciaux(); dirty();
    };
    $$('[data-move]', fiche).forEach(b => b.onclick = async () => {
        const j = i + +b.dataset.move; [list[i], list[j]] = [list[j], list[i]];
        list.forEach((x, k) => x.ordre = k);
        await save(() => Promise.all([list[i], list[j]].map(x => S.store.saveCommercial(x))));
        tabCommerciaux(); dirty();
    });
}

// ═══ 3. Secteurs : on peint la carte ═════════════════════════
function tabSecteurs() {
    if (A.paint === undefined) A.paint = S.base.commerciaux[0]?.id ?? null;
    $('#admin-body').innerHTML = `<p class="a-intro">Choisissez un commercial, puis <b>cliquez ou glissez</b> sur la carte pour lui attribuer des zones. La gomme libère une zone. Chaque clic est enregistré.</p>
        <div class="paint">
            <div><div class="palette" id="palette"></div>
                <div class="paint-tools">
                    <button class="btn btn-sm" data-bulk="BE"><i class="ri-checkbox-multiple-line"></i>Belgique</button>
                    <button class="btn btn-sm" data-bulk="CH"><i class="ri-checkbox-multiple-line"></i>Suisse</button>
                    <button class="btn btn-sm" data-bulk="LU"><i class="ri-checkbox-multiple-line"></i>Luxembourg</button>
                    <button class="btn btn-sm" data-bulk="DOM"><i class="ri-checkbox-multiple-line"></i>Outre-mer</button>
                </div>
                <p class="muted" style="font-size:12px;margin-top:8px">Les boutons attribuent tout le pays au commercial choisi.</p>
            </div>
            <div class="paint-map"><svg id="paint-svg"></svg>
                <div class="paint-help" id="paint-help"></div></div>
        </div>`;
    const svg = $('#paint-svg'); buildMap(svg, { badges: false });
    paintRefresh();
    let down = false; const pending = new Map(); let t;
    const apply = el => {
        const z = el?.closest?.('[data-zone]')?.dataset.zone; if (!z) return;
        if ((S.base.secteurs[z] || null) === A.paint) return;
        if (A.paint) S.base.secteurs[z] = A.paint; else delete S.base.secteurs[z];
        pending.set(z, A.paint); paintRefresh();
        clearTimeout(t); t = setTimeout(flush, 350);
    };
    const flush = () => { const list = [...pending].map(([zone, commercial_id]) => ({ zone, commercial_id })); pending.clear(); if (list.length) save(() => S.store.setSecteurs(list)).then(dirty); };
    svg.addEventListener('pointerdown', e => { down = true; apply(e.target); });
    svg.addEventListener('pointerover', e => { if (down) apply(e.target); });
    window.addEventListener('pointerup', () => down = false);
    svg.addEventListener('mousemove', e => {
        const z = e.target.closest('[data-zone]')?.dataset.zone; const tip = $('#tip');
        if (!z) { tip.classList.remove('show'); return; }
        const o = commercial(S.base.secteurs[z]);
        tip.innerHTML = `<h4>${esc(zoneInfo.get(z)?.nom || z)}</h4><div class="t-row"><span>Commercial</span><b>${o ? esc(fullName(o)) : 'Non attribuée'}</b></div>`; placeTip(e);
    });
    svg.addEventListener('mouseleave', () => $('#tip').classList.remove('show'));
    $$('[data-bulk]').forEach(b => b.onclick = () => {
        const k = b.dataset.bulk;
        CARTE.zones.filter(z => k === 'DOM' ? z.dom : z.pays === k && !z.dom).forEach(z => { if (A.paint) S.base.secteurs[z.code] = A.paint; else delete S.base.secteurs[z.code]; pending.set(z.code, A.paint); });
        paintRefresh(); flush();
    });
}

function paintRefresh() {
    const counts = {}; for (const c of Object.values(S.base.secteurs)) counts[c] = (counts[c] || 0) + 1;
    const free = CARTE.zones.length - Object.keys(S.base.secteurs).filter(z => zoneInfo.has(z)).length;
    $('#palette').innerHTML = S.base.commerciaux.map(c => `<button data-paint="${c.id}" class="${A.paint === c.id ? 'on' : ''}"><span class="avatar" style="--c:${c.couleur}">${esc(initials(c))}</span><span class="p-name">${esc(fullName(c))}</span><span class="p-count">${counts[c.id] || 0}</span></button>`).join('')
        + `<button data-paint="" class="${A.paint === null ? 'on' : ''}"><span class="avatar" style="--c:#64748b"><i class="ri-eraser-line"></i></span><span class="p-name">Gomme (libérer)</span><span class="p-count">${free} libres</span></button>`;
    $$('#palette [data-paint]').forEach(b => b.onclick = () => { A.paint = b.dataset.paint || null; paintRefresh(); });
    const svg = $('#paint-svg');
    for (const p of $$('path.z', svg)) { const c = commercial(S.base.secteurs[p.dataset.zone]); p.style.fill = c ? fillOf(c) : 'var(--zone-empty)'; }
    paintBorders(svg, z => S.base.secteurs[z], null);
    const sel = commercial(A.paint);
    $('#paint-help').innerHTML = `<span class="pill"><i class="ri-brush-line"></i>Pinceau : ${sel ? esc(fullName(sel)) : 'gomme'}</span><span class="pill">${free} zone${free > 1 ? 's' : ''} sans commercial</span>`;
}

// ═══ 4. Objectifs ════════════════════════════════════════════
function tabObjectifs() {
    const y = A.year || S.ref.getFullYear(); A.year = y;
    const list = S.base.commerciaux;
    const get = (id, m) => S.base.objectifs.find(o => o.commercial_id === id && o.annee === y && o.mois === m)?.montant || 0;
    const real = (id, m) => sumRange(S.byDay, new Date(y - 1, m - 1, 1), new Date(y - 1, m, 0), id).ca;
    const totalM = m => list.reduce((s, c) => s + get(c.id, m), 0);
    $('#admin-body').innerHTML = `<p class="a-intro">Objectifs de chiffre d'affaires HT, <b>mois par mois</b>. Ils pilotent les jauges, le rythme attendu et l'atterrissage. Saisissez un total annuel puis répartissez-le, ou partez du réalisé de l'année précédente.</p>
        <div class="a-row" style="margin-bottom:14px">
            <div class="seg seg-sm" id="obj-year">${[y - 1, y, y + 1].map(a => `<button data-y="${a}" class="${a === y ? 'on' : ''}">${a}</button>`).join('')}<span class="seg-glider"></span></div>
            <span class="muted">|</span>
            <span>Reprendre le réalisé ${y - 1}</span><input type="number" id="obj-pct" value="5" step="1" style="width:76px"> <span>%</span>
            <button class="btn btn-sm" id="obj-from-n1"><i class="ri-magic-line"></i>Pour toute l'équipe</button>
        </div>
        <div class="tbl-wrap" style="max-height:none"><table class="tbl"><thead><tr><th>Commercial</th><th class="num">Annuel</th><th></th>${MOIS.map(m => `<th class="num">${m}</th>`).join('')}</tr></thead><tbody>
        ${list.map(c => `<tr data-id="${c.id}"><td><span class="a-row" style="gap:8px;flex-wrap:nowrap"><span class="avatar" style="--c:${c.couleur};width:24px;height:24px;border-radius:8px;font-size:9px">${esc(initials(c))}</span>${esc(fullName(c))}</span></td>
            <td><input type="number" step="1000" min="0" data-annuel value="${Math.round([...Array(12)].reduce((s, _, m) => s + get(c.id, m + 1), 0))}" style="min-width:110px"></td>
            <td><button class="btn btn-sm btn-ghost" data-split title="Répartir l'annuel selon la saisonnalité de ${y - 1}"><i class="ri-git-branch-line"></i></button></td>
            ${MOIS.map((_, m) => `<td><input type="number" step="500" min="0" data-m="${m + 1}" value="${Math.round(get(c.id, m + 1))}" title="Réalisé ${MOIS_LONG[m]} ${y - 1} : ${euros(real(c.id, m + 1))}"></td>`).join('')}</tr>`).join('')}
        <tr><td><b>Équipe</b></td><td class="num"><b>${euros(MOIS.reduce((s, _, m) => s + totalM(m + 1), 0), { compact: false })}</b></td><td></td>${MOIS.map((_, m) => `<td class="num"><b>${euros(totalM(m + 1))}</b></td>`).join('')}</tr>
        </tbody></table></div>`;
    moveGlider($('#obj-year'));
    $$('#obj-year button').forEach(b => b.onclick = () => { A.year = +b.dataset.y; tabObjectifs(); });
    const put = rows => { for (const o of rows) { const e = S.base.objectifs.find(x => x.commercial_id === o.commercial_id && x.annee === o.annee && x.mois === o.mois); if (e) e.montant = o.montant; else S.base.objectifs.push(o); } return save(() => S.store.saveObjectifs(rows)).then(dirty); };
    const split = (id, total) => {
        const base = [...Array(12)].map((_, m) => real(id, m + 1)); const sum = base.reduce((a, b) => a + b, 0);
        return base.map((v, m) => ({ commercial_id: id, annee: y, mois: m + 1, montant: Math.round(total * (sum ? v / sum : 1 / 12) / 100) * 100 }));
    };
    $$('tr[data-id]').forEach(tr => {
        const id = tr.dataset.id;
        $$('[data-m]', tr).forEach(inp => inp.addEventListener('change', () => put([{ commercial_id: id, annee: y, mois: +inp.dataset.m, montant: Math.max(0, +inp.value || 0) }]).then(tabObjectifs)));
        $('[data-split]', tr).onclick = () => put(split(id, +$('[data-annuel]', tr).value || 0)).then(tabObjectifs);
        $('[data-annuel]', tr).addEventListener('change', e => put(split(id, +e.target.value || 0)).then(tabObjectifs));
    });
    $('#obj-from-n1').onclick = () => {
        const k = 1 + (+$('#obj-pct').value || 0) / 100;
        if (!confirm(`Remplacer les objectifs ${y} de toute l'équipe par le réalisé ${y - 1} ${k >= 1 ? '+' : ''}${Math.round((k - 1) * 100)} % ?`)) return;
        put(list.flatMap(c => [...Array(12)].map((_, m) => ({ commercial_id: c.id, annee: y, mois: m + 1, montant: Math.round(real(c.id, m + 1) * k / 100) * 100 })))).then(tabObjectifs);
    };
}

// ═══ 5. Réglages ═════════════════════════════════════════════
function tabReglages() {
    const r = S.base.reglages;
    $('#admin-body').innerHTML = `
        <div class="a-section"><h3><i class="ri-palette-line"></i>Outil</h3>
            <div class="a-grid"><label class="field">Nom de l'outil<input data-r="nom" value="${esc(r.nom || '')}"></label>
            <label class="field">Sous-titre<input data-r="sous_titre" value="${esc(r.sous_titre || '')}"></label></div></div>
        <div class="a-section"><h3><i class="ri-traffic-light-line"></i>Statuts (rythme = réalisé ÷ attendu à date)</h3>
            <div class="a-grid"><label class="field">« Dans les temps » à partir de (%)<input type="number" data-r="seuil_vert" value="${r.seuil_vert}"></label>
            <label class="field">« En retard » en dessous de (%)<input type="number" data-r="seuil_orange" value="${r.seuil_orange}"></label></div>
            <p class="muted" style="margin-top:8px;font-size:12.5px">Entre les deux : « Vigilance ».</p></div>
        <div class="a-section"><h3><i class="ri-stack-line"></i>Gammes produits</h3>
            <div class="chips-pick">${(r.gammes || []).map(t => `<span class="chip on">${esc(t)}<button data-rm-gamme="${esc(t)}" title="Retirer"><i class="ri-close-line"></i></button></span>`).join('')}</div>
            <div class="a-row" style="margin-top:10px;max-width:520px"><input id="add-gamme-r" placeholder="Nouvelle gamme" style="flex:1"><button class="btn btn-sm" data-add="gammes" data-src="add-gamme-r"><i class="ri-add-line"></i>Ajouter</button></div>
            <p class="muted" style="margin-top:8px;font-size:12.5px">La colonne « Gamme » (ou « Famille produit ») du fichier est rapprochée de cette liste.</p></div>
        <div class="a-section"><h3><i class="ri-user-heart-line"></i>Types de clientèle</h3>
            <div class="chips-pick" id="lst-types">${(r.types_clientele || []).map(t => `<span class="chip on">${esc(t)}<button data-rm-type="${esc(t)}" title="Retirer"><i class="ri-close-line"></i></button></span>`).join('')}</div>
            <div class="a-row" style="margin-top:10px;max-width:520px"><input id="add-type-r" placeholder="Nouveau type de clientèle" style="flex:1"><button class="btn btn-sm" data-add="types_clientele" data-src="add-type-r"><i class="ri-add-line"></i>Ajouter</button></div></div>
        <div class="a-section"><h3><i class="ri-briefcase-4-line"></i>Fonctions</h3>
            <div class="chips-pick">${(r.fonctions || []).map(t => `<span class="chip on">${esc(t)}<button data-rm-fn="${esc(t)}" title="Retirer"><i class="ri-close-line"></i></button></span>`).join('')}</div>
            <div class="a-row" style="margin-top:10px;max-width:520px"><input id="add-fn-r" placeholder="Nouvelle fonction" style="flex:1"><button class="btn btn-sm" data-add="fonctions" data-src="add-fn-r"><i class="ri-add-line"></i>Ajouter</button></div></div>
        <div class="a-section"><h3><i class="ri-eye-line"></i>Accès au tableau de bord</h3>
            ${S.store.mode === 'cloud' ? `<label class="switch"><input type="checkbox" data-r="lecture_publique" ${r.lecture_publique ? 'checked' : ''}> Tableau de bord visible sans connexion (lecture seule)</label>
            <p class="muted" style="margin-top:8px;font-size:12.5px">Désactivé : seuls les deux administrateurs voient les chiffres, après connexion.</p>`
            : '<p class="muted">Disponible une fois Supabase branché.</p>'}</div>
        ${S.store.mode === 'demo' ? `<div class="a-section"><h3><i class="ri-flask-line"></i>Démonstration</h3><button class="btn btn-danger" id="demo-reset"><i class="ri-restart-line"></i>Réinitialiser les données de démonstration</button></div>` : ''}`;
    let t;
    $('#admin-body').oninput = e => {
        const k = e.target.dataset.r; if (!k) return;
        r[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? +e.target.value : e.target.value;
        clearTimeout(t); t = setTimeout(() => save(() => S.store.saveReglages({ [k]: r[k] })).then(dirty), 450);
    };
    const setList = (k, v) => { r[k] = v; save(() => S.store.saveReglages({ [k]: v })).then(dirty); tabReglages(); };
    $$('[data-rm-type]').forEach(b => b.onclick = () => setList('types_clientele', r.types_clientele.filter(x => x !== b.dataset.rmType)));
    $$('[data-rm-gamme]').forEach(b => b.onclick = () => setList('gammes', r.gammes.filter(x => x !== b.dataset.rmGamme)));
    $$('[data-rm-fn]').forEach(b => b.onclick = () => setList('fonctions', r.fonctions.filter(x => x !== b.dataset.rmFn)));
    $$('[data-add]').forEach(b => b.onclick = () => { const v = $('#' + b.dataset.src).value.trim(); if (v) setList(b.dataset.add, [...new Set([...(r[b.dataset.add] || []), v])]); });
    $('#demo-reset')?.addEventListener('click', () => { if (confirm('Revenir aux données de démonstration d\'origine ?')) { S.store.resetDemo(); refresh().then(renderAdmin); } });
}

// ─── Branchements ──────────────────────────────────────────
window.addEventListener('commerce:ready', () => {
    $('#btn-admin').addEventListener('click', openAdmin);
    $('#admin-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { A.tab = b.dataset.tab; renderAdmin(); } });
    $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m.id); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal.open').forEach(m => closeModal(m.id)); });
    $('#login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const f = new FormData(e.target); const btn = $('#login-submit');
        btn.disabled = true; btn.innerHTML = '<i class="ri-loader-4-line"></i>Connexion…';
        try { await S.store.signIn(String(f.get('email')).trim(), String(f.get('password'))); e.target.reset(); closeModal('login'); await refresh(); openAdmin(); }
        catch (err) { $('#login-error').textContent = err.message; $('#login-error').hidden = false; }
        finally { btn.disabled = false; btn.innerHTML = '<i class="ri-login-circle-line"></i>Se connecter'; }
    });
    $('#btn-logout').addEventListener('click', async () => { await S.store.signOut(); S.session = { isAdmin: false }; closeModal('admin'); toast('Déconnecté', 'ri-logout-box-r-line'); refresh(); });
});
