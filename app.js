/* ============================================================
   PICARD2030 — Timeline & suivi d'avancement des projets
   Données : data/projets.js (window.PICARD2030_DATA)
   Les modifications faites dans l'admin sont conservées dans le
   navigateur jusqu'à export du fichier de données.
   ============================================================ */

const STORAGE_KEY = 'picard2030_data_v1';
const DAY = 86400000;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const PLAN_START = new Date(2026, 0, 1);
const PLAN_END = new Date(2031, 0, 1);

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
function uid() { return 'p-' + Math.random().toString(36).slice(2, 9); }

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
    if (overdueMilestones(p).length || delta < -15) return 'late';
    if (delta < -5) return 'warn';
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
    const in90 = projects.flatMap(p => p.milestones).filter(m => !m.done && parse(m.date) >= today && daysBetween(today, parse(m.date)) <= 90).length;
    const next = nextMilestone(projects);

    $('#kpis').innerHTML = `
        <div class="kpi kpi-gauge">${gauge(weightedProgress(projects), color, 88, 9)}<div><span class="kpi-label">Avancement global</span><span class="kpi-sub">pondéré par la durée</span></div></div>
        <div class="kpi"><i class="ri-rocket-2-line kpi-icon"></i><span class="kpi-value">${active}<small>/${projects.length}</small></span><span class="kpi-label">Projets en cours</span></div>
        <div class="kpi ${late ? 'kpi-alert' : ''}"><i class="ri-alarm-warning-line kpi-icon"></i><span class="kpi-value">${late}</span><span class="kpi-label">En retard</span><span class="kpi-sub">${warn} en vigilance</span></div>
        <div class="kpi"><i class="ri-flag-2-line kpi-icon"></i><span class="kpi-value">${in90}</span><span class="kpi-label">Jalons sous 90 jours</span></div>
        <div class="kpi kpi-next">${next
            ? `<span class="kpi-countdown">${countdown(next.date)}</span><span class="kpi-label">Prochain jalon</span><span class="kpi-sub">${esc(next.name)} · ${esc(next.project.name)}</span>`
            : `<span class="kpi-label">Aucun jalon à venir</span>`}</div>`;
}

