/* ============================================================
   COMMERCE — Tableau de bord
   ============================================================ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = c => ((c.prenom?.[0] || '') + (c.nom?.[0] || '')).toUpperCase();
const fullName = c => `${c.prenom} ${c.nom}`;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const S = {
    store: null, base: null, byDay: new Map(), ref: new Date(),
    period: 'mois', who: null, mapMode: 'secteurs', clientsMode: 'clients',
    zoneData: new Map(), zoneN1: new Map(), charts: {}, session: { isAdmin: false },
};
try { const p = JSON.parse(localStorage.getItem('commerce_vue') || '{}'); if (p.period) S.period = p.period; if (p.mapMode) S.mapMode = p.mapMode; if (p.clientsMode) S.clientsMode = p.clientsMode; } catch (e) {}
const remember = () => { try { localStorage.setItem('commerce_vue', JSON.stringify({ period: S.period, mapMode: S.mapMode, clientsMode: S.clientsMode })); } catch (e) {} };

const commercial = id => S.base.commerciaux.find(c => c.id === id);
const actifs = () => S.base.commerciaux.filter(c => c.actif !== false);
const idsFor = who => new Set(who ? [who] : S.base.commerciaux.map(c => c.id));
const zonesOf = id => Object.entries(S.base.secteurs).filter(([, c]) => c === id).map(([z]) => z);
const zoneInfo = new Map(CARTE.zones.map(z => [z.code, z]));
const bounds = p => periodBounds(p, S.ref);
const kpisFor = (who, p = S.period) => computeKpis(S.byDay, S.base.objectifs, idsFor(who), who, bounds(p));

// ─── Chargement ─────────────────────────────────────────────
async function loadAll() {
    S.base = await S.store.loadBase();
    S.ref = S.base.etat?.derniere_date ? parseIso(S.base.etat.derniere_date) : new Date();
    const y = S.ref.getFullYear();
    S.byDay = indexSeries(await S.store.serieJour(`${y - 1}-01-01`, `${y}-12-31`));
    if (S.who && !commercial(S.who)) S.who = null;
    document.title = S.base.reglages.nom || 'PICARD-ATC';
    $('#app-name').textContent = S.base.reglages.nom || 'PICARD-ATC';
    $('#app-sub').textContent = S.base.reglages.sous_titre || '';
}

async function loadZones() {
    const b = bounds(S.period);
    const [n, n1] = await Promise.all([
        S.store.parZone(iso(b.debut), iso(b.ref), S.who),
        S.store.parZone(iso(b.debutN1), iso(b.refN1), S.who),
    ]);
    S.zoneData = new Map(n.map(r => [r[0], { ca: +r[1], mg: +r[2], nb: +r[3] }]));
    S.zoneN1 = new Map(n1.map(r => [r[0], { ca: +r[1] }]));
}

async function renderAll({ animate = true } = {}) {
    renderSide(); renderHead(); renderKpis(animate); renderGauges(); renderTrajectory(); renderMonths(); renderRank(); renderLive();
    await Promise.all([loadZones().then(() => { renderMap(); renderSignals(); }), renderClients(), renderGammes()]);
}

// ─── Menu de gauche ─────────────────────────────────────────
function ringHtml(k) {
    const st = statut(k.rythme, S.base.reglages);
    const color = { ok: 'var(--ok)', warn: 'var(--warn)', late: 'var(--late)', none: 'rgba(255,255,255,.25)' }[st.key];
    const p = Math.max(0, Math.min(100, k.atteinte ?? 0));
    return { html: `<span>${k.atteinte == null ? '—' : Math.round(k.atteinte)}</span>`, style: `--p:${p};--c:${color}`, st };
}

function renderSide() {
    const q = norm($('#search').value);
    const list = S.base.commerciaux.filter(c => !q || norm(fullName(c) + ' ' + (c.code || '') + ' ' + zonesOf(c.id).map(z => zoneInfo.get(z)?.nom).join(' ')).includes(q));
    const team = kpisFor(null);
    const tr = ringHtml(team);
    const ring = $('#team-ring'); ring.innerHTML = tr.html; ring.setAttribute('style', tr.style);
    ring.title = `${pct(team.atteinte)} de l'objectif ${bounds(S.period).label}`;
    $('#team-count').textContent = `${actifs().length} commerciaux · ${euros(team.ca)}`;
    $('#team-stack').innerHTML = actifs().slice(0, 5).map(c => `<span class="avatar" style="--c:${c.couleur}"></span>`).join('');
    $('#team-all').classList.toggle('active', !S.who);

    const html = list.map((c, i) => {
        const k = kpisFor(c.id); const r = ringHtml(k); const nz = zonesOf(c.id).length;
        return `<button class="team-item ${S.who === c.id ? 'active' : ''} ${c.actif === false ? 'inactive' : ''}" data-who="${c.id}" style="animation-delay:${i * 25}ms" title="${esc(r.st.label)}">
            <span class="avatar" style="--c:${c.couleur}">${esc(initials(c))}</span>
            <span class="ti-text"><strong>${esc(fullName(c))}</strong><small>${euros(k.ca)} · ${nz} zone${nz > 1 ? 's' : ''}</small></span>
            <span class="ring" style="${r.style}" aria-label="${pct(k.atteinte)} de l'objectif">${r.html}</span>
        </button>`;
    }).join('');
    $('#team-list').innerHTML = `<div class="group">Commerciaux · ${list.length}</div>` + (html || '<div class="empty">Aucun commercial</div>');
}

function select(who) {
    S.who = who || null;
    $('#side').classList.remove('open');
    renderAll();
    const url = new URL(location); if (S.who) url.searchParams.set('c', S.who); else url.searchParams.delete('c');
    history.replaceState(null, '', url);
    zoomToSelection();
    $('#main').scrollIntoView?.({ block: 'start', behavior: 'smooth' });
}

// ─── En-tête ────────────────────────────────────────────────
function renderHead() {
    const c = S.who && commercial(S.who);
    if (c) {
        const zones = zonesOf(c.id);
        const pays = [...new Set(zones.map(z => zoneInfo.get(z)?.pays))].map(p => ({ FR: 'France', BE: 'Belgique', LU: 'Luxembourg', CH: 'Suisse' }[p])).filter(Boolean);
        const dom = zones.filter(z => zoneInfo.get(z)?.dom).length;
        $('#who').innerHTML = `<span class="avatar lg" style="--c:${c.couleur}">${esc(initials(c))}</span>
            <div><h1>${esc(fullName(c))}${c.fonction ? ` <span class="role">${esc(c.fonction)}</span>` : ''}</h1><div class="meta">
                <span><i class="ri-map-pin-2-line"></i>${zones.length} zone${zones.length > 1 ? 's' : ''}${pays.length ? ' · ' + pays.join(', ') : ''}${dom ? ` (dont ${dom} outre-mer)` : ''}</span>
                ${c.email ? `<a href="mailto:${esc(c.email)}"><i class="ri-mail-line"></i>${esc(c.email)}</a>` : ''}
                ${c.telephone ? `<a href="tel:${esc(c.telephone.replace(/\s/g, ''))}"><i class="ri-phone-line"></i>${esc(c.telephone)}</a>` : ''}
            </div>${(c.clientele || []).length ? `<div class="tags">${c.clientele.map(t => `<span class="tag"><i class="ri-user-heart-line"></i>${esc(t)}</span>`).join('')}</div>` : ''}</div>`;
    } else {
        const b = bounds(S.period);
        $('#who').innerHTML = `<span class="team-hero"><i class="ri-team-fill"></i></span>
            <div><h1>Toute l'équipe</h1><div class="meta"><span><i class="ri-calendar-2-line"></i>${b.label[0].toUpperCase() + b.label.slice(1)} · données au ${dateLongue(S.ref)}</span><span><i class="ri-user-star-line"></i>${actifs().length} commerciaux</span></div></div>`;
    }
    $$('#period button').forEach(b => b.classList.toggle('on', b.dataset.period === S.period));
    moveGlider($('#period'));
}

function moveGlider(seg) {
    const on = $('button.on', seg), g = $('.seg-glider', seg);
    if (!on || !g) return;
    g.style.width = on.offsetWidth + 'px';
    g.style.transform = `translateX(${on.offsetLeft}px)`;
}

// ─── Signaux : ce qui demande une décision ─────────────────
function renderSignals() {
    const b = bounds(S.period); const reg = S.base.reglages;
    const out = [];
    if (!S.who) {
        const rows = actifs().map(c => ({ c, k: kpisFor(c.id) }));
        const late = rows.filter(r => statut(r.k.rythme, reg).key === 'late').sort((a, b) => a.k.rythme - b.k.rythme);
        const team = kpisFor(null);
        if (team.objectif) {
            const ok = team.ecartProjection >= 0;
            out.push({ cls: ok ? 'ok' : 'warn', icon: ok ? 'ri-flag-2-fill' : 'ri-compass-3-fill',
                html: `Atterrissage ${b.label} : <b>${euros(team.projection)}</b>, soit <b>${euros(team.ecartProjection, { sign: true })}</b> vs objectif` });
        }
        if (late.length) out.push({ cls: 'late', icon: 'ri-alarm-warning-fill', html: `<b>${late.length}</b> en retard sur le rythme : ` + late.slice(0, 4).map(r => `<button class="chip-btn" data-who="${r.c.id}">${esc(r.c.prenom)} ${pct(r.k.rythme)}</button>`).join(' ') });
        else if (rows.length) out.push({ cls: 'ok', icon: 'ri-checkbox-circle-fill', html: 'Aucun commercial en retard sur son rythme' });
    } else {
        const k = kpisFor(S.who);
        const st = statut(k.rythme, reg);
        if (k.objectif) {
            const reste = Math.max(0, k.objectif - k.ca);
            const jr = workdaysBetween(addDays(b.ref, 1), b.fin);
            const manque = k.objectifADate - k.ca;
            out.push({ cls: st.key, icon: st.icon, html: `${st.label} : rythme <b>${pct(k.rythme)}</b> de l'attendu` + (manque > 0 ? ` · retard de <b>${euros(manque)}</b>` : ` · avance de <b>${euros(-manque)}</b>`) });
            if (reste > 0 && jr > 0) out.push({ cls: 'info', icon: 'ri-speed-up-fill', html: `Pour atteindre l'objectif : <b>${euros(reste / jr)}</b> par jour ouvré sur les ${jr} jours restants` });
            else if (reste <= 0) out.push({ cls: 'ok', icon: 'ri-trophy-fill', html: `Objectif ${b.label} atteint` });
        }
    }
    // Zone en plus forte baisse vs N-1 (en €)
    let worst = null;
    for (const [z, v] of S.zoneN1) {
        const d = (S.zoneData.get(z)?.ca || 0) - v.ca;
        if (v.ca > 0 && (!worst || d < worst.d)) worst = { z, d, p: d / v.ca * 100 };
    }
    if (worst && worst.d < 0 && zoneInfo.get(worst.z)) out.push({ cls: 'warn', icon: 'ri-arrow-right-down-line', html: `Plus forte baisse : <b>${esc(zoneInfo.get(worst.z).nom)}</b> ${euros(worst.d, { sign: true })} (${pct(worst.p, { sign: true })}) vs N-1` });
    $('#signals').innerHTML = out.map((s, i) => `<div class="signal ${s.cls}" style="animation-delay:${i * 60}ms"><i class="${s.icon}"></i><span>${s.html}</span></div>`).join('');
}

// ─── KPI ────────────────────────────────────────────────────
function delta(v, fmt = x => pct(x, { sign: true }), invert = false) {
    if (v == null || isNaN(v)) return '<span class="delta flat">—</span>';
    const cls = Math.abs(v) < 0.05 ? 'flat' : (v > 0) !== invert ? 'up' : 'down';
    const ico = cls === 'flat' ? 'ri-subtract-line' : v > 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
    return `<span class="delta ${cls}"><i class="${ico}"></i>${fmt(v)}</span>`;
}

function sparkline(who, b) {
    const pts = []; const k = who || 'total';
    for (let d = new Date(b.debut); d <= b.ref; d = addDays(d, 1)) if (isWorkday(d)) pts.push(S.byDay.get(iso(d))?.[k]?.ca || 0);
    // Lissage : semaines pour le trimestre et l'année, moyenne glissante sur 3 jours pour le mois
    const vals = S.period !== 'mois' ? pts.reduce((acc, v, i) => { const j = Math.floor(i / 5); acc[j] = (acc[j] || 0) + v; return acc; }, [])
        : pts.map((_, i) => { const w = pts.slice(Math.max(0, i - 1), i + 2); return w.reduce((a, b) => a + b, 0) / w.length; });
    if (vals.length < 2) return '';
    const max = Math.max(...vals) || 1, w = 92, h = 34;
    const xy = vals.map((v, i) => [i / (vals.length - 1) * w, h - 3 - v / max * (h - 6)]);
    const line = smoothPath(xy);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1cc9c8" stop-opacity=".22"/><stop offset="1" stop-color="#1cc9c8" stop-opacity="0"/></linearGradient><linearGradient id="sl" x1="0" x2="1"><stop offset="0" stop-color="#0fb5d0"/><stop offset="1" stop-color="#00e3a0"/></linearGradient></defs>
        <path d="${line}L${w} ${h}L0 ${h}Z" fill="url(#sg)"/><path d="${line}" fill="none" stroke="url(#sl)" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

function smoothPath(pts) {
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
}

function margeSub(k) {
    const om = objectifMarge(S.base.commerciaux, S.base.objectifs, idsFor(S.who), S.ref.getFullYear());
    if (om == null || k.tauxMarge == null) return `<span>Marge brute</span><b>${euros(k.marge)}</b>`;
    const ok = k.tauxMarge >= om;
    return `<span>Objectif ${pct(om, { dec: 1 })}</span><b class="${ok ? 'ok-text' : 'late-text'}"><i class="${ok ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}"></i> ${pts(k.tauxMarge - om)} · ${euros(k.marge)}</b>`;
}

function renderKpis(animate) {
    const b = bounds(S.period); const k = kpisFor(S.who);
    const jr = workdaysBetween(addDays(b.ref, 1), b.fin);
    const reste = k.objectif ? Math.max(0, k.objectif - k.ca) : null;
    const cards = [
        { icon: 'ri-money-euro-circle-line', kc: 'linear-gradient(135deg,#0fb5d0,#00e3a0)', label: "Chiffre d'affaires HT", val: k.ca, fmt: v => euros(v),
            row: `${delta(k.evol)}<span>vs ${euros(k.caN1)} en N-1</span>`, extra: sparkline(S.who, b),
            sub: `<span>Objectif ${b.label}</span><b>${euros(k.objectif)}</b>` },
        { icon: 'ri-flight-land-line', kc: 'linear-gradient(135deg,#8b5cf6,#ec4899)', label: 'Atterrissage prévu', val: k.projection, fmt: v => euros(v),
            row: k.objectif ? `${delta(k.ecartProjection, v => euros(v, { sign: true }))}<span>vs objectif</span>` : '<span>au rythme actuel</span>',
            sub: reste != null ? `<span>Reste à faire</span><b>${euros(reste)}${jr && reste ? ` · ${euros(reste / jr)}/j` : ''}</b>` : `<span>Fin de période</span><b>${dateCourte(b.fin)}</b>` },
        { icon: 'ri-percent-line', kc: 'linear-gradient(135deg,#10b981,#84cc16)', label: 'Taux de marge', val: k.tauxMarge, fmt: v => pct(v, { dec: 1 }),
            row: `${delta(k.tauxMargeN1 != null && k.tauxMarge != null ? k.tauxMarge - k.tauxMargeN1 : null, pts)}<span>vs N-1</span>`,
            sub: margeSub(k) },
        { icon: 'ri-shopping-bag-3-line', kc: 'linear-gradient(135deg,#f59e0b,#ef4444)', label: 'Commandes', val: k.commandes, fmt: v => nf0.format(v),
            row: `${delta(k.commandesN1 ? (k.commandes / k.commandesN1 - 1) * 100 : null)}<span>vs N-1</span>`,
            sub: `<span>Panier moyen</span><b>${euros(k.panier, { compact: false })} ${k.panierN1 ? `<small class="muted">(${pct((k.panier / k.panierN1 - 1) * 100, { sign: true })})</small>` : ''}</b>` },
    ];
    $('#kpis').innerHTML = cards.map((c, i) => `<article class="kpi" style="--kc:${c.kc};animation-delay:${i * 50}ms">
        ${c.extra || ''}<div class="kpi-top"><i class="${c.icon}"></i>${c.label}</div>
        <div class="kpi-val" data-val="${c.val ?? ''}" data-i="${i}">${c.val == null ? '—' : c.fmt(c.val)}</div>
        <div class="kpi-row">${c.row}</div><div class="kpi-sub">${c.sub}</div></article>`).join('');
    if (animate) $$('#kpis .kpi-val').forEach(el => { const v = parseFloat(el.dataset.val); if (!isNaN(v)) countUp(el, v, cards[+el.dataset.i].fmt); });
}

function countUp(el, to, fmt, ms = 900) {
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
}

// ─── Jauges ─────────────────────────────────────────────────
function renderGauges() {
    const el = $('#gauges');
    if (!el.dataset.ready) {
        el.innerHTML = ['mois', 'trimestre', 'annee'].map(p => `<button class="gauge" data-period="${p}"><div class="g-chart"></div><div class="g-title"></div><div class="g-sub"></div><span class="g-status"></span></button>`).join('');
        el.dataset.ready = 1;
    }
    for (const g of $$('.gauge', el)) {
        const p = g.dataset.period; const k = kpisFor(S.who, p); const b = bounds(p);
        const st = statut(k.rythme, S.base.reglages); const [c1, c2] = ['#0fb5d0', '#00e3a0'];
        g.classList.toggle('on', p === S.period);
        $('.g-title', g).textContent = { mois: MOIS_LONG[b.ref.getMonth()].replace(/^./, m => m.toUpperCase()), trimestre: b.label.split(' ')[0], annee: String(b.ref.getFullYear()) }[p];
        $('.g-sub', g).textContent = k.objectif ? `${euros(k.ca)} / ${euros(k.objectif)}` : 'Aucun objectif';
        const s = $('.g-status', g); s.className = 'g-status ' + st.key; s.innerHTML = `<i class="${st.icon}"></i>${st.label}`;
        const chart = S.charts['g' + p] || (S.charts['g' + p] = echarts.init($('.g-chart', g), null, { renderer: 'svg' }));
        const val = Math.min(k.atteinte ?? 0, 100), mark = Math.min(k.attendu ?? 0, 100);
        const track = css('--surface-3');
        chart.setOption({
            animationDuration: 1100, animationEasingUpdate: 'cubicOut', animationDurationUpdate: 900,
            series: [
                { type: 'gauge', startAngle: 90, endAngle: -270, min: 0, max: 100, radius: '88%', center: ['50%', '50%'],
                  progress: { show: true, roundCap: false, width: 9, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: c1 }, { offset: 1, color: c2 }]), shadowBlur: 10, shadowColor: 'rgba(15,181,208,.35)' } },
                  axisLine: { roundCap: false, lineStyle: { width: 9, color: [[1, track]] } },
                  pointer: { show: false }, anchor: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, title: { show: false },
                  detail: { valueAnimation: true, offsetCenter: [0, 0], fontSize: g.offsetWidth < 170 ? 20 : 26, fontWeight: 300, fontFamily: 'Roboto', color: css('--text'), formatter: () => k.atteinte == null ? '—' : `${Math.round(k.atteinte)}%` },
                  data: [{ value: val }] },
                // Repère « attendu à date »
                { type: 'gauge', startAngle: 90, endAngle: -270, min: 0, max: 100, radius: '88%', center: ['50%', '50%'],
                  axisLine: { show: false }, progress: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, detail: { show: false }, title: { show: false }, anchor: { show: false },
                  pointer: { show: k.attendu != null, icon: 'rect', length: '14%', width: 2, offsetCenter: [0, '-80%'], itemStyle: { color: css('--target') } },
                  data: [{ value: mark }] },
            ],
        });
        g.title = k.objectif ? `Réalisé ${pct(k.atteinte)} de l'objectif · attendu à date ${pct(k.attendu)} · rythme ${pct(k.rythme)}` : '';
    }
}

// ─── Trajectoire cumulée ────────────────────────────────────
function baseAxis() {
    return {
        axisLine: { lineStyle: { color: css('--chart-grid') } }, axisTick: { show: false },
        axisLabel: { color: css('--chart-axis'), fontSize: 11, fontFamily: 'Roboto' },
        splitLine: { lineStyle: { color: css('--chart-grid') } },
    };
}
const tooltipStyle = () => ({
    backgroundColor: css('--surface-3'), borderColor: css('--line-strong'), borderWidth: 1, padding: [8, 12],
    textStyle: { color: css('--text'), fontSize: 12, fontFamily: 'Roboto' }, extraCssText: 'border-radius:0;box-shadow:0 12px 30px rgba(0,0,0,.25)',
});

function renderTrajectory() {
    const b = bounds(S.period); const ids = idsFor(S.who); const k = kpisFor(S.who);
    // Jours ouvrés uniquement : pas de « marches » le week-end, des courbes continues
    const objAll = objectifCumul(S.base.objectifs, ids, b.debut, b.fin).filter(o => isWorkday(parseIso(o[0])));
    const realMap = new Map(cumulative(S.byDay, b.debut, b.ref, S.who));
    const n1All = cumulative(S.byDay, b.debutN1, b.finN1, S.who);
    const dates = objAll.map(o => o[0]);
    const real = dates.map(d => realMap.has(d) ? realMap.get(d) : null);
    const idxRef = real.reduce((m, v, i) => v != null ? i : m, -1);
    const last = idxRef >= 0 ? real[idxRef] : 0;
    // N-1 recalé : même rang de jour ouvré dans la période de l'an dernier
    const n1Work = n1All.filter(o => isWorkday(parseIso(o[0])));
    const n1Vals = dates.map((_, i) => n1Work[i]?.[1] ?? n1Work.at(-1)?.[1] ?? null);
    const proj = dates.map((_, i) => i === idxRef ? last : null);
    const hasProj = dates.length - 1 > idxRef && idxRef >= 0;
    if (hasProj) proj[dates.length - 1] = k.projection;
    const hasObj = k.objectif > 0;
    $('#traj-sub').textContent = `· ${b.label}`;
    const colors = { real: '#1cc9c8', obj: css('--target'), n1: css('--n1'), proj: '#00e3a0' };
    $('#traj-legend').innerHTML = `<span><i class="lg-line" style="border-color:${colors.real}"></i>Réalisé</span>${hasObj ? `<span><i class="lg-line lg-dash" style="border-color:${colors.obj}"></i>Objectif</span>` : ''}<span><i class="lg-line" style="border-color:${colors.n1}"></i>N-1</span><span><i class="lg-line lg-dash" style="border-color:${colors.proj}"></i>Atterrissage</span>`;
    const chart = S.charts.traj || (S.charts.traj = echarts.init($('#chart-traj'), null, { renderer: 'svg' }));
    const fmtDate = s => { const d = parseIso(s); return S.period === 'mois' ? String(d.getDate()) : MOIS[d.getMonth()]; };
    const smooth = { smooth: .45, smoothMonotone: 'x', showSymbol: false };
    chart.setOption({
        animationDuration: 1200, animationEasing: 'cubicOut', grid: { left: 8, right: 14, top: 16, bottom: 4, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), axisPointer: { type: 'line', lineStyle: { color: css('--line-strong'), type: 'dashed' } },
            formatter: ps => { const d = parseIso(dates[ps[0].dataIndex]); return `<b>${dateLongue(d)}</b><br>` + ps.filter(p => p.value != null).map(p => `${p.marker}${p.seriesName} <b style="float:right;margin-left:16px">${euros(p.value)}</b>`).join('<br>'); } },
        xAxis: { type: 'category', data: dates, boundaryGap: false, ...baseAxis(), splitLine: { show: false },
            axisLabel: { ...baseAxis().axisLabel, formatter: fmtDate, interval: S.period === 'mois' ? 3 : S.period === 'trimestre' ? 10 : 21 } },
        yAxis: { type: 'value', ...baseAxis(), axisLine: { show: false }, splitLine: { lineStyle: { color: css('--chart-grid'), type: [3, 4] } }, axisLabel: { ...baseAxis().axisLabel, formatter: v => euros(v) } },
        series: [
            { name: 'N-1', type: 'line', data: n1Vals, ...smooth, lineStyle: { width: 1.3, color: colors.n1 }, itemStyle: { color: colors.n1 }, z: 1,
              areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(63,135,148,.35)' }, { offset: 1, color: 'rgba(63,135,148,.02)' }]) } },
            ...(hasObj ? [{ name: 'Objectif', type: 'line', data: objAll.map(o => o[1]), ...smooth, lineStyle: { width: 1.3, type: [5, 5], color: colors.obj, opacity: .75 }, itemStyle: { color: colors.obj }, z: 2 }] : []),
            { name: 'Atterrissage', type: 'line', data: proj, connectNulls: true, showSymbol: false, lineStyle: { width: 1.8, type: [2, 5], cap: 'round', color: colors.proj }, itemStyle: { color: colors.proj }, z: 3,
              markPoint: hasProj ? { symbol: 'circle', symbolSize: 6, itemStyle: { color: colors.proj }, data: [{ coord: [dates.length - 1, k.projection] }],
                  label: { show: true, position: 'left', distance: 8, formatter: () => euros(k.projection), color: colors.proj, fontWeight: 600, fontSize: 11 } } : undefined },
            { name: 'Réalisé', type: 'line', data: real, ...smooth, z: 4,
              lineStyle: { width: 2.4, cap: 'round', color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#0fb5d0' }, { offset: 1, color: '#00e3a0' }]), shadowBlur: 12, shadowColor: 'rgba(15,181,208,.35)', shadowOffsetY: 5 },
              itemStyle: { color: colors.real },
              areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0,227,160,.55)' }, { offset: .7, color: 'rgba(15,181,208,.12)' }, { offset: 1, color: 'rgba(15,181,208,0)' }]) },
              markPoint: idxRef >= 0 ? { symbol: 'circle', symbolSize: 9, itemStyle: { color: '#00e3a0', borderColor: css('--surface'), borderWidth: 2, shadowBlur: 10, shadowColor: 'rgba(0,227,160,.6)' }, label: { show: false }, data: [{ coord: [idxRef, last] }] } : undefined },
        ],
    }, true);
}

// ─── Mois par mois : courbes lissées en dégradé ─────────────
function renderMonths() {
    const y = S.ref.getFullYear(); const ids = idsFor(S.who);
    const n = [], n1 = [], obj = [];
    for (let m = 0; m < 12; m++) {
        const d1 = new Date(y, m, 1), d2 = new Date(y, m + 1, 0);
        n.push(d1 > S.ref ? null : sumRange(S.byDay, d1, d2 < S.ref ? d2 : S.ref, S.who).ca);
        n1.push(sumRange(S.byDay, new Date(y - 1, m, 1), new Date(y - 1, m + 1, 0), S.who).ca);
        obj.push(objectifMois(S.base.objectifs, ids, y, m + 1) || null);
    }
    // Mois en cours incomplet : pointillé jusqu'à la projection de fin de mois
    const cur = S.ref.getMonth();
    const kM = kpisFor(S.who, 'mois');
    const nDone = n.map((v, m) => m < cur ? v : null);
    const nCur = n.map((v, m) => m === cur - 1 ? v : m === cur ? kM.projection : null);
    $('#months-sub').textContent = `· ${y} vs ${y - 1}`;
    const hasObj = obj.some(Boolean);
    $('#months-legend').innerHTML = `<span><i class="lg-line" style="border-color:#1cc9c8"></i>${y}</span><span><i class="lg-line lg-dash" style="border-color:#00e3a0"></i>${MOIS_LONG[cur]} projeté</span><span><i class="lg-line" style="border-color:${css('--n1')}"></i>${y - 1}</span>${hasObj ? `<span><i class="lg-line lg-dash" style="border-color:${css('--target')}"></i>Objectif</span>` : ''}`;
    const chart = S.charts.months || (S.charts.months = echarts.init($('#chart-months'), null, { renderer: 'svg' }));
    const smooth = { smooth: .5, smoothMonotone: 'x' };
    chart.setOption({
        animationDuration: 1200, animationEasing: 'cubicOut',
        grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), axisPointer: { type: 'line', lineStyle: { color: css('--line-strong'), type: 'dashed' } },
            formatter: ps => { const m = ps[0].dataIndex; const v = n[m], v1 = n1[m], o = obj[m];
                return `<b>${MOIS_LONG[m]}</b><br>${y} : <b>${euros(v)}</b>${m === cur ? ` <span style="opacity:.7">(à date · projeté ${euros(kM.projection)})</span>` : ''}${v != null && v1 && m !== cur ? ` (${pct((v / v1 - 1) * 100, { sign: true })})` : ''}<br>${y - 1} : <b>${euros(v1)}</b>` + (o ? `<br>Objectif : <b>${euros(o)}</b>` : ''); } },
        xAxis: { type: 'category', data: MOIS.map(m => m.replace('.', '')), boundaryGap: false, ...baseAxis(), splitLine: { show: false } },
        yAxis: { type: 'value', ...baseAxis(), axisLine: { show: false }, splitLine: { lineStyle: { color: css('--chart-grid'), type: [3, 4] } }, axisLabel: { ...baseAxis().axisLabel, formatter: v => euros(v) } },
        series: [
            { name: String(y - 1), type: 'line', data: n1, ...smooth, showSymbol: false, z: 1, lineStyle: { width: 1.3, color: css('--n1') }, itemStyle: { color: css('--n1') },
              areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(63,135,148,.35)' }, { offset: 1, color: 'rgba(63,135,148,.02)' }]) } },
            ...(hasObj ? [{ name: 'Objectif', type: 'line', data: obj, ...smooth, showSymbol: false, z: 2, lineStyle: { width: 1.3, type: [5, 5], color: css('--target'), opacity: .75 }, itemStyle: { color: css('--target') } }] : []),
            { name: 'Projection', type: 'line', data: nCur, ...smooth, showSymbol: false, z: 3, lineStyle: { width: 1.8, type: [2, 5], cap: 'round', color: '#00e3a0' }, itemStyle: { color: '#00e3a0' } },
            { name: String(y), type: 'line', data: nDone, ...smooth, z: 4, symbol: 'circle', symbolSize: 5, showSymbol: true,
              itemStyle: { color: '#00e3a0', borderColor: css('--surface'), borderWidth: 1.5 },
              lineStyle: { width: 2.4, cap: 'round', color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#0fb5d0' }, { offset: 1, color: '#00e3a0' }]), shadowBlur: 12, shadowColor: 'rgba(15,181,208,.35)', shadowOffsetY: 5 },
              areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0,227,160,.55)' }, { offset: .7, color: 'rgba(15,181,208,.12)' }, { offset: 1, color: 'rgba(15,181,208,0)' }]) },
              emphasis: { scale: 1.6 } },
        ],
    }, true);
}

// ─── Classement (équipe) / Zones (commercial) ──────────────
function renderRank() {
    const reg = S.base.reglages;
    if (!S.who) {
        $('#rank-title').innerHTML = '<i class="ri-trophy-line"></i>Classement <small>· % de l\'objectif</small>';
        $('#rank-hint').innerHTML = '<i class="ri-cursor-line"></i>Cliquez pour ouvrir';
        const rows = actifs().map(c => ({ c, k: kpisFor(c.id) })).sort((a, b) => (b.k.rythme ?? -1) - (a.k.rythme ?? -1));
        $('#rank').innerHTML = rows.map(({ c, k }, i) => {
            const st = statut(k.rythme, reg);
            return `<button class="rank-row" data-who="${c.id}" style="animation-delay:${i * 30}ms" title="${esc(st.label)} · rythme ${pct(k.rythme)}">
                <span class="avatar" style="--c:${c.couleur}">${esc(initials(c))}</span>
                <span><span class="r-name">${esc(fullName(c))}<small>${euros(k.ca)}</small></span>
                <span class="bar"><span data-w="${Math.min(100, (k.atteinte || 0) / 1.2)}"></span>${k.attendu != null ? `<i style="left:${Math.min(100, k.attendu / 1.2)}%"></i>` : ''}</span></span>
                <span class="r-val">${pct(k.atteinte)}<small class="${st.key}"><i class="${st.icon}"></i>${k.evol == null ? '' : pct(k.evol, { sign: true })}</small></span>
            </button>`;
        }).join('') || '<div class="empty"><i class="ri-user-add-line"></i>Ajoutez vos commerciaux dans l\'admin</div>';
    } else {
        $('#rank-title').innerHTML = '<i class="ri-map-pin-line"></i>Zones du secteur <small>· chiffre de la période</small>';
        $('#rank-hint').innerHTML = '';
        $('#rank').innerHTML = '<div class="empty"><i class="ri-loader-4-line"></i>Chargement…</div>';
    }
    requestAnimationFrame(() => $$('#rank .bar > span').forEach(s => s.style.width = s.dataset.w + '%'));
}

function renderZonesList() {
    if (!S.who) return;
    const rows = [...S.zoneData.entries()].map(([z, v]) => ({ z, v, n1: S.zoneN1.get(z)?.ca || 0 })).sort((a, b) => b.v.ca - a.v.ca).slice(0, 8);
    const max = rows[0]?.v.ca || 1;
    $('#rank').innerHTML = rows.map((r, i) => {
        const ev = r.n1 ? (r.v.ca / r.n1 - 1) * 100 : null; const zi = zoneInfo.get(r.z);
        return `<div class="client-row" style="animation-delay:${i * 30}ms" data-zone="${esc(r.z)}"><span class="num">${i + 1}</span>
            <span><span class="r-name c-name">${esc(zi?.nom || r.z)}</span><span class="bar"><span data-w="${r.v.ca / max * 100}"></span></span></span>
            <span class="r-val">${euros(r.v.ca)}<small class="${ev == null ? 'none' : ev >= 0 ? 'ok' : 'late'}">${ev == null ? 'nouveau' : pct(ev, { sign: true })}</small></span></div>`;
    }).join('') || '<div class="empty"><i class="ri-map-pin-line"></i>Aucune vente localisée sur la période</div>';
    requestAnimationFrame(() => $$('#rank .bar > span').forEach(s => s.style.width = s.dataset.w + '%'));
}

// ─── Meilleurs clients ──────────────────────────────────────
async function renderClients() {
    const b = bounds(S.period);
    $('#clients-sub').textContent = `· ${b.label}`;
    $$('#clients-mode button').forEach(x => x.classList.toggle('on', x.dataset.cmode === S.clientsMode));
    moveGlider($('#clients-mode'));
    const total = kpisFor(S.who).ca || 1;
    if (S.clientsMode === 'segments') {
        const rows = await S.store.parSegment(iso(b.debut), iso(b.ref), S.who);
        const max = rows[0]?.[1] || 1;
        const suivis = new Set(S.who ? commercial(S.who)?.clientele || [] : []);
        $('#clients').innerHTML = rows.map(([n, ca, nb], i) => `<div class="client-row" style="animation-delay:${i * 30}ms"><span class="num">${suivis.has(n) ? '<i class="ri-star-fill grad-text" title="Clientèle suivie"></i>' : i + 1}</span>
            <span><span class="c-name">${esc(n)}</span><span class="bar"><span data-w="${ca / max * 100}"></span></span></span>
            <span class="r-val">${pct(ca / total * 100)}<small>${euros(+ca)} · ${nb} cde${nb > 1 ? 's' : ''}</small></span></div>`).join('') || '<div class="empty"><i class="ri-pie-chart-line"></i>Ajoutez une colonne « Type client » au fichier pour voir cette répartition</div>';
    } else {
        const rows = await S.store.topClients(iso(b.debut), iso(b.ref), S.who, 7);
        const max = rows[0]?.[1] || 1;
        $('#clients').innerHTML = rows.map(([n, ca, nb], i) => `<div class="client-row" style="animation-delay:${i * 30}ms"><span class="num">${i + 1}</span>
            <span><span class="c-name" title="${esc(n)}">${esc(n)}</span><span class="bar"><span data-w="${ca / max * 100}"></span></span></span>
            <span class="r-val">${euros(+ca)}<small>${pct(ca / total * 100)} · ${nb} cde${nb > 1 ? 's' : ''}</small></span></div>`).join('') || '<div class="empty"><i class="ri-building-2-line"></i>Aucun client sur la période</div>';
    }
    requestAnimationFrame(() => $$('#clients .bar > span').forEach(s => s.style.width = s.dataset.w + '%'));
}
// ─── Gammes produits ────────────────────────────────────────
const GAMME_ICONE = { 'serrures': 'ri-lock-2-line', 'portes blindees': 'ri-shield-keyhole-line', 'portes techniques': 'ri-door-lock-box-line', 'portes de hall': 'ri-building-4-line', 'eliot': 'ri-bluetooth-connect-line' };
const gammeIcone = g => GAMME_ICONE[norm(g)] || 'ri-stack-line';

async function renderGammes() {
    const b = bounds(S.period);
    const [n, n1] = await Promise.all([S.store.parGamme(iso(b.debut), iso(b.ref), S.who), S.store.parGamme(iso(b.debutN1), iso(b.refN1), S.who)]);
    const cur = new Map(n.map(r => [r[0], { ca: +r[1], mg: +r[2] }])), prev = new Map(n1.map(r => [r[0], +r[1]]));
    const ordre = [...(S.base.reglages.gammes || [])];
    for (const r of n) if (!ordre.includes(r[0]) && r[0] !== 'Non renseignée') ordre.push(r[0]);
    const total = n.reduce((s, r) => s + +r[1], 0) || 1;
    const el = $('#gammes');
    if (!n.length || (n.length === 1 && n[0][0] === 'Non renseignée')) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = ordre.map((g, i) => {
        const v = cur.get(g) || { ca: 0, mg: 0 }; const p1 = prev.get(g) || 0; const icon = gammeIcone(g);
        const ev = p1 ? (v.ca / p1 - 1) * 100 : null;
        return `<div class="gamme" style="animation-delay:${i * 50}ms" title="${esc(g)} : ${euros(v.ca, { compact: false })} · marge ${pct(v.ca ? v.mg / v.ca * 100 : null, { dec: 1 })}">
            <div class="g-top"><i class="${icon}"></i>${esc(g)}</div>
            <div class="g-val">${euros(v.ca)}<small>${pct(v.ca / total * 100)} du CA</small></div>
            <div class="g-mix"><span data-w="${v.ca / total * 100}"></span></div>
            <div class="g-foot"><span>Marge ${pct(v.ca ? v.mg / v.ca * 100 : null)}</span>${delta(ev)}</div></div>`;
    }).join('');
    requestAnimationFrame(() => $$('#gammes .g-mix span').forEach(s => s.style.width = s.dataset.w + '%'));
}

// ─── Carte ──────────────────────────────────────────────────
const MAP = { vb: null, full: [0, 0, CARTE.w, CARTE.h], anim: 0 };
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e; };
const SHORT = { '975': 'SPM', '987': 'PF', '988': 'NC', '971': 'GP', '972': 'MQ', '973': 'GF', '974': 'RE', '976': 'YT', LU: 'LU' };
const zoneShort = z => SHORT[z] || (z.includes('-') ? z.split('-')[1] : z);

// Construit la carte : fond (pays voisins), encarts outre-mer, zones, frontières, pastilles
function buildMap(svg, { badges = true } = {}) {
    svg.setAttribute('viewBox', `0 0 ${CARTE.w} ${CARTE.h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = '';
    svg.style.setProperty('--s', 1);
    el('defs', {}, svg);
    el('path', { d: CARTE.fond, class: 'fond' }, svg);
    const gIn = el('g', { class: 'insets' }, svg);
    for (const i of CARTE.insets) {
        el('rect', { x: i.x, y: i.y, width: i.w, height: i.h, class: 'inset-box', 'data-zone': i.code }, gIn);
        el('text', { x: i.x + 9, y: i.y + 16, class: 'inset-label' }, gIn).textContent = i.nom.replace('Saint-Pierre-et-Miquelon', 'St-Pierre-et-M.').replace('Polynésie française', 'Polynésie').replace('Nouvelle-Calédonie', 'N.-Calédonie');
    }
    const defs = $('defs', svg);
    const sh = el('linearGradient', { id: 'sheen-' + svg.id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: CARTE.w, y2: CARTE.h }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': .55 }, sh);
    el('stop', { offset: .5, 'stop-color': '#fff', 'stop-opacity': 0 }, sh);
    el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': .45 }, sh);
    const land = el('g', { class: 'land' }, svg);
    const gz = el('g', { class: 'zones' }, land);
    for (const z of CARTE.zones) el('path', { d: z.d, class: 'z', 'data-zone': z.code }, gz);
    // Reflet : un léger dégradé de lumière sur l'ensemble, les couleurs des ATC restent unies
    const gs = el('g', { class: 'sheen', fill: `url(#sheen-${svg.id})` }, land);
    for (const z of CARTE.zones) el('path', { d: z.d, 'fill-rule': 'evenodd' }, gs);
    const gb = el('g', { class: 'borders' }, land);
    for (const b of CARTE.borders) { const p = el('path', { d: b.d, class: 'b' }, gb); p._a = b.a; p._b = b.b; }
    el('g', { class: 'zlabels' }, svg);
    if (badges) el('g', { class: 'badges' }, svg);
}

// Une couleur unie par commercial sur toutes ses zones (le relief vient de l'ombre et des frontières)
const fillOf = c => c.couleur;

// Frontières : internes au secteur (fines), entre secteurs (marquées), côtes, contour du secteur choisi
function paintBorders(svg, ownerOf, selected) {
    for (const p of $$('path.b', svg)) {
        const oa = ownerOf(p._a) || null, ob = p._b ? ownerOf(p._b) || null : undefined;
        let cls = 'b ';
        if (ob === undefined) cls += 'b-coast';
        else if (oa === ob) cls += 'b-in';
        else cls += 'b-sector';
        if (selected && ((oa === selected) !== (ob === selected))) cls += ' b-sel';
        p.setAttribute('class', cls);
    }
}

function seqColor(t) { // une seule teinte, du clair au foncé (bleu)
    const stops = document.documentElement.dataset.theme === 'light' ? ['#d9f2f3', '#86d9df', '#0fb5d0', '#0b8aa0', '#0b5e6e'] : ['#33505b', '#147d8f', '#0fb5d0', '#3fdcbc', '#b9f7e4'];
    return interpolate(stops, t);
}
function divColor(t) { // -1 … +1 : rouge ↔ gris ↔ vert
    const neutral = document.documentElement.dataset.theme === 'light' ? '#e3eaed' : '#3a5460';
    return t < 0 ? interpolate([neutral, '#f3a0a6', '#e0606f'], -t) : interpolate([neutral, '#7ee8c6', '#00c38c'], t);
}
function interpolate(stops, t) {
    t = Math.max(0, Math.min(1, t)); const n = stops.length - 1; const i = Math.min(n - 1, Math.floor(t * n)); const f = t * n - i;
    const a = hex(stops[i]), b = hex(stops[i + 1]);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
}
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function zoneFill(code) {
    const owner = S.base.secteurs[code]; const c = owner && commercial(owner);
    if (S.mapMode === 'secteurs') return c ? fillOf(c) : 'var(--zone-empty)';
    const v = S.zoneData.get(code)?.ca || 0;
    if (S.mapMode === 'ca') { if (!v) return 'var(--zone-empty)'; const max = Math.max(...[...S.zoneData.values()].map(x => x.ca)); return seqColor(Math.sqrt(v / max)); }
    const v1 = S.zoneN1.get(code)?.ca || 0;
    if (!v && !v1) return 'var(--zone-empty)';
    const ev = v1 ? v / v1 - 1 : 1;
    return divColor(Math.max(-1, Math.min(1, ev / 0.3)));
}

// Pastille au centre de chaque secteur (centre pondéré par la surface des zones)
function sectorCenters() {
    const acc = new Map();
    for (const z of CARTE.zones) {
        const o = S.base.secteurs[z.code]; if (!o || z.inset !== undefined) continue;
        const e = acc.get(o) || acc.set(o, { x: 0, y: 0, a: 0 }).get(o);
        e.x += z.c[0] * z.a; e.y += z.c[1] * z.a; e.a += z.a;
    }
    for (const z of CARTE.zones) { // commerciaux uniquement outre-mer
        const o = S.base.secteurs[z.code]; if (!o || acc.has(o) || z.inset === undefined) continue;
        acc.set(o, { x: z.c[0], y: z.c[1] - 30, a: 1 });
    }
    return [...acc].map(([id, e]) => ({ id, x: e.x / e.a, y: e.y / e.a }));
}

function renderBadges(svg) {
    const g = $('g.badges', svg); if (!g) return;
    g.innerHTML = '';
    if (S.mapMode !== 'secteurs') return;
    for (const { id, x, y } of sectorCenters()) {
        const c = commercial(id); if (!c || (S.who && S.who !== id)) continue;
        const b = el('g', { class: 'badge' + (S.who === id ? ' on' : ''), 'data-who': id }, g);
        b.style.transform = `translate(${x}px, ${y}px) scale(var(--s))`;
        if (S.who === id) {
            const w = 20 + fullName(c).length * 6.3;
            el('rect', { x: -14, y: -14, width: w + 16, height: 28, class: 'badge-pill' }, b);
            el('text', { x: 18, y: 4, class: 'badge-name' }, b).textContent = fullName(c);
        }
        el('circle', { r: 11, fill: c.couleur, class: 'badge-dot' }, b);
        el('text', { y: 3.3, class: 'badge-txt' }, b).textContent = initials(c);
    }
}

function renderZoneLabels(svg, mine) {
    const g = $('g.zlabels', svg); g.innerHTML = '';
    if (!mine) return;
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
    const mine = S.who ? new Set(zonesOf(S.who)) : null;
    for (const p of $$('path.z', svg)) {
        const z = p.dataset.zone;
        p.style.fill = zoneFill(z);
        p.classList.toggle('dim', !!mine && !mine.has(z));
    }
    svg.classList.toggle('has-sel', !!mine);
    svg.dataset.mode = S.mapMode;
    paintBorders(svg, z => S.base.secteurs[z], S.who);
    renderBadges(svg); renderZoneLabels(svg, mine);
    $$('#map-mode button').forEach(b => b.classList.toggle('on', b.dataset.map === S.mapMode));
    moveGlider($('#map-mode'));
    renderMapLegend();
    renderZonesList();
}

function renderMapLegend() {
    const el = $('#map-legend');
    el.hidden = S.mapMode === 'secteurs';
    if (S.mapMode === 'secteurs') return;
    if (S.mapMode === 'ca') {
        const max = Math.max(0, ...[...S.zoneData.values()].map(x => x.ca));
        el.innerHTML = `<strong>Chiffre par zone</strong><div class="ramp" style="background:linear-gradient(90deg,${[0, .25, .5, .75, 1].map(seqColor).join(',')})"></div><div class="ramp-lbl"><span>0</span><span>${euros(max)}</span></div>`;
    } else {
        el.innerHTML = `<strong>Évolution vs N-1</strong><div class="ramp" style="background:linear-gradient(90deg,${[-1, -.5, 0, .5, 1].map(divColor).join(',')})"></div><div class="ramp-lbl"><span>−30 %</span><span>0</span><span>+30 %</span></div>`;
    }
}

function bindMap(svg) {
    const tip = $('#tip');
    svg.addEventListener('mousemove', e => {
        const bd = e.target.closest('.badge');
        if (bd && !MAP.dragged) {
            const c = commercial(bd.dataset.who); const k = kpisFor(c.id); const st = statut(k.rythme, S.base.reglages);
            tip.innerHTML = `<h4><i class="dot" style="background:${c.couleur}"></i>${esc(fullName(c))}</h4>
                <div class="t-row"><span>Chiffre ${bounds(S.period).label}</span><b>${euros(k.ca)}</b></div>
                <div class="t-row"><span>Objectif atteint</span><b>${pct(k.atteinte)}</b></div>
                <div class="t-row"><span>Statut</span><b>${st.label}</b></div>
                <div class="t-row"><span>Zones</span><b>${zonesOf(c.id).length}</b></div>`;
            return placeTip(e);
        }
        const t = e.target.closest('[data-zone]');
        if (!t || MAP.dragged) { tip.classList.remove('show'); return; }
        const code = t.dataset.zone; const zi = zoneInfo.get(code); const owner = commercial(S.base.secteurs[code]);
        const v = S.zoneData.get(code), v1 = S.zoneN1.get(code);
        const ev = v && v1?.ca ? (v.ca / v1.ca - 1) * 100 : null;
        tip.innerHTML = `<h4>${esc(zi?.nom || code)} <small class="muted">${/^\d/.test(code) ? code : ''}</small></h4>
            <div class="t-row"><span>Commercial</span><b>${owner ? `<i class="dot" style="background:${owner.couleur}"></i> ${esc(fullName(owner))}` : 'Non attribuée'}</b></div>
            <div class="t-row"><span>Chiffre ${bounds(S.period).label}</span><b>${euros(v?.ca || 0)}</b></div>
            <div class="t-row"><span>vs N-1</span><b>${ev == null ? '—' : pct(ev, { sign: true })}</b></div>
            ${v?.nb ? `<div class="t-row"><span>Commandes</span><b>${nf0.format(v.nb)}</b></div>` : ''}`;
        placeTip(e);
    });
    svg.addEventListener('mouseleave', () => tip.classList.remove('show'));
    svg.addEventListener('click', e => {
        if (MAP.dragged) return;
        const t = e.target.closest('[data-zone]'); if (!t) return;
        const owner = S.base.secteurs[t.dataset.zone];
        if (owner && owner !== S.who) select(owner);
        else if (owner === S.who && S.who) zoomTo(zoneBox([t.dataset.zone]), 2.2);
    });
    // Zoom à la molette et déplacement à la souris
    svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 0.8 : 1.25, svgPoint(svg, e)); }, { passive: false });
    let start = null;
    svg.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY, vb: MAP.vb.slice() }; MAP.dragged = false; });
    window.addEventListener('pointermove', e => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!MAP.dragged && Math.hypot(dx, dy) < 5) return;
        MAP.dragged = true; svg.classList.add('dragging');
        const r = svg.getBoundingClientRect(); const s = Math.max(start.vb[2] / r.width, start.vb[3] / r.height);
        setVb([start.vb[0] - dx * s, start.vb[1] - dy * s, start.vb[2], start.vb[3]]);
    });
    window.addEventListener('pointerup', () => { start = null; svg.classList.remove('dragging'); setTimeout(() => MAP.dragged = false, 0); });
    $('#map-in').onclick = () => zoomAt(0.7);
    $('#map-out').onclick = () => zoomAt(1.4);
    $('#map-reset').onclick = () => animateVb(MAP.full);
}

function placeTip(e) {
    const tip = $('#tip'); tip.classList.add('show');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > innerWidth - 8) x = e.clientX - w - 16;
    if (y + h > innerHeight - 8) y = e.clientY - h - 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

function svgPoint(svg, e) { const r = svg.getBoundingClientRect(); const s = Math.max(MAP.vb[2] / r.width, MAP.vb[3] / r.height);
    return [MAP.vb[0] + MAP.vb[2] / 2 + (e.clientX - r.left - r.width / 2) * s, MAP.vb[1] + MAP.vb[3] / 2 + (e.clientY - r.top - r.height / 2) * s]; }
function setVb(vb) { MAP.vb = vb; const svg = $('#map'); svg.setAttribute('viewBox', vb.map(v => v.toFixed(1)).join(' ')); mapScale(svg, vb); }
// Taille constante à l'écran des pastilles et étiquettes, quel que soit le zoom
function mapScale(svg, vb) { const r = svg.getBoundingClientRect(); if (!r.width) return; svg.style.setProperty('--s', Math.max(vb[2] / r.width, vb[3] / r.height).toFixed(3)); }
function zoomAt(f, at) {
    const [x, y, w, h] = MAP.vb; const nw = Math.min(CARTE.w * 1.2, Math.max(60, w * f)), nh = nw * h / w;
    const [cx, cy] = at || [x + w / 2, y + h / 2];
    animateVb([cx - (cx - x) * nw / w, cy - (cy - y) * nh / h, nw, nh], 260);
}
function animateVb(to, ms = 650) {
    const from = MAP.vb.slice(); const t0 = performance.now(); const id = ++MAP.anim;
    const step = t => { if (id !== MAP.anim) return; const p = Math.min(1, (t - t0) / ms); const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        setVb(from.map((v, i) => v + (to[i] - v) * e)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
}
function zoneBox(codes) {
    let b = null;
    for (const c of codes) { const z = zoneInfo.get(c); if (!z) continue; const [x0, y0, x1, y1] = z.b; b = b ? [Math.min(b[0], x0), Math.min(b[1], y0), Math.max(b[2], x1), Math.max(b[3], y1)] : [x0, y0, x1, y1]; }
    return b;
}
function zoomTo(b, pad = 1.25) {
    if (!b) return animateVb(MAP.full);
    const svg = $('#map').getBoundingClientRect(); const ratio = svg.width / svg.height || 1;
    let w = Math.max(140, (b[2] - b[0]) * pad), h = Math.max(140, (b[3] - b[1]) * pad);
    if (w / h > ratio) h = w / ratio; else w = h * ratio;
    animateVb([(b[0] + b[2]) / 2 - w / 2, (b[1] + b[3]) / 2 - h / 2, w, h]);
}
function zoomToSelection() {
    if (!S.who) return animateVb(MAP.full);
    const zones = zonesOf(S.who);
    const metro = zones.filter(z => !zoneInfo.get(z)?.inset && zoneInfo.get(z)?.inset !== 0);
    zoomTo(zoneBox(metro.length ? metro : zones));
}

// ─── Fraîcheur des données & temps réel ─────────────────────
function renderLive() {
    const e = S.base.etat || {};
    $('#live-label').textContent = e.derniere_date ? `Données au ${dateLongue(parseIso(e.derniere_date))}` : 'Aucune donnée';
    $('#live-sub').textContent = e.dernier_import ? `Injection ${relative(new Date(e.dernier_import))}` : S.store.mode === 'demo' ? 'Mode démonstration' : 'En attente du premier fichier';
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
    $('#who').innerHTML = '<span class="team-hero"><i class="ri-lock-2-fill"></i></span><div><h1>Accès réservé</h1><div class="meta"><span>Le tableau de bord est privé</span></div></div>';
    $('#kpis').innerHTML = `<div class="card empty" style="grid-column:1/-1"><i class="ri-shield-keyhole-line"></i>Connectez-vous pour voir les chiffres.<br><br><button class="btn btn-primary" onclick="document.querySelector('#btn-admin').click()"><i class="ri-login-circle-line"></i>Se connecter</button></div>`;
    $$('.grid-a, .grid-b, .signals, .foot').forEach(e => e.hidden = true);
}

async function refresh(msg) {
    S.session = await S.store.session();
    await loadAll();
    if (locked()) return showLocked();
    $$('.grid-a, .grid-b, .signals, .foot').forEach(e => e.hidden = false);
    await renderAll({ animate: false });
    if (msg) { toast(msg); $('#live').classList.add('flash'); setTimeout(() => $('#live').classList.remove('flash'), 3000); }
}

// ─── Thème ──────────────────────────────────────────────────
function applyThemeIcon() { $('#btn-theme').innerHTML = document.documentElement.dataset.theme === 'light' ? '<i class="ri-moon-line"></i>' : '<i class="ri-sun-line"></i>'; }
function toggleTheme() {
    const light = document.documentElement.dataset.theme !== 'light';
    if (light) document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('commerce_theme', light ? 'light' : 'dark'); } catch (e) {}
    applyThemeIcon(); renderAll({ animate: false });
}

// ─── Démarrage ──────────────────────────────────────────────
async function boot() {
    S.store = createStore();
    $('#demo-banner').hidden = S.store.mode !== 'demo';
    applyThemeIcon();
    try {
        await S.store.init();
        S.session = await S.store.session();
        await loadAll();
    } catch (err) {
        $('#kpis').innerHTML = `<div class="card empty" style="grid-column:1/-1"><i class="ri-wifi-off-line"></i>Impossible de charger les données : ${esc(err.message)}</div>`;
        return;
    }
    const c = new URL(location).searchParams.get('c'); if (c && commercial(c)) S.who = c;
    if (locked()) showLocked(); else { await renderAll(); zoomToSelection(); }
    S.store.onChange(() => refresh('Nouvelles données reçues'));
    setInterval(renderLive, 30000);

    document.addEventListener('click', e => {
        const w = e.target.closest('[data-who]');
        if (w && !e.target.closest('#admin')) { select(w.dataset.who); return; }
    });
    $('#period').addEventListener('click', e => { const b = e.target.closest('[data-period]'); if (b) { S.period = b.dataset.period; remember(); renderAll(); } });
    $('#gauges').addEventListener('click', e => { const b = e.target.closest('[data-period]'); if (b && b.dataset.period !== S.period) { S.period = b.dataset.period; remember(); renderAll(); } });
    $('#clients-mode').addEventListener('click', e => { const b = e.target.closest('[data-cmode]'); if (b) { S.clientsMode = b.dataset.cmode; remember(); renderClients(); } });
    $('#map-mode').addEventListener('click', e => { const b = e.target.closest('[data-map]'); if (b) { S.mapMode = b.dataset.map; remember(); renderMap(); } });
    $('#search').addEventListener('input', renderSide);
    $('#btn-theme').addEventListener('click', toggleTheme);
    $('#btn-menu').addEventListener('click', () => $('#side').classList.add('open'));
    $('#side-scrim').addEventListener('click', () => $('#side').classList.remove('open'));
    document.addEventListener('keydown', e => {
        if (e.target.matches('input, textarea, select') || $('.modal.open') || locked()) return;
        const list = [null, ...S.base.commerciaux.map(c => c.id)]; const i = list.indexOf(S.who);
        if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); select(list[(i + 1) % list.length]); }
        if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); select(list[(i - 1 + list.length) % list.length]); }
        if (e.key === 'Escape') select(null);
    });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { mapScale($('#map'), MAP.vb); Object.values(S.charts).forEach(c => c.resize()); moveGlider($('#period')); moveGlider($('#map-mode')); }, 120); });
    window.dispatchEvent(new Event('commerce:ready'));
}
document.addEventListener('DOMContentLoaded', boot);
