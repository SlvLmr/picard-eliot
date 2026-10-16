/* ============================================================
   PICARD-ATC — Administration
   Accès : 2 comptes (Supabase Auth). En mode démo, accès direct.
   Onglets : Import · Fiches ATC · Secteurs & potentiel · Budgets · Réglages
   ============================================================ */
const A = { tab: 'import', files: [], paint: undefined, fiche: null };
const TABS = [
    ['import', 'ri-upload-cloud-2-line', 'Import des fichiers'],
    ['commerciaux', 'ri-team-line', 'Fiches ATC'],
    ['secteurs', 'ri-map-2-line', 'Secteurs & potentiel'],
    ['budgets', 'ri-focus-3-line', 'Budgets'],
    ['reglages', 'ri-equalizer-line', 'Réglages'],
];

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
    $('#admin-body').oninput = null;
    ({ import: tabImport, commerciaux: tabCommerciaux, secteurs: tabSecteurs, budgets: tabBudgets, reglages: tabReglages })[A.tab]();
}

// ═══ 1. Import des 3 fichiers Picard ═════════════════════════
function tabImport() {
    $('#admin-body').innerHTML = `
        <p class="a-intro">Déposez les fichiers Picard <b>tels quels</b>, un ou plusieurs à la fois : chacun est reconnu automatiquement.</p>
        <div class="kinds">
            <div><i class="ri-calendar-check-line"></i><b>Tableau commercial quotidien</b><span>Enregistré et facturé société, jour par jour, budgets et 2025</span></div>
            <div><i class="ri-team-line"></i><b>Répartition budget ATC</b><span>Réalisé, budget, quantités et 2025 par ATC et par gamme</span></div>
            <div><i class="ri-truck-line"></i><b>Valorisation du portefeuille</b><span>Carnet de commandes : reste à livrer et échéancier</span></div>
            <div><i class="ri-medal-line"></i><b>Liste des IAP</b><span>Installateurs agréés par ATC et statut (Officiel, Premium, Elite)</span></div>
            <div><i class="ri-file-pdf-2-line"></i><b>États PDF quotidiens</b><span>Commandes non validées, carnet par activité, livraisons par ATC</span></div>
        </div>
        <label class="drop" id="drop">
            <span class="drop-ico"><i class="ri-file-excel-2-line"></i></span>
            <strong>Glissez vos fichiers ici</strong>
            <span class="muted">ou cliquez pour les choisir · .xlsx, .xls, .pdf</span>
            <input type="file" id="file-in" accept=".xlsx,.xls,.pdf" multiple>
        </label>
        ${S.store.mode === 'demo' ? '<p class="note-local"><i class="ri-lock-2-line"></i> Supabase n\'est pas encore branché : les données importées restent <b>uniquement dans ce navigateur</b>. Elles ne sont ni envoyées ni publiées.</p>' : ''}
        <div id="preview"></div>
        <div class="a-section" style="margin-top:26px"><h3><i class="ri-history-line"></i>Derniers imports</h3><div id="imports" class="tbl-wrap"><div class="empty">Chargement…</div></div></div>`;
    const drop = $('#drop');
    $('#file-in').addEventListener('change', e => readFiles([...e.target.files]));
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => readFiles([...e.dataTransfer.files]));
    if (A.files.length) renderPreview();
    renderImports();
}

async function readFiles(files) {
    for (const file of files) {
        try {
            if (/\.pdf$/i.test(file.name)) { // états PDF quotidiens
                const { kind, data } = await lireEtatPdf(await file.arrayBuffer());
                if (kind === 'encours') { A.files.push({ name: file.name, error: 'État des commandes en cours : déjà couvert par le « Carnet par activité », inutile de l\'importer' }); continue; }
                if (kind === 'attente' && !data.date) data.date = iso(new Date());
                A.files = A.files.filter(f => f.kind !== 'etat_' + kind);
                A.files.push({ name: file.name, kind: 'etat_' + kind, data }); continue;
            }
            if (!window.XLSX) throw new Error('lecteur Excel indisponible (connexion internet ?)');
            const wb = readWorkbook(await file.arrayBuffer());
            const kind = detectKind(wb);
            if (!kind) { A.files.push({ name: file.name, error: 'Fichier non reconnu' }); continue; }
            const data = kind === 'quotidien' ? parseQuotidien(wb) : kind === 'portefeuille' ? parsePortefeuille(wb) : kind === 'etat_iap' ? parseIap(wb) : parseRepartition(wb);
            A.files = A.files.filter(f => f.kind !== kind);
            A.files.push({ name: file.name, kind, data });
        } catch (e) { A.files.push({ name: file.name, error: 'Lecture impossible : ' + e.message }); }
    }
    renderPreview();
}

