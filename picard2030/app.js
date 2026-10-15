/* ============================================================
   PICARD2030 — Application (timeline, jauges, admin)
   Structure : rubriques → thèmes → actions
   Les calculs et le chargement des données sont dans core.js.
   ============================================================ */

const state = {
    rubrique: 'all',
    zoom: 'year',
    anchor: startOfMonth(new Date()),
    owner: '',
    editingId: null,
    adminTab: 'themes',
    collapsed: new Set(),
    storyMode: null,
};

function $(sel) { return document.querySelector(sel); }
function data() { return store.data; }
function themeById(id) { return data().themes.find(t => t.id === id); }

function visibleThemes() {
    return data().themes.filter(t =>
        (state.rubrique === 'all' || t.rubrique === state.rubrique) &&
        (!state.owner || t.owner === state.owner));
}

// ─── Composants visuels ──────────────────────────
function gauge(value, color, size = 96, stroke = 10, label = '', icon = '') {
    return `<div class="gauge" style="width:${size}px;height:${size}px">
        ${gaugeSvg(value, color, size, stroke, true)}
        <div class="gauge-label">${icon ? `<i class="${esc(icon)}" style="color:${color}"></i>` : ''}<strong data-count="${value}" data-suffix="%">${value}%</strong>${label ? `<small>${esc(label)}</small>` : ''}</div>
    </div>`;
}

function bar(value, color, cls = '') {
    return `<div class="bar ${cls}"><div class="bar-fill" style="--w:${clamp(value, 0, 100)}%;background:${color}"></div></div>`;
}

function healthBadge(h) {
    const x = HEALTH[h];
    return `<span class="badge ${x.cls}"><i class="${x.icon}"></i>${x.label}</span>`;
}

function animateGauges(root = document) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
        root.querySelectorAll('.gauge-fg[data-offset]').forEach(el => { el.style.strokeDashoffset = el.dataset.offset; });
        root.querySelectorAll('.bar-fill').forEach(el => el.classList.add('in'));
    }));
    root.querySelectorAll('[data-count]').forEach(countUp);
}

function dateSpan(start, end) {
    return +start === +end ? fmtDate(start) : `${fmtDate(start)} → ${fmtDate(end)}`;
}

// ─── Onglets & rubriques ─────────────────────────
function renderTabs() {
    const tabs = [{ id: 'all', name: "Vue d'ensemble", icon: 'ri-apps-2-line', color: 'var(--accent)' }, ...data().rubriques];
    $('#pole-tabs').innerHTML = tabs.map(t => {
        const n = t.id === 'all' ? data().themes.length : themesOf(t.id).length;
        return `<button class="pole-tab ${state.rubrique === t.id ? 'active' : ''}" data-rubrique="${esc(t.id)}" style="--pole:${t.color}">
            <i class="${esc(t.icon)}"></i>${esc(t.name)}<span class="count">${n}</span></button>`;
    }).join('');
    document.documentElement.style.setProperty('--pole-current', state.rubrique === 'all' ? 'var(--accent)' : rubriqueOf(state.rubrique).color);
}

function renderOverview() {
    const el = $('#poles-overview');
    el.hidden = state.rubrique !== 'all';
    if (el.hidden) { el.innerHTML = ''; return; }
    el.innerHTML = data().rubriques.map(r => {
        const themes = themesOf(r.id);
        const hs = themes.map(themeHealth);
        const late = hs.filter(h => h === 'late').length, warn = hs.filter(h => h === 'warn').length;
        const nActions = themes.reduce((s, t) => s + t.actions.length, 0);
        const next = upcomingDeadlines(themes)[0];
        return `<button class="pole-card" data-rubrique="${esc(r.id)}" style="--pole:${r.color}" data-reveal>
            <div class="pole-card-head"><i class="${esc(r.icon)}"></i><h3>${esc(r.name)}</h3></div>
            <div class="pole-card-body">
                ${gauge(weightedProgress(themes), r.color, 120, 12, 'avancement')}
                <ul class="pole-stats">
                    <li><strong>${themes.length}</strong> thèmes · <strong>${nActions}</strong> actions</li>
                    <li class="${late ? 't-late' : ''}"><strong>${late}</strong> en retard</li>
                    <li class="${warn ? 't-warn' : ''}"><strong>${warn}</strong> en vigilance</li>
                    <li class="pole-next">${next ? `<i class="ri-flag-2-line"></i> ${esc(next.name)} <em>${countdown(next.date)}</em>` : 'Aucune échéance à venir'}</li>
                </ul>
            </div>
            <div class="pole-themes">${themes.map(t => `
                <span class="pole-theme" data-tip="t|${esc(t.id)}">
                    <span class="dot ${HEALTH[themeHealth(t)].cls}"></span>${esc(t.name)}<b>${themeProgress(t)}%</b>
                </span>`).join('')}</div>
        </button>`;
    }).join('');
}

// ─── KPI ─────────────────────────────────────────
function renderKpis() {
    const themes = visibleThemes();
    const color = state.rubrique === 'all' ? 'var(--accent)' : rubriqueOf(state.rubrique).color;
    const hs = themes.map(themeHealth);
    const active = hs.filter(h => h !== 'done' && h !== 'upcoming').length;
    const late = hs.filter(h => h === 'late').length;
    const warn = hs.filter(h => h === 'warn').length;
    const horizon = settings().milestoneHorizon;
    const deadlines = upcomingDeadlines(themes);
    const inHorizon = deadlines.filter(d => daysBetween(today, d.date) <= horizon).length;
    const next = deadlines[0];

    $('#kpis').innerHTML = `
        <div class="kpi kpi-gauge" data-reveal>${gauge(weightedProgress(themes), color, 88, 9)}<div><span class="kpi-label">Avancement global</span><span class="kpi-sub">pondéré par la durée</span></div></div>
        <div class="kpi" data-reveal><i class="ri-rocket-2-line kpi-icon"></i><span class="kpi-value"><span data-count="${active}">${active}</span><small>/${themes.length}</small></span><span class="kpi-label">Thèmes en cours</span></div>
        <div class="kpi ${late ? 'kpi-alert' : ''}" data-reveal><i class="ri-alarm-warning-line kpi-icon"></i><span class="kpi-value" data-count="${late}">${late}</span><span class="kpi-label">En retard</span><span class="kpi-sub">${warn} en vigilance</span></div>
        <div class="kpi" data-reveal><i class="ri-flag-2-line kpi-icon"></i><span class="kpi-value" data-count="${inHorizon}">${inHorizon}</span><span class="kpi-label">Échéances sous ${horizon} jours</span></div>
        <div class="kpi kpi-next" data-reveal>${next
            ? `<span class="kpi-countdown">${countdown(next.date)}</span><span class="kpi-label">Prochaine échéance</span><span class="kpi-sub">${esc(next.name)} · ${esc(next.theme.name)}</span>`
            : `<span class="kpi-label">Aucune échéance à venir</span>`}</div>`;
}

// ─── Timeline (Gantt) ────────────────────────────
function timelineRange() {
    if (state.zoom === 'plan') { const s = settings(); return { from: new Date(s.planStart, 0, 1), to: new Date(s.planEnd + 1, 0, 1) }; }
    if (state.zoom === 'year') { const y = state.anchor.getFullYear(); return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) }; }
    return { from: state.anchor, to: addMonths(state.anchor, 6) };
}

