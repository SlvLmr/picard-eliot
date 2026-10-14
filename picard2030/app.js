/* ============================================================
   PICARD2030 — Timeline & suivi d'avancement des projets
   Données : data/projets.js (window.PICARD2030_DATA)
   Les modifications faites dans l'admin sont conservées dans le
   navigateur jusqu'à export du fichier de données.
   ============================================================ */

const STORAGE_KEY = 'picard2030_data_v1';
const DAY = 86400000;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DEFAULT_SETTINGS = {
    title: 'Picard2030',
    subtitle: 'Suivi des projets',
    accent: '#0f766e',
    planStart: 2026,
    planEnd: 2030,
    warnThreshold: 5,
    lateThreshold: 15,
    milestoneHorizon: 90,
};

const HEALTH = {
    done:     { label: 'Terminé',   icon: 'ri-checkbox-circle-fill', cls: 'h-done' },
    ok:       { label: 'Dans les temps', icon: 'ri-sun-fill',        cls: 'h-ok' },
    warn:     { label: 'Vigilance', icon: 'ri-cloudy-fill',          cls: 'h-warn' },
    late:     { label: 'En retard', icon: 'ri-thunderstorms-fill',   cls: 'h-late' },
    upcoming: { label: 'À venir',   icon: 'ri-time-line',            cls: 'h-upcoming' },
};

const state = {
    data: null,
    isLocal: false,
    pole: 'all',
    zoom: 'year',
    anchor: startOfMonth(new Date()),
    owner: '',
    editingId: null,
    adminTab: 'projects',
};

const today = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();

// ─── Utilitaires ─────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function parse(d) { const [y, m, j] = String(d).split('-').map(Number); return new Date(y, (m || 1) - 1, j || 1, 12); }
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmtDate(d) { const x = parse(d); return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function daysBetween(a, b) { return Math.round((b - a) / DAY); }
function uid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 9); }
function settings() { return { ...DEFAULT_SETTINGS, ...state.data.settings }; }

// ─── Calculs ─────────────────────────────────────
function poleOf(id) { return state.data.poles.find(p => p.id === id) || { id, name: id || '—', color: '#64748b', icon: 'ri-folder-line' }; }

function projectRange(p) {
    const dates = [...p.phases.flatMap(ph => [parse(ph.start), parse(ph.end)]), ...p.milestones.map(m => parse(m.date))];
    if (!dates.length) return { start: today, end: today };
    return { start: new Date(Math.min(...dates)), end: new Date(Math.max(...dates)) };
}

function phaseDays(ph) { return Math.max(1, daysBetween(parse(ph.start), parse(ph.end)) + 1); }

function projectProgress(p) {
    const total = p.phases.reduce((s, ph) => s + phaseDays(ph), 0);
    if (!total) return p.milestones.length ? Math.round(100 * p.milestones.filter(m => m.done).length / p.milestones.length) : 0;
    return Math.round(p.phases.reduce((s, ph) => s + phaseDays(ph) * (Number(ph.progress) || 0), 0) / total);
}

function expectedProgress(p) {
    const total = p.phases.reduce((s, ph) => s + phaseDays(ph), 0);
    if (!total) return 0;
    const done = p.phases.reduce((s, ph) => {
        const a = parse(ph.start), b = parse(ph.end);
        return s + phaseDays(ph) * clamp((today - a) / Math.max(DAY, b - a), 0, 1);
    }, 0);
    return Math.round(100 * done / total);
}

function timeElapsed(p) {
    const { start, end } = projectRange(p);
    return Math.round(100 * clamp((today - start) / Math.max(DAY, end - start), 0, 1));
}

function overdueMilestones(p) { return p.milestones.filter(m => !m.done && parse(m.date) < today); }

function health(p) {
    const prog = projectProgress(p);
    if (prog >= 100 && !overdueMilestones(p).length) return 'done';
    if (projectRange(p).start > today) return 'upcoming';
    const delta = prog - expectedProgress(p);
    const s = settings();
    if (overdueMilestones(p).length || delta < -s.lateThreshold) return 'late';
    if (delta < -s.warnThreshold) return 'warn';
    return 'ok';
}

function nextMilestone(projects) {
    return projects
        .flatMap(p => p.milestones.filter(m => !m.done).map(m => ({ ...m, project: p })))
        .sort((a, b) => parse(a.date) - parse(b.date))
        .find(m => parse(m.date) >= today) || null;
}

function weightedProgress(projects) {
    let w = 0, s = 0;
    projects.forEach(p => { const d = p.phases.reduce((t, ph) => t + phaseDays(ph), 0) || 1; w += d; s += d * projectProgress(p); });
    return w ? Math.round(s / w) : 0;
}

function countdown(date) {
    const n = daysBetween(today, parse(date));
    if (n === 0) return "aujourd'hui";
    return n > 0 ? `J-${n}` : `J+${-n}`;
}

function visibleProjects() {
    return state.data.projects.filter(p =>
        (state.pole === 'all' || p.pole === state.pole) &&
        (!state.owner || p.owner === state.owner));
}

