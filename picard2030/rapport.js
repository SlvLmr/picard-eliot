/* ============================================================
   PICARD2030 — Rapport simplifié (A4, à enregistrer en PDF)
   Charte : fond noir, cartes sombres à filet fin, accent doré.
   Page 1 : synthèse (chiffre clé, trajectoire, rubriques, météo,
   échéances, points d'attention) · puis une page par rubrique :
   une ligne par thème, 5 étapes horizontales.
   ============================================================ */

const opts = { actions: true, notes: true, rubrique: 'all', paper: 'dark' };

const STATUS_ORDER = ['late', 'warn', 'ok', 'upcoming', 'done'];

function $id(id) { return document.getElementById(id); }
function pct(v) { return `${v}<small>%</small>`; }

function pill(h) { return `<span class="pill ${HEALTH[h].cls}"><i class="${HEALTH[h].icon}"></i>${HEALTH[h].label}</span>`; }
function exampleTag(r) { return r.example ? '<span class="tag-example">Exemple</span>' : ''; }

function ring(value, color, size, stroke) {
    return `<div class="ring" style="width:${size}px;height:${size}px">${gaugeSvg(value, color, size, stroke, false)}</div>`;
}

// ─── Trajectoire prévue (à une date donnée) ──────
function linAt(s, e, d) { if (d < s) return 0; if (d >= e) return 100; return 100 * (d - s) / Math.max(DAY, e - s); }
function themeExpAt(t, d) {
    if (!t.actions.length) { const r = themeRange(t); return linAt(r.start, r.end, d); }
    let w = 0, s = 0;
    t.actions.forEach(a => { const r = actionRange(a), k = spanDays(r.start, r.end); w += k; s += k * linAt(r.start, r.end, d); });
    return s / w;
}
function expectedAt(themes, d) {
    let w = 0, s = 0;
    themes.forEach(t => { const r = themeRange(t), k = spanDays(r.start, r.end); w += k; s += k * themeExpAt(t, d); });
    return w ? s / w : 0;
}