function resume(f) {
    const d = f.data;
    if (f.kind.startsWith('etat_')) {
        const ratt = rattacheurEtats(S.base.commerciaux); const noms = [...new Set(d.lignes.map(l => l.atc).filter(Boolean))];
        const inconnus = noms.filter(n => !ratt(n));
        const items = f.kind === 'etat_iap' ? [['IAP', d.lignes.length], ...['elite', 'premium', 'officiel'].map(s => [STATUT_IAP_NOM[s], d.lignes.filter(l => l.statut === s).length])]
            : f.kind === 'etat_livraisons' ? [['Année', d.annee], ['Portes livrées', nf0.format(d.lignes.reduce((s, l) => s + l.q, 0))], ['Mois', Object.keys(d.totaux).length]]
            : f.kind === 'etat_carnet' ? [['État du', dateLongue(parseIso(d.date))], ['Portes en carnet', nf0.format(d.lignes.reduce((s, l) => s + l.qte, 0))], ['En retard', d.lignes.filter(l => l.dfab && l.dclient && l.dfab > l.dclient).length], ['Bloquées', d.lignes.filter(l => l.bloque).length]]
            : [['Lignes', d.lignes.length], ['Non validées', d.lignes.filter(l => !l.validee).length], ['Bloquées', d.lignes.filter(l => l.bloque).length]];
        items.push(['ATC reconnus', `${noms.length - inconnus.length} / ${noms.length}`]);
        return { lignes: d.lignes.length, items, noms: inconnus.length ? ['Non rattachés (ignorés) : ' + inconnus.join(', ')] : null };
    }
    if (f.kind === 'quotidien') {
        const last = d.jours.at(-1); const fact = d.jours.reduce((s, j) => s + j.fact, 0), enr = d.jours.reduce((s, j) => s + j.enr, 0);
        return { lignes: d.jours.length, items: [['Jours', d.jours.length], ['Dernier jour', last ? dateLongue(parseIso(last.d)) : '—'], ['Facturé cumulé', euros(fact)], ['Enregistré cumulé', euros(enr)], ['Budget année', euros(d.mois.reduce((s, m) => s + (m.b_fact || 0), 0))]] };
    }
    if (f.kind === 'portefeuille') {
        const last = d.jours.at(-1);
        return { lignes: d.jours.length, items: [['Relevés', d.jours.length], ['Dernier relevé', last ? dateLongue(parseIso(last.d)) : '—'], ['Carnet total', euros(last?.pf_total)], ['Livrable ce mois', euros(last?.lm_total)]] };
    }
    const real = d.lignes.filter(l => l.g !== 'eliot').reduce((s, l) => s + (l.r || 0), 0), bud = d.lignes.filter(l => l.g !== 'eliot').reduce((s, l) => s + (l.b || 0), 0);
    const eq = {}; d.personnes.forEach(p => eq[p.equipe] = (eq[p.equipe] || 0) + 1);
    return { lignes: d.lignes.length, items: [['Année', d.annee], ['Fiches', `${d.personnes.length} (${Object.entries(eq).map(([k, n]) => `${equipeDe(k).nom} ${n}`).join(', ')})`], ['Réalisé', euros(real)], ['Budget', euros(bud)]],
        noms: d.personnes.map(p => (p.prenom + ' ' + p.nom).trim()) };
}

function renderPreview() {
    $('#preview').innerHTML = `<div class="preview">${A.files.map((f, i) => {
        if (f.error) return `<div class="pv-file bad"><i class="ri-error-warning-line"></i><div><b>${esc(f.name)}</b><span>${esc(f.error)}</span></div><button class="icon-btn" data-rm="${i}"><i class="ri-close-line"></i></button></div>`;
        const r = resume(f);
        return `<div class="pv-file"><i class="ri-checkbox-circle-line"></i><div><b>${KIND_LABEL[f.kind]}</b><span>${esc(f.name)}</span>
            <div class="pv-items">${r.items.map(([k, v]) => `<span>${k}<b>${esc(String(v))}</b></span>`).join('')}</div>
            ${r.noms ? `<p class="muted pv-noms">${r.noms.map(esc).join(' · ')}</p>` : ''}</div>
            <button class="icon-btn" data-rm="${i}" title="Retirer"><i class="ri-close-line"></i></button></div>`;
    }).join('')}
        ${A.files.some(f => !f.error) ? `<div class="a-row" style="justify-content:flex-end"><button class="btn btn-primary" id="pv-go"><i class="ri-upload-cloud-2-line"></i>Importer ${A.files.filter(f => !f.error).length} fichier${A.files.filter(f => !f.error).length > 1 ? 's' : ''}</button></div>` : ''}</div>`;
    $$('[data-rm]').forEach(b => b.onclick = () => { A.files.splice(+b.dataset.rm, 1); renderPreview(); });
    $('#pv-go')?.addEventListener('click', importer);
}

async function importer() {
    const btn = $('#pv-go'); btn.disabled = true; btn.innerHTML = '<i class="ri-loader-4-line"></i>Import…';
    // L'ordre compte : la répartition crée les fiches ATC avant le reste
    const ordre = { repartition: 0, quotidien: 1, portefeuille: 2, etat_attente: 3, etat_carnet: 4, etat_livraisons: 5, etat_iap: 6 };
    try {
        for (const f of A.files.filter(f => !f.error).sort((a, b) => ordre[a.kind] - ordre[b.kind])) {
            await save(() => S.store.importer(f.kind, f.data, { fichier: f.name, lignes: resume(f).lignes }));
        }
        toast(`${A.files.filter(f => !f.error).length} fichier(s) importé(s)`, 'ri-upload-cloud-2-fill');
        A.files = []; $('#preview').innerHTML = ''; renderImports(); await refresh();
    } catch (e) { btn.disabled = false; btn.innerHTML = '<i class="ri-upload-cloud-2-line"></i>Réessayer'; }
}