function periodLabel(from, to) {
    if (state.zoom === 'plan') return `Plan ${settings().planStart} → ${settings().planEnd}`;
    if (state.zoom === 'year') return `Année ${from.getFullYear()}`;
    return `${fmtMonth(from)} → ${fmtMonth(addMonths(to, -1))}`;
}

function renderGantt() {
    const { from, to } = timelineRange();
    const pct = d => 100 * (d - from) / (to - from);
    const inView = (s, e) => e >= from && s < to;
    const span = (s, e) => { const a = clamp(pct(s), 0, 100); return `left:${a}%;width:${clamp(pct(e), 0, 100) - a}%`; };
    const themes = visibleThemes();

    let ticks = '', grid = '';
    if (state.zoom === 'plan') {
        for (let y = from.getFullYear(); y < to.getFullYear(); y++) {
            const a = pct(new Date(y, 0, 1)), b = pct(new Date(y + 1, 0, 1));
            ticks += `<div class="tick tick-year" style="left:${a}%;width:${b - a}%">${y}</div>`;
            grid += `<div class="tick-line" style="left:${a}%"></div>`;
            for (let q = 1; q < 4; q++) grid += `<div class="tick-line minor" style="left:${pct(new Date(y, q * 3, 1))}%"></div>`;
        }
    } else {
        for (let d = new Date(from); d < to; d = addMonths(d, 1)) {
            const a = pct(d), b = pct(addMonths(d, 1));
            const lbl = MONTHS[d.getMonth()] + (d.getMonth() === 0 || +d === +from ? ` ${d.getFullYear()}` : '');
            ticks += `<div class="tick" style="left:${a}%;width:${b - a}%">${lbl}</div>`;
            grid += `<div class="tick-line ${d.getMonth() === 0 ? 'major' : ''}" style="left:${a}%"></div>`;
        }
    }
    const todayLine = today >= from && today < to ? `<div class="today-line" style="left:${pct(today)}%"><span>Aujourd'hui</span></div>` : '';

    const themeRows = t => {
        const r = themeRange(t), h = themeHealth(t), prog = themeProgress(t);
        const open = !state.collapsed.has(t.id);
        let track = '';
        if (inView(r.start, r.end)) {
            const end = new Date(r.end.getTime() + DAY);
            track += `<div class="g-tbar" style="${span(r.start, end)};--c:${t.color};--p:${prog}%" data-tip="t|${esc(t.id)}"><div class="g-fill"></div></div>`;
            if (r.end < to) track += `<div class="g-pt big ${HEALTH[h].cls}" style="left:${pct(end)}%;--c:${t.color}" data-tip="t|${esc(t.id)}"></div>`;
        }
        let html = `<div class="g-row g-theme" data-id="${esc(t.id)}" tabindex="0">
            <div class="g-label">
                ${t.actions.length ? `<button class="g-toggle ${open ? 'open' : ''}" data-toggle="${esc(t.id)}" title="${open ? 'Replier' : 'Déplier'}"><i class="ri-arrow-right-s-line"></i></button>` : '<span class="g-toggle-space"></span>'}
                <i class="g-icon ${esc(t.icon || 'ri-folder-line')}" style="color:${t.color}"></i>
                <div class="g-label-text"><strong>${esc(t.name)}</strong><small>${esc(t.owner)}</small></div>
                <span class="g-pct ${HEALTH[h].cls}">${prog}%</span>
            </div>
            <div class="g-track">${track}</div>
        </div>`;
        if (open) html += t.actions.map((a, i) => {
            const ar = actionRange(a), ah = actionHealth(a), tip = `a|${esc(t.id)}|${i}`;
            let at = '';
            if (isMilestone(a)) {
                if (ar.start >= from && ar.start < to) at = `<div class="g-ms ${a.progress >= 100 ? 'done' : ''} ${ah === 'late' ? 'over' : ''}" style="left:${pct(ar.start)}%;--c:${t.color}" data-tip="${tip}"></div>`;
            } else if (inView(ar.start, ar.end)) {
                const end = new Date(ar.end.getTime() + DAY);
                at = `<div class="g-bar" style="${span(ar.start, end)};--c:${t.color};--p:${a.progress}%" data-tip="${tip}"><div class="g-fill"></div></div>`;
                if (end < to) at += `<div class="g-pt ${HEALTH[ah].cls}" style="left:${pct(end)}%;--c:${t.color}" data-tip="${tip}"></div>`;
            }
            return `<div class="g-row g-action" data-id="${esc(t.id)}">
                <div class="g-label"><span class="dot ${HEALTH[ah].cls}"></span><span class="g-action-name">${esc(a.name)}</span><span class="g-pct">${isMilestone(a) ? '<i class="ri-flag-2-line"></i>' : a.progress + '%'}</span></div>
                <div class="g-track">${at}</div>
            </div>`;
        }).join('');
        return html;
    };

    const groups = state.rubrique === 'all'
        ? data().rubriques.map(r => ({ r, items: themes.filter(t => t.rubrique === r.id) })).filter(g => g.items.length)
        : [{ r: null, items: themes }];
    const rows = groups.map(g =>
        (g.r ? `<div class="g-group" style="--pole:${g.r.color}"><i class="${esc(g.r.icon)}"></i>${esc(g.r.name)}<span>${weightedProgress(g.items)}%</span></div>` : '') +
        g.items.map(themeRows).join('')).join('');

    $('#gantt').innerHTML = `
        <div class="g-head"><div class="g-label g-label-head">${periodLabel(from, to)}</div><div class="g-track g-ticks">${ticks}</div></div>
        <div class="g-body">
            <div class="g-grid"><div class="g-label"></div><div class="g-track">${grid}${todayLine}</div></div>
            ${rows || '<div class="empty">Aucun thème pour ce filtre.</div>'}
        </div>`;

    document.querySelectorAll('#zoom button').forEach(b => b.classList.toggle('active', b.dataset.zoom === state.zoom));
    $('#nav-prev').disabled = $('#nav-next').disabled = state.zoom === 'plan';
    const allOpen = themes.every(t => !state.collapsed.has(t.id));
    $('#toggle-all').innerHTML = allOpen ? '<i class="ri-contract-up-down-line"></i> Replier' : '<i class="ri-expand-up-down-line"></i> Déplier';
}

// ─── Animations (apparition au défilement, compteurs) ─
let revealObserver = null;
let instantRender = false;