// ─── Composants visuels ──────────────────────────
function gauge(value, color, size = 96, stroke = 10, label = '') {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - clamp(value, 0, 100) / 100);
    return `<div class="gauge" style="width:${size}px;height:${size}px">
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${value}%">
            <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gauge-bg" stroke-width="${stroke}"/>
            <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gauge-fg" stroke="${color}" stroke-width="${stroke}"
                stroke-dasharray="${c}" stroke-dashoffset="${c}" data-offset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
        </svg>
        <div class="gauge-label"><strong>${value}%</strong>${label ? `<small>${esc(label)}</small>` : ''}</div>
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
}

// ─── Rendu : onglets & pôles ─────────────────────
function renderTabs() {
    const tabs = [{ id: 'all', name: "Vue d'ensemble", icon: 'ri-apps-2-line', color: 'var(--accent)' }, ...state.data.poles];
    $('#pole-tabs').innerHTML = tabs.map(t => {
        const n = t.id === 'all' ? state.data.projects.length : state.data.projects.filter(p => p.pole === t.id).length;
        return `<button class="pole-tab ${state.pole === t.id ? 'active' : ''}" data-pole="${esc(t.id)}" style="--pole:${t.color}">
            <i class="${esc(t.icon)}"></i>${esc(t.name)}<span class="count">${n}</span></button>`;
    }).join('');
    document.documentElement.style.setProperty('--pole-current', state.pole === 'all' ? 'var(--accent)' : poleOf(state.pole).color);
}

function renderPolesOverview() {
    const el = $('#poles-overview');
    if (state.pole !== 'all') { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = state.data.poles.map(pole => {
        const projects = state.data.projects.filter(p => p.pole === pole.id);
        const hs = projects.map(health);
        const late = hs.filter(h => h === 'late').length, warn = hs.filter(h => h === 'warn').length;
        const next = nextMilestone(projects);
        return `<button class="pole-card" data-pole="${esc(pole.id)}" style="--pole:${pole.color}">
            <div class="pole-card-head"><i class="${esc(pole.icon)}"></i><h3>${esc(pole.name)}</h3></div>
            <div class="pole-card-body">
                ${gauge(weightedProgress(projects), pole.color, 120, 12, 'avancement')}
                <ul class="pole-stats">
                    <li><strong>${projects.length}</strong> projets</li>
                    <li class="${late ? 't-late' : ''}"><strong>${late}</strong> en retard</li>
                    <li class="${warn ? 't-warn' : ''}"><strong>${warn}</strong> en vigilance</li>
                    <li class="pole-next">${next ? `<i class="ri-flag-2-line"></i> ${esc(next.name)} <em>${countdown(next.date)}</em>` : 'Aucun jalon à venir'}</li>
                </ul>
            </div>
            <div class="pole-health">${projects.map(p => `<span class="dot ${HEALTH[health(p)].cls}" title="${esc(p.name)} — ${HEALTH[health(p)].label}"></span>`).join('')}</div>
        </button>`;
    }).join('');
}

// ─── Rendu : KPI ─────────────────────────────────
function renderKpis() {
    const projects = visibleProjects();
    const color = state.pole === 'all' ? 'var(--accent)' : poleOf(state.pole).color;
    const hs = projects.map(health);
    const active = hs.filter(h => h !== 'done' && h !== 'upcoming').length;
    const late = hs.filter(h => h === 'late').length;
    const warn = hs.filter(h => h === 'warn').length;
    const horizon = settings().milestoneHorizon;
    const inHorizon = projects.flatMap(p => p.milestones).filter(m => !m.done && parse(m.date) >= today && daysBetween(today, parse(m.date)) <= horizon).length;
    const next = nextMilestone(projects);

    $('#kpis').innerHTML = `
        <div class="kpi kpi-gauge">${gauge(weightedProgress(projects), color, 88, 9)}<div><span class="kpi-label">Avancement global</span><span class="kpi-sub">pondéré par la durée</span></div></div>
        <div class="kpi"><i class="ri-rocket-2-line kpi-icon"></i><span class="kpi-value">${active}<small>/${projects.length}</small></span><span class="kpi-label">Projets en cours</span></div>
        <div class="kpi ${late ? 'kpi-alert' : ''}"><i class="ri-alarm-warning-line kpi-icon"></i><span class="kpi-value">${late}</span><span class="kpi-label">En retard</span><span class="kpi-sub">${warn} en vigilance</span></div>
        <div class="kpi"><i class="ri-flag-2-line kpi-icon"></i><span class="kpi-value">${inHorizon}</span><span class="kpi-label">Jalons sous ${horizon} jours</span></div>
        <div class="kpi kpi-next">${next
            ? `<span class="kpi-countdown">${countdown(next.date)}</span><span class="kpi-label">Prochain jalon</span><span class="kpi-sub">${esc(next.name)} · ${esc(next.project.name)}</span>`
            : `<span class="kpi-label">Aucun jalon à venir</span>`}</div>`;
}

// ─── Rendu : timeline (Gantt) ────────────────────
function timelineRange() {
    if (state.zoom === 'plan') { const s = settings(); return { from: new Date(s.planStart, 0, 1), to: new Date(s.planEnd + 1, 0, 1) }; }
    if (state.zoom === 'year') { const y = state.anchor.getFullYear(); return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) }; }
    return { from: state.anchor, to: addMonths(state.anchor, 6) };
}

function renderGantt() {
    const { from, to } = timelineRange();
    const span = to - from;
    const pct = d => 100 * (d - from) / span;
    const projects = visibleProjects();

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
    const showToday = today >= from && today < to;
    const todayLine = showToday ? `<div class="today-line" style="left:${pct(today)}%"><span>Aujourd'hui</span></div>` : '';

    const groups = state.pole === 'all'
        ? state.data.poles.map(pole => ({ pole, items: projects.filter(p => p.pole === pole.id) })).filter(g => g.items.length)
        : [{ pole: null, items: projects }];

    const rows = groups.map(g => {
        const head = g.pole ? `<div class="g-group" style="--pole:${g.pole.color}"><i class="${esc(g.pole.icon)}"></i>${esc(g.pole.name)}</div>` : '';
        return head + g.items.map(p => {
            const { start, end } = projectRange(p);
            const h = health(p), prog = projectProgress(p);
            let track = '';
            if (end >= from && start < to) {
                const a = clamp(pct(start), 0, 100), b = clamp(pct(end), 0, 100);
                track += `<div class="g-span" style="left:${a}%;width:${b - a}%;--c:${p.color}"></div>`;
            }
            p.phases.forEach(ph => {
                const s = parse(ph.start), e = new Date(parse(ph.end).getTime() + DAY);
                if (e < from || s >= to) return;
                const a = clamp(pct(s), 0, 100), b = clamp(pct(e), 0, 100);
                track += `<div class="g-phase" style="left:${a}%;width:${b - a}%;--c:${p.color};--p:${clamp(ph.progress, 0, 100)}%"
                    title="${esc(ph.name)}\n${fmtDate(ph.start)} → ${fmtDate(ph.end)}\nAvancement : ${ph.progress}%">
                    <div class="g-phase-fill"></div><span>${esc(ph.name)}</span></div>`;
            });
            p.milestones.forEach(m => {
                const d = parse(m.date);
                if (d < from || d >= to) return;
                const over = !m.done && d < today;
                track += `<div class="g-ms ${m.done ? 'done' : ''} ${over ? 'over' : ''}" style="left:${pct(d)}%;--c:${p.color}"
                    title="◆ ${esc(m.name)}\n${fmtDate(m.date)}${m.done ? ' — atteint' : over ? ' — en retard' : ' — ' + countdown(m.date)}"></div>`;
            });
            return `<div class="g-row" data-id="${esc(p.id)}" tabindex="0">
                <div class="g-label">
                    <span class="dot ${HEALTH[h].cls}" title="${HEALTH[h].label}"></span>
                    <div class="g-label-text"><strong>${esc(p.name)}</strong><small>${esc(p.owner)}</small></div>
                    <span class="g-pct">${prog}%</span>
                </div>
                <div class="g-track">${track}</div>
            </div>`;
        }).join('');
    }).join('');

    $('#gantt').innerHTML = `
        <div class="g-head"><div class="g-label g-label-head">${periodLabel(from, to)}</div><div class="g-track g-ticks">${ticks}</div></div>
        <div class="g-body">
            <div class="g-grid"><div class="g-label"></div><div class="g-track">${grid}${todayLine}</div></div>
            ${rows || '<div class="empty">Aucun projet pour ce filtre.</div>'}
        </div>`;

    document.querySelectorAll('#zoom button').forEach(b => b.classList.toggle('active', b.dataset.zoom === state.zoom));
    $('#nav-prev').disabled = $('#nav-next').disabled = state.zoom === 'plan';
}

