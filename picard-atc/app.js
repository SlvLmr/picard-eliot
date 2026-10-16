/* ============================================================
   PICARD-ATC — Tableau de bord
   Navigation par rubriques (Synthèse, Commerciaux, Secteurs, Carnet, Clients).
   Périmètre choisi en haut à gauche : toute la société, une équipe (« eq:NORD ») ou un ATC.
   ============================================================ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = c => horsAtc(c) && !c.prenom ? c.equipe : ((c.prenom?.[0] || '') + (c.nom?.[0] || '')).toUpperCase();
const fullName = c => `${c.prenom} ${c.nom}`.trim();
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const VIEWS = { synthese: 'Synthèse', commerciaux: 'Commerciaux', secteurs: 'Secteurs', carnet: 'Carnet de commandes', clients: 'Clients' };
const S = {
    store: null, base: null, D: null, ref: new Date(),
    view: 'synthese', period: 'mois', force: 'serruriers', sel: null, gamme: null, zone: null, mapMode: 'secteurs', clientsMode: 'clients', sort: 'atteinte', mask: false,
    charts: {}, session: { isAdmin: false },
};
try { const p = JSON.parse(localStorage.getItem('picard_atc_vue') || '{}'); for (const k of ['period', 'force', 'mapMode', 'clientsMode', 'sort', 'mask']) if (p[k] != null) S[k] = p[k]; } catch (e) {}
// La Synthèse et le Carnet sont toujours une vue d'ensemble société ; ailleurs, le périmètre choisi (S.sel) s'applique
const GLOBAL_VIEWS = new Set(['synthese', 'carnet']);
Object.defineProperty(S, 'who', { get() { return GLOBAL_VIEWS.has(S.view) ? null : S.sel; }, set(v) { S.sel = v || null; } });
const remember = () => { try { localStorage.setItem('picard_atc_vue', JSON.stringify({ period: S.period, force: S.force, mapMode: S.mapMode, clientsMode: S.clientsMode, sort: S.sort, mask: S.mask })); } catch (e) {} };

// Montants masqués (œil en haut à droite) : utile en rendez-vous
const eurosBrut = euros;
euros = (v, o) => S.mask && v != null && !isNaN(v) ? '••• €' : eurosBrut(v, o);

const commercial = id => S.base.commerciaux.find(c => c.id === id);
const actifs = () => S.base.commerciaux.filter(c => c.actif !== false);
const equipesUtilisees = () => EQUIPES.filter(e => actifs().some(c => c.equipe === e.code));
const membres = code => actifs().filter(c => c.equipe === code);
const atcs = () => actifs().filter(c => !horsAtc(c));
const isEquipe = w => typeof w === 'string' && w.startsWith('eq:');
const idsFor = (who = S.who) => new Set(!who ? actifs().map(c => c.id) : isEquipe(who) ? membres(who.slice(3)).map(c => c.id) : [who]);
// Secteurs : la carte montre une force à la fois (S.force) ; S.base.secteurs = zone → 1er ATC du secteur dans cette force
const affDe = (force = S.force) => S.base.affectations?.[force] || {};
const idsSecteur = (sec, force = S.force) => (affDe(force)[sec] || []).filter(id => commercial(id));
function zonesFor(who = S.who, force = S.force) {
    const ids = idsFor(who); const out = [];
    for (const sec of forceDe(force).secteurs) if (idsSecteur(sec, force).some(id => ids.has(id))) out.push(...SECTEURS[sec].zones);
    return out;
}
const zonesOf = (id, force) => zonesFor(id, force);
const forcesDe = id => [...new Set(affectationsDe(S.base.affectations, id).map(a => a.force))];
// Mixte = présent à la fois chez les Serruriers et les Menuisiers ; sinon on nomme sa ou ses forces
const typeAtc = id => { const f = forcesDe(id); if (f.includes('serruriers') && f.includes('menuisiers')) return 'ATC mixte';
    return f.length ? 'ATC ' + f.map(x => forceDe(x).court).join(' + ') : 'Sans secteur'; };
function deriveForce() {
    S.zoneSect = zoneSecteurs(S.force); S.base.secteurs = {};
    for (const [z, sec] of Object.entries(S.zoneSect)) { const id = idsSecteur(sec)[0]; if (id) S.base.secteurs[z] = id; }
}
const zoneInfo = new Map(CARTE.zones.map(z => [z.code, z]));
const pinfo = (p = S.period) => periodInfo(p, S.ref);
const gammesSel = () => S.gamme ? [S.gamme] : undefined;
const nomWho = (who = S.who) => !who ? 'Tous les ATC' : isEquipe(who) ? 'Équipe ' + equipeDe(who.slice(3)).nom : fullName(commercial(who));

// Carnet : livrable sur le mois en cours (dernier relevé du mois de référence)
function carnetDuMois() {
    const pf = S.base.portefeuille; const last = pf.at(-1);
    if (!last || last.d.slice(0, 7) !== iso(S.ref).slice(0, 7)) return null;
    return last.lm_total ?? null;
}
// Indicateurs d'une sélection ; pour la société, l'atterrissage du mois s'appuie sur le carnet
function K(who = S.who, p = S.period, gammes) {
    return kpis(S.D, idsFor(who), pinfo(p), { carnetMois: !who && !gammes ? carnetDuMois() : null, gammes });
}
const Kc = (who, p, g = null) => { const k = `${who}|${p}|${g}`; if (!S.kCache.has(k)) S.kCache.set(k, K(who, p, g ? [g] : undefined)); return S.kCache.get(k); };
const Ks = (who = S.who, p = S.period) => Kc(who, p, S.gamme);

// ─── Chargement ─────────────────────────────────────────────
async function loadAll() {
    S.base = await S.store.loadAll();
    S.base.zonesInfo = fusionnerZones({}, S.base.zonesInfo).zonesInfo;
    S.base.affectations ||= {};
    // Secteur outre-mer : revient à la fiche « DOM-TOM » tant qu'il n'est pas affecté autrement
    const dom = S.base.commerciaux.find(c => c.equipe === 'DOM' && c.actif !== false);
    if (dom) for (const f of FORCES) { const a = (S.base.affectations[f.id] ||= {}); if (!a.dom?.length) a.dom = [dom.id]; }
    if (!FORCES.some(f => f.id === S.force)) S.force = FORCES[0].id;
    // Couleur d'un ATC = dégradé de son (premier) secteur
    for (const c of S.base.commerciaux) { const a = affectationsDe(S.base.affectations, c.id)[0]; if (a) c.couleur = SECTEURS[a.secteur].c[1]; }
    deriveForce();
    S.D = { idx: buildIndex(S.base.atcMois) };
    S.ref = S.base.etat?.derniere_date ? parseIso(S.base.etat.derniere_date) : new Date();
    if (S.sel && !isEquipe(S.sel) && !commercial(S.sel)) S.sel = null;
    document.title = S.base.reglages.nom || 'PICARD-ATC';
}

function renderAll({ animate = true } = {}) {
    S.kCache = new Map();
    applyViews(); renderChrome(); renderLive();
    const v = S.view; const solo = S.sel && !isEquipe(S.sel);
    if (v === 'synthese' || (v === 'commerciaux' && S.sel)) { renderCrumb(); renderHero(animate); renderGTiles(); renderPerf(); renderKpis(animate); renderRank(); renderMiniCarnet(); renderMonths(); }
    if (v === 'commerciaux' && !solo) renderTable();
    if (v === 'secteurs') renderMap();
    if (v === 'carnet') renderCarnet();
    if (v === 'clients') renderClients();
}

// Rubrique Commerciaux avec un ATC ou une équipe choisi : sa synthèse s'affiche (au-dessus du tableau pour une équipe)
function applyViews() {
    const solo = S.sel && !isEquipe(S.sel);
    $$('.view').forEach(sec => { const v = sec.dataset.view;
        sec.hidden = !(v === S.view ? !(v === 'commerciaux' && solo) : v === 'synthese' && S.view === 'commerciaux' && !!S.sel); });
}
function renderCrumb() {
    const c = $('#crumb'); c.hidden = !(S.view === 'commerciaux' && S.sel);
    if (!c.hidden) c.innerHTML = `<button class="lnk-back" data-who=""><i class="ri-arrow-left-line"></i>Commerciaux</button><span>/</span>${avatarWho(S.sel, 'xs')}<b>${esc(nomWho())}</b>`;
}

// ─── Navigation ─────────────────────────────────────────────
function go(view, { push = true } = {}) {
    if (!VIEWS[view]) view = 'synthese';
    const changed = view !== S.view; S.view = view;
    $$('#nav [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === view));
    $('#side').classList.remove('open');
    if (push && location.hash !== '#' + view) history.replaceState(null, '', urlFor());
    renderAll({ animate: changed });
    requestAnimationFrame(() => { Object.values(S.charts).forEach(c => c.resize()); if (view === 'secteurs') { MAP.rect = $('#map').getBoundingClientRect(); zoomToSelection(); } });
    if (changed) $('#main').scrollTo?.(0, 0), window.scrollTo(0, 0);
}
function urlFor() { const u = new URL(location); u.hash = S.view; if (S.sel) u.searchParams.set('c', S.sel); else u.searchParams.delete('c'); return u; }

function select(who) {
    S.who = who || null; S.zone = null;
    if (S.sel && !isEquipe(S.sel)) { const f = forcesDe(S.sel); if (f.length && !f.includes(S.force)) { S.force = f[0]; deriveForce(); } }
    closeMenus();
    if (S.sel && GLOBAL_VIEWS.has(S.view)) return go('commerciaux'); // depuis une vue société, un ATC choisi ouvre sa fiche
    history.replaceState(null, '', urlFor());
    renderAll();
    requestAnimationFrame(() => Object.values(S.charts).forEach(c => c.resize()));
    if (S.view === 'secteurs') zoomToSelection();
    window.scrollTo(0, 0);
}

// ─── Barre du haut & sélecteurs ─────────────────────────────
function avatarWho(who, cls = '') {
    if (!who) return `<span class="avatar ${cls} all"><i class="ri-building-2-line"></i></span>`;
    if (isEquipe(who)) { const e = equipeDe(who.slice(3)); return `<span class="avatar ${cls}" style="--c:${e.couleur}">${e.code === 'RA' ? 'RA' : e.code.slice(0, 2)}</span>`; }
    const c = commercial(who); return `<span class="avatar ${cls}" style="--c:${c.couleur}">${esc(initials(c))}</span>`;
}
function renderChrome() {
    $('#top-title').textContent = VIEWS[S.view];
    // « Tous les ATC » reste visible partout ; le sélecteur sert à choisir une équipe ou un ATC (hors vues société)
    $('#btn-all').classList.toggle('on', !S.who);
    $('#who-label').textContent = S.who ? nomWho() : 'Choisir un ATC';
    $('#who-av').innerHTML = S.who ? avatarWho(S.who, 'xs') : '<i class="ri-user-search-line"></i>';
    $('#period-label').textContent = { mois: 'Mois', trimestre: 'Trimestre', annee: 'Année' }[S.period];
    $$('#menu-period [data-period]').forEach(b => b.classList.toggle('on', b.dataset.period === S.period));
    $('#gamme-label').textContent = S.gamme ? gammeNom(S.gamme) : 'Toutes les gammes';
    $('#menu-gamme').innerHTML = [['', 'Toutes les gammes'], ...GAMMES.map(g => [g.k, g.nom])].map(([k, n]) => `<button data-gamme="${k}" class="${(S.gamme || '') === k ? 'on' : ''}">${esc(n)}</button>`).join('');
    $('#sort-label').textContent = { atteinte: '% du budget', realise: 'Facturé', evol: 'Évolution', nom: 'Nom' }[S.sort];
    $('#btn-mask').innerHTML = `<i class="${S.mask ? 'ri-eye-off-line' : 'ri-eye-line'}"></i>`;
    $('#btn-mask').title = S.mask ? 'Afficher les montants' : 'Masquer les montants';
    renderWhoList();
}
function renderWhoList() {
    const q = norm($('#search').value);
    const row = (who, titre, sous) => { const k = Kc(who || null, S.period);
        return `<button data-who="${who}" class="${(S.who || '') === who ? 'on' : ''}">${avatarWho(who || null, 'sm')}<span class="ml-txt"><b>${esc(titre)}</b><small>${sous}</small></span><span class="ml-val">${euros(k.realise)}<small class="${statut(k.atteinte, S.base.reglages).key}">${pct(k.atteinte)}</small></span></button>`; };
    let html = q ? '' : row('', 'Tous les ATC', `${atcs().length} ATC · ${equipesUtilisees().filter(e => e.code !== 'DIR' && e.code !== 'DOM').length} équipes`);
    for (const e of equipesUtilisees()) {
        const ms = membres(e.code).filter(c => !q || norm(fullName(c) + ' ' + c.code + ' ' + e.nom).includes(q));
        if (!ms.length) continue;
        html += `<div class="ml-group">${esc(e.nom)}</div>`;
        if (e.code !== 'DIR' && e.code !== 'DOM' && !q) html += row('eq:' + e.code, 'Équipe ' + e.nom, `${ms.length} ATC`);
        html += ms.map(c => row(c.id, fullName(c), esc(typeAtc(c.id)))).join('');
    }
    $('#who-list').innerHTML = html || '<div class="empty">Aucun résultat</div>';
}
function closeMenus() { $$('.dd.open').forEach(d => d.classList.remove('open')); }
function toggleMenu(btn) {
    const dd = btn.closest('.dd'); const open = !dd.classList.contains('open');
    closeMenus(); if (!open) return;
    dd.classList.add('open');
    if (btn.dataset.dd === 'who') { $('#search').value = ''; renderWhoList(); setTimeout(() => $('#search').focus(), 30); }
}

// ─── Synthèse : chiffre héros + courbe ──────────────────────
function delta(v, fmt = x => pct(x, { sign: true })) {
    if (v == null || isNaN(v)) return '<span class="delta flat">—</span>';
    const cls = Math.abs(v) < 0.05 ? 'flat' : v > 0 ? 'up' : 'down';
    const ico = cls === 'flat' ? 'ri-subtract-line' : v > 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
    return `<span class="delta ${cls}"><i class="${ico}"></i>${fmt(v)}</span>`;
}
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const exemple = '<span class="ex" title="Donnée d\'exemple : non fournie par les fichiers">Exemple</span>';
function countUp(el, to, fmt, ms = 900) {
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
}

function renderHero(animate) {
    const p = pinfo(); const k = Ks();
    $('#hero-date').textContent = `Facturé · ${p.label[0].toUpperCase() + p.label.slice(1)}${S.gamme ? ' · ' + gammeNom(S.gamme) : ''} · au ${dateLongue(S.ref)}`;
    const el = $('#hero-val');
    if (animate && !S.mask) countUp(el, k.realise, v => euros(v, { compact: false })); else el.textContent = euros(k.realise, { compact: false });
    $('#hero-delta').innerHTML = `${delta(k.evol)}<span class="muted">${k.n1 ? `${euros(k.realise - k.n1, { sign: true })} vs ${p.y - 1} à date` : `vs ${p.y - 1}`}</span>`;
    const box = $('#hero-enr');
    if (!S.who && !S.gamme && S.base.jours.length) {
        const e = enregistre(p); box.hidden = false;
        box.innerHTML = `<div class="hero-date"><i class="dot-enr"></i>Enregistré · prises de commande</div><div class="hero-val2">${euros(e.enr, { compact: false })}</div>
            <div class="hero-delta">${delta(e.n1 ? (e.enr / e.n1 - 1) * 100 : null)}<span class="muted">objectif à date ${pct(e.bADate ? e.enr / e.bADate * 100 : null)}</span></div>`;
    } else box.hidden = true;
    renderTrajectory();
}

// ─── Courbes ────────────────────────────────────────────────
const GOLD = '#e7b876', GOLD_2 = '#f5d7a8';
const C = { real: GOLD, proj: GOLD_2, enr: '#7aa7f7' };
function baseAxis() {
    return { axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: css('--chart-axis'), fontSize: 10.5, fontFamily: 'Inter' }, splitLine: { lineStyle: { color: css('--chart-grid') } } };
}
const tooltipStyle = () => ({ backgroundColor: '#141417', borderColor: '#26262b', borderWidth: 1, padding: [8, 12],
    textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Inter' }, extraCssText: 'border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.5)' });
const gradLine = () => GOLD;
const gradArea = (a = .22) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `rgba(231,184,118,${a})` }, { offset: 1, color: 'rgba(231,184,118,0)' }]);
const enrArea = () => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(122,167,247,.12)' }, { offset: 1, color: 'rgba(122,167,247,0)' }]);
const n1Area = () => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(160,160,170,.10)' }, { offset: 1, color: 'rgba(160,160,170,0)' }]);
const smooth = { smooth: .4, smoothMonotone: 'x', showSymbol: false };
const pointer = () => ({ type: 'line', lineStyle: { color: '#3a3a40', width: 1 } });
const legendHtml = items => items.map(([n, c, dash]) => `<span><i class="lg-line ${dash ? 'lg-dash' : ''}" style="border-color:${c}"></i>${n}</span>`).join('');

function chartOf(id) { return S.charts[id] || (S.charts[id] = echarts.init($('#' + id), null, { renderer: 'svg' })); }

function renderTrajectory() {
    const p = pinfo(); const k = Ks();
    const chart = chartOf('chart-traj');
    let dates, series, legend, fmtX, fmtTip;
    const jp = S.base.jours.filter(j => { const d = parseIso(j.d); return d.getFullYear() === p.y && p.months.includes(d.getMonth() + 1); });
    let interval = 'auto';
    if (!S.who && !S.gamme && jp.length) {
        // Société : facturé et enregistré cumulés jour par jour sur la période, objectif facturé réparti sur les jours ouvrés
        const sm = m => S.base.societeMois.find(x => x.a === p.y && x.m === m) || {};
        const deb = new Date(p.y, p.months[0] - 1, 1), fin = new Date(p.y, p.months.at(-1), 0);
        dates = []; for (let d = new Date(deb); d <= fin; d = addDays(d, 1)) if (isWorkday(d)) dates.push(iso(d));
        const wd = {}; dates.forEach(d => { const m = +d.slice(5, 7); wd[m] = (wd[m] || 0) + 1; });
        const map = new Map(jp.map(j => [j.d, j])); const refIso = iso(S.ref); let cf = 0, ce = 0, co = 0;
        const fact = [], enr = [], obj = [];
        dates.forEach(d => { const m = +d.slice(5, 7); co += (sm(m).b_fact || agg(S.D.idx, idsFor(null), p.y, [m]).b) / wd[m]; obj.push(co);
            if (d <= refIso) { const j = map.get(d); cf += j?.fact || 0; ce += j?.enr || 0; fact.push(cf); enr.push(ce); } else { fact.push(null); enr.push(null); } });
        const idx = fact.reduce((m, v, i) => v != null ? i : m, -1);
        const proj = dates.map((_, i) => i === idx ? fact[idx] : i === dates.length - 1 ? k.projection : null);
        series = [
            { name: 'Objectif facturé', type: 'line', data: obj, ...smooth, lineStyle: { width: 1, type: [4, 4], color: css('--target') }, itemStyle: { color: css('--target') } },
            { name: 'Atterrissage', type: 'line', data: proj, connectNulls: true, showSymbol: false, lineStyle: { width: 1.2, type: [2, 4], color: C.proj }, itemStyle: { color: C.proj } },
            { name: 'Enregistré', type: 'line', data: enr, ...smooth, lineStyle: { width: 1.6, color: C.enr }, itemStyle: { color: C.enr }, areaStyle: { color: enrArea() } },
            { name: 'Facturé', type: 'line', data: fact, ...smooth, lineStyle: { width: 1.8, color: C.real }, itemStyle: { color: C.real }, areaStyle: { color: gradArea() } },
        ];
        legend = [['Facturé', C.real], ['Enregistré', C.enr], ['Objectif facturé', css('--target'), 1], [S.period === 'mois' ? 'Atterrissage (carnet)' : 'Atterrissage', C.proj, 1]];
        const firstOfMonth = new Set(); dates.forEach((d, i) => { if (i === 0 || d.slice(5, 7) !== dates[i - 1].slice(5, 7)) firstOfMonth.add(d); });
        fmtX = S.period === 'mois' ? (d => `${d.slice(8, 10)}/${d.slice(5, 7)}`) : (d => firstOfMonth.has(d) ? MOIS[+d.slice(5, 7) - 1].replace('.', '') : '');
        if (S.period !== 'mois') interval = 0;
        fmtTip = d => dateLongue(parseIso(d));
    } else {
        // Cumul mois par mois sur l'année
        const sm = serieMois(S.D, idsFor(), p.y, gammesSel()); let cr = 0, cb = 0, cn = 0;
        dates = MOIS.map(m => m.replace('.', ''));
        const real = [], bud = [], n1 = [];
        sm.forEach((x, i) => { cb += x.b; cn += x.n1; bud.push(cb); n1.push(cn); if (i + 1 <= p.m) { cr += x.r; real.push(cr); } else real.push(null); });
        const ka = Kc(S.who, 'annee', S.gamme);
        const proj = dates.map((_, i) => i === p.m - 1 ? real[i] : i === 11 ? ka.projection : null);
        series = [
            { name: String(p.y - 1), type: 'line', data: n1, ...smooth, lineStyle: { width: 1, color: css('--n1') }, itemStyle: { color: css('--n1') }, areaStyle: { color: n1Area() } },
            { name: 'Budget', type: 'line', data: bud, ...smooth, lineStyle: { width: 1, type: [4, 4], color: css('--target') }, itemStyle: { color: css('--target') } },
            { name: 'Atterrissage', type: 'line', data: proj, connectNulls: true, showSymbol: false, lineStyle: { width: 1.2, type: [2, 4], color: C.proj }, itemStyle: { color: C.proj } },
            { name: 'Facturé', type: 'line', data: real, ...smooth, lineStyle: { width: 1.6, color: C.real }, itemStyle: { color: C.real }, areaStyle: { color: gradArea() } },
        ];
        legend = [['Facturé (cumul)', C.real], ['Budget', css('--target'), 1], [String(p.y - 1), css('--n1')], ['Atterrissage', C.proj, 1], [S.gamme ? 'Enregistré : non suivi par gamme' : 'Enregistré : suivi au niveau société', 'transparent']];
        fmtX = s => s; fmtTip = s => s + ' ' + p.y;
    }
    $('#traj-legend').innerHTML = legendHtml(legend);
    chart.setOption({
        animationDuration: 900, animationEasing: 'cubicOut', grid: { left: 4, right: 10, top: 14, bottom: 2, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), axisPointer: pointer(),
            formatter: ps => `<b>${fmtTip(dates[ps[0].dataIndex])}</b><br>` + ps.filter(x => x.value != null).map(x => `${x.marker}${x.seriesName} <b style="float:right;margin-left:16px">${euros(x.value)}</b>`).join('<br>') },
        xAxis: { type: 'category', data: dates, boundaryGap: false, ...baseAxis(), splitLine: { show: false }, axisLabel: { ...baseAxis().axisLabel, formatter: fmtX, interval, hideOverlap: interval !== 0 } },
        yAxis: { type: 'value', ...baseAxis(), splitNumber: 4, axisLabel: { ...baseAxis().axisLabel, formatter: v => euros(v) } },
        series,
    }, true);
}

// ─── Synthèse : budget (jauge + chiffres clés + alertes) ────
function renderPerf() {
    const p = pinfo(); const k = Ks(); const st = statut(k.atteinte, S.base.reglages);
    $('#perf-period').textContent = '· ' + p.label;
    $('#perf-lbl').textContent = 'Budget réalisé';
    $('#perf-val').textContent = pct(k.atteinte);
    $('#perf-status').className = 'status ' + st.key; $('#perf-status').textContent = st.label;
    const chart = chartOf('gauge');
    chart.setOption({
        animationDuration: 1000, animationEasingUpdate: 'cubicOut',
        series: [
            { type: 'gauge', startAngle: 90, endAngle: -270, min: 0, max: 100, radius: '92%',
              progress: { show: true, width: 7, roundCap: true, itemStyle: { color: css(st.key === 'none' ? '--muted' : '--' + st.key) } },
              axisLine: { lineStyle: { width: 7, color: [[1, '#1e1e23']] } },
              pointer: { show: false }, anchor: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, title: { show: false }, detail: { show: false },
              data: [{ value: Math.min(k.atteinte ?? 0, 100) }] },
            { type: 'gauge', startAngle: 90, endAngle: -270, min: 0, max: 100, radius: '92%',
              axisLine: { show: false }, progress: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, detail: { show: false }, title: { show: false }, anchor: { show: false },
              pointer: { show: k.attendu != null, icon: 'rect', length: '16%', width: 2, offsetCenter: [0, '-78%'], itemStyle: { color: '#fff' } },
              data: [{ value: Math.min(k.attendu ?? 0, 100) }] },
        ],
    }, true);
    const rows = [
        ['Budget', euros(k.budget)],
        ['Attendu à date', `${euros(k.budgetADate)} · ${pct(k.attendu)}`],
        ['Atterrissage prévu', `${euros(k.projection)} ${k.budget ? `<span class="${k.ecartProjection >= 0 ? 'up' : 'down'}">${euros(k.ecartProjection, { sign: true })}</span>` : ''}`],
        ['Reste à faire', `${euros(k.reste)}${p.joursRestants && k.reste ? ` · ${euros(k.reste / p.joursRestants)}/j` : ''}`],
    ];
    $('#perf-rows').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    renderSignals();
    const solo = S.who && !isEquipe(S.who);
    $('#perf-link').hidden = solo;
}

function renderSignals() {
    const p = pinfo(); const reg = S.base.reglages; const out = [];
    if (!S.who || isEquipe(S.who)) {
        const late = [...idsFor()].map(commercial).filter(c => c && !horsAtc(c)).map(c => ({ c, k: Kc(c.id, S.period, S.gamme) }))
            .filter(x => ['late', 'orange'].includes(statut(x.k.atteinte, reg).key)).sort((a, b) => a.k.atteinte - b.k.atteinte);
        if (late.length) out.push({ cls: 'late', html: `<b>${late.length} ATC</b> sous 85 % : ` + late.slice(0, 3).map(x => `<button class="lnk" data-who="${x.c.id}" data-go="commerciaux">${esc(x.c.prenom || x.c.nom)} ${pct(x.k.atteinte)}</button>`).join(', ') + (late.length > 3 ? '…' : '') });
    } else {
        const k = Ks();
        if (k.reste > 0 && p.joursRestants > 0) out.push({ cls: 'info', html: `Pour tenir le budget : <b>${euros(k.reste / p.joursRestants)}</b> par jour ouvré` });
    }
    let worst = null;
    if (!S.gamme) for (const g of CA_GAMMES) { const kg = Kc(S.who, S.period, g); if (kg.n1 > 0 && kg.evol != null && (!worst || kg.evol < worst.evol)) worst = { g, evol: kg.evol }; }
    if (worst && worst.evol < 0) out.push({ cls: 'warn', html: `Gamme en recul : <b>${gammeNom(worst.g)}</b> ${pct(worst.evol, { sign: true })} vs ${p.y - 1}` });
    $('#signals').innerHTML = out.map(s => `<div class="signal ${s.cls}">${s.html}</div>`).join('');
}

// ─── Synthèse : indicateurs ─────────────────────────────────
function enregistre(p) { // prises de commande société sur la période
    const jours = S.base.jours.filter(j => { const d = parseIso(j.d); return d.getFullYear() === p.y && p.months.includes(d.getMonth() + 1) && d <= p.ref; });
    const enr = jours.reduce((s, j) => s + j.enr, 0);
    const sm = m => S.base.societeMois.find(x => x.a === p.y && x.m === m) || {};
    let b = 0, n1 = 0;
    for (const m of p.months) { const x = sm(m); const f = m < p.m ? 1 : m === p.m ? p.frac : 0; b += (x.b_enr || 0) * f; n1 += (x.n1_enr || 0) * f; }
    return { enr, bADate: b, n1, has: jours.length > 0 };
}
function iapDe(who = S.who) {
    const zones = zonesFor(who, 'serruriers'); const ids = idsFor(who);
    const nb = zones.reduce((s, z) => s + (S.base.zonesInfo[z]?.iap || 0), 0);
    const cs = [...ids].map(commercial).filter(Boolean);
    return { nb, objectif: cs.reduce((s, c) => s + (+c.iap_objectif || 0), 0), nouveaux: cs.reduce((s, c) => s + (+c.iap_nouveaux || 0), 0) };
}
function renderKpis(animate) {
    const p = pinfo(); const k = Ks(); const iap = iapDe();
    const cards = [
        { label: 'Atterrissage prévu', val: k.projection, fmt: v => euros(v),
            row: k.budget ? `${delta(k.ecartProjection, v => euros(v, { sign: true }))}<span>vs budget${k.carnet ? ' · carnet inclus' : ''}</span>` : '<span>au rythme actuel</span>' },
    ];
    if (!S.who && !S.gamme) {
        const e = enregistre(p); const ratio = k.realise ? e.enr / k.realise : null;
        cards.push({ label: 'Enregistré / facturé', val: ratio, fmt: v => nf2.format(v),
            row: ratio == null ? '<span>—</span>' : `<span>${ratio >= 1 ? '<b class="up">le carnet se remplit</b>' : '<b class="down-t">le carnet se vide</b>'} · ${euros(e.enr - k.realise, { sign: true })}</span>` });
    } else {
        cards.push({ label: 'Quantités', val: k.qte, fmt: v => nf0.format(v) + ' u.', row: `<span>unités facturées · ${p.label}</span>` });
    }
    cards.push({ label: `IAP${S.base.etat?.zonesExemple ? exemple : ''}`, val: iap.nb, fmt: v => nf0.format(v),
        row: `<span>objectif ${nf0.format(iap.objectif)} · <b class="up">+${iap.nouveaux}</b> en ${p.y}</span>` });
    const rnd = seedFrom(String(S.who) + S.period); const marge = 31 + rnd() * 7, mObj = 34;
    cards.push({ label: `Taux de marge${exemple}`, val: marge, fmt: v => pct(v, { dec: 1 }),
        row: `${delta((rnd() - 0.5) * 3, pts)}<span>objectif ${pct(mObj, { dec: 1 })}</span>` });
    $('#kpis').innerHTML = cards.map((c, i) => `<article class="card kpi" style="animation-delay:${i * 40}ms">
        <div class="kpi-top">${c.label}</div>
        <div class="kpi-val" data-val="${c.val ?? ''}" data-i="${i}">${c.val == null ? '—' : c.fmt(c.val)}</div>
        <div class="kpi-row">${c.row}</div></article>`).join('');
    if (animate && !S.mask) $$('#kpis .kpi-val').forEach(el => { const v = parseFloat(el.dataset.val); if (!isNaN(v)) countUp(el, v, cards[+el.dataset.i].fmt); });
}

// ─── Synthèse : gammes & commerciaux (listes) ───────────────
function barHtml(k) {
    const st = statut(k.atteinte, S.base.reglages);
    return `<span class="bar"><span class="${st.key}" data-w="${Math.min(100, k.atteinte || 0)}"></span>${k.attendu != null ? `<i style="left:${Math.min(100, k.attendu)}%"></i>` : ''}</span>`;
}
function growBars(root) { requestAnimationFrame(() => $$('.bar > span', root).forEach(s => s.style.width = s.dataset.w + '%')); }

function smoothPath(pts) {
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
}
function sparkline(vals) {
    vals = vals.filter(v => v != null);
    if (vals.length < 2) return '';
    const max = Math.max(...vals) || 1, min = Math.min(...vals), w = 64, h = 24;
    const pts = vals.map((v, i) => [i / (vals.length - 1) * w, h - 2 - (v - min) / (max - min || 1) * (h - 4)]);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${smoothPath(pts)}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
}
// Gammes : une tuile par gamme sous la courbe ; un clic filtre toute la synthèse
function renderGTiles() {
    const p = pinfo(); const tot = Kc(S.who, S.period).realise || 1;
    $('#gtiles').innerHTML = GAMMES.map((g, i) => {
        const k = Kc(S.who, S.period, g.k); const st = statut(k.atteinte, S.base.reglages);
        const serie = serieMois(S.D, idsFor(), p.y, [g.k]).map(x => x.hasR ? x.r : null);
        return `<button class="card gtile ${S.gamme === g.k ? 'on' : ''}" data-gamme="${g.k}" style="animation-delay:${i * 40}ms" title="${S.gamme === g.k ? 'Retirer le filtre' : 'Filtrer la synthèse sur ' + esc(g.nom)}">
            <div class="gt-top"><span class="l-ico"><i class="${g.icon}"></i></span><span class="gt-name">${esc(g.nom)}<small>${g.sub ? esc(g.sub) : '&nbsp;'}</small></span></div>
            <div class="gt-val">${euros(k.realise)}<small>${g.k === 'eliot' ? (k.qte ? nf0.format(k.qte) + ' u.' : '') : pct(k.realise / tot * 100) + ' du CA'}</small>${sparkline(serie)}</div>
            ${barHtml(k)}
            <div class="gt-foot"><span><b class="${st.key}">${pct(k.atteinte)}</b> du budget</span>${delta(k.evol)}</div></button>`;
    }).join('');
    growBars($('#gtiles'));
}

// Carnet de commandes (résumé de la synthèse, société)
function renderMiniCarnet() {
    const sec = $('#sec-carnet'); const pf = S.base.portefeuille;
    sec.hidden = !!S.who || !pf.length; $('#row-2').classList.toggle('solo', sec.hidden);
    if (sec.hidden) return;
    const last = pf.at(-1); const debMois = pf.find(x => x.d.slice(0, 7) === last.d.slice(0, 7)) || pf[0];
    const ech = [['Livrable ce mois', last.lm_total], ['M+1', last.m1_total], ['M+2', last.m2_total]]; const maxE = Math.max(...ech.map(e => e[1] || 0)) || 1;
    $('#mini-carnet-sub').textContent = `· au ${dateCourte(parseIso(last.d))}`;
    $('#mini-carnet').innerHTML = `<div class="mc-top"><div><div class="hero-date">Reste à livrer</div><div class="hero-val2">${euros(last.pf_total)}</div></div>
        <div class="hero-delta">${delta(debMois.pf_total ? (last.pf_total / debMois.pf_total - 1) * 100 : null)}<span class="muted">depuis le 1er du mois</span></div></div>
        <div class="list-in">${ech.map(([n, v]) => `<div class="lrow static"><span class="l-main"><span class="l-name">${n}</span><span class="bar"><span class="gold" data-w="${(v || 0) / maxE * 100}"></span></span></span><span class="l-val">${euros(v || 0)}</span></div>`).join('')}</div>
        <p class="perf-note">Facturé du mois + livrable ce mois = <b>${euros(Kc(null, 'mois').projection)}</b> d'atterrissage ${MOIS_LONG[S.ref.getMonth()]}.</p>`;
    growBars($('#mini-carnet'));
}


function renderRank() {
    const solo = S.who && !isEquipe(S.who);
    $('#rank-title').textContent = solo ? 'Fiche' : isEquipe(S.who) ? 'Commerciaux de l\'équipe' : 'Meilleurs commerciaux';
    $('#rank-link').hidden = solo;
    if (solo) {
        const c = commercial(S.who); const zones = [...new Set(FORCES.flatMap(f => zonesOf(c.id, f.id)))]; const iap = iapDe();
        const aff = affectationsDe(S.base.affectations, c.id);
        const zi = S.base.zonesInfo; const pot = zones.reduce((s, z) => s + (zi[z]?.potentiel || 0), 0);
        $('#rank').innerHTML = `<div class="fiche-mini">
            <div class="fm-id">${avatarWho(c.id, 'lg')}<div><b>${esc(fullName(c))}</b><small>${esc(typeAtc(c.id))} · Équipe ${esc(equipeDe(c.equipe).nom)}</small></div></div>
            <div class="fm-sects">${aff.map(a => `<span class="sect-chip" style="--g1:${SECTEURS[a.secteur].c[0]};--g2:${SECTEURS[a.secteur].c[1]}"><i></i>${esc(forceDe(a.force).court)} · <b>${esc(SECTEURS[a.secteur].nom)}</b></span>`).join('') || '<span class="muted">Aucun secteur affecté</span>'}</div>
            <div class="fm-grid"><span><em>Zones</em><b>${zones.length}</b></span><span><em>IAP</em><b>${iap.nb}</b></span><span><em>Potentiel${exemple}</em><b>${euros(pot)}</b></span></div>
            ${(c.clientele || []).length ? `<div class="tags">${c.clientele.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
            <div class="fm-contact">${c.email ? `<a href="mailto:${esc(c.email)}"><i class="ri-mail-line"></i>${esc(c.email)}</a>` : ''}${c.telephone ? `<a href="tel:${esc(c.telephone.replace(/\s/g, ''))}"><i class="ri-phone-line"></i>${esc(c.telephone)}</a>` : ''}</div>
            <a class="link" href="#secteurs">Voir sur la carte<i class="ri-arrow-right-s-line"></i></a></div>`;
        return;
    }
    const list = [...idsFor()].map(commercial).filter(c => c && !horsAtc(c)).map(c => ({ c, k: Kc(c.id, S.period, S.gamme) }))
        .sort((a, b) => (b.k.atteinte ?? -1) - (a.k.atteinte ?? -1)).slice(0, 6);
    $('#rank').innerHTML = list.map(({ c, k }, i) => `<button class="lrow" data-who="${c.id}" data-go="commerciaux" style="animation-delay:${i * 30}ms">
        ${avatarWho(c.id, 'sm')}<span class="l-main"><span class="l-name">${esc(fullName(c))}<small>${esc(equipeDe(c.equipe).nom)}</small></span>${barHtml(k)}</span>
        <span class="l-val">${euros(k.realise)}<small><b class="${statut(k.atteinte, S.base.reglages).key}">${pct(k.atteinte)}</b> · ${delta(k.evol)}</small></span></button>`).join('') || '<div class="empty">Aucun ATC</div>';
    growBars($('#rank'));
}

function renderMonths() {
    const p = pinfo(); const sm = serieMois(S.D, idsFor(), p.y, gammesSel()); const km = Kc(S.who, 'mois', S.gamme);
    const real = sm.map((x, i) => i + 1 < p.m ? x.r : null);
    const proj = sm.map((x, i) => i + 1 === p.m - 1 ? x.r : i + 1 === p.m ? km.projection : null);
    $('#months-sub').textContent = `· ${p.y} vs ${p.y - 1}`;
    $('#months-legend').innerHTML = legendHtml([[String(p.y), C.real], [`${MOIS_LONG[p.m - 1]} projeté`, C.proj, 1], [String(p.y - 1), css('--n1')], ['Budget', css('--target'), 1]]);
    chartOf('chart-months').setOption({
        animationDuration: 900, animationEasing: 'cubicOut', grid: { left: 4, right: 10, top: 14, bottom: 2, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), axisPointer: pointer(),
            formatter: ps => { const m = ps[0].dataIndex; const x = sm[m];
                return `<b>${MOIS_LONG[m]}</b><br>${p.y} : <b>${x.hasR ? euros(x.r) : '—'}</b>${m + 1 === p.m ? ' (à date)' : ''}${x.hasR && x.n1 && m + 1 < p.m ? ` · ${pct((x.r / x.n1 - 1) * 100, { sign: true })}` : ''}<br>${p.y - 1} : <b>${euros(x.n1)}</b><br>Budget : <b>${euros(x.b)}</b>${x.hasR && x.b && m + 1 < p.m ? ` · ${pct(x.r / x.b * 100)}` : ''}`; } },
        xAxis: { type: 'category', data: MOIS.map(m => m.replace('.', '')), boundaryGap: false, ...baseAxis(), splitLine: { show: false } },
        yAxis: { type: 'value', ...baseAxis(), splitNumber: 4, axisLabel: { ...baseAxis().axisLabel, formatter: v => euros(v) } },
        series: [
            { name: String(p.y - 1), type: 'line', data: sm.map(x => x.n1), ...smooth, lineStyle: { width: 1, color: css('--n1') }, itemStyle: { color: css('--n1') }, areaStyle: { color: n1Area() } },
            { name: 'Budget', type: 'line', data: sm.map(x => x.b), ...smooth, lineStyle: { width: 1, type: [4, 4], color: css('--target') }, itemStyle: { color: css('--target') } },
            { name: 'Projection', type: 'line', data: proj, ...smooth, lineStyle: { width: 1.2, type: [2, 4], color: C.proj }, itemStyle: { color: C.proj } },
            { name: String(p.y), type: 'line', data: real, smooth: .4, smoothMonotone: 'x', symbol: 'circle', symbolSize: 4, itemStyle: { color: C.real },
              lineStyle: { width: 1.6, color: C.real }, areaStyle: { color: gradArea(.18) } },
        ],
    }, true);
}

// ─── Commerciaux : tableau ──────────────────────────────────
function renderTable() {
    const reg = S.base.reglages;
    const ids = isEquipe(S.who) ? idsFor() : null; // un ATC sélectionné reste surligné dans la liste complète
    const rows = atcs().filter(c => !ids || ids.has(c.id))
        .map(c => ({ c, k: Kc(c.id, S.period, S.gamme), ka: Kc(c.id, 'annee', S.gamme) }));
    const by = { atteinte: x => -(x.k.atteinte ?? -1), realise: x => -x.k.realise, evol: x => -(x.k.evol ?? -999), nom: x => fullName(x.c) }[S.sort];
    rows.sort((a, b) => { const va = by(a), vb = by(b); return typeof va === 'string' ? va.localeCompare(vb) : va - vb; });
    const p = pinfo();
    $('#atc-sub').textContent = `· ${p.label}${S.gamme ? ' · ' + gammeNom(S.gamme) : ''} · ${rows.length} ATC`;
    const tot = rows.reduce((s, x) => ({ r: s.r + x.k.realise, b: s.b + x.k.budget, n1: s.n1 + x.k.n1, pr: s.pr + x.ka.projection }), { r: 0, b: 0, n1: 0, pr: 0 });
    $('#atc-table').innerHTML = `<table class="tbl tbl-atc"><thead><tr><th>ATC</th><th>Équipe</th><th class="num">Facturé</th><th class="num">Budget</th><th style="width:22%">Budget réalisé</th><th class="num">vs ${p.y - 1}</th><th class="num">Atterrissage ${p.y}</th><th>Secteurs</th><th class="num">IAP</th></tr></thead><tbody>
        ${rows.map(({ c, k, ka }, i) => { const st = statut(k.atteinte, reg); return `<tr data-who="${c.id}" data-go="commerciaux" class="${S.who === c.id ? 'on' : ''}" style="animation-delay:${i * 18}ms">
            <td><span class="cell-who">${avatarWho(c.id, 'sm')}<span><b>${esc(fullName(c))}</b><small>${esc(typeAtc(c.id))}</small></span></span></td>
            <td class="muted">${esc(equipeDe(c.equipe).nom)}</td>
            <td class="num">${euros(k.realise)}</td><td class="num muted">${euros(k.budget)}</td>
            <td><span class="cell-bar">${barHtml(k)}<b class="${st.key}">${pct(k.atteinte)}</b></span></td>
            <td class="num">${delta(k.evol)}</td><td class="num">${euros(ka.projection)}</td>
            <td class="cell-sects">${[...new Set(affectationsDe(S.base.affectations, c.id).map(a => a.secteur))].map(sec => `<span class="sect-dot" style="--g1:${SECTEURS[sec].c[0]};--g2:${SECTEURS[sec].c[1]}" title="${esc(SECTEURS[sec].nom)}"></span>${esc(SECTEURS[sec].nom)}`).join('<br>') || '<span class="muted">—</span>'}</td><td class="num muted">${iapDe(c.id).nb}</td></tr>`; }).join('')}
        </tbody><tfoot><tr><td colspan="2">Total</td><td class="num">${euros(tot.r)}</td><td class="num">${euros(tot.b)}</td><td>${pct(tot.b ? tot.r / tot.b * 100 : null)}</td><td class="num">${delta(tot.n1 ? (tot.r / tot.n1 - 1) * 100 : null)}</td><td class="num">${euros(tot.pr)}</td><td></td><td></td></tr></tfoot></table>`;
    growBars($('#atc-table'));
}

// ─── Clients (exemple) ──────────────────────────────────────
function renderClients() {
    const p = pinfo(); const total = Ks().realise || 0;
    $('#clients-sub').innerHTML = `· ${esc(nomWho())} · ${p.label} ${exemple}`;
    $$('#clients-mode button').forEach(x => x.classList.toggle('on', x.dataset.cmode === S.clientsMode));
    const r = seedFrom(String(S.who) + S.clientsMode);
    let rows;
    if (S.clientsMode === 'segments') {
        const c = S.who && !isEquipe(S.who) ? commercial(S.who) : null;
        const types = (S.base.reglages.types_clientele || []).slice(0, 8);
        const w = types.map(() => 0.3 + r()); const sw = w.reduce((a, b) => a + b, 0);
        rows = types.map((t, i) => ({ n: t, v: total * w[i] / sw, star: c?.clientele?.includes(t) })).sort((a, b) => b.v - a.v);
    } else {
        rows = [0.13, 0.09, 0.075, 0.06, 0.05, 0.042, 0.036, 0.03, 0.026, 0.022].map((s, i) => ({ n: `Client ${i + 1}`, v: total * s * (0.85 + r() * 0.3) })).sort((a, b) => b.v - a.v).map((x, i) => ({ ...x, n: `Client ${i + 1}` }));
    }
    const max = rows[0]?.v || 1;
    $('#clients').innerHTML = rows.map((x, i) => `<div class="lrow static" style="animation-delay:${i * 25}ms"><span class="l-ico num">${x.star ? '<i class="ri-star-fill"></i>' : i + 1}</span>
        <span class="l-main"><span class="l-name">${esc(x.n)}</span><span class="bar"><span class="gold" data-w="${x.v / max * 100}"></span></span></span>
        <span class="l-val">${euros(x.v)}<small>${pct(total ? x.v / total * 100 : null)} du CA</small></span></div>`).join('');
    growBars($('#clients'));
}

// ─── Carnet de commandes (reste à livrer, société) ──────────
const PF_GAMMES = [['serr', 'Serrures'], ['diam', 'Portes blindées'], ['tech', 'Portes techniques'], ['hall', 'Portes de Hall'], ['tol', 'Tôlerie']];
function renderCarnet() {
    const pf = S.base.portefeuille; const box = $('#carnet');
    if (!pf.length) { box.innerHTML = '<article class="card empty"><i class="ri-truck-line"></i>Importez le fichier « Valorisation du portefeuille » pour voir le carnet.</article>'; $('#carnet-sub').textContent = ''; return; }
    const last = pf.at(-1); const debMois = pf.find(x => x.d.slice(0, 7) === last.d.slice(0, 7)) || pf[0];
    $('#carnet-sub').textContent = `· reste à livrer au ${dateLongue(parseIso(last.d))}`;
    const maxG = Math.max(...PF_GAMMES.map(([g]) => last['pf_' + g] || 0)) || 1;
    const ech = [['Ce mois', last.lm_total], ['M+1', last.m1_total], ['M+2', last.m2_total]];
    const maxE = Math.max(...ech.map(e => e[1] || 0)) || 1;
    const feuq = (last.pf_tech || 0) + (last.pf_hall || 0), brog = (last.pf_serr || 0) + (last.pf_diam || 0) + (last.pf_tol || 0);
    const row = (n, v, max) => `<div class="lrow static"><span class="l-main"><span class="l-name">${n}</span><span class="bar"><span class="gold" data-w="${(v || 0) / max * 100}"></span></span></span><span class="l-val">${euros(v || 0)}</span></div>`;
    box.innerHTML = `
        <div class="row-hero">
            <article class="card hero">
                <div class="hero-head"><div>
                    <div class="hero-date">Carnet total · au ${dateLongue(parseIso(last.d))}</div>
                    <div class="hero-val">${euros(last.pf_total, { compact: false })}</div>
                    <div class="hero-delta">${delta(debMois.pf_total ? (last.pf_total / debMois.pf_total - 1) * 100 : null)}<span class="muted">depuis le 1er du mois</span></div>
                </div></div>
                <div class="chart" id="chart-carnet"></div>
                <div class="legend">${legendHtml([['Carnet total', C.real], ['Livrable ce mois', C.enr]])}</div>
            </article>
            <article class="card perf">
                <h3 class="perf-title">Échéancier de livraison</h3>
                <div class="list-in">${ech.map(([n, v]) => row(n, v, maxE)).join('')}</div>
                <p class="perf-note">Facturé du mois + livrable ce mois = <b>${euros(Kc(null, 'mois').projection)}</b> d'atterrissage ${MOIS_LONG[S.ref.getMonth()]}.</p>
                <div class="perf-rows"><div><span>Feuquières <small class="muted">techniques · hall</small></span><b>${euros(feuq)}</b></div><div><span>Broglie <small class="muted">serrures · blindées · tôlerie</small></span><b>${euros(brog)}</b></div></div>
            </article>
        </div>
        <h2 class="sec-title">Par gamme</h2>
        <article class="card list">${PF_GAMMES.map(([g, n]) => row(n, last['pf_' + g], maxG)).join('')}</article>`;
    growBars(box);
    if (S.charts['chart-carnet']) { S.charts['chart-carnet'].dispose(); delete S.charts['chart-carnet']; }
    chartOf('chart-carnet').setOption({
        animationDuration: 900, grid: { left: 4, right: 10, top: 14, bottom: 2, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), axisPointer: pointer(), formatter: ps => `<b>${dateLongue(parseIso(pf[ps[0].dataIndex].d))}</b><br>` + ps.map(x => `${x.marker}${x.seriesName} <b style="float:right;margin-left:14px">${euros(x.value)}</b>`).join('<br>') },
        xAxis: { type: 'category', data: pf.map(x => x.d), boundaryGap: false, ...baseAxis(), splitLine: { show: false }, axisLabel: { ...baseAxis().axisLabel, formatter: s => { const d = parseIso(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }, interval: i => i === 0 || i === pf.length - 1 || i === Math.floor(pf.length / 2) } },
        yAxis: { type: 'value', ...baseAxis(), splitNumber: 4, axisLabel: { ...baseAxis().axisLabel, formatter: v => euros(v) } },
        series: [
            { name: 'Carnet total', type: 'line', data: pf.map(x => x.pf_total), ...smooth, lineStyle: { width: 1.6, color: C.real }, itemStyle: { color: C.real }, areaStyle: { color: gradArea() } },
            { name: 'Livrable ce mois', type: 'line', data: pf.map(x => x.lm_total), ...smooth, lineStyle: { width: 1.2, color: C.enr }, itemStyle: { color: C.enr } },
        ],
    });
}

// ─── Carte ──────────────────────────────────────────────────
const MAP = { vb: null, full: [0, 0, CARTE.w, CARTE.h], anim: 0, rect: null };
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e; };
const SHORT = { '975': 'SPM', '987': 'PF', '988': 'NC', '971': 'GP', '972': 'MQ', '973': 'GF', '974': 'RE', '976': 'YT', LU: 'LU' };
const zoneShort = z => SHORT[z] || (z.includes('-') ? z.split('-')[1] : z);

function buildMap(svg, { badges = true } = {}) {
    svg.setAttribute('viewBox', `0 0 ${CARTE.w} ${CARTE.h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = '';
    svg.style.setProperty('--s', 1);
    const defs = el('defs', {}, svg);
    for (const [id, sec] of Object.entries(SECTEURS)) {
        const b = zoneBox(sec.zones.filter(z => zoneInfo.get(z)?.inset === undefined)) || zoneBox(sec.zones) || [0, 0, CARTE.w, CARTE.h];
        const g = el('linearGradient', { id: svg.id + '-sg-' + id, gradientUnits: 'userSpaceOnUse', x1: b[0], y1: b[1], x2: b[2], y2: b[3] }, defs);
        el('stop', { offset: '0', 'stop-color': sec.c[0] }, g); el('stop', { offset: '1', 'stop-color': sec.c[1] }, g);
    }
    el('path', { d: CARTE.fond, class: 'fond' }, svg);
    const gIn = el('g', { class: 'insets' }, svg);
    for (const i of CARTE.insets) {
        el('rect', { x: i.x, y: i.y, width: i.w, height: i.h, class: 'inset-box', 'data-zone': i.code }, gIn);
        el('text', { x: i.x + 9, y: i.y + 16, class: 'inset-label' }, gIn).textContent = i.nom.replace('Saint-Pierre-et-Miquelon', 'St-Pierre-et-M.').replace('Polynésie française', 'Polynésie').replace('Nouvelle-Calédonie', 'N.-Calédonie');
    }
    const land = el('g', { class: 'land' }, svg);
    const gz = el('g', { class: 'zones' }, land);
    for (const z of CARTE.zones) el('path', { d: z.d, class: 'z', 'data-zone': z.code }, gz);
    const gb = el('g', { class: 'borders' }, land);
    for (const b of CARTE.borders) { const p = el('path', { d: b.d, class: 'b' }, gb); p._a = b.a; p._b = b.b; }
    el('g', { class: 'zlabels' }, svg);
    if (badges) el('g', { class: 'badges' }, svg);
}

// Frontières : internes au secteur, entre secteurs, côtes, contour de la sélection
function paintBorders(svg, ownerOf, inSel) {
    for (const p of svg.querySelectorAll('path.b')) {
        const oa = ownerOf(p._a) || null, ob = p._b ? ownerOf(p._b) || null : undefined;
        let cls = ob === undefined ? 'b b-coast' : oa === ob ? 'b b-in' : 'b b-sector';
        if (inSel && (inSel(p._a) !== (p._b ? inSel(p._b) : false))) cls += ' b-sel';
        if (p._cls !== cls) { p.setAttribute('class', cls); p._cls = cls; }
    }
}

function seqColor(t) {
    const stops = document.documentElement.dataset.theme === 'light' ? ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'] : ['#2a3a5c', '#1e40af', '#2563eb', '#60a5fa', '#bfdbfe'];
    return interpolate(stops, t);
}
function divColor(t) {
    const neutral = document.documentElement.dataset.theme === 'light' ? '#e5e7eb' : '#3f444c';
    return t < 0 ? interpolate([neutral, '#f3a0a6', '#e0606f'], -t) : interpolate([neutral, '#7ee8c6', '#00c38c'], t);
}
function interpolate(stops, t) {
    t = Math.max(0, Math.min(1, t)); const n = stops.length - 1; const i = Math.min(n - 1, Math.floor(t * n)); const f = t * n - i;
    const a = hex(stops[i]), b = hex(stops[i + 1]);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
}
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function zoneFill(code, maxPot) {
    const owner = S.base.secteurs[code]; const c = owner && commercial(owner);
    if (S.mapMode === 'potentiel') { const v = S.base.zonesInfo[code]?.potentiel || 0; return v ? seqColor(Math.sqrt(v / maxPot)) : 'var(--zone-empty)'; }
    if (S.mapMode === 'secteurs') return S.zoneSect[code] ? `url(#map-sg-${S.zoneSect[code]})` : 'var(--zone-empty)';
    if (!c) return 'var(--zone-empty)';
    const k = Kc(c.id, S.period, S.gamme);
    if (S.mapMode === 'atteinte') { const st = statut(k.atteinte, S.base.reglages); return st.key === 'none' ? 'var(--zone-empty)' : `color-mix(in srgb, var(--${st.key}) 78%, var(--surface-solid))`; }
    return k.evol == null ? 'var(--zone-empty)' : divColor(k.evol / 25);
}

// Centre de chaque secteur de la force affichée (pondéré par la surface), pour poser la pastille de ses ATC
function sectorCenters() {
    const out = [];
    for (const sec of forceDe(S.force).secteurs) {
        let x = 0, y = 0, a = 0; const zs = SECTEURS[sec].zones.map(z => zoneInfo.get(z)).filter(Boolean);
        const metro = zs.filter(z => z.inset === undefined);
        for (const z of metro) { x += z.c[0] * z.a; y += z.c[1] * z.a; a += z.a; }
        if (!a && zs[0]) { x = zs[0].c[0]; y = zs[0].c[1] - 30; a = 1; }
        if (a) out.push({ sec, ids: idsSecteur(sec), x: x / a, y: y / a });
    }
    return out;
}

function renderBadges(svg) {
    const g = $('g.badges', svg); if (!g) return;
    g.innerHTML = '';
    if (S.mapMode !== 'secteurs') return;
    const sel = idsFor();
    for (const { sec, ids, x, y } of sectorCenters()) {
        if (S.who && !ids.some(id => sel.has(id))) continue;
        const c = commercial(ids.find(id => sel.has(id)) || ids[0]); const solo = !!c && S.who === c.id;
        const b = el('g', { class: 'badge' + (solo ? ' on' : '') + (c ? '' : ' free'), ...(c ? { 'data-who': c.id } : {}), 'data-sec': sec }, g);
        b.style.transform = `translate(${x}px, ${y}px) scale(var(--s))`;
        if (solo) {
            const w = 20 + fullName(c).length * 6.3;
            el('rect', { x: -14, y: -14, width: w + 16, height: 28, class: 'badge-pill' }, b);
            el('text', { x: 18, y: 4, class: 'badge-name' }, b).textContent = fullName(c);
        }
        el('circle', { r: 11, fill: SECTEURS[sec].c[1], class: 'badge-dot' }, b);
        el('text', { y: 3.3, class: 'badge-txt' }, b).textContent = !c ? '?' : ids.length > 1 && !S.who ? ids.length + '' : initials(c).slice(0, 3);
    }
}

function renderZoneLabels(svg, mine) {
    const g = $('g.zlabels', svg); g.innerHTML = '';
    if (!mine || mine.size > 40) return;
    for (const z of CARTE.zones) {
        if (!mine.has(z.code) || z.inset !== undefined || z.a < 120) continue;
        const t = el('text', { class: 'zl' }, g); t.textContent = zoneShort(z.code);
        t.style.transform = `translate(${z.c[0]}px, ${z.c[1]}px) scale(var(--s))`;
    }
}

function renderMap() {
    const svg = $('#map');
    if (!svg.dataset.ready) { buildMap(svg); svg.dataset.ready = 1; bindMap(svg); MAP.vb = MAP.full.slice(); }
    mapScale(svg, MAP.vb);
    const mine = S.who ? new Set(zonesFor()) : null;
    const maxPot = Math.max(1, ...Object.values(S.base.zonesInfo).map(z => z.potentiel || 0));
    for (const p of svg.querySelectorAll('path.z')) {
        const z = p.dataset.zone;
        p.style.fill = zoneFill(z, maxPot);
        p.classList.toggle('dim', !!mine && !mine.has(z));
        p.classList.toggle('zsel', S.zone === z);
    }
    svg.classList.toggle('has-sel', !!mine);
    svg.dataset.mode = S.mapMode;
    if (!$('#force-tabs').children.length) $('#force-tabs').innerHTML = FORCES.map(f => `<button data-force="${f.id}">${esc(f.nom)}</button>`).join('');
    paintBorders(svg, z => S.zoneSect[z], mine ? z => mine.has(z) : null);
    $$('#force-tabs button').forEach(b => b.classList.toggle('on', b.dataset.force === S.force));
    renderBadges(svg); renderZoneLabels(svg, mine);
    $$('#map-mode button').forEach(b => b.classList.toggle('on', b.dataset.map === S.mapMode));
    renderMapLegend(maxPot);
    renderPotentiel();
}

function renderMapLegend(maxPot) {
    const el = $('#map-legend');
    el.hidden = S.mapMode === 'secteurs';
    if (S.mapMode === 'atteinte') { const r = S.base.reglages, o = r.seuil_orange ?? 60, j = r.seuil_jaune ?? 85, v = r.seuil_vert ?? 90;
        el.innerHTML = `<strong>Réalisé vs budget</strong><div class="ramp" style="background:linear-gradient(90deg,var(--late) 0 25%,var(--orange) 25% 50%,var(--warn) 50% 75%,var(--ok) 75%)"></div><div class="ramp-lbl"><span>≤ ${o} %</span><span>${o + 1}–${j}</span><span>${j + 1}–${v}</span><span>> ${v} %</span></div>`; }
    else if (S.mapMode === 'evol') el.innerHTML = `<strong>Évolution vs ${S.ref.getFullYear() - 1}</strong><div class="ramp" style="background:linear-gradient(90deg,${[-1, -.5, 0, .5, 1].map(divColor).join(',')})"></div><div class="ramp-lbl"><span>−25 %</span><span>0</span><span>+25 %</span></div>`;
    else if (S.mapMode === 'potentiel') el.innerHTML = `<strong>Potentiel de marché ${exemple}</strong><div class="ramp" style="background:linear-gradient(90deg,${[0, .25, .5, .75, 1].map(seqColor).join(',')})"></div><div class="ramp-lbl"><span>0</span><span>${euros(maxPot)}</span></div>`;
}

// Encart « Potentiel » : une zone cliquée, ou à défaut le secteur sélectionné
function renderPotentiel() {
    const box = $('#potentiel'); const zi = S.base.zonesInfo;
    if (S.zone) {
        const z = zoneInfo.get(S.zone); const info = zi[S.zone] || {}; const owner = commercial(S.base.secteurs[S.zone]);
        const zs = owner ? zonesOf(owner.id) : []; const potSect = zs.reduce((s, x) => s + (zi[x]?.potentiel || 0), 0);
        const ka = owner ? Kc(owner.id, 'annee') : null;
        const couv = ka && potSect ? ka.projection * ((info.potentiel || 0) / potSect) : null; // part du chiffre de l'ATC rapportée au poids de la zone
        box.innerHTML = `<header><h3 class="perf-title">Potentiel ${exemple}</h3><button class="pt-x" data-pt-close title="Fermer"><i class="ri-close-line"></i></button></header>
            <h4>${esc(z?.nom || S.zone)} <small>${/^\d/.test(S.zone) ? S.zone : ''}</small></h4>
            <div class="pt-big">${euros(info.potentiel || 0)}<small>potentiel annuel</small></div>
            <div class="pt-grid">
                <span>IAP installés<b>${info.iap ?? 0}</b></span>
                <span>Potentiel / IAP<b>${info.iap ? euros(info.potentiel / info.iap) : '—'}</b></span>
                <span>Poids dans le secteur<b>${potSect ? pct(info.potentiel / potSect * 100) : '—'}</b></span>
                <span>Couverture estimée<b>${couv != null && info.potentiel ? pct(couv / info.potentiel * 100) : '—'}</b></span>
            </div>
            ${owner ? `<button class="pt-atc" data-who="${owner.id}"><span class="avatar" style="--c:${owner.couleur}">${esc(initials(owner))}</span>${esc(fullName(owner))}<i class="ri-arrow-right-line"></i></button>` : '<p class="muted">Zone sans ATC</p>'}`;
    } else {
        const zones = S.who ? zonesFor() : Object.keys(zi);
        const pot = zones.reduce((s, x) => s + (zi[x]?.potentiel || 0), 0), iap = zones.reduce((s, x) => s + (zi[x]?.iap || 0), 0);
        const ka = Kc(S.who, 'annee');
        box.innerHTML = `<header><h3 class="perf-title">Potentiel ${exemple}</h3></header>
            <h4>${S.who ? (isEquipe(S.who) ? 'Équipe ' + esc(equipeDe(S.who.slice(3)).nom) : esc(fullName(commercial(S.who)))) : 'Tous les ATC'}</h4>
            <div class="pt-big">${euros(pot)}<small>potentiel annuel · ${zones.length} zones</small></div>
            <div class="pt-grid">
                <span>Atterrissage ${S.ref.getFullYear()}<b>${euros(ka.projection)}</b></span>
                <span>Couverture<b>${pot ? pct(ka.projection / pot * 100) : '—'}</b></span>
                <span>IAP installés<b>${iap}</b></span>
                <span>Potentiel / IAP<b>${iap ? euros(pot / iap) : '—'}</b></span>
            </div>
            <p class="pt-hint">Le potentiel de marché est saisi par zone dans l'administration (onglet Secteurs). Cliquez une zone de la carte pour son détail ; double-cliquez pour ouvrir son ATC.</p>
            ${S.who ? '' : `<a class="link" href="#commerciaux">Voir les commerciaux<i class="ri-arrow-right-s-line"></i></a>`}`;
    }
}

function bindMap(svg) {
    const tip = $('#tip');
    svg.addEventListener('mousemove', e => {
        if (MAP.moving) return;
        const bd = e.target.closest('.badge');
        if (bd && !bd.dataset.who) { tip.innerHTML = `<h4>${esc(SECTEURS[bd.dataset.sec].nom)}</h4><div class="t-row"><span>${esc(forceDe(S.force).nom)}</span><b>Aucun ATC affecté</b></div>`; return placeTip(e); }
        if (bd && idsSecteur(bd.dataset.sec).length > 1 && !S.who) {
            tip.innerHTML = `<h4>${esc(SECTEURS[bd.dataset.sec].nom)}</h4>` + idsSecteur(bd.dataset.sec).map(id => { const c = commercial(id); const k = Kc(id, S.period, S.gamme);
                return `<div class="t-row"><span><i class="dot" style="background:${c.couleur}"></i> ${esc(fullName(c))}</span><b>${pct(k.atteinte)}</b></div>`; }).join('');
            return placeTip(e);
        }
        if (bd) {
            const c = commercial(bd.dataset.who); const k = Kc(c.id, S.period, S.gamme); const st = statut(k.atteinte, S.base.reglages);
            tip.innerHTML = `<h4><i class="dot" style="background:${c.couleur}"></i>${esc(fullName(c))}</h4>
                <div class="t-row"><span>Facturé ${pinfo().label}</span><b>${euros(k.realise)}</b></div>
                <div class="t-row"><span>Budget atteint</span><b>${pct(k.atteinte)}</b></div>
                <div class="t-row"><span>Statut</span><b>${st.label}</b></div>`;
            return placeTip(e);
        }
        const t = e.target.closest('[data-zone]');
        if (!t) { tip.classList.remove('show'); return; }
        const code = t.dataset.zone; const zi = zoneInfo.get(code); const owner = commercial(S.base.secteurs[code]); const info = S.base.zonesInfo[code] || {};
        const k = owner ? Kc(owner.id, S.period, S.gamme) : null;
        tip.innerHTML = `<h4>${esc(zi?.nom || code)} <small class="muted">${/^\d/.test(code) ? code : ''}</small></h4>
            <div class="t-row"><span>Secteur</span><b>${S.zoneSect[code] ? esc(SECTEURS[S.zoneSect[code]].nom) : '—'}</b></div>
            <div class="t-row"><span>ATC</span><b>${S.zoneSect[code] && idsSecteur(S.zoneSect[code]).length ? idsSecteur(S.zoneSect[code]).map(id => esc(fullName(commercial(id)))).join(', ') : 'Non affecté'}</b></div>
            ${k ? `<div class="t-row"><span>Budget ATC atteint</span><b>${pct(k.atteinte)}</b></div>` : ''}
            <div class="t-row"><span>Potentiel (exemple)</span><b>${euros(info.potentiel || 0)}</b></div>
            <div class="t-row"><span>IAP</span><b>${info.iap ?? 0}</b></div>`;
        placeTip(e);
    });
    svg.addEventListener('mouseleave', () => tip.classList.remove('show'));
    svg.addEventListener('click', e => {
        if (MAP.dragged) return;
        if (e.target.closest('.badge')) return; // la pastille ouvre l'ATC (gestion globale des data-who)
        const t = e.target.closest('[data-zone]');
        S.zone = t ? (S.zone === t.dataset.zone ? null : t.dataset.zone) : null;
        for (const p of svg.querySelectorAll('path.z')) p.classList.toggle('zsel', S.zone === p.dataset.zone);
        renderPotentiel();
    });
    svg.addEventListener('dblclick', e => { const t = e.target.closest('[data-zone]'); const o = t && S.base.secteurs[t.dataset.zone]; if (o) select(o); });
    svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 0.8 : 1.25, svgPoint(svg, e)); }, { passive: false });
    let start = null;
    svg.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY, vb: MAP.vb.slice() }; MAP.dragged = false; });
    window.addEventListener('pointermove', e => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!MAP.dragged && Math.hypot(dx, dy) < 5) return;
        if (!MAP.dragged) { MAP.dragged = true; moving(true); svg.classList.add('dragging'); tip.classList.remove('show'); }
        const r = MAP.rect; const s = Math.max(start.vb[2] / r.width, start.vb[3] / r.height);
        setVb([start.vb[0] - dx * s, start.vb[1] - dy * s, start.vb[2], start.vb[3]]);
    });
    window.addEventListener('pointerup', () => { if (start && MAP.dragged) moving(false); start = null; svg.classList.remove('dragging'); setTimeout(() => MAP.dragged = false, 0); });
    $('#map-in').onclick = () => zoomAt(0.7);
    $('#map-out').onclick = () => zoomAt(1.4);
    $('#map-reset').onclick = () => animateVb(MAP.full);
    new ResizeObserver(() => { MAP.rect = svg.getBoundingClientRect(); mapScale(svg, MAP.vb); }).observe(svg);
    document.addEventListener('click', e => { if (e.target.closest('[data-pt-close]')) { S.zone = null; svg.querySelectorAll('path.z.zsel').forEach(p => p.classList.remove('zsel')); renderPotentiel(); } });
}

// Pendant un zoom ou un déplacement, on coupe les effets coûteux (ombres, transitions) : la carte reste fluide
let movingT;
function moving(on) {
    const svg = $('#map');
    if (on) { clearTimeout(movingT); MAP.moving = true; svg.classList.add('moving'); }
    else movingT = setTimeout(() => { MAP.moving = false; svg.classList.remove('moving'); }, 120);
}

function placeTip(e) {
    const tip = $('#tip'); tip.classList.add('show');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > innerWidth - 8) x = e.clientX - w - 16;
    if (y + h > innerHeight - 8) y = e.clientY - h - 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function svgPoint(svg, e) { const r = MAP.rect || svg.getBoundingClientRect(); const s = Math.max(MAP.vb[2] / r.width, MAP.vb[3] / r.height);
    return [MAP.vb[0] + MAP.vb[2] / 2 + (e.clientX - r.left - r.width / 2) * s, MAP.vb[1] + MAP.vb[3] / 2 + (e.clientY - r.top - r.height / 2) * s]; }
function setVb(vb) { MAP.vb = vb; const svg = $('#map'); svg.setAttribute('viewBox', vb.map(v => v.toFixed(1)).join(' ')); mapScale(svg, vb); }
// Taille constante à l'écran des pastilles et étiquettes, quel que soit le zoom
function mapScale(svg, vb) { const r = MAP.rect || (MAP.rect = svg.getBoundingClientRect()); if (!r.width) return; svg.style.setProperty('--s', Math.max(vb[2] / r.width, vb[3] / r.height).toFixed(3)); }
function zoomAt(f, at) {
    const [x, y, w, h] = MAP.vb; const nw = Math.min(CARTE.w * 1.2, Math.max(60, w * f)), nh = nw * h / w;
    const [cx, cy] = at || [x + w / 2, y + h / 2];
    animateVb([cx - (cx - x) * nw / w, cy - (cy - y) * nh / h, nw, nh], 220);
}
function animateVb(to, ms = 550) {
    const from = MAP.vb.slice(); const t0 = performance.now(); const id = ++MAP.anim;
    moving(true);
    const step = t => { if (id !== MAP.anim) return; const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3);
        setVb(from.map((v, i) => v + (to[i] - v) * e)); if (p < 1) requestAnimationFrame(step); else moving(false); };
    requestAnimationFrame(step);
}
function zoneBox(codes) {
    let b = null;
    for (const c of codes) { const z = zoneInfo.get(c); if (!z) continue; const [x0, y0, x1, y1] = z.b; b = b ? [Math.min(b[0], x0), Math.min(b[1], y0), Math.max(b[2], x1), Math.max(b[3], y1)] : [x0, y0, x1, y1]; }
    return b;
}
function zoomTo(b, pad = 1.25) {
    if (!b) return animateVb(MAP.full);
    const r = MAP.rect || $('#map').getBoundingClientRect(); const ratio = r.width / r.height || 1;
    let w = Math.max(140, (b[2] - b[0]) * pad), h = Math.max(140, (b[3] - b[1]) * pad);
    if (w / h > ratio) h = w / ratio; else w = h * ratio;
    animateVb([(b[0] + b[2]) / 2 - w / 2, (b[1] + b[3]) / 2 - h / 2, w, h]);
}
function zoomToSelection() {
    if (!S.who) return animateVb(MAP.full);
    const zones = zonesFor();
    const metro = zones.filter(z => zoneInfo.get(z)?.inset === undefined);
    zoomTo(zoneBox(metro.length ? metro : zones));
}

// ─── Fraîcheur des données & temps réel ─────────────────────
function renderLive() {
    const e = S.base.etat || {};
    $('#live-label').textContent = e.derniere_date ? `Données au ${dateCourte(parseIso(e.derniere_date))}` : 'Aucune donnée';
    $('#live-sub').textContent = e.source === 'demo' ? 'Démonstration · importer vos fichiers' : e.dernier_import ? `Import ${relative(new Date(e.dernier_import))}` : 'Importer les fichiers du jour';
    const kinds = new Set((S.base.imports || []).map(i => i.type));
    $('#promo-steps').innerHTML = ['repartition', 'quotidien', 'portefeuille'].map(k => `<i class="${e.source !== 'demo' && (kinds.has(k) || S.base.etat?.source === 'fichiers') ? 'on' : ''}"></i>`).join('');
    const pill = $('#pill-demo');
    if (S.store.mode === 'demo') { pill.hidden = false; pill.innerHTML = e.source === 'demo' ? '<i class="ri-flask-line"></i>Démonstration · données fictives' : '<i class="ri-hard-drive-2-line"></i>Vos fichiers · ce navigateur'; }
    else pill.hidden = true;
    $('#me-name').textContent = S.session.isAdmin ? S.session.email : 'Visiteur';
}
function relative(d) {
    const s = (Date.now() - d) / 1000;
    if (s < 60) return "à l'instant"; if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.round(s / 3600)} h`; return `le ${dateCourte(d)} à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}
function toast(msg, icon = 'ri-flashlight-fill') {
    const t = $('#toast'); t.innerHTML = `<i class="${icon}"></i>${esc(msg)}`; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}

// Tableau de bord privé (réglage admin) : seuls les administrateurs connectés voient les chiffres
const locked = () => S.store.mode === 'cloud' && S.base.reglages.lecture_publique === false && !S.session.isAdmin;
function showLocked() {
    $$('.view').forEach(s => s.hidden = true);
    $('.filters').hidden = true;
    let l = $('#locked'); if (!l) { l = document.createElement('section'); l.id = 'locked'; $('.filters').after(l); }
    l.hidden = false;
    l.innerHTML = `<article class="card empty locked"><i class="ri-lock-2-line"></i><h2>Accès réservé</h2><p class="muted">Le tableau de bord est privé. Connectez-vous pour voir les chiffres.</p><button class="cta" onclick="document.querySelector('#btn-admin').click()"><i class="ri-login-circle-line"></i>Se connecter</button></article>`;
}

async function refresh(msg) {
    S.session = await S.store.session();
    await loadAll();
    if (locked()) return showLocked();
    $('#locked')?.setAttribute('hidden', ''); $('.filters').hidden = false;
    go(S.view, { push: false });
    if (msg) toast(msg);
}

// ─── Démarrage ──────────────────────────────────────────────
async function boot() {
    S.store = createStore();
    try {
        await S.store.init();
        S.session = await S.store.session();
        await loadAll();
    } catch (err) {
        $('.view[data-view="synthese"]').innerHTML = `<article class="card empty"><i class="ri-wifi-off-line"></i>Impossible de charger les données : ${esc(err.message)}</article>`;
        return;
    }
    const u = new URL(location); const c = u.searchParams.get('c'); if (c && (isEquipe(c) || commercial(c))) S.who = c;
    const v = location.hash.slice(1);
    if (locked()) showLocked(); else go(VIEWS[v] ? v : 'synthese', { push: false });
    S.store.onChange(() => refresh('Nouvelles données reçues'));
    setInterval(() => S.base && renderLive(), 30000);

    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS[h] && h !== S.view && !locked()) go(h); });
    document.addEventListener('click', e => {
        if (e.target.closest('#admin, #login')) return;
        const dd = e.target.closest('[data-dd]'); if (dd) return toggleMenu(dd);
        if (!e.target.closest('.menu')) closeMenus();
        const per = e.target.closest('[data-period]'); if (per) { S.period = per.dataset.period; remember(); closeMenus(); return renderAll(); }
        const gm = e.target.closest('[data-gamme]'); if (gm) { const g = gm.dataset.gamme || null; S.gamme = S.gamme === g && gm.closest('#gtiles') ? null : g; closeMenus(); return renderAll(); }
        const so = e.target.closest('[data-sort]'); if (so) { S.sort = so.dataset.sort; remember(); closeMenus(); return renderAll(); }
        const w = e.target.closest('[data-who]');
        if (w) { const goView = w.dataset.go; select(w.dataset.who); if (goView && goView !== S.view) go(goView); return; }
    });
    $('#force-tabs').addEventListener('click', e => { const b = e.target.closest('[data-force]'); if (!b) return; S.force = b.dataset.force; remember(); deriveForce(); renderAll({ animate: false }); });
    $('#map-mode').addEventListener('click', e => { const b = e.target.closest('[data-map]'); if (b) { S.mapMode = b.dataset.map; remember(); renderMap(); } });
    $('#clients-mode').addEventListener('click', e => { const b = e.target.closest('[data-cmode]'); if (b) { S.clientsMode = b.dataset.cmode; remember(); renderClients(); } });
    $('#search').addEventListener('input', renderWhoList);
    $('#search').addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('#who-list [data-who]'); if (b) select(b.dataset.who); } });
    $('#btn-mask').addEventListener('click', () => { S.mask = !S.mask; remember(); renderAll({ animate: false }); });
    $('#btn-import').addEventListener('click', () => { A.tab = 'import'; $('#btn-admin').click(); });
    $('#promo').addEventListener('click', () => { A.tab = 'import'; $('#btn-admin').click(); });
    $('#btn-menu').addEventListener('click', () => $('#side').classList.add('open'));
    $('#side-scrim').addEventListener('click', () => $('#side').classList.remove('open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => Object.values(S.charts).forEach(c => c.resize()), 120); });
    window.dispatchEvent(new Event('commerce:ready'));
}
document.addEventListener('DOMContentLoaded', boot);