function countUp(el) {
    const target = Number(el.dataset.count), suffix = el.dataset.suffix || '';
    if (instantRender || !Number.isFinite(target) || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = target + suffix; return; }
    const t0 = performance.now(), dur = 900, run = el._run = (el._run || 0) + 1;
    const step = now => {
        if (el._run !== run) return;
        const k = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0' + suffix;
    requestAnimationFrame(step);
}

function reveal(el) {
    el.classList.add('revealed');
    animateGauges(el);
}

function observeReveals() {
    const els = document.querySelectorAll('[data-reveal]:not(.revealed)');
    if (instantRender || !('IntersectionObserver' in window)) { els.forEach(reveal); return; }
    revealObserver ||= new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { revealObserver.unobserve(e.target); reveal(e.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => revealObserver.observe(el));
}

// ─── 01 · Timeline simplifiée ────────────────────
function storyMode() { return state.rubrique !== 'all' && innerWidth >= 900 ? 'alt' : 'compact'; }

function storyActions(t, max = 4) {
    if (!t.actions.length) return '';
    const shown = t.actions.slice(0, max);
    return `<ul class="sn-actions">${shown.map(a => {
        const i = t.actions.indexOf(a);
        return `<li data-tip="a|${esc(t.id)}|${i}"><span class="dot ${HEALTH[actionHealth(a)].cls}"></span><span class="sn-an">${esc(a.name)}</span>${isMilestone(a)
            ? `<span class="sn-ams"><i class="ri-flag-2-line"></i>${fmtDate(a.start)}</span>`
            : `${bar(a.progress, t.color, 'mini')}<b>${a.progress}%</b>`}</li>`;
    }).join('')}${t.actions.length > max ? `<li class="sn-more">+ ${t.actions.length - max} autre${t.actions.length - max > 1 ? 's' : ''} action${t.actions.length - max > 1 ? 's' : ''}</li>` : ''}</ul>`;
}

function storyCard(t, withGauge) {
    const r = themeRange(t), h = themeHealth(t);
    return `<article class="sn-card" data-id="${esc(t.id)}" tabindex="0">
        <div class="sn-card-head">
            <div>
                <p class="sn-date">${fmtMonth(r.start)} <i class="ri-arrow-right-line"></i> ${fmtMonth(r.end)}</p>
                <h3>${esc(t.name)}</h3>
                <p class="sn-meta">${t.owner ? `<span>${esc(t.owner)}</span>` : ''}${healthBadge(h)}</p>
            </div>
            ${withGauge ? gauge(themeProgress(t), t.color, 70, 8, '', t.icon) : ''}
        </div>
        ${t.note ? `<p class="sn-note">${esc(t.note)}</p>` : ''}
        ${storyActions(t)}
    </article>`;
}

function storyVisual(t) {
    return `<div class="sn-visual" data-id="${esc(t.id)}" data-tip="t|${esc(t.id)}">
        ${gauge(themeProgress(t), t.color, 128, 13, 'réalisé', t.icon)}
        <span class="sn-expected">attendu ${themeExpected(t)}%</span>
    </div>`;
}

function storyTimeline(themes, mode) {
    const sorted = themes.slice().sort((a, b) => themeRange(a).start - themeRange(b).start);
    const todayIdx = sorted.findIndex(t => themeRange(t).start > today);
    const todayRow = `<div class="sn-today" data-reveal><span><i class="ri-map-pin-2-fill"></i> Aujourd'hui · ${fmtDate(today)}</span></div>`;
    const rows = sorted.map((t, i) => {
        const r = themeRange(t);
        const live = r.start <= today && r.end >= today && themeProgress(t) < 100;
        const spine = `<div class="sn-spine"><span class="sn-seg"></span><span class="sn-knot ${live ? 'live' : ''}"></span><span class="sn-arm"></span></div>`;
        let node;
        if (mode === 'alt') {
            const right = i % 2 === 0;
            node = `<div class="sn ${right ? 'sn-right' : 'sn-left'}" style="--c:${t.color}" data-reveal>
                <div class="sn-side sn-l">${right ? storyVisual(t) : storyCard(t, false)}</div>
                ${spine}
                <div class="sn-side sn-r">${right ? storyCard(t, false) : storyVisual(t)}</div>
            </div>`;
        } else {
            node = `<div class="sn sn-compact" style="--c:${t.color}" data-reveal>${spine}<div class="sn-side">${storyCard(t, true)}</div></div>`;
        }
        return (i === todayIdx ? todayRow : '') + node;
    }).join('') + (todayIdx === -1 && sorted.length ? todayRow : '');
    return `<div class="story story-${mode}">
        <div class="sn-cap top"></div>
        ${rows || '<div class="empty">Aucun thème.</div>'}
        <div class="sn-cap bottom"></div>
    </div>`;
}

function renderStory() {
    const mode = storyMode();
    state.storyMode = mode;
    if (state.rubrique === 'all') {
        $('#story-sub').textContent = "Les grands thèmes de chaque rubrique, dans l'ordre chronologique";
        $('#story').innerHTML = `<div class="story-cols">${data().rubriques.map(r => {
            const themes = themesOf(r.id).filter(t => !state.owner || t.owner === state.owner);
            return `<div class="story-col" style="--pole:${r.color}">
                <header class="story-col-head" data-rubrique="${esc(r.id)}" data-reveal>
                    ${gauge(weightedProgress(themes), r.color, 64, 7)}
                    <div><h3><i class="${esc(r.icon)}"></i> ${esc(r.name)}</h3><p>${themes.length} thèmes · ${themes.reduce((n, t) => n + t.actions.length, 0)} actions</p></div>
                    <i class="ri-arrow-right-up-line story-col-go" title="Ouvrir la rubrique"></i>
                </header>
                ${storyTimeline(themes, 'compact')}
            </div>`;
        }).join('')}</div>`;
    } else {
        const r = rubriqueOf(state.rubrique);
        $('#story-sub').textContent = `Les thèmes ${r.name} dans l'ordre chronologique`;
        $('#story').innerHTML = storyTimeline(visibleThemes(), mode);
    }
}

// ─── 02 · Indicateurs (compléments) ──────────────
function renderInsights() {
    const themes = visibleThemes();
    const actions = themes.flatMap(t => t.actions);
    const order = ['done', 'ok', 'warn', 'late', 'upcoming'];
    const stack = (items, healthOf, label) => {
        const counts = Object.fromEntries(order.map(k => [k, 0]));
        items.forEach(x => counts[healthOf(x)]++);
        const total = items.length || 1;
        return `<div class="meteo-row"><div class="meteo-label"><b data-count="${items.length}">${items.length}</b> ${label}</div>
            <div class="meteo-bar">${order.filter(k => counts[k]).map(k => `<span class="${HEALTH[k].cls}" style="--w:${100 * counts[k] / total}%" title="${HEALTH[k].label} : ${counts[k]}">${counts[k]}</span>`).join('')}</div></div>`;
    };
    const deadlines = upcomingDeadlines(themes).slice(0, 5);
    const attention = themes.flatMap(t => [
        ...(['late', 'warn'].includes(themeHealth(t)) ? [{ t, name: t.name, h: themeHealth(t), tip: `t|${t.id}`, sub: 'Thème' }] : []),
        ...t.actions.map((a, i) => ({ t, a, i })).filter(x => ['late', 'warn'].includes(actionHealth(x.a)))
            .map(x => ({ t: x.t, name: x.a.name, h: actionHealth(x.a), tip: `a|${x.t.id}|${x.i}`, sub: x.t.name })),
    ]).sort((a, b) => (a.h === 'late' ? 0 : 1) - (b.h === 'late' ? 0 : 1)).slice(0, 5);

    $('#insights').innerHTML = `
        <div class="insight" data-reveal>
            <h3><i class="ri-sun-cloudy-line"></i> Météo</h3>
            ${stack(themes, themeHealth, 'thèmes')}
            ${stack(actions, actionHealth, 'actions')}
            <div class="meteo-legend">${order.map(k => `<span><i class="dot ${HEALTH[k].cls}"></i>${HEALTH[k].label}</span>`).join('')}</div>
        </div>
        <div class="insight" data-reveal>
            <h3><i class="ri-flag-2-line"></i> Prochaines échéances</h3>
            ${deadlines.length ? `<ul class="ins-list">${deadlines.map(d => {
                const n = daysBetween(today, d.date);
                const tip = d.action ? `a|${d.theme.id}|${d.theme.actions.indexOf(d.action)}` : `t|${d.theme.id}`;
                return `<li data-tip="${esc(tip)}"><span class="cd ${n <= 30 ? 'soon' : ''}">${countdown(d.date)}</span>
                    <span class="ins-what"><b>${esc(d.name)}</b><small><i class="dot" style="--hc:${d.theme.color}"></i>${esc(d.theme.name)} · ${fmtDate(d.date)}</small></span></li>`;
            }).join('')}</ul>` : '<p class="muted">Aucune échéance à venir.</p>'}
        </div>
        <div class="insight" data-reveal>
            <h3><i class="ri-alarm-warning-line"></i> Points d'attention</h3>
            ${attention.length ? `<ul class="ins-list">${attention.map(x => `
                <li data-tip="${esc(x.tip)}"><span class="dot ${HEALTH[x.h].cls}"></span>
                    <span class="ins-what"><b>${esc(x.name)}</b><small>${esc(x.sub)} · ${HEALTH[x.h].label}</small></span></li>`).join('')}</ul>`
                : '<p class="ins-ok"><i class="ri-checkbox-circle-line"></i> Rien à signaler, tout est dans les temps.</p>'}
        </div>`;
}

// ─── Info-bulles (survol) ────────────────────────
function tipHtml(key) {
    const [kind, id, idx] = key.split('|');
    const t = themeById(id);
    if (!t) return '';
    const rub = rubriqueOf(t.rubrique);
    if (kind === 't') {
        const r = themeRange(t), prog = themeProgress(t);
        const done = t.actions.filter(a => a.progress >= 100).length;
        return `<div class="tip-head" style="--c:${t.color}"><small>${esc(rub.name)}</small><strong><i class="${esc(t.icon || 'ri-folder-line')}"></i> ${esc(t.name)}</strong></div>
            <div class="tip-row"><i class="ri-calendar-line"></i>${dateSpan(r.start, r.end)}</div>
            <div class="tip-progress">${bar(prog, t.color)}<span><b>${prog}%</b> réalisé · attendu ${themeExpected(t)}%</span></div>
            <div class="tip-row">${healthBadge(themeHealth(t))}<span class="muted">${t.actions.length ? `${done}/${t.actions.length} actions terminées` : ''}</span></div>
            ${t.note ? `<p class="tip-note">${esc(t.note)}</p>` : ''}`;
    }
    const a = t.actions[Number(idx)];
    if (!a) return '';
    const r = actionRange(a);
    return `<div class="tip-head" style="--c:${t.color}"><small>${esc(rub.name)} · ${esc(t.name)}</small><strong>${isMilestone(a) ? '<i class="ri-flag-2-line"></i> ' : ''}${esc(a.name)}</strong></div>
        <div class="tip-row"><i class="ri-calendar-line"></i>${isMilestone(a) ? 'Jalon · ' + fmtDate(r.start) : dateSpan(r.start, r.end)}${r.end >= today && a.progress < 100 ? ` <em>${countdown(r.end)}</em>` : ''}</div>
        <div class="tip-progress">${bar(a.progress, t.color)}<span><b>${a.progress}%</b> réalisé · attendu ${linearExpected(r.start, r.end)}%</span></div>
        <div class="tip-row">${healthBadge(actionHealth(a))}</div>
        ${a.note ? `<p class="tip-note">${esc(a.note)}</p>` : ''}`;
}

function showTip(target, x, y) {
    const tip = $('#tip');
    if (tip.dataset.key !== target.dataset.tip) {
        tip.dataset.key = target.dataset.tip;
        tip.innerHTML = tipHtml(target.dataset.tip);
        tip.querySelectorAll('.bar-fill').forEach(el => el.classList.add('in'));
    }
    tip.classList.add('show');
    const w = tip.offsetWidth, h = tip.offsetHeight, m = 14;
    let left = x + m, top = y + m;
    if (left + w > innerWidth - 8) left = x - w - m;
    if (top + h > innerHeight - 8) top = y - h - m;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
}

function hideTip() { const tip = $('#tip'); tip.classList.remove('show'); tip.dataset.key = ''; }

// ─── Fiche détaillée ─────────────────────────────
function openDrawer(id) {
    const t = themeById(id);
    if (!t) return;
    hideTip();
    const h = themeHealth(t), prog = themeProgress(t), r = themeRange(t), rub = rubriqueOf(t.rubrique);
    $('#drawer-content').innerHTML = `
        <div class="drawer-head" style="--c:${t.color}">
            <button class="btn btn-icon drawer-close" data-close><i class="ri-close-line"></i></button>
            <span class="chip" style="--pole:${rub.color}"><i class="${esc(rub.icon)}"></i>${esc(rub.name)}</span>
            <h2><i class="${esc(t.icon || 'ri-folder-line')}" style="color:${t.color}"></i> ${esc(t.name)}</h2>
            <p class="muted">${esc(t.owner)} · ${dateSpan(r.start, r.end)}</p>
        </div>
        <div class="drawer-summary">
            ${gauge(prog, t.color, 120, 12, 'réalisé')}
            <div>
                ${healthBadge(h)}
                <p class="muted">Attendu à date : <b>${themeExpected(t)}%</b><br>Temps écoulé : <b>${timeElapsed(t)}%</b></p>
            </div>
        </div>
        ${t.note ? `<p class="drawer-desc">${esc(t.note)}</p>` : ''}
        <h3>Actions</h3>
        <ul class="phase-list">${t.actions.map(a => {
            const ar = actionRange(a), ah = actionHealth(a);
            const isNow = ar.start <= today && ar.end >= today;
            return `<li class="${isNow ? 'now' : ''}">
                <div class="bar-row"><span><span class="dot ${HEALTH[ah].cls}"></span> ${isMilestone(a) ? '<i class="ri-flag-2-line"></i> ' : ''}${esc(a.name)}${isNow ? ' <em class="now-tag">en cours</em>' : ''}</span><b>${a.progress}%</b></div>
                ${bar(a.progress, t.color)}
                <small class="muted">${isMilestone(a) ? 'Jalon · ' + fmtDate(ar.start) : dateSpan(ar.start, ar.end)} · ${HEALTH[ah].label}</small>
                ${a.note ? `<p class="phase-note">${esc(a.note)}</p>` : ''}
            </li>`;
        }).join('') || '<li class="muted">Aucune action</li>'}</ul>
        <button class="btn btn-primary btn-block" data-edit="${esc(t.id)}"><i class="ri-edit-line"></i> Modifier dans l'admin</button>`;
    $('#drawer').classList.add('open');
    $('#overlay').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    animateGauges($('#drawer'));
}

function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#overlay').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
}

// ─── Admin ───────────────────────────────────────
// Onglets : Thèmes, Rubriques, Réglages, Données. Enregistrement automatique.
const ADMIN_TABS = [
    { id: 'themes', label: 'Thèmes & actions', icon: 'ri-folders-line' },
    { id: 'rubriques', label: 'Rubriques', icon: 'ri-layout-grid-line' },
    { id: 'settings', label: 'Réglages', icon: 'ri-equalizer-line' },
    { id: 'data', label: 'Données', icon: 'ri-database-2-line' },
];

function iconOptions(selected) {
    return ICONS.map(([ic, lbl]) => `<option value="${ic}" ${ic === selected ? 'selected' : ''}>${lbl}</option>`).join('');
}

function openAdmin(id) {
    if (id) { state.editingId = id; state.adminTab = 'themes'; }
    if (!themeById(state.editingId)) state.editingId = data().themes[0]?.id || null;
    hideTip();
    $('#admin').classList.add('open');
    $('#admin').setAttribute('aria-hidden', 'false');
    renderAdmin();
}

function closeAdmin() {
    $('#admin').classList.remove('open');
    $('#admin').setAttribute('aria-hidden', 'true');
}

function renderAdmin() {
    $('#admin-tabs').innerHTML = ADMIN_TABS.map(t =>
        `<button type="button" data-admin-tab="${t.id}" class="${state.adminTab === t.id ? 'active' : ''}"><i class="${t.icon}"></i><span>${t.label}</span></button>`).join('');
    const body = $('#admin-body');
    body.dataset.tab = state.adminTab;
    body.innerHTML = { themes: adminThemesHtml, rubriques: adminRubriquesHtml, settings: adminSettingsHtml, data: adminDataHtml }[state.adminTab]();
    animateGauges(body);
}

// Thèmes & actions
function adminThemeListHtml() {
    return data().rubriques.map(r => `
        <div class="admin-group" style="--pole:${r.color}"><i class="${esc(r.icon)}"></i>${esc(r.name)}</div>
        ${themesOf(r.id).map(t => {
            const p = themeProgress(t);
            return `<button type="button" class="admin-item ${t.id === state.editingId ? 'active' : ''}" data-id="${esc(t.id)}" style="--c:${t.color}">
                <i class="${esc(t.icon || 'ri-folder-line')} ai-icon"></i>
                <span class="ai-text"><span class="ai-name">${esc(t.name || 'Sans nom')}</span>
                    <span class="ai-bar"><span style="width:${p}%"></span></span></span>
                <span class="ai-pct">${p}%</span>
            </button>`;
        }).join('') || '<p class="admin-none">Aucun thème</p>'}
    `).join('');
}

function adminThemesHtml() {
    const t = themeById(state.editingId);
    const owners = [...new Set(data().themes.map(x => x.owner).filter(Boolean))].sort();
    const form = !t ? '<div class="empty">Créez votre premier thème.</div>' : `
        <div class="ed-hero" style="--c:${esc(t.color)}">
            <div id="ed-gauge">${gauge(themeProgress(t), t.color, 96, 10, '', t.icon)}</div>
            <div class="ed-hero-main">
                <input class="ed-title" name="name" value="${esc(t.name)}" placeholder="Nom du thème" aria-label="Nom du thème">
                <div class="ed-hero-meta">
                    <span id="ed-health">${healthBadge(themeHealth(t))}</span>
                    <span id="ed-dates"><i class="ri-calendar-line"></i> ${dateSpan(themeRange(t).start, themeRange(t).end)}</span>
                    <span id="ed-count"><i class="ri-list-check-2"></i> ${t.actions.length} action${t.actions.length > 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="ed-hero-tools">
                <button type="button" class="btn btn-icon" data-move="-1" title="Monter"><i class="ri-arrow-up-line"></i></button>
                <button type="button" class="btn btn-icon" data-move="1" title="Descendre"><i class="ri-arrow-down-line"></i></button>
                <button type="button" class="btn btn-icon" data-duplicate title="Dupliquer"><i class="ri-file-copy-line"></i></button>
                <button type="button" class="btn btn-icon btn-danger" data-delete title="Supprimer le thème"><i class="ri-delete-bin-line"></i></button>
            </div>
        </div>

        <div class="ed-card">
            <h3><i class="ri-settings-4-line"></i> Paramètres du thème</h3>
            <div class="form-grid">
                <label>Rubrique<select name="rubrique">${data().rubriques.map(r => `<option value="${esc(r.id)}" ${r.id === t.rubrique ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
                <label>Responsable<input name="owner" value="${esc(t.owner)}" list="owners-list" placeholder="Ex. Direction commerciale"></label>
                <label>Couleur & icône<span class="color-icon">
                    <input type="color" name="color" value="${esc(t.color)}">
                    <span class="icon-pick"><i class="${esc(t.icon || 'ri-folder-line')}"></i><select name="icon">${iconOptions(t.icon)}</select></span>
                </span></label>
                <label>Date de début<input type="date" name="start" value="${esc(t.start || '')}"><small>vide = calculée depuis les actions</small></label>
                <label>Date de fin<input type="date" name="end" value="${esc(t.end || '')}"><small>vide = calculée depuis les actions</small></label>
                ${t.actions.length
                    ? `<label>Avancement<span class="computed"><span id="ed-computed">${themeProgress(t)}%</span><small>calculé à partir des actions</small></span></label>`
                    : `<label>Avancement<span class="range"><input type="range" name="progress" min="0" max="100" step="5" value="${Number(t.progress) || 0}" style="--val:${Number(t.progress) || 0}%"><output>${Number(t.progress) || 0}%</output></span><small>utilisé tant qu'il n'y a pas d'action</small></label>`}
                <label class="span-3">Texte affiché au survol<textarea name="note" rows="2" placeholder="Contexte, objectif, point d'attention…">${esc(t.note)}</textarea></label>
                <datalist id="owners-list">${owners.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
            </div>
        </div>

        <div class="ed-card">
            <div class="form-section-head">
                <h3><i class="ri-list-check-2"></i> Actions</h3>
                <button type="button" class="btn btn-primary btn-small" data-add-action><i class="ri-add-line"></i> Ajouter une action</button>
            </div>
            <p class="help small"><i class="ri-lightbulb-flash-line"></i> Glissez le curseur pour l'avancement. Même date de début et de fin = jalon.</p>
            <div class="rows" id="action-rows">${t.actions.map(a => actionRow(a, t)).join('') || '<p class="admin-none" data-empty>Aucune action pour l\'instant.</p>'}</div>
        </div>`;
    return `<div class="admin-split">
        <div class="admin-list">
            <div id="admin-themes">${adminThemeListHtml()}</div>
            <button type="button" class="btn btn-primary btn-block" data-new-theme><i class="ri-add-line"></i> Nouveau thème</button>
        </div>
        <form class="admin-form" data-form="theme" autocomplete="off" onsubmit="return false">${form}</form>
    </div>`;
}

function actionRow(a = {}, t = themeById(state.editingId)) {
    const start = a.start || iso(today);
    const end = a.end || iso(new Date(parse(start).getTime() + 90 * DAY));
    const prog = Number(a.progress) || 0;
    const h = actionHealth({ start, end, progress: prog });
    return `<div class="action-row ${HEALTH[h].cls}" style="--c:${esc(t?.color || 'var(--accent)')}">
        <div class="ar-top">
            <span class="ar-status">${healthBadge(h)}</span>
            <input class="ar-name" name="a-name" placeholder="Nom de l'action" value="${esc(a.name || '')}">
            <button type="button" class="btn btn-icon ar-done ${prog >= 100 ? 'on' : ''}" data-done title="Marquer comme terminée"><i class="ri-check-line"></i></button>
            <button type="button" class="btn btn-icon" data-remove title="Supprimer l'action"><i class="ri-delete-bin-6-line"></i></button>
        </div>
        <div class="ar-mid">
            <label>Début<input type="date" name="a-start" value="${esc(start)}"></label>
            <label>Fin<input type="date" name="a-end" value="${esc(end)}"></label>
            <div class="range ar-range"><input type="range" name="a-progress" min="0" max="100" step="5" value="${prog}" style="--val:${prog}%"><output>${prog}%</output></div>
        </div>
        <input class="note-input" name="a-note" placeholder="Texte affiché au survol (facultatif)" value="${esc(a.note || '')}">
    </div>`;
}

// Met à jour en direct l'en-tête et les statuts pendant la saisie
function liveRefresh(form) {
    const t = themeById(state.editingId);
    if (!t || !form.querySelector('.ed-hero')) return;
    const prog = themeProgress(t), r = themeRange(t);
    const hero = form.querySelector('.ed-hero');
    hero.style.setProperty('--c', t.color);
    const fg = hero.querySelector('.gauge-fg');
    const c = Number(fg.getAttribute('stroke-dasharray'));
    fg.setAttribute('stroke', t.color);
    fg.style.strokeDashoffset = c * (1 - prog / 100);
    const label = hero.querySelector('.gauge-label strong');
    label._run = (label._run || 0) + 1;
    label.textContent = prog + '%';
    hero.querySelector('.gauge-label i').className = t.icon;
    hero.querySelector('.gauge-label i').style.color = t.color;
    $('#ed-health').innerHTML = healthBadge(themeHealth(t));
    $('#ed-dates').innerHTML = `<i class="ri-calendar-line"></i> ${dateSpan(r.start, r.end)}`;
    $('#ed-count').innerHTML = `<i class="ri-list-check-2"></i> ${t.actions.length} action${t.actions.length > 1 ? 's' : ''}`;
    if ($('#ed-computed')) $('#ed-computed').textContent = prog + '%';
    form.querySelectorAll('.action-row').forEach((row, i) => {
        const a = t.actions[i];
        if (!a) return;
        const h = actionHealth(a);
        row.className = `action-row ${HEALTH[h].cls}`;
        row.style.setProperty('--c', t.color);
        row.querySelector('.ar-status').innerHTML = healthBadge(h);
        row.querySelector('.ar-done').classList.toggle('on', a.progress >= 100);
    });
    form.querySelectorAll('input[type="range"]').forEach(rg => rg.style.setProperty('--val', rg.value + '%'));
}

function readThemeForm(form) {
    const t = themeById(state.editingId);
    if (!t) return;
    const v = n => form.querySelector(`[name="${n}"]`)?.value.trim() ?? '';
    Object.assign(t, { name: v('name'), rubrique: v('rubrique'), owner: v('owner'), color: v('color'), icon: v('icon'), note: v('note') });
    form.querySelector('.icon-pick i').className = t.icon;
    for (const k of ['start', 'end']) { if (v(k)) t[k] = v(k); else delete t[k]; }
    if (t.start && t.end && parse(t.end) < parse(t.start)) t.end = t.start;
    if (form.querySelector('[name="progress"]')) t.progress = Number(v('progress'));
    t.actions = [...form.querySelectorAll('.action-row')].map(row => {
        const q = n => row.querySelector(`[name="${n}"]`).value;
        const start = q('a-start') || iso(today);
        let end = q('a-end') || start;
        if (parse(end) < parse(start)) end = start;
        return { name: q('a-name').trim(), start, end, progress: Number(q('a-progress')), note: q('a-note').trim() };
    });
    $('#admin-themes').innerHTML = adminThemeListHtml();
}

// Rubriques
function adminRubriquesHtml() {
    return `<form class="admin-pane" data-form="rubriques" autocomplete="off" onsubmit="return false">
        <p class="help">Les rubriques sont les grandes parties de l'outil (onglets, timeline, rapport). Une rubrique qui contient des thèmes ne peut pas être supprimée : déplacez d'abord ses thèmes.</p>
        <div class="rows-head row-pole"><span>Nom</span><span>Couleur</span><span>Icône</span><span>Thèmes</span><span></span></div>
        <div class="rows">${data().rubriques.map((r, i) => {
            const n = themesOf(r.id).length;
            return `<div class="row row-pole" data-rubrique-id="${esc(r.id)}">
                <input name="r-name" value="${esc(r.name)}" placeholder="Nom de la rubrique">
                <input type="color" name="r-color" value="${esc(r.color)}">
                <span class="icon-pick"><i class="${esc(r.icon)}"></i><select name="r-icon">${iconOptions(r.icon)}</select></span>
                <span class="muted">${n}</span>
                <span class="inline-actions">
                    <button type="button" class="btn btn-icon" data-rubrique-move="${i}" title="Monter" ${i === 0 ? 'disabled' : ''}><i class="ri-arrow-up-line"></i></button>
                    <button type="button" class="btn btn-icon" data-rubrique-delete="${esc(r.id)}" title="${n ? 'Contient des thèmes' : 'Supprimer'}" ${n ? 'disabled' : ''}><i class="ri-delete-bin-line"></i></button>
                </span>
            </div>`;
        }).join('')}</div>
        <button type="button" class="btn" data-new-rubrique><i class="ri-add-line"></i> Ajouter une rubrique</button>
    </form>`;
}

function readRubriquesForm(form) {
    form.querySelectorAll('[data-rubrique-id]').forEach(row => {
        const r = data().rubriques.find(x => x.id === row.dataset.rubriqueId);
        if (!r) return;
        r.name = row.querySelector('[name="r-name"]').value.trim();
        r.color = row.querySelector('[name="r-color"]').value;
        r.icon = row.querySelector('[name="r-icon"]').value;
        row.querySelector('.icon-pick i').className = r.icon;
    });
}

// Réglages
function adminSettingsHtml() {
    const s = settings();
    const field = (name, label, type, help, attrs = '') => `<label>${label}
        <input type="${type}" name="${name}" value="${esc(s[name])}" ${attrs}>${help ? `<small>${help}</small>` : ''}</label>`;
    return `<form class="admin-pane" data-form="settings" autocomplete="off" onsubmit="return false">
        <h3>Affichage</h3>
        <div class="form-grid">
            ${field('title', "Nom de l'outil", 'text', '')}
            ${field('subtitle', 'Sous-titre', 'text', '')}
            ${field('accent', 'Couleur principale', 'color', '')}
        </div>
        <h3>Période du plan</h3>
        <div class="form-grid">
            ${field('planStart', 'Année de début', 'number', 'Vue « plan » de la timeline', 'min="2000" max="2100"')}
            ${field('planEnd', 'Année de fin', 'number', '', 'min="2000" max="2100"')}
        </div>
        <h3>Météo des thèmes et actions</h3>
        <div class="form-grid">
            ${field('warnThreshold', 'Vigilance à partir de', 'number', "points de retard sur l'avancement attendu", 'min="0" max="100"')}
            ${field('lateThreshold', 'Retard à partir de', 'number', "points de retard sur l'avancement attendu", 'min="0" max="100"')}
            ${field('milestoneHorizon', 'Horizon des échéances', 'number', "jours, pour l'indicateur « échéances à venir »", 'min="1" max="730"')}
        </div>
        <button type="button" class="btn btn-ghost" data-reset-settings><i class="ri-refresh-line"></i> Réglages par défaut</button>
    </form>`;
}

function readSettingsForm(form) {
    const s = data().settings;
    const v = n => form.querySelector(`[name="${n}"]`).value;
    const num = (n, min, max) => { const x = parseInt(v(n), 10); return Number.isFinite(x) ? clamp(x, min, max) : DEFAULT_SETTINGS[n]; };
    s.title = v('title').trim() || DEFAULT_SETTINGS.title;
    s.subtitle = v('subtitle').trim();
    s.accent = v('accent');
    s.planStart = num('planStart', 2000, 2100);
    s.planEnd = Math.max(s.planStart, num('planEnd', 2000, 2100));
    s.warnThreshold = num('warnThreshold', 0, 100);
    s.lateThreshold = Math.max(s.warnThreshold, num('lateThreshold', 0, 100));
    s.milestoneHorizon = num('milestoneHorizon', 1, 730);
}

// Données
function adminDataHtml() {
    const nActions = data().themes.reduce((s, t) => s + t.actions.length, 0);
    return `<div class="admin-pane">
        <p class="help">Vos modifications sont enregistrées <b>dans ce navigateur</b>. Pour les partager avec l'équipe, exportez le fichier
        <code>data/projets.js</code> et remplacez celui du site (ou demandez à Claude de le faire).</p>
        <div class="data-actions">
            <button type="button" class="data-tile" data-export><i class="ri-download-2-line"></i><b>Exporter</b><small>Télécharger projets.js</small></button>
            <button type="button" class="data-tile" data-import><i class="ri-upload-2-line"></i><b>Importer</b><small>Charger un projets.js ou .json</small></button>
            <a class="data-tile" href="rapport.html" target="_blank"><i class="ri-file-pdf-2-line"></i><b>Rapport PDF</b><small>Version simplifiée à diffuser</small></a>
            <button type="button" class="data-tile danger" data-reset ${store.isLocal ? '' : 'disabled'}><i class="ri-arrow-go-back-line"></i><b>Annuler mes modifications</b><small>Revenir à la version publiée</small></button>
        </div>
        <p class="muted">Dernière mise à jour : ${data().meta.updatedAt ? fmtDate(data().meta.updatedAt) : '—'} · ${data().rubriques.length} rubriques · ${data().themes.length} thèmes · ${nActions} actions</p>
    </div>`;
}

// Enregistrement automatique
let saveTimer = null;
function autosave(form) {
    if (!form) return;
    ({ theme: readThemeForm, rubriques: readRubriquesForm, settings: readSettingsForm })[form.dataset.form]?.(form);
    if (form.dataset.form === 'theme') liveRefresh(form);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persist(); applySettings(); renderInstant(); flashSaved(); }, 250);
}

function flashSaved() {
    const el = $('#admin-status');
    el.classList.add('saved');
    el.innerHTML = '<i class="ri-check-line"></i> Enregistré';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.classList.remove('saved'); el.innerHTML = '<i class="ri-save-line"></i> Enregistrement automatique'; }, 1500);
}

function commit(msg) { persist(); applySettings(); renderAdmin(); renderInstant(); if (msg) toast(msg); }

// Rendu sans animation (pendant l'édition dans l'admin)
function renderInstant() {
    instantRender = true;
    document.body.classList.add('instant');
    renderAll();
    instantRender = false;
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('instant')));
}

function adminClick(t) {
    const tab = t.closest('[data-admin-tab]');
    if (tab) { state.adminTab = tab.dataset.adminTab; return renderAdmin(); }
    const item = t.closest('.admin-item');
    if (item) { state.editingId = item.dataset.id; return renderAdmin(); }
    const form = t.closest('form');

    if (t.closest('[data-new-theme]')) {
        const rubrique = state.rubrique !== 'all' ? state.rubrique : data().rubriques[0]?.id || '';
        const theme = { id: uid('t'), rubrique, name: 'Nouveau thème', owner: '', color: rubriqueOf(rubrique).color, icon: 'ri-folder-line', note: '', actions: [] };
        data().themes.push(theme);
        state.editingId = theme.id;
        commit();
        return $('#admin-body [name="name"]')?.select();
    }
    if (t.closest('[data-add-action]')) {
        const box = $('#action-rows');
        box.querySelector('[data-empty]')?.remove();
        const last = [...box.querySelectorAll('[name="a-end"]')].pop();
        const start = last?.value ? iso(new Date(parse(last.value).getTime() + DAY)) : (themeById(state.editingId)?.start || undefined);
        box.insertAdjacentHTML('beforeend', actionRow({ start }));
        box.lastElementChild.classList.add('is-new');
        box.lastElementChild.querySelector('.ar-name').focus();
        return autosave(form);
    }
    if (t.closest('[data-remove]')) {
        const row = t.closest('.action-row');
        row.classList.add('is-leaving');
        return setTimeout(() => { row.remove(); autosave(form); }, 180);
    }
    const done = t.closest('[data-done]');
    if (done) {
        const range = done.closest('.action-row').querySelector('[name="a-progress"]');
        range.value = Number(range.value) >= 100 ? 0 : 100;
        range.nextElementSibling.textContent = range.value + '%';
        return autosave(form);
    }
    const move = t.closest('[data-move]');
    if (move) {
        const list = data().themes, i = list.findIndex(x => x.id === state.editingId);
        const same = list.map((x, k) => k).filter(k => list[k].rubrique === list[i].rubrique);
        const j = same[same.indexOf(i) + Number(move.dataset.move)];
        if (j !== undefined) { [list[i], list[j]] = [list[j], list[i]]; commit(); }
        return;
    }
    if (t.closest('[data-duplicate]')) {
        const th = themeById(state.editingId);
        const copy = { ...structuredClone(th), id: uid('t'), name: th.name + ' (copie)' };
        data().themes.splice(data().themes.indexOf(th) + 1, 0, copy);
        state.editingId = copy.id;
        return commit('Thème dupliqué');
    }
    if (t.closest('[data-delete]')) {
        const th = themeById(state.editingId);
        if (th && confirm(`Supprimer le thème « ${th.name} » et ses ${th.actions.length} actions ?`)) {
            data().themes = data().themes.filter(x => x !== th);
            state.editingId = data().themes[0]?.id || null;
            commit('Thème supprimé');
        }
        return;
    }
    if (t.closest('[data-new-rubrique]')) {
        data().rubriques.push({ id: uid('r'), name: 'Nouvelle rubrique', color: '#0891b2', icon: 'ri-folder-line' });
        commit();
        return [...document.querySelectorAll('#admin-body [name="r-name"]')].pop()?.select();
    }
    const rm = t.closest('[data-rubrique-move]');
    if (rm) {
        const i = Number(rm.dataset.rubriqueMove), list = data().rubriques;
        if (i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; commit(); }
        return;
    }
    const rd = t.closest('[data-rubrique-delete]');
    if (rd) {
        const r = data().rubriques.find(x => x.id === rd.dataset.rubriqueDelete);
        if (r && confirm(`Supprimer la rubrique « ${r.name} » ?`)) {
            data().rubriques = data().rubriques.filter(x => x !== r);
            if (state.rubrique === r.id) state.rubrique = 'all';
            commit('Rubrique supprimée');
        }
        return;
    }
    if (t.closest('[data-reset-settings]')) { data().settings = { ...DEFAULT_SETTINGS }; return commit('Réglages réinitialisés'); }
    if (t.closest('[data-export]')) return exportData();
    if (t.closest('[data-import]')) return $('#import-file').click();
    if (t.closest('[data-reset]')) return resetLocal();
}

// ─── Persistance, import / export ────────────────
const DATA_HEADER = `/* ============================================================
   PICARD2030 — Données (source de vérité)

   Structure : rubriques → thèmes → actions
   - rubriques : les grandes parties (Commerce, Production…)
   - themes    : les grands thèmes, rattachés à une rubrique
   - actions   : les actions de chaque thème

   Chaque thème et chaque action a une date de début, une date
   de fin et un texte « note » affiché au survol.
   Dates : AAAA-MM-JJ · progress : 0 à 100
   L'avancement d'un thème est calculé à partir de ses actions.

   Ce fichier peut être modifié à la main, par Claude, ou régénéré
   depuis l'admin (Données → Exporter).
   ============================================================ */
`;

function persist() {
    saveLocal();
    $('#local-banner').hidden = false;
}

function exportData() {
    data().meta.updatedAt = iso(today);
    const content = `${DATA_HEADER}window.PICARD2030_DATA = ${JSON.stringify(data(), null, 2)};\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/javascript' }));
    a.download = 'projets.js';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Fichier projets.js téléchargé — à placer dans data/');
}

function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const txt = String(reader.result);
            const json = JSON.parse(txt.slice(txt.indexOf('{', txt.indexOf('=') + 1), txt.lastIndexOf('}') + 1));
            if (!Array.isArray(json.themes)) throw new Error('format');
            store.data = normalize(json);
            persist();
            applySettings();
            if ($('#admin').classList.contains('open')) openAdmin();
            renderAll();
            toast('Données importées');
        } catch (e) {
            toast("Fichier invalide : impossible d'importer", true);
        }
    };
    reader.readAsText(file);
}