function periodLabel(from, to) {
    if (state.zoom === 'plan') return `Plan ${settings().planStart} → ${settings().planEnd}`;
    if (state.zoom === 'year') return `Année ${from.getFullYear()}`;
    const last = addMonths(to, -1);
    return `${MONTHS[from.getMonth()]} ${from.getFullYear()} → ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;
}

// ─── Rendu : cartes projets ──────────────────────
function renderCards() {
    const projects = visibleProjects();
    $('#cards').innerHTML = projects.map(p => {
        const h = health(p), prog = projectProgress(p), exp = expectedProgress(p), el = timeElapsed(p);
        const next = nextMilestone([p]);
        const pole = poleOf(p.pole);
        const current = p.phases.find(ph => parse(ph.start) <= today && parse(ph.end) >= today);
        return `<article class="card" data-id="${esc(p.id)}" tabindex="0" style="--c:${p.color}">
            <div class="card-top">
                ${gauge(prog, p.color, 84, 9)}
                <div class="card-title">
                    <span class="chip" style="--pole:${pole.color}"><i class="${esc(pole.icon)}"></i>${esc(pole.name)}</span>
                    <h3>${esc(p.name)}</h3>
                    <small>${esc(p.owner)}</small>
                </div>
            </div>
            ${healthBadge(h)}
            <div class="card-bars">
                <div class="bar-row"><span>Temps écoulé</span><b>${el}%</b></div>${bar(el, 'var(--muted-strong)', 'thin')}
                <div class="bar-row"><span>Travail réalisé</span><b>${prog}%</b></div>${bar(prog, p.color, 'thin')}
                <div class="bar-row sub"><span>Attendu à date</span><b>${exp}%</b></div>
            </div>
            <div class="card-foot">
                <span><i class="ri-loader-2-line"></i>${current ? esc(current.name) : '—'}</span>
                <span>${next ? `<i class="ri-flag-2-line"></i>${esc(next.name)} <em>${countdown(next.date)}</em>` : ''}</span>
            </div>
        </article>`;
    }).join('') || '<div class="empty">Aucun projet pour ce filtre.</div>';
}

// ─── Détail projet ───────────────────────────────
function openDrawer(id) {
    const p = state.data.projects.find(x => x.id === id);
    if (!p) return;
    const h = health(p), prog = projectProgress(p), { start, end } = projectRange(p);
    const pole = poleOf(p.pole);
    $('#drawer-content').innerHTML = `
        <div class="drawer-head" style="--c:${p.color}">
            <button class="btn btn-icon drawer-close" data-close><i class="ri-close-line"></i></button>
            <span class="chip" style="--pole:${pole.color}"><i class="${esc(pole.icon)}"></i>${esc(pole.name)}</span>
            <h2>${esc(p.name)}</h2>
            <p class="muted">${esc(p.owner)} · ${fmtDate(iso(start))} → ${fmtDate(iso(end))}</p>
        </div>
        <div class="drawer-summary">
            ${gauge(prog, p.color, 120, 12, 'réalisé')}
            <div>
                ${healthBadge(h)}
                <p class="muted">Attendu à date : <b>${expectedProgress(p)}%</b><br>Temps écoulé : <b>${timeElapsed(p)}%</b></p>
            </div>
        </div>
        ${p.description ? `<p class="drawer-desc">${esc(p.description)}</p>` : ''}
        <h3>Phases</h3>
        <ul class="phase-list">${p.phases.map(ph => {
            const isNow = parse(ph.start) <= today && parse(ph.end) >= today;
            return `<li class="${isNow ? 'now' : ''}">
                <div class="bar-row"><span>${esc(ph.name)}${isNow ? ' <em class="now-tag">en cours</em>' : ''}</span><b>${ph.progress}%</b></div>
                ${bar(ph.progress, p.color)}
                <small class="muted">${fmtDate(ph.start)} → ${fmtDate(ph.end)}</small>
            </li>`;
        }).join('') || '<li class="muted">Aucune phase</li>'}</ul>
        <h3>Jalons</h3>
        <ul class="ms-list">${p.milestones.slice().sort((a, b) => parse(a.date) - parse(b.date)).map(m => {
            const over = !m.done && parse(m.date) < today;
            return `<li class="${m.done ? 'done' : ''} ${over ? 'over' : ''}">
                <i class="${m.done ? 'ri-checkbox-circle-fill' : over ? 'ri-error-warning-fill' : 'ri-flag-2-line'}"></i>
                <span>${esc(m.name)}</span><small>${fmtDate(m.date)}${m.done ? '' : ' · ' + countdown(m.date)}</small>
            </li>`;
        }).join('') || '<li class="muted">Aucun jalon</li>'}</ul>
        <button class="btn btn-primary btn-block" data-edit="${esc(p.id)}"><i class="ri-edit-line"></i> Modifier dans l'admin</button>`;
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
// Quatre onglets : Projets, Pôles, Réglages, Données.
// Toute modification est enregistrée automatiquement (dans le navigateur).
const ADMIN_TABS = [
    { id: 'projects', label: 'Projets', icon: 'ri-folders-line' },
    { id: 'poles', label: 'Pôles', icon: 'ri-layout-grid-line' },
    { id: 'settings', label: 'Réglages', icon: 'ri-equalizer-line' },
    { id: 'data', label: 'Données', icon: 'ri-database-2-line' },
];

const ICONS = [
    ['ri-store-2-line', 'Boutique'], ['ri-tools-line', 'Outils'], ['ri-shopping-cart-line', 'Panier'],
    ['ri-truck-line', 'Logistique'], ['ri-building-4-line', 'Usine'], ['ri-team-line', 'Équipe'],
    ['ri-megaphone-line', 'Marketing'], ['ri-line-chart-line', 'Finance'], ['ri-computer-line', 'Informatique'],
    ['ri-shield-check-line', 'Qualité'], ['ri-leaf-line', 'Environnement'], ['ri-lightbulb-line', 'Innovation'],
    ['ri-global-line', 'International'], ['ri-user-heart-line', 'RH'], ['ri-folder-line', 'Dossier'],
];

function openAdmin(id) {
    if (id) { state.editingId = id; state.adminTab = 'projects'; }
    if (!state.data.projects.some(p => p.id === state.editingId)) state.editingId = state.data.projects[0]?.id || null;
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
    body.innerHTML = {
        projects: adminProjectsHtml,
        poles: adminPolesHtml,
        settings: adminSettingsHtml,
        data: adminDataHtml,
    }[state.adminTab]();
}

// Projets
function adminProjectListHtml() {
    return state.data.poles.map(pole => `
        <div class="admin-group" style="--pole:${pole.color}"><i class="${esc(pole.icon)}"></i>${esc(pole.name)}</div>
        ${state.data.projects.filter(p => p.pole === pole.id).map(p => `
            <button type="button" class="admin-item ${p.id === state.editingId ? 'active' : ''}" data-id="${esc(p.id)}">
                <span class="swatch" style="background:${p.color}"></span><span>${esc(p.name || 'Sans nom')}</span></button>`).join('')
            || '<p class="admin-none">Aucun projet</p>'}
    `).join('');
}

function adminProjectsHtml() {
    const p = state.data.projects.find(x => x.id === state.editingId);
    const owners = [...new Set(state.data.projects.map(x => x.owner).filter(Boolean))].sort();
    const form = !p ? '<div class="empty">Créez votre premier projet.</div>' : `
        <div class="form-grid">
            <label class="span-2">Nom du projet<input name="name" value="${esc(p.name)}"></label>
            <label>Pôle<select name="pole">${state.data.poles.map(po => `<option value="${esc(po.id)}" ${po.id === p.pole ? 'selected' : ''}>${esc(po.name)}</option>`).join('')}</select></label>
            <label>Responsable<input name="owner" value="${esc(p.owner)}" list="owners-list"></label>
            <label>Couleur<input type="color" name="color" value="${esc(p.color)}"></label>
            <label>&nbsp;<span class="inline-actions">
                <button type="button" class="btn btn-small" data-move="-1" title="Monter"><i class="ri-arrow-up-line"></i></button>
                <button type="button" class="btn btn-small" data-move="1" title="Descendre"><i class="ri-arrow-down-line"></i></button>
                <button type="button" class="btn btn-small" data-duplicate title="Dupliquer"><i class="ri-file-copy-line"></i></button>
            </span></label>
            <label class="span-3">Description<textarea name="description" rows="2">${esc(p.description)}</textarea></label>
            <datalist id="owners-list">${owners.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        </div>
        <div class="form-section">
            <div class="form-section-head"><h3>Phases</h3><button type="button" class="btn btn-small" data-add="phase"><i class="ri-add-line"></i> Phase</button></div>
            <div class="rows-head row-phase"><span>Nom</span><span>Début</span><span>Fin</span><span>Avancement</span><span></span></div>
            <div class="rows" id="phase-rows">${p.phases.map(phaseRow).join('')}</div>
        </div>
        <div class="form-section">
            <div class="form-section-head"><h3>Jalons</h3><button type="button" class="btn btn-small" data-add="ms"><i class="ri-add-line"></i> Jalon</button></div>
            <div class="rows" id="ms-rows">${p.milestones.map(msRow).join('')}</div>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-danger" data-delete><i class="ri-delete-bin-line"></i> Supprimer le projet</button>
        </div>`;
    return `<div class="admin-split">
        <div class="admin-list">
            <div id="admin-projects">${adminProjectListHtml()}</div>
            <button type="button" class="btn btn-primary btn-block" data-new-project><i class="ri-add-line"></i> Nouveau projet</button>
        </div>
        <form class="admin-form" data-form="project" autocomplete="off" onsubmit="return false">${form}</form>
    </div>`;
}

function phaseRow(ph = {}) {
    const start = ph.start || iso(today);
    const end = ph.end || iso(new Date(parse(start).getTime() + 90 * DAY));
    const prog = Number(ph.progress) || 0;
    return `<div class="row row-phase">
        <input name="ph-name" placeholder="Nom de la phase" value="${esc(ph.name || '')}">
        <input type="date" name="ph-start" value="${esc(start)}">
        <input type="date" name="ph-end" value="${esc(end)}">
        <div class="range"><input type="range" name="ph-progress" min="0" max="100" step="5" value="${prog}"><output>${prog}%</output></div>
        <button type="button" class="btn btn-icon" data-remove title="Supprimer"><i class="ri-close-line"></i></button>
    </div>`;
}

function msRow(m = {}) {
    return `<div class="row row-ms">
        <input name="ms-name" placeholder="Nom du jalon" value="${esc(m.name || '')}">
        <input type="date" name="ms-date" value="${esc(m.date || iso(today))}">
        <label class="check"><input type="checkbox" name="ms-done" ${m.done ? 'checked' : ''}> Atteint</label>
        <button type="button" class="btn btn-icon" data-remove title="Supprimer"><i class="ri-close-line"></i></button>
    </div>`;
}

function readProjectForm(form) {
    const p = state.data.projects.find(x => x.id === state.editingId);
    if (!p) return;
    const v = n => form.querySelector(`[name="${n}"]`).value.trim();
    Object.assign(p, { name: v('name'), pole: v('pole'), owner: v('owner'), color: v('color'), description: v('description') });
    p.phases = [...form.querySelectorAll('.row-phase:not(.rows-head)')].map(r => {
        const start = r.querySelector('[name="ph-start"]').value || iso(today);
        let end = r.querySelector('[name="ph-end"]').value || start;
        if (parse(end) < parse(start)) end = start;
        return { name: r.querySelector('[name="ph-name"]').value.trim(), start, end, progress: Number(r.querySelector('[name="ph-progress"]').value) };
    });
    p.milestones = [...form.querySelectorAll('.row-ms')].map(r => ({
        name: r.querySelector('[name="ms-name"]').value.trim(),
        date: r.querySelector('[name="ms-date"]').value || iso(today),
        done: r.querySelector('[name="ms-done"]').checked,
    }));
    $('#admin-projects').innerHTML = adminProjectListHtml();
}

// Pôles
function adminPolesHtml() {
    return `<form class="admin-pane" data-form="poles" autocomplete="off" onsubmit="return false">
        <p class="help">Les pôles structurent les onglets et la timeline. Un pôle qui contient des projets ne peut pas être supprimé : déplacez d'abord ses projets.</p>
        <div class="rows-head row-pole"><span>Nom</span><span>Couleur</span><span>Icône</span><span>Projets</span><span></span></div>
        <div class="rows">${state.data.poles.map((pole, i) => {
            const n = state.data.projects.filter(p => p.pole === pole.id).length;
            return `<div class="row row-pole" data-pole-id="${esc(pole.id)}">
                <input name="pole-name" value="${esc(pole.name)}" placeholder="Nom du pôle">
                <input type="color" name="pole-color" value="${esc(pole.color)}">
                <div class="icon-pick"><i class="${esc(pole.icon)}"></i><select name="pole-icon">${ICONS.map(([ic, lbl]) => `<option value="${ic}" ${ic === pole.icon ? 'selected' : ''}>${lbl}</option>`).join('')}</select></div>
                <span class="muted">${n}</span>
                <span class="inline-actions">
                    <button type="button" class="btn btn-icon" data-pole-move="${i}" data-dir="-1" title="Monter" ${i === 0 ? 'disabled' : ''}><i class="ri-arrow-up-line"></i></button>
                    <button type="button" class="btn btn-icon" data-pole-delete="${esc(pole.id)}" title="${n ? 'Contient des projets' : 'Supprimer'}" ${n ? 'disabled' : ''}><i class="ri-delete-bin-line"></i></button>
                </span>
            </div>`;
        }).join('')}</div>
        <button type="button" class="btn" data-new-pole><i class="ri-add-line"></i> Ajouter un pôle</button>
    </form>`;
}

function readPolesForm(form) {
    form.querySelectorAll('.row-pole[data-pole-id]').forEach(r => {
        const pole = state.data.poles.find(p => p.id === r.dataset.poleId);
        if (!pole) return;
        pole.name = r.querySelector('[name="pole-name"]').value.trim();
        pole.color = r.querySelector('[name="pole-color"]').value;
        pole.icon = r.querySelector('[name="pole-icon"]').value;
        r.querySelector('.icon-pick i').className = pole.icon;
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
        <h3>Météo des projets</h3>
        <div class="form-grid">
            ${field('warnThreshold', 'Vigilance à partir de', 'number', 'points de retard sur l\'avancement attendu', 'min="0" max="100"')}
            ${field('lateThreshold', 'Retard à partir de', 'number', 'points de retard sur l\'avancement attendu', 'min="0" max="100"')}
            ${field('milestoneHorizon', 'Horizon des jalons', 'number', 'jours, pour l\'indicateur « jalons à venir »', 'min="1" max="730"')}
        </div>
        <button type="button" class="btn btn-ghost" data-reset-settings><i class="ri-refresh-line"></i> Réglages par défaut</button>
    </form>`;
}

function readSettingsForm(form) {
    const s = state.data.settings;
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
    return `<div class="admin-pane">
        <p class="help">Vos modifications sont enregistrées <b>dans ce navigateur</b>. Pour les partager avec l'équipe, exportez le fichier
        <code>data/projets.js</code> et remplacez celui du site (ou demandez à Claude de le faire).</p>
        <div class="data-actions">
            <button type="button" class="data-tile" data-export><i class="ri-download-2-line"></i><b>Exporter</b><small>Télécharger projets.js</small></button>
            <button type="button" class="data-tile" data-import><i class="ri-upload-2-line"></i><b>Importer</b><small>Charger un projets.js ou .json</small></button>
            <button type="button" class="data-tile danger" data-reset ${state.isLocal ? '' : 'disabled'}><i class="ri-arrow-go-back-line"></i><b>Annuler mes modifications</b><small>Revenir à la version publiée</small></button>
        </div>
        <p class="muted">Dernière mise à jour : ${state.data.meta.updatedAt ? fmtDate(state.data.meta.updatedAt) : '—'} · ${state.data.projects.length} projets · ${state.data.poles.length} pôles</p>
    </div>`;
}

// Enregistrement automatique
let saveTimer = null;
function autosave(form) {
    if (!form) return;
    ({ project: readProjectForm, poles: readPolesForm, settings: readSettingsForm })[form.dataset.form]?.(form);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persist(); applySettings(); renderAll(); flashSaved(); }, 250);
}

function flashSaved() {
    const el = $('#admin-status');
    el.classList.add('saved');
    el.innerHTML = '<i class="ri-check-line"></i> Enregistré';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.classList.remove('saved'); el.innerHTML = '<i class="ri-save-line"></i> Enregistrement automatique'; }, 1500);
}

function commit(msg) { persist(); applySettings(); renderAdmin(); renderAll(); if (msg) toast(msg); }

function adminClick(t) {
    const tab = t.closest('[data-admin-tab]');
    if (tab) { state.adminTab = tab.dataset.adminTab; return renderAdmin(); }
    const item = t.closest('.admin-item');
    if (item) { state.editingId = item.dataset.id; return renderAdmin(); }
    const form = t.closest('form');

    if (t.closest('[data-new-project]')) {
        const pole = state.pole !== 'all' ? state.pole : state.data.poles[0]?.id || '';
        const p = { id: uid('p'), pole, name: 'Nouveau projet', owner: '', color: poleOf(pole).color, description: '',
            phases: [{ name: 'Phase 1', start: iso(today), end: iso(new Date(today.getTime() + 90 * DAY)), progress: 0 }], milestones: [] };
        state.data.projects.push(p);
        state.editingId = p.id;
        commit();
        return $('#admin-body [name="name"]')?.select();
    }
    const add = t.closest('[data-add]');
    if (add) {
        const isPhase = add.dataset.add === 'phase';
        const box = isPhase ? $('#phase-rows') : $('#ms-rows');
        const last = [...box.querySelectorAll('[name="ph-end"]')].pop();
        const start = isPhase && last?.value ? iso(new Date(parse(last.value).getTime() + DAY)) : undefined;
        box.insertAdjacentHTML('beforeend', isPhase ? phaseRow({ start }) : msRow());
        box.lastElementChild.querySelector('input').focus();
        return autosave(form);
    }
    if (t.closest('[data-remove]')) { t.closest('.row').remove(); return autosave(form); }
    const move = t.closest('[data-move]');
    if (move) {
        const list = state.data.projects, i = list.findIndex(x => x.id === state.editingId);
        const samePole = list.map((x, k) => k).filter(k => list[k].pole === list[i].pole);
        const j = samePole[samePole.indexOf(i) + Number(move.dataset.move)];
        if (j !== undefined) { [list[i], list[j]] = [list[j], list[i]]; commit(); }
        return;
    }
    if (t.closest('[data-duplicate]')) {
        const p = state.data.projects.find(x => x.id === state.editingId);
        const copy = { ...structuredClone(p), id: uid('p'), name: p.name + ' (copie)' };
        state.data.projects.splice(state.data.projects.indexOf(p) + 1, 0, copy);
        state.editingId = copy.id;
        return commit('Projet dupliqué');
    }
    if (t.closest('[data-delete]')) {
        const p = state.data.projects.find(x => x.id === state.editingId);
        if (p && confirm(`Supprimer le projet « ${p.name} » ?`)) {
            state.data.projects = state.data.projects.filter(x => x.id !== p.id);
            state.editingId = state.data.projects[0]?.id || null;
            commit('Projet supprimé');
        }
        return;
    }
    if (t.closest('[data-new-pole]')) {
        state.data.poles.push({ id: uid('pole'), name: 'Nouveau pôle', color: '#0891b2', icon: 'ri-folder-line' });
        commit();
        return [...document.querySelectorAll('#admin-body [name="pole-name"]')].pop()?.select();
    }
    const pm = t.closest('[data-pole-move]');
    if (pm) {
        const i = Number(pm.dataset.poleMove), poles = state.data.poles;
        if (i > 0) { [poles[i - 1], poles[i]] = [poles[i], poles[i - 1]]; commit(); }
        return;
    }
    const pd = t.closest('[data-pole-delete]');
    if (pd) {
        const pole = state.data.poles.find(p => p.id === pd.dataset.poleDelete);
        if (pole && confirm(`Supprimer le pôle « ${pole.name} » ?`)) {
            state.data.poles = state.data.poles.filter(p => p !== pole);
            if (state.pole === pole.id) state.pole = 'all';
            commit('Pôle supprimé');
        }
        return;
    }
    if (t.closest('[data-reset-settings]')) { state.data.settings = { ...DEFAULT_SETTINGS }; return commit('Réglages réinitialisés'); }
    if (t.closest('[data-export]')) return exportData();
    if (t.closest('[data-import]')) return $('#import-file').click();
    if (t.closest('[data-reset]')) return resetLocal();
}

// ─── Persistance, import / export ────────────────
function persist() {
    state.data.meta.updatedAt = iso(today);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); } catch (e) { /* stockage indisponible */ }
    state.isLocal = true;
    $('#local-banner').hidden = false;
}

function load() {
    const base = structuredClone(window.PICARD2030_DATA || { meta: { name: 'Picard2030' }, poles: [], projects: [] });
    let local = null;
    try { local = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* ignore */ }
    state.data = local && Array.isArray(local.projects) ? local : base;
    state.isLocal = !!(local && Array.isArray(local.projects));
    state.data.poles ||= [];
    state.data.settings = settings();
    state.data.projects.forEach(p => { p.phases ||= []; p.milestones ||= []; });
    $('#local-banner').hidden = !state.isLocal;
}

function exportData() {
    state.data.meta.updatedAt = iso(today);
    const content = `/* ============================================================
   PICARD2030 — Données des projets (source de vérité)

   Ce fichier peut être modifié :
   - à la main, ou par Claude (puis commit + push)
   - via l'admin de l'application → bouton « Exporter » qui
     régénère ce fichier à l'identique.

   Format des dates : AAAA-MM-JJ
   progress : 0 à 100 (avancement de la phase)
   ============================================================ */
window.PICARD2030_DATA = ${JSON.stringify(state.data, null, 2)};
`;
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
            if (!Array.isArray(json.projects)) throw new Error('format');
            json.poles ||= [];
            json.meta ||= {};
            state.data = json;
            state.data.settings = settings();
            state.data.projects.forEach(p => { p.phases ||= []; p.milestones ||= []; });
            persist();
            applySettings();
            if ($('#admin').classList.contains('open')) renderAdmin();
            renderAll();
            toast('Données importées');
        } catch (e) {
            toast("Fichier invalide : impossible d'importer", true);
        }
    };
    reader.readAsText(file);
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
    const owners = [...new Set(state.data.projects.filter(p => state.pole === 'all' || p.pole === state.pole).map(p => p.owner).filter(Boolean))].sort();
    if (!owners.includes(state.owner)) state.owner = '';
    $('#filter-owner').innerHTML = `<option value="">Tous les responsables</option>` +
        owners.map(o => `<option ${o === state.owner ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

function renderAll() {
    renderTabs();
    renderPolesOverview();
    renderOwnerFilter();
    renderKpis();
    renderGantt();
    renderCards();
    animateGauges();
}

function setPole(id) {
    state.pole = id;
    try { localStorage.setItem('picard2030_pole', id); } catch (e) { /* ignore */ }
    renderAll();
}

function applySettings() {
    const s = settings();
    document.title = s.title;
    $('#app-title').textContent = s.title;
    $('#brand-mark').textContent = (s.title.trim()[0] || 'P').toUpperCase();
    $('#today-label').textContent = [s.subtitle, fmtDate(iso(today))].filter(Boolean).join(' · ');
    $('#zoom-plan').textContent = `${s.planStart} → ${s.planEnd}`;
    document.documentElement.style.setProperty('--accent', s.accent);
}

function resetLocal() {
    if (!confirm('Revenir aux données publiées (data/projets.js) et perdre les modifications locales ?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    load();
    if (!state.data.poles.some(p => p.id === state.pole)) state.pole = 'all';
    applySettings();
    if ($('#admin').classList.contains('open')) openAdmin();
    renderAll();
    toast('Données publiées rechargées');
}

function bind() {
    document.addEventListener('click', e => {
        const t = e.target;
        if (t.closest('#admin')) {
            if (t === $('#admin') || t.closest('#admin-close')) return closeAdmin();
            return adminClick(t);
        }
        const poleBtn = t.closest('[data-pole]');
        if (poleBtn) return setPole(poleBtn.dataset.pole);
        const zoom = t.closest('[data-zoom]');
        if (zoom) { state.zoom = zoom.dataset.zoom; state.anchor = startOfMonth(state.zoom === 'year' ? new Date(state.anchor.getFullYear(), 0, 1) : today); return renderGantt(); }
        const row = t.closest('.g-row, .card');
        if (row) return openDrawer(row.dataset.id);
        if (t.closest('[data-close]') || t === $('#overlay')) return closeDrawer();
        const edit = t.closest('[data-edit]');
        if (edit) { closeDrawer(); return openAdmin(edit.dataset.edit); }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeDrawer(); closeAdmin(); }
        if (e.key === 'Enter' && e.target.matches('.g-row, .card')) openDrawer(e.target.dataset.id);
    });

    $('#admin-body').addEventListener('input', e => {
        if (e.target.name === 'ph-progress') e.target.nextElementSibling.textContent = e.target.value + '%';
        autosave(e.target.closest('form'));
    });
    $('#admin-body').addEventListener('change', e => autosave(e.target.closest('form')));

    $('#nav-prev').onclick = () => { state.anchor = addMonths(state.anchor, state.zoom === 'year' ? -12 : -6); renderGantt(); };
    $('#nav-next').onclick = () => { state.anchor = addMonths(state.anchor, state.zoom === 'year' ? 12 : 6); renderGantt(); };
    $('#nav-today').onclick = () => { state.anchor = startOfMonth(today); if (state.zoom === 'plan') state.zoom = 'year'; renderGantt(); };
    $('#filter-owner').onchange = e => { state.owner = e.target.value; renderKpis(); renderGantt(); renderCards(); animateGauges(); };
    $('#btn-admin').onclick = () => openAdmin();
    $('#btn-banner-export').onclick = exportData;
    $('#btn-reset').onclick = resetLocal;
    $('#import-file').onchange = e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; };
}

load();
try { const saved = localStorage.getItem('picard2030_pole'); if (saved && (saved === 'all' || state.data.poles.some(p => p.id === saved))) state.pole = saved; } catch (e) { /* ignore */ }
bind();
applySettings();
renderAll();