async function renderImports() {
    const list = await S.store.listImports();
    $('#imports').innerHTML = list.length ? `<table class="tbl"><thead><tr><th>Importé</th><th>Type</th><th>Fichier</th><th class="num">Lignes</th><th>Par</th></tr></thead><tbody>
        ${list.map(i => `<tr><td>${relative(new Date(i.created_at))}</td><td>${KIND_LABEL[i.type] || i.type}</td><td>${esc(i.fichier || '—')}</td><td class="num">${i.lignes}</td><td>${esc(i.par || '')}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><i class="ri-inbox-line"></i>Aucun import pour l\'instant</div>';
}

// ═══ 2. Fiches ATC ═══════════════════════════════════════════
function tabCommerciaux() {
    const list = S.base.commerciaux;
    if (!list.find(c => c.id === A.fiche)) A.fiche = list[0]?.id || null;
    $('#admin-body').innerHTML = `<div class="atc">
        <aside class="atc-list">
            <button class="btn btn-primary btn-block" id="add-com"><i class="ri-user-add-line"></i>Ajouter une fiche</button>
            <div class="atc-items">${EQUIPES.map(e => {
                const ms = list.filter(c => c.equipe === e.code); if (!ms.length) return '';
                return `<div class="atc-group">${esc(e.nom)}</div>` + ms.map((c, i) => `<button class="atc-item ${c.id === A.fiche ? 'on' : ''} ${c.actif === false ? 'off' : ''}" data-fiche="${c.id}" style="animation-delay:${i * 20}ms">
                    <span class="avatar" style="--c:${c.couleur}">${esc(initials(c))}</span>
                    <span class="ti-text"><strong>${esc(fullName(c))}</strong><small>${esc(typeAtc(c.id))}</small></span></button>`).join('');
            }).join('')}</div>
        </aside>
        <section class="fiche" id="fiche"></section></div>`;
    $$('[data-fiche]').forEach(b => b.onclick = () => { A.fiche = b.dataset.fiche; tabCommerciaux(); });
    $('#add-com').onclick = async () => {
        const c = { prenom: 'Nouveau', nom: 'ATC', equipe: 'IDF', couleur: nuance(equipeDe('IDF').couleur, list.length), actif: true, ordre: list.length, fonction: 'ATC', clientele: [], iap_objectif: 0, iap_nouveaux: 0 };
        await save(async () => { const saved = await S.store.saveCommercial(c); S.base.commerciaux.push(saved); A.fiche = saved.id; });
        tabCommerciaux(); dirty(); $('#fiche [data-f=prenom]')?.select();
    };
    if (A.fiche) renderFiche(list.find(c => c.id === A.fiche));
    else $('#fiche').innerHTML = '<div class="empty"><i class="ri-user-add-line"></i>Importez le fichier « Répartition budget ATC » pour créer les fiches</div>';
}