function resetLocal() {
    if (!confirm('Revenir aux données publiées (data/projets.js) et perdre les modifications locales ?')) return;
    clearLocal();
    loadData();
    $('#local-banner').hidden = true;
    if (!data().rubriques.some(r => r.id === state.rubrique)) state.rubrique = 'all';
    applySettings();
    if ($('#admin').classList.contains('open')) openAdmin();
    renderAll();
    toast('Données publiées rechargées');
}

function toast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
}

// ─── Assemblage ──────────────────────────────────
function renderOwnerFilter() {
    const owners = [...new Set(data().themes.filter(t => state.rubrique === 'all' || t.rubrique === state.rubrique).map(t => t.owner).filter(Boolean))].sort();
    if (!owners.includes(state.owner)) state.owner = '';
    $('#filter-owner').innerHTML = `<option value="">Tous les responsables</option>` +
        owners.map(o => `<option ${o === state.owner ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

function renderAll() {
    renderTabs();
    renderOwnerFilter();
    renderStory();
    renderKpis();
    renderOverview();
    renderInsights();
    renderGantt();
    observeReveals();
}

function setRubrique(id) {
    state.rubrique = id;
    try { localStorage.setItem('picard2030_rubrique', id); } catch (e) { /* ignore */ }
    renderAll();
}

function applySettings() {
    const s = settings();
    document.title = s.title;
    $('#app-title').textContent = s.title;
    $('#brand-mark').textContent = (s.title.trim()[0] || 'P').toUpperCase();
    $('#today-label').textContent = [s.subtitle, fmtDate(today)].filter(Boolean).join(' · ');
    $('#zoom-plan').textContent = `${s.planStart} → ${s.planEnd}`;
    document.documentElement.style.setProperty('--accent', s.accent);
}

function bind() {
    document.addEventListener('click', e => {
        const t = e.target;
        if (t.closest('#admin')) {
            if (t === $('#admin') || t.closest('#admin-close')) return closeAdmin();
            return adminClick(t);
        }
        const toggle = t.closest('[data-toggle]');
        if (toggle) {
            const id = toggle.dataset.toggle;
            state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id);
            hideTip();
            return renderGantt();
        }
        const rub = t.closest('[data-rubrique]');
        if (rub) return setRubrique(rub.dataset.rubrique);
        const zoom = t.closest('[data-zoom]');
        if (zoom) { state.zoom = zoom.dataset.zoom; state.anchor = startOfMonth(state.zoom === 'year' ? new Date(state.anchor.getFullYear(), 0, 1) : today); return renderGantt(); }
        const row = t.closest('.g-row, .sn-card, .sn-visual');
        if (row) return openDrawer(row.dataset.id);
        if (t.closest('[data-close]') || t === $('#overlay')) return closeDrawer();
        const edit = t.closest('[data-edit]');
        if (edit) { closeDrawer(); return openAdmin(edit.dataset.edit); }
    });

    document.addEventListener('mousemove', e => {
        const target = e.target.closest?.('[data-tip]');
        if (target && !$('#admin').classList.contains('open')) showTip(target, e.clientX, e.clientY);
        else hideTip();
    });
    document.addEventListener('scroll', hideTip, true);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeDrawer(); closeAdmin(); hideTip(); }
        if (e.key === 'Enter' && e.target.matches('.g-row, .sn-card')) openDrawer(e.target.dataset.id);
    });

    $('#admin-body').addEventListener('input', e => {
        if (e.target.type === 'range') e.target.nextElementSibling.textContent = e.target.value + '%';
        autosave(e.target.closest('form'));
    });
    $('#admin-body').addEventListener('change', e => autosave(e.target.closest('form')));

    $('#toggle-all').onclick = () => {
        const themes = visibleThemes();
        const allOpen = themes.every(t => !state.collapsed.has(t.id));
        themes.forEach(t => allOpen ? state.collapsed.add(t.id) : state.collapsed.delete(t.id));
        renderGantt();
    };
    $('#nav-prev').onclick = () => { state.anchor = addMonths(state.anchor, state.zoom === 'year' ? -12 : -6); renderGantt(); };
    $('#nav-next').onclick = () => { state.anchor = addMonths(state.anchor, state.zoom === 'year' ? 12 : 6); renderGantt(); };
    $('#nav-today').onclick = () => { state.anchor = startOfMonth(today); if (state.zoom === 'plan') state.zoom = 'year'; renderGantt(); };
    $('#filter-owner').onchange = e => { state.owner = e.target.value; renderAll(); };
    let resizeTimer;
    addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (storyMode() !== state.storyMode) { renderStory(); observeReveals(); } }, 200); });
    $('#btn-admin').onclick = () => openAdmin();
    $('#btn-banner-export').onclick = exportData;
    $('#btn-reset').onclick = resetLocal;
    $('#import-file').onchange = e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; };
}

loadData();
$('#local-banner').hidden = !store.isLocal;
try { const saved = localStorage.getItem('picard2030_rubrique'); if (saved && (saved === 'all' || data().rubriques.some(r => r.id === saved))) state.rubrique = saved; } catch (e) { /* ignore */ }
bind();
applySettings();
renderAll();