// ─── Rendu : timeline (Gantt) ────────────────────
function timelineRange() {
    if (state.zoom === 'plan') return { from: PLAN_START, to: PLAN_END };
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
    if (state.zoom === 'plan') return 'Plan 2026 → 2030';
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
function openAdmin(id) {
    state.editingId = id || state.data.projects[0]?.id || null;
    $('#admin').classList.add('open');
    $('#admin').setAttribute('aria-hidden', 'false');
    renderAdmin();
}

function closeAdmin() {
    $('#admin').classList.remove('open');
    $('#admin').setAttribute('aria-hidden', 'true');
}

function renderAdmin() {
    $('#admin-projects').innerHTML = state.data.poles.map(pole => `
        <div class="admin-group" style="--pole:${pole.color}"><i class="${esc(pole.icon)}"></i>${esc(pole.name)}</div>
        ${state.data.projects.filter(p => p.pole === pole.id).map(p => `
            <button class="admin-item ${p.id === state.editingId ? 'active' : ''}" data-id="${esc(p.id)}">
                <span class="swatch" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}
    `).join('');

    const p = state.data.projects.find(x => x.id === state.editingId);
    const form = $('#admin-form');
    if (!p) { form.innerHTML = '<div class="empty">Sélectionnez ou créez un projet.</div>'; return; }

    form.innerHTML = `
        <div class="form-grid">
            <label class="span-2">Nom du projet<input name="name" value="${esc(p.name)}" required></label>
            <label>Pôle<select name="pole">${state.data.poles.map(po => `<option value="${esc(po.id)}" ${po.id === p.pole ? 'selected' : ''}>${esc(po.name)}</option>`).join('')}</select></label>
            <label>Responsable<input name="owner" value="${esc(p.owner)}"></label>
            <label>Couleur<input type="color" name="color" value="${esc(p.color)}"></label>
            <label class="span-3">Description<textarea name="description" rows="2">${esc(p.description)}</textarea></label>
        </div>
        <div class="form-section">
            <div class="form-section-head"><h3>Phases</h3><button type="button" class="btn btn-small" data-add="phase"><i class="ri-add-line"></i> Phase</button></div>
            <div class="rows" id="phase-rows">${p.phases.map(phaseRow).join('')}</div>
        </div>
        <div class="form-section">
            <div class="form-section-head"><h3>Jalons</h3><button type="button" class="btn btn-small" data-add="ms"><i class="ri-add-line"></i> Jalon</button></div>
            <div class="rows" id="ms-rows">${p.milestones.map(msRow).join('')}</div>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-danger" data-delete><i class="ri-delete-bin-line"></i> Supprimer le projet</button>
            <button type="submit" class="btn btn-primary"><i class="ri-save-line"></i> Enregistrer</button>
        </div>`;
}

function phaseRow(ph = {}) {
    const d = iso(today);
    return `<div class="row row-phase">
        <input name="ph-name" placeholder="Nom de la phase" value="${esc(ph.name || '')}" required>
        <input type="date" name="ph-start" value="${esc(ph.start || d)}" required>
        <input type="date" name="ph-end" value="${esc(ph.end || d)}" required>
        <div class="range"><input type="range" name="ph-progress" min="0" max="100" step="5" value="${Number(ph.progress) || 0}"><output>${Number(ph.progress) || 0}%</output></div>
        <button type="button" class="btn btn-icon" data-remove title="Supprimer"><i class="ri-close-line"></i></button>
    </div>`;
}

function msRow(m = {}) {
    return `<div class="row row-ms">
        <input name="ms-name" placeholder="Nom du jalon" value="${esc(m.name || '')}" required>
        <input type="date" name="ms-date" value="${esc(m.date || iso(today))}" required>
        <label class="check"><input type="checkbox" name="ms-done" ${m.done ? 'checked' : ''}> Atteint</label>
        <button type="button" class="btn btn-icon" data-remove title="Supprimer"><i class="ri-close-line"></i></button>
    </div>`;
}

function saveAdminForm() {
    const form = $('#admin-form');
    const p = state.data.projects.find(x => x.id === state.editingId);
    if (!p) return;
    const v = n => form.querySelector(`[name="${n}"]`).value.trim();
    p.name = v('name'); p.pole = v('pole'); p.owner = v('owner'); p.color = v('color'); p.description = v('description');
    p.phases = [...form.querySelectorAll('.row-phase')].map(r => ({
        name: r.querySelector('[name="ph-name"]').value.trim(),
        start: r.querySelector('[name="ph-start"]').value,
        end: r.querySelector('[name="ph-end"]').value,
        progress: Number(r.querySelector('[name="ph-progress"]').value),
    })).map(ph => parse(ph.end) < parse(ph.start) ? { ...ph, end: ph.start } : ph)
       .sort((a, b) => parse(a.start) - parse(b.start));
    p.milestones = [...form.querySelectorAll('.row-ms')].map(r => ({
        name: r.querySelector('[name="ms-name"]').value.trim(),
        date: r.querySelector('[name="ms-date"]').value,
        done: r.querySelector('[name="ms-done"]').checked,
    }));
    persist();
    renderAdmin();
    renderAll();
    toast('Projet enregistré');
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
            state.data = json;
            state.data.poles ||= [];
            persist();
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

function bind() {
    $('#today-label').textContent = `Suivi des projets · ${fmtDate(iso(today))}`;

    document.addEventListener('click', e => {
        const t = e.target;
        const poleBtn = t.closest('[data-pole]');
        if (poleBtn) return setPole(poleBtn.dataset.pole);
        const zoom = t.closest('[data-zoom]');
        if (zoom) { state.zoom = zoom.dataset.zoom; state.anchor = startOfMonth(state.zoom === 'year' ? new Date(state.anchor.getFullYear(), 0, 1) : today); return renderGantt(); }
        const row = t.closest('.g-row, .card');
        if (row) return openDrawer(row.dataset.id);
        if (t.closest('[data-close]') || t === $('#overlay')) return closeDrawer();
        const edit = t.closest('[data-edit]');
        if (edit) { closeDrawer(); return openAdmin(edit.dataset.edit); }
        const item = t.closest('.admin-item');
        if (item) { state.editingId = item.dataset.id; return renderAdmin(); }
        const add = t.closest('[data-add]');
        if (add) {
            const box = add.dataset.add === 'phase' ? $('#phase-rows') : $('#ms-rows');
            return box.insertAdjacentHTML('beforeend', add.dataset.add === 'phase' ? phaseRow() : msRow());
        }
        if (t.closest('[data-remove]')) return t.closest('.row').remove();
        if (t.closest('[data-delete]')) {
            const p = state.data.projects.find(x => x.id === state.editingId);
            if (p && confirm(`Supprimer le projet « ${p.name} » ?`)) {
                state.data.projects = state.data.projects.filter(x => x.id !== p.id);
                state.editingId = state.data.projects[0]?.id || null;
                persist(); renderAdmin(); renderAll(); toast('Projet supprimé');
            }
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeDrawer(); closeAdmin(); }
        if (e.key === 'Enter' && e.target.matches('.g-row, .card')) openDrawer(e.target.dataset.id);
    });

    document.addEventListener('input', e => {
        if (e.target.name === 'ph-progress') e.target.nextElementSibling.textContent = e.target.value + '%';
    });

    $('#admin-form').addEventListener('submit', e => { e.preventDefault(); saveAdminForm(); });
    $('#nav-prev').onclick = () => { state.anchor = addMonths(state.anchor, state.zoom === 'year' ? -12 : -6); renderGantt(); };
    $('#nav-next').onclick = () => { state.anchor = addMonths(state.anchor, state.zoom === 'year' ? 12 : 6); renderGantt(); };
    $('#nav-today').onclick = () => { state.anchor = startOfMonth(today); if (state.zoom === 'plan') state.zoom = 'year'; renderGantt(); };
    $('#filter-owner').onchange = e => { state.owner = e.target.value; renderKpis(); renderGantt(); renderCards(); animateGauges(); };
    $('#btn-admin').onclick = () => openAdmin(state.editingId);
    $('#admin-close').onclick = closeAdmin;
    $('#admin').addEventListener('click', e => { if (e.target === $('#admin')) closeAdmin(); });
    $('#admin-add').onclick = () => {
        const pole = state.pole !== 'all' ? state.pole : state.data.poles[0]?.id || '';
        const p = { id: uid(), pole, name: 'Nouveau projet', owner: '', color: poleOf(pole).color, description: '',
            phases: [{ name: 'Phase 1', start: iso(today), end: iso(new Date(today.getTime() + 90 * DAY)), progress: 0 }], milestones: [] };
        state.data.projects.push(p);
        state.editingId = p.id;
        persist(); renderAdmin(); renderAll();
    };
    $('#btn-export').onclick = exportData;
    $('#btn-banner-export').onclick = exportData;
    $('#btn-import').onclick = () => $('#import-file').click();
    $('#import-file').onchange = e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; };
    $('#btn-reset').onclick = () => {
        if (!confirm('Revenir aux données publiées (data/projets.js) et perdre les modifications locales ?')) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        load(); renderAll(); toast('Données publiées rechargées');
    };
}

load();
try { const saved = localStorage.getItem('picard2030_pole'); if (saved && (saved === 'all' || state.data.poles.some(p => p.id === saved))) state.pole = saved; } catch (e) { /* ignore */ }
bind();
renderAll();