function renderFiche(c) {
    const reg = S.base.reglages; const y = S.ref.getFullYear();
    const list = S.base.commerciaux; const i = list.indexOf(c);
    const zones = zonesOf(c.id, 'serruriers'); const aff = affectationsDe(S.base.affectations, c.id);
    const iapZones = zones.reduce((s, z) => s + (S.base.zonesInfo[z]?.iap || 0), 0);
    const potentiel = zones.reduce((s, z) => s + (S.base.zonesInfo[z]?.potentiel || 0), 0);
    const types = [...new Set([...(reg.types_clientele || []), ...(c.clientele || [])])];
    const fonctions = [...new Set([...(reg.fonctions || []), ...(c.fonction ? [c.fonction] : [])])];
    const ids = new Set([c.id]); const mois = [...Array(12)].map((_, k) => k + 1);
    const bud = g => agg(S.D.idx, ids, y, mois, [g]);
    const parMois = serieMois(S.D, ids, y); const maxB = Math.max(1, ...parMois.map(x => x.b));
    $('#fiche').innerHTML = `
        <header class="fiche-head" style="--c:${c.couleur}">
            <label class="ph-drop" id="ph-drop" title="Glissez une photo ou cliquez pour en choisir une">${avatarWho(c.id, 'lg')}<i class="ri-camera-line"></i><input type="file" accept="image/*" id="f-photo"></label>
            <div class="fiche-id"><h3>${esc(fullName(c))}</h3><p>${esc(c.fonction || '')} · équipe ${esc(equipeDe(c.equipe).nom)}</p></div>
            ${S.base.photos?.[c.id] ? '<button class="btn btn-ghost btn-sm" id="f-photo-del"><i class="ri-image-line"></i>Retirer la photo</button>' : ''}
            <label class="switch"><input type="checkbox" data-f="actif" ${c.actif !== false ? 'checked' : ''}> Actif</label>
        </header>

        <div class="fiche-grid">
        <div class="f-block"><h4><i class="ri-id-card-line"></i>Identité</h4>
            <div class="f-fields">
                <label class="field">Prénom<input data-f="prenom" value="${esc(c.prenom)}"></label>
                <label class="field">Nom<input data-f="nom" value="${esc(c.nom)}"></label>
                <label class="field">Équipe<select data-f="equipe">${EQUIPES.map(e => `<option value="${e.code}" ${e.code === c.equipe ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
                <label class="field">Fonction<select data-f="fonction"><option value="">—</option>${fonctions.map(f => `<option ${f === c.fonction ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
                <label class="field">E-mail<input type="email" data-f="email" value="${esc(c.email || '')}"></label>
                <label class="field">Téléphone<input data-f="telephone" value="${esc(c.telephone || '')}"></label>
                <label class="field full">Libellé dans le fichier Répartition<input data-f="code" value="${esc(c.code || '')}" placeholder="ex. DUPONT Jean"></label>
                <label class="field full">Nom dans les états PDF <span class="muted">(si différent du nom de famille, séparés par des virgules)</span><input data-f="alias" value="${esc((c.alias || []).join(', '))}" placeholder="ex. ASSIER"></label>
            </div></div>

        <div class="f-block"><h4><i class="ri-community-line"></i>IAP · installateurs agréés</h4>
            <div class="f-goals">
                <span class="field goal-big">Installés dans le secteur<span class="f-big"><b>${iapZones}</b> IAP</span><span class="muted f-help">Somme des IAP saisis par zone (onglet Secteurs)</span></span>
                <label class="field goal-big">Objectif<span class="a-row"><input type="number" class="pct" min="0" data-f="iap_objectif" value="${c.iap_objectif ?? 0}"></span></label>
                <label class="field goal-big">Recrutés en ${y}<span class="a-row"><input type="number" class="pct" min="0" data-f="iap_nouveaux" value="${c.iap_nouveaux ?? 0}"></span></label>
            </div>
            <p class="muted f-help">Potentiel du secteur (exemple) : <b>${euros(potentiel)}</b>${iapZones ? ` · ${euros(potentiel / iapZones)} par IAP` : ''}</p>
        </div>

        <div class="f-block f-wide"><h4><i class="ri-focus-3-line"></i>Budget ${y} <small class="muted">· issu du fichier Répartition budget ATC</small></h4>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Gamme</th><th class="num">Budget</th><th class="num">Réalisé</th><th class="num">%</th><th class="num">${y - 1}</th><th class="num">Quantités</th></tr></thead><tbody>
            ${GAMMES.map(g => { const x = bud(g.k); return `<tr><td>${esc(g.nom)}${g.sub ? ` <small class="muted">${esc(g.sub)}</small>` : ''}</td><td class="num">${euros(x.b)}</td><td class="num">${euros(x.r)}</td><td class="num">${pct(x.b ? x.r / x.b * 100 : null)}</td><td class="num">${euros(x.n1)}</td><td class="num">${x.q ? nf0.format(x.q) : '—'}</td></tr>`; }).join('')}
            </tbody></table></div>
            <div class="f-months">${parMois.map((x, k) => `<div class="f-month" title="${MOIS_LONG[k]} : budget ${euros(x.b)} · réalisé ${x.hasR ? euros(x.r) : '—'}"><span class="mb"><i style="height:${Math.round(x.b / maxB * 100)}%"></i></span><span>${MOIS[k]}</span><span class="fm-v">${euros(x.b)}</span></div>`).join('')}</div>
            <div class="f-goals" style="margin-top:14px"><label class="field goal-big">Taux de marge visé ${exemple}<span class="a-row"><input type="number" class="pct" step="0.5" min="0" max="100" data-f="objectif_marge" value="${c.objectif_marge ?? ''}" placeholder="ex. 35"><span class="muted">%</span></span></label></div>
        </div>

        <div class="f-block"><h4><i class="ri-user-heart-line"></i>Type de clientèle</h4>
            <p class="muted f-help">Les clientèles que cet ATC développe. Elles apparaissent sur sa page.</p>
            <div class="chips-pick">${types.map(t => `<button class="chip ${c.clientele?.includes(t) ? 'on' : ''}" data-clientele="${esc(t)}"><i class="${c.clientele?.includes(t) ? 'ri-check-line' : 'ri-add-line'}"></i>${esc(t)}</button>`).join('')}</div>
            <div class="a-row" style="margin-top:10px"><input id="new-type" placeholder="Autre type de clientèle…" style="flex:1"><button class="btn btn-sm" id="add-type"><i class="ri-add-line"></i>Ajouter</button></div>
        </div>

        <div class="f-block"><h4><i class="ri-map-2-line"></i>Secteur</h4>
            <p class="f-big"><b>${aff.length}</b> secteur${aff.length > 1 ? 's' : ''} · ${esc(typeAtc(c.id))}</p>
            <div class="fm-sects">${aff.map(a => `<span class="sect-chip" style="--g1:${SECTEURS[a.secteur].c[0]};--g2:${SECTEURS[a.secteur].c[1]}"><i></i>${esc(forceDe(a.force).court)} · <b>${esc(SECTEURS[a.secteur].nom)}</b></span>`).join('') || '<span class="muted">Aucun secteur affecté</span>'}</div>
            <button class="btn" id="f-paint" style="margin-top:10px"><i class="ri-map-pin-user-line"></i>Gérer les secteurs</button>
        </div>

        <div class="f-block f-wide"><h4><i class="ri-sticky-note-line"></i>Notes</h4>
            <textarea data-f="notes" rows="4" placeholder="Priorités, comptes clés, plan d'action…" style="width:100%;resize:vertical">${esc(c.notes || '')}</textarea>
        </div>
        </div>

        <footer class="fiche-foot">
            <span class="a-row"><button class="btn btn-sm" data-move="-1" ${i ? '' : 'disabled'}><i class="ri-arrow-up-line"></i>Monter</button>
            <button class="btn btn-sm" data-move="1" ${i < list.length - 1 ? '' : 'disabled'}><i class="ri-arrow-down-line"></i>Descendre</button></span>
            <button class="btn btn-danger btn-sm" id="f-del"><i class="ri-delete-bin-6-line"></i>Supprimer cette fiche</button>
        </footer>`;
    const fiche = $('#fiche'); let t;
    const persist = () => { clearTimeout(t); t = setTimeout(() => save(() => S.store.saveCommercial(c)).then(dirty), 450); };
    fiche.oninput = e => {
        const f = e.target.dataset.f; if (!f) return;
        c[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? (e.target.value === '' ? null : +e.target.value) : e.target.value;
        if (f === 'alias') c.alias = e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
        if (f === 'couleur') $$('.fiche-head .avatar, .atc-item.on .avatar').forEach(a => a.style.setProperty('--c', c.couleur));
        if (f === 'prenom' || f === 'nom') { $('.fiche-id h3').textContent = fullName(c); $('.atc-item.on strong').textContent = fullName(c); }
        persist();
    };
    fiche.onchange = e => { if (['fonction', 'couleur', 'equipe'].includes(e.target.dataset.f)) tabCommerciaux(); };
    $$('[data-clientele]', fiche).forEach(b => b.onclick = () => {
        const v = b.dataset.clientele; const set = new Set(c.clientele || []);
        set.has(v) ? set.delete(v) : set.add(v); c.clientele = [...set]; persist(); renderFiche(c);
    });
    $('#add-type').onclick = () => {
        const v = $('#new-type').value.trim(); if (!v) return;
        c.clientele = [...new Set([...(c.clientele || []), v])];
        if (!(reg.types_clientele || []).includes(v)) { reg.types_clientele = [...(reg.types_clientele || []), v]; save(() => S.store.saveReglages({ types_clientele: reg.types_clientele })); }
        persist(); renderFiche(c);
    };
    $('#new-type').addEventListener('keydown', e => { if (e.key === 'Enter') $('#add-type').click(); });
    const posePhoto = async file => {
        if (!file || !/^image\//.test(file.type)) return;
        const image = await photoCarree(file);
        (S.base.photos ||= {})[c.id] = image;
        await save(() => S.store.setPhoto(c.id, image)); renderFiche(c); dirty();
    };
    $('#f-photo').onchange = e => posePhoto(e.target.files[0]);
    const pd = $('#ph-drop');
    ['dragenter', 'dragover'].forEach(ev => pd.addEventListener(ev, e => { e.preventDefault(); pd.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => pd.addEventListener(ev, e => { e.preventDefault(); pd.classList.remove('over'); }));
    pd.addEventListener('drop', e => posePhoto(e.dataTransfer.files[0]));
    $('#f-photo-del')?.addEventListener('click', async () => { delete S.base.photos[c.id]; await save(() => S.store.setPhoto(c.id, null)); renderFiche(c); dirty(); });
    $('#f-paint').onclick = () => { A.force = forcesDe(c.id)[0] || A.force; A.tab = 'secteurs'; renderAdmin(); };
    $('#f-del').onclick = async () => {
        if (!confirm(`Supprimer la fiche ${fullName(c)} ? Ses secteurs seront libérés et ses chiffres importés supprimés.`)) return;
        await save(() => S.store.deleteCommercial(c.id));
        S.base.commerciaux = list.filter(x => x.id !== c.id);
        for (const f in S.base.affectations) for (const sec in S.base.affectations[f]) S.base.affectations[f][sec] = S.base.affectations[f][sec].filter(x => x !== c.id);
        A.fiche = null; tabCommerciaux(); dirty();
    };
    $$('[data-move]', fiche).forEach(b => b.onclick = async () => {
        const j = i + +b.dataset.move; [list[i], list[j]] = [list[j], list[i]];
        list.forEach((x, k) => x.ordre = k);
        await save(() => Promise.all([list[i], list[j]].map(x => S.store.saveCommercial(x))));
        tabCommerciaux(); dirty();
    });
}

// Photo recadrée en carré (centrée, cadrage un peu haut pour garder le visage), 480 px, JPEG ~30 Ko
async function photoCarree(file) {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); });
    const s = Math.min(img.width, img.height), N = 480, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const x = (img.width - s) / 2, y = Math.max(0, (img.height - s) * 0.25);
    cv.getContext('2d').drawImage(img, x, y, s, s, 0, 0, N, N);
    return cv.toDataURL('image/jpeg', 0.82);
}

// ═══ 3. Secteurs & potentiel ═════════════════════════════════
// Une force à la fois : chaque secteur de son découpage reçoit un ou plusieurs ATC. Outil « Potentiel & IAP » : saisie par zone.
function tabSecteurs() {
    A.force ||= S.force; A.outil ||= 'secteurs';
    $('#admin-body').innerHTML = `<p class="a-intro">Les découpages des forces commerciales sont fixés. Pour chaque secteur, <b>affectez un ou plusieurs ATC</b> ; un ATC présent dans plusieurs forces est un ATC <b>mixte</b>. L'outil <b>Potentiel & IAP</b> permet de saisir, zone par zone, le potentiel de marché et le nombre d'installateurs agréés.</p>
        <div class="a-row" style="margin-bottom:14px"><div class="tabs" id="a-force">${FORCES.map(f => `<button data-af="${f.id}" class="${A.force === f.id ? 'on' : ''}">${esc(f.nom)}</button>`).join('')}</div>
            <div class="tabs"><button data-outil="secteurs" class="${A.outil === 'secteurs' ? 'on' : ''}">Affectations</button><button data-outil="potentiel" class="${A.outil === 'potentiel' ? 'on' : ''}">Potentiel & IAP</button></div></div>
        <div class="paint">
            <div class="sect-list" id="sect-list"></div>
            <div class="paint-map"><svg id="paint-svg"></svg>
                <div class="paint-help" id="paint-help"></div>
                <form class="zone-edit" id="zone-edit" hidden></form></div>
        </div>`;
    const svg = $('#paint-svg'); buildMap(svg, { badges: false });
    paintRefresh();
    $$('[data-af]').forEach(b => b.onclick = () => { A.force = b.dataset.af; A.sec = null; tabSecteurs(); });
    $$('[data-outil]').forEach(b => b.onclick = () => { A.outil = b.dataset.outil; tabSecteurs(); });
    svg.addEventListener('click', e => {
        const z = e.target.closest('[data-zone]')?.dataset.zone; if (!z) return;
        if (A.outil === 'potentiel') return editZone(z);
        A.sec = zoneSecteurs(A.force)[z] || null; paintRefresh();
        $(`#sect-list [data-sec="${A.sec}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    svg.addEventListener('mousemove', e => {
        const z = e.target.closest('[data-zone]')?.dataset.zone; const tip = $('#tip');
        if (!z) { tip.classList.remove('show'); return; }
        const sec = zoneSecteurs(A.force)[z]; const ids = sec ? idsSecteur(sec, A.force) : []; const info = S.base.zonesInfo[z] || {};
        tip.innerHTML = `<h4>${esc(zoneInfo.get(z)?.nom || z)}</h4><div class="t-row"><span>Secteur</span><b>${sec ? esc(SECTEURS[sec].nom) : '—'}</b></div><div class="t-row"><span>ATC</span><b>${ids.map(id => esc(fullName(commercial(id)))).join(', ') || 'Non affecté'}</b></div>
            <div class="t-row"><span>Potentiel</span><b>${euros(info.potentiel || 0)}</b></div><div class="t-row"><span>IAP</span><b>${info.iap ?? 0}</b></div>`; placeTip(e);
    });
    svg.addEventListener('mouseleave', () => $('#tip').classList.remove('show'));
}

async function setAffectation(sec, ids) {
    (S.base.affectations[A.force] ||= {})[sec] = ids;
    paintRefresh();
    await save(() => S.store.setAffectation(A.force, sec, ids)); dirty();
}

function editZone(z) {
    const f = $('#zone-edit'); const info = S.base.zonesInfo[z] || {};
    f.hidden = false;
    f.innerHTML = `<h4>${esc(zoneInfo.get(z)?.nom || z)}</h4>
        <label class="field">Potentiel annuel (€)<input type="number" name="potentiel" min="0" step="10000" value="${info.potentiel || 0}"></label>
        <label class="field">IAP installés<input type="number" name="iap" min="0" value="${info.iap ?? 0}"></label>
        <div class="a-row"><button class="btn btn-primary btn-sm" type="submit"><i class="ri-check-line"></i>Enregistrer</button><button class="btn btn-ghost btn-sm" type="button" data-close-edit>Fermer</button></div>`;
    f.onsubmit = async e => {
        e.preventDefault(); const d = new FormData(f);
        const v = { potentiel: +d.get('potentiel') || 0, iap: +d.get('iap') || 0 };
        S.base.zonesInfo[z] = v;
        await save(() => S.store.setZoneInfo(z, v)); dirty(); paintRefresh(); f.hidden = true;
    };
    $('[data-close-edit]', f).onclick = () => f.hidden = true;
    $('[name=potentiel]', f).select();
}

function paintRefresh() {
    const f = forceDe(A.force); const zs = zoneSecteurs(A.force); const atcs = S.base.commerciaux.filter(c => c.actif !== false);
    $('#sect-list').innerHTML = f.secteurs.map(sec => { const ids = idsSecteur(sec, A.force); const d = SECTEURS[sec];
        return `<div class="sect-row ${A.sec === sec ? 'on' : ''}" data-sec="${sec}">
            <div class="sr-head"><span class="sect-dot" style="--g1:${d.c[0]};--g2:${d.c[1]}"></span><b>${esc(d.nom)}</b><small>${d.zones.length} zone${d.zones.length > 1 ? 's' : ''}</small></div>
            <div class="sr-atc">${ids.map(id => { const c = commercial(id); return `<span class="chip on">${esc(fullName(c))}<button data-rm="${sec}|${id}" title="Retirer"><i class="ri-close-line"></i></button></span>`; }).join('')}
                <select data-add="${sec}"><option value="">${ids.length ? '+ Ajouter' : 'Affecter un ATC…'}</option>${atcs.filter(c => !ids.includes(c.id)).map(c => `<option value="${c.id}">${esc(fullName(c))}</option>`).join('')}</select></div></div>`; }).join('');
    $$('#sect-list [data-sec]').forEach(r => r.onclick = e => { if (e.target.closest('select, button')) return; A.sec = r.dataset.sec; paintRefresh(); });
    $$('#sect-list [data-add]').forEach(sel => sel.onchange = () => { if (sel.value) setAffectation(sel.dataset.add, [...idsSecteur(sel.dataset.add, A.force), sel.value]); });
    $$('#sect-list [data-rm]').forEach(b => b.onclick = () => { const [sec, id] = b.dataset.rm.split('|'); setAffectation(sec, idsSecteur(sec, A.force).filter(x => x !== id)); });
    const svg = $('#paint-svg');
    const maxPot = Math.max(1, ...Object.values(S.base.zonesInfo).map(z => z.potentiel || 0));
    for (const p of svg.querySelectorAll('path.z')) {
        const z = p.dataset.zone;
        if (A.outil === 'potentiel') { const v = S.base.zonesInfo[z]?.potentiel || 0; p.style.fill = v ? seqColor(Math.sqrt(v / maxPot)) : 'var(--zone-empty)'; p.style.opacity = ''; }
        else { p.style.fill = zs[z] ? `url(#paint-svg-sg-${zs[z]})` : 'var(--zone-empty)'; p.style.opacity = A.sec && zs[z] !== A.sec ? .35 : (zs[z] && !idsSecteur(zs[z], A.force).length ? .45 : 1); }
    }
    paintBorders(svg, z => zs[z], A.sec ? z => zs[z] === A.sec : null);
    const libres = f.secteurs.filter(sec => !idsSecteur(sec, A.force).length).length;
    $('#paint-help').innerHTML = A.outil === 'potentiel' ? '<span class="pill"><i class="ri-focus-3-line"></i>Cliquez une zone pour saisir son potentiel et ses IAP</span>'
        : `<span class="pill"><i class="ri-cursor-line"></i>Cliquez un secteur pour le sélectionner</span><span class="pill">${libres} secteur${libres > 1 ? 's' : ''} sans ATC</span>`;
}

// ═══ 4. Budgets (lecture du fichier Répartition) ═════════════
function tabBudgets() {
    const y = S.ref.getFullYear(); const mois = [...Array(12)].map((_, k) => k + 1);
    const ligne = (ids, nom, avatar, cls = '') => {
        const cells = GAMMES.map(g => agg(S.D.idx, ids, y, mois, [g.k]));
        const tot = agg(S.D.idx, ids, y, mois);
        return `<tr class="${cls}"><td>${avatar}${esc(nom)}</td>${cells.map(x => `<td class="num">${euros(x.b)}</td>`).join('')}<td class="num"><b>${euros(tot.b)}</b></td><td class="num">${euros(tot.r)}</td><td class="num">${pct(tot.b ? tot.r / tot.b * 100 : null)}</td><td class="num">${euros(tot.n1)}</td></tr>`;
    };
    let rows = '';
    for (const e of EQUIPES) {
        const ms = S.base.commerciaux.filter(c => c.equipe === e.code); if (!ms.length) continue;
        rows += ms.map(c => ligne(new Set([c.id]), fullName(c), `<span class="avatar" style="--c:${c.couleur};width:22px;height:22px;font-size:8px;display:inline-grid;margin-right:8px;vertical-align:middle">${esc(initials(c))}</span>`)).join('');
        if (e.code !== 'DIR' && e.code !== 'DOM') rows += ligne(new Set(ms.map(c => c.id)), 'Équipe ' + e.nom, '', 'sub');
    }
    rows += ligne(new Set(S.base.commerciaux.map(c => c.id)), 'Total société', '', 'tot');
    $('#admin-body').innerHTML = `<p class="a-intro">Budgets ${y} par ATC et par gamme, <b>lus dans le fichier « Répartition budget ATC »</b>. Pour les modifier, réimportez le fichier mis à jour. Eliot est compris dans Serrures (il n'est pas ajouté au total).</p>
        <div class="tbl-wrap" style="max-height:none"><table class="tbl budgets"><thead><tr><th>ATC</th>${GAMMES.map(g => `<th class="num">${esc(g.nom)}</th>`).join('')}<th class="num">Budget total</th><th class="num">Réalisé</th><th class="num">%</th><th class="num">${y - 1}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ═══ 5. Réglages ═════════════════════════════════════════════
function tabReglages() {
    const r = S.base.reglages;
    $('#admin-body').innerHTML = `
        <div class="a-section"><h3><i class="ri-palette-line"></i>Outil</h3>
            <div class="a-grid"><label class="field">Nom de l'outil<input data-r="nom" value="${esc(r.nom || '')}"></label>
            <label class="field">Sous-titre<input data-r="sous_titre" value="${esc(r.sous_titre || '')}"></label></div></div>
        <div class="a-section"><h3><i class="ri-traffic-light-line"></i>Statuts (% du budget réalisé)</h3>
            <div class="a-grid"><label class="field">Rouge jusqu'à (%)<input type="number" data-r="seuil_orange" value="${r.seuil_orange ?? 60}"></label>
            <label class="field">Orange jusqu'à (%)<input type="number" data-r="seuil_jaune" value="${r.seuil_jaune ?? 85}"></label>
            <label class="field">Jaune jusqu'à (%) · vert au-delà<input type="number" data-r="seuil_vert" value="${r.seuil_vert ?? 90}"></label></div>
            <p class="muted" style="margin-top:8px;font-size:12.5px">Par défaut : rouge jusqu'à 60 %, orange de 61 à 85 %, jaune de 86 à 90 %, vert au-delà.</p></div>
        <div class="a-section"><h3><i class="ri-user-heart-line"></i>Types de clientèle</h3>
            <div class="chips-pick">${(r.types_clientele || []).map(t => `<span class="chip on">${esc(t)}<button data-rm-type="${esc(t)}" title="Retirer"><i class="ri-close-line"></i></button></span>`).join('')}</div>
            <div class="a-row" style="margin-top:10px;max-width:520px"><input id="add-type-r" placeholder="Nouveau type de clientèle" style="flex:1"><button class="btn btn-sm" data-add="types_clientele" data-src="add-type-r"><i class="ri-add-line"></i>Ajouter</button></div></div>
        <div class="a-section"><h3><i class="ri-briefcase-4-line"></i>Fonctions</h3>
            <div class="chips-pick">${(r.fonctions || []).map(t => `<span class="chip on">${esc(t)}<button data-rm-fn="${esc(t)}" title="Retirer"><i class="ri-close-line"></i></button></span>`).join('')}</div>
            <div class="a-row" style="margin-top:10px;max-width:520px"><input id="add-fn-r" placeholder="Nouvelle fonction" style="flex:1"><button class="btn btn-sm" data-add="fonctions" data-src="add-fn-r"><i class="ri-add-line"></i>Ajouter</button></div></div>
        <div class="a-section"><h3><i class="ri-eye-line"></i>Accès au tableau de bord</h3>
            ${S.store.mode === 'cloud' ? `<label class="switch"><input type="checkbox" data-r="lecture_publique" ${r.lecture_publique ? 'checked' : ''}> Tableau de bord visible sans connexion (lecture seule)</label>
            <p class="muted" style="margin-top:8px;font-size:12.5px">Recommandé : désactivé. Seuls les deux administrateurs voient alors les chiffres, après connexion.</p>`
            : '<p class="muted">Disponible une fois Supabase branché.</p>'}</div>
        ${S.store.mode === 'demo' ? `<div class="a-section"><h3><i class="ri-flask-line"></i>Ce navigateur</h3><button class="btn btn-danger" id="demo-reset"><i class="ri-restart-line"></i>Effacer les données importées et revenir à la démonstration</button></div>` : ''}`;
    let t;
    $('#admin-body').oninput = e => {
        const k = e.target.dataset.r; if (!k) return;
        r[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? +e.target.value : e.target.value;
        clearTimeout(t); t = setTimeout(() => save(() => S.store.saveReglages({ [k]: r[k] })).then(dirty), 450);
    };
    const setList = (k, v) => { r[k] = v; save(() => S.store.saveReglages({ [k]: v })).then(dirty); tabReglages(); };
    $$('[data-rm-type]').forEach(b => b.onclick = () => setList('types_clientele', r.types_clientele.filter(x => x !== b.dataset.rmType)));
    $$('[data-rm-fn]').forEach(b => b.onclick = () => setList('fonctions', r.fonctions.filter(x => x !== b.dataset.rmFn)));
    $$('[data-add]').forEach(b => b.onclick = () => { const v = $('#' + b.dataset.src).value.trim(); if (v) setList(b.dataset.add, [...new Set([...(r[b.dataset.add] || []), v])]); });
    $('#demo-reset')?.addEventListener('click', () => { if (confirm('Effacer les données de ce navigateur et revenir à la démonstration ?')) { S.store.resetDemo(); refresh().then(renderAdmin); } });
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