// Courbe : progression prévue (ligne dorée) et point « réalisé » à date
function trajectory(themes, color, w, h) {
    if (!themes.length) return '';
    const rs = themes.map(themeRange);
    const start = startOfMonth(new Date(Math.min(...rs.map(r => r.start)))), end = addMonths(new Date(Math.max(...rs.map(r => r.end))), 1);
    const pad = { l: 26, r: 10, t: 12, b: 20 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const x = d => pad.l + iw * clamp((d - start) / (end - start), 0, 1), y = v => pad.t + ih * (1 - v / 100);
    const pts = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 7 * DAY)) pts.push([x(d), y(expectedAt(themes, d))]);
    pts.push([x(end), y(expectedAt(themes, end))]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const area = `${line}L${x(end).toFixed(1)},${y(0)}L${x(start).toFixed(1)},${y(0)}Z`;
    const done = weightedProgress(themes), exp = Math.round(expectedAt(themes, today));
    const tx = x(today), months = [];
    for (let d = new Date(start); d <= end; d = addMonths(d, 1)) months.push(new Date(d));
    const step = Math.max(1, Math.ceil(months.length / 7));
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    return `<svg class="traj" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${color};stop-opacity:.28"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/></linearGradient></defs>
        ${[0, 50, 100].map(v => `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pad.l - 6}" y="${y(v) + 3}" text-anchor="end">${v}%</text>`).join('')}
        ${months.filter((m, i) => i % step === 0).map(m => `<text class="axis" x="${x(m)}" y="${h - 5}" text-anchor="middle">${MONTHS[m.getMonth()].replace('.', '')} ${String(m.getFullYear()).slice(2)}</text>`).join('')}
        <path d="${area}" fill="url(#${id})"/>
        <path d="${line}" fill="none" style="stroke:${color}" stroke-width="2" stroke-linejoin="round"/>
        <line class="today" x1="${tx}" x2="${tx}" y1="${pad.t - 4}" y2="${y(0)}"/>
        <circle cx="${tx}" cy="${y(exp)}" r="3.5" style="fill:${color}"/>
        <circle class="real" cx="${tx}" cy="${y(done)}" r="5"/>
        <text class="lbl" x="${tx + 8}" y="${y(done) + 4}">Réalisé ${done}%</text>
    </svg>`;
}

function gapLine(themes) {
    const done = weightedProgress(themes), exp = Math.round(expectedAt(themes, today)), d = done - exp;
    const cls = d >= -settings().warnThreshold ? 'h-ok' : d >= -settings().lateThreshold ? 'h-warn' : 'h-late';
    return `<span class="gap ${cls}">${d >= 0 ? '+' : '−'}${Math.abs(d)} pts</span><span class="muted">vs prévu à date (${exp} %)</span>`;
}

// Météo : barre empilée des statuts
function weather(themes) {
    const counts = Object.fromEntries(STATUS_ORDER.map(k => [k, 0]));
    themes.forEach(t => counts[themeHealth(t)]++);
    const n = themes.length || 1;
    return `<div class="weather">
        <div class="wbar">${STATUS_ORDER.filter(k => counts[k]).map(k => `<span class="${HEALTH[k].cls}" style="flex:${counts[k]}"></span>`).join('')}</div>
        <div class="wlegend">${STATUS_ORDER.map(k => `<span class="${HEALTH[k].cls} ${counts[k] ? '' : 'zero'}"><b>${counts[k]}</b><em>${Math.round(100 * counts[k] / n)} %</em><small><i class="dot"></i>${HEALTH[k].label}</small></span>`).join('')}</div>
    </div>`;
}

function pageHead(crumb) {
    const s = settings();
    return `<header class="phead">
        <div class="brand"><img src="logo/picard2030-embleme-fixe.svg" alt=""><b>${esc(s.title)}</b>${crumb ? `<span>/ ${esc(crumb)}</span>` : ''}</div>
        <span>État d'avancement · ${fmtDate(today)}</span>
    </header>`;
}

function footer(n, total) {
    return `<footer class="pfoot"><span>Document interne · ${esc(settings().title)}</span><span>${n} / ${total}</span></footer>`;
}

function rubriques() {
    return publicRubriques().filter(r => opts.rubrique === 'all' || r.id === opts.rubrique);
}

// ─── Page de synthèse ────────────────────────────
function summaryPage(total) {
    const rubs = rubriques();
    const themes = rubs.flatMap(r => themesOf(r.id));
    const nActions = themes.reduce((n, t) => n + t.actions.length, 0);
    const doneActions = themes.reduce((n, t) => n + t.actions.filter(a => a.progress >= 100).length, 0);
    const deadlines = upcomingDeadlines(themes).slice(0, 7);
    const attention = themes.flatMap(t => [
        ...(['late', 'warn'].includes(themeHealth(t)) ? [{ t, name: t.name, h: themeHealth(t), note: t.note, kind: 'Thème' }] : []),
        ...t.actions.filter(a => ['late', 'warn'].includes(actionHealth(a))).map(a => ({ t, name: a.name, h: actionHealth(a), note: a.note, kind: t.name })),
    ]).sort((a, b) => (a.h === 'late' ? 0 : 1) - (b.h === 'late' ? 0 : 1)).slice(0, 5);

    return `<section class="page">
        ${pageHead('')}
        <div class="hero card">
            <div class="hero-txt">
                <p class="kicker">${rubs.length === 1 ? `Avancement · ${esc(rubs[0].name)}` : 'Avancement global du plan'}</p>
                <p class="big">${pct(weightedProgress(themes))}</p>
                <p class="gapline">${gapLine(themes)}</p>
                <div class="hero-stats">
                    <span><b>${themes.length}</b>thèmes</span><span><b>${nActions}</b>actions</span><span><b>${doneActions}</b>terminées</span>
                </div>
            </div>
            <div class="hero-chart">
                ${trajectory(themes, 'var(--gold)', 380, 150)}
                <p class="chart-legend"><span class="lg-line"></span>Trajectoire prévue<span class="lg-dot"></span>Réalisé à date</p>
            </div>
        </div>

        ${rubs.length < 2 ? '' : `<div class="rubs">${rubs.map(r => {
            const ts = themesOf(r.id), v = weightedProgress(ts);
            return `<div class="card rub" style="--c:${r.color}">
                <div class="rub-top">
                    <div>
                        <h3><i class="${esc(r.icon)}"></i>${esc(r.name)}${exampleTag(r)}</h3>
                        <p class="muted">${ts.length} thèmes · ${ts.reduce((n, t) => n + t.actions.length, 0)} actions</p>
                    </div>
                    ${ring(v, r.color, 58, 6)}
                </div>
                <p class="mid">${pct(v)}</p>
                <p class="gapline small">${gapLine(ts)}</p>
                <div class="mini">${ts.map(t => `<span class="${HEALTH[themeHealth(t)].cls}" title="${esc(t.name)}"></span>`).join('')}</div>
            </div>`;
        }).join('')}</div>`}

        <div class="card">
            <h2>Météo des ${themes.length} thèmes</h2>
            ${weather(themes)}
        </div>

        <div class="two">
            <div class="card">
                <h2><i class="ri-flag-2-line"></i>Prochaines échéances</h2>
                ${deadlines.length ? `<ul class="list">${deadlines.map(d => `
                    <li><span class="when">${countdown(d.date)}</span>
                        <span class="what"><b>${esc(d.name)}</b><small><i class="dot" style="background:${d.theme.color}"></i>${esc(d.theme.name)} · ${fmtDate(d.date)}</small></span></li>`).join('')}</ul>`
                    : '<p class="muted">Aucune échéance à venir.</p>'}
            </div>
            <div class="card">
                <h2><i class="ri-alarm-warning-line"></i>Points d'attention</h2>
                ${attention.length ? `<ul class="list">${attention.map(x => `
                    <li class="${HEALTH[x.h].cls}"><span class="flag"></span>
                        <span class="what"><b>${esc(x.name)}</b><small><i class="dot" style="background:${x.t.color}"></i>${esc(x.kind)}</small>${opts.notes && x.note ? `<em>${esc(x.note)}</em>` : ''}</span></li>`).join('')}</ul>`
                    : '<p class="muted">Aucun point d\'attention : tout est dans les temps.</p>'}
            </div>
        </div>
        ${footer(1, total)}
    </section>`;
}

// ─── Une page par rubrique : 5 étapes par thème ──
// Choix des 5 étapes : la dernière faite, l'étape en cours et les suivantes
const STEPS = 5;
function themeSteps(t) {
    const acts = t.actions.map((a, i) => ({ a, i, d: actionRange(a).end }))
        .sort((x, y) => (x.d - y.d) || (x.i - y.i));
    if (acts.length <= STEPS) return { steps: acts, before: 0, after: 0 };
    const cur = acts.findIndex(x => x.a.progress < 100);
    const from = Math.max(0, Math.min((cur === -1 ? acts.length : cur) - 1, acts.length - STEPS));
    return { steps: acts.slice(from, from + STEPS), before: from, after: acts.length - from - STEPS };
}

function stepState(a) {
    if (a.progress >= 100) return 'done';
    if (actionHealth(a) === 'late') return 'late';
    return actionRange(a).start <= today ? 'now' : 'next';
}

function themeRow(t) {
    const h = themeHealth(t), prog = themeProgress(t);
    const { steps, before, after } = themeSteps(t);
    const lastDone = steps.reduce((k, x, i) => (x.a.progress >= 100 ? i : k), -1);
    const span = Math.max(steps.length - 1, 0) * 20;
    const fill = lastDone > 0 ? lastDone * 20 : 0;
    const head = `<div class="hrow-head">
            <h3>${t.icon ? `<i class="${esc(t.icon)}"></i>` : ''}<span>${esc(t.name)}</span></h3>
            <p class="hrow-meta"><b>${prog}<small>%</small></b>${pill(h)}</p>
            <span class="hbar"><span style="width:${prog}%"></span></span>
            ${opts.notes && t.note ? `<p class="hrow-note">${esc(t.note)}</p>` : ''}
        </div>`;
    if (!opts.actions || !steps.length) return `<div class="hrow card" style="--c:${t.color}">${head}<div></div></div>`;
    return `<div class="hrow card" style="--c:${t.color}">${head}
        <div class="htrack">
            <span class="hline" style="width:${span}%"></span>
            <span class="hline fill" style="width:${fill}%"></span>
            ${before ? `<span class="hmore before">+${before}</span>` : ''}
            ${after ? `<span class="hmore after">+${after}</span>` : ''}
            ${steps.map(({ a }) => {
                const st = stepState(a), d = actionRange(a).end;
                return `<div class="hstep ${st}">
                    <span class="hdate">${isMilestone(a) ? `${d.getDate()} ` : ''}${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}</span>
                    <span class="hnode">${st === 'done' ? '<i class="ri-check-line"></i>' : ''}</span>
                    <span class="hname">${esc(a.name)}</span>
                    <span class="hval">${isMilestone(a) ? 'Jalon' : `${a.progress} %`}</span>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

function rubriquePage(r, n, total) {
    const themes = sortThemes(themesOf(r.id), 'date');
    const nActions = themes.reduce((k, t) => k + t.actions.length, 0);
    return `<section class="page" style="--rub:${r.color}">
        ${pageHead(r.name)}
        <div class="rub-head">
            <div>
                <p class="kicker">Rubrique</p>
                <h1><i class="${esc(r.icon)}"></i>${esc(r.name)}${exampleTag(r)}</h1>
                <p class="muted">${themes.length} thèmes · ${nActions} actions · classés par échéance</p>
            </div>
            <div class="rub-kpi">
                <p class="big mid">${pct(weightedProgress(themes))}</p>
                <p class="gapline small">${gapLine(themes)}</p>
            </div>
        </div>
        <div class="hlegend">
            <span><i class="hn done"><i class="ri-check-line"></i></i>Fait</span><span><i class="hn now"></i>En cours</span>
            <span><i class="hn late"></i>En retard</span><span><i class="hn next"></i>À venir</span>
        </div>
        <div class="hrows">${themes.map(themeRow).join('') || '<p class="muted center">Aucun thème dans cette rubrique.</p>'}</div>
        ${themes.length && themes.length <= 5 ? `<div class="card rub-traj">
            <h2><i class="ri-line-chart-line"></i>Trajectoire de la rubrique</h2>
            ${trajectory(themes, 'var(--gold)', 640, 170)}
            <p class="chart-legend"><span class="lg-line"></span>Trajectoire prévue<span class="lg-dot"></span>Réalisé à date</p>
        </div>` : ''}
        ${footer(n, total)}
    </section>`;
}

function render() {
    document.title = `${settings().title} — État d'avancement`;
    document.body.classList.toggle('paper-light', opts.paper === 'light');
    const rubs = rubriques(), total = rubs.length + 1;
    $id('report').innerHTML = summaryPage(total) + rubs.map((r, i) => rubriquePage(r, i + 2, total)).join('');
}

loadData();
$id('opt-rubrique').innerHTML = `<option value="all">Toutes les rubriques</option>` +
    publicRubriques().map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
if (publicRubriques().length <= 1) $id('opt-rubrique').hidden = true;
$id('opt-actions').onchange = e => { opts.actions = e.target.checked; render(); };
$id('opt-notes').onchange = e => { opts.notes = e.target.checked; render(); };
$id('opt-rubrique').onchange = e => { opts.rubrique = e.target.value; render(); };
$id('opt-paper').onchange = e => { opts.paper = e.target.value; render(); };
$id('btn-print').onclick = () => window.print();
render();
