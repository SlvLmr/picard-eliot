/* ============================================================
   PICARD2030 — Rapport simplifié (A4, à enregistrer en PDF)
   Page 1 : synthèse · puis une page par rubrique, sous forme de
   timeline verticale (infographie).
   ============================================================ */

const opts = { actions: true, notes: true, rubrique: 'all' };

function donut(value, color, size, stroke, icon = '') {
    return `<div class="donut" style="width:${size}px;height:${size}px">
        ${gaugeSvg(value, color, size, stroke, false)}
        <div class="donut-label">${icon ? `<i class="${esc(icon)}" style="color:${color}"></i>` : ''}<b>${value}%</b></div>
    </div>`;
}

function pill(h) { return `<span class="pill ${HEALTH[h].cls}"><i class="${HEALTH[h].icon}"></i>${HEALTH[h].label}</span>`; }

function band() {
    const colors = store.data.themes.map(t => t.color);
    return `<div class="band">${colors.map(c => `<span style="background:${c}"></span>`).join('')}</div>`;
}

function footer(label) {
    const s = settings();
    return `<footer class="page-foot"><span>${esc(s.title)} · État d'avancement au ${fmtDate(today)}</span><span>${esc(label)}</span></footer>`;
}

function rubriques() {
    return store.data.rubriques.filter(r => opts.rubrique === 'all' || r.id === opts.rubrique);
}

// ─── Page de synthèse ────────────────────────────
function summaryPage() {
    const s = settings();
    const rubs = rubriques();
    const themes = rubs.flatMap(r => themesOf(r.id));
    const counts = Object.fromEntries(Object.keys(HEALTH).map(k => [k, 0]));
    themes.forEach(t => counts[themeHealth(t)]++);
    const deadlines = upcomingDeadlines(themes).slice(0, 5);
    const attention = themes.flatMap(t => [
        ...(['late', 'warn'].includes(themeHealth(t)) ? [{ t, name: t.name, h: themeHealth(t), note: t.note, kind: 'Thème' }] : []),
        ...t.actions.filter(a => ['late', 'warn'].includes(actionHealth(a))).map(a => ({ t, name: a.name, h: actionHealth(a), note: a.note, kind: t.name })),
    ]).sort((a, b) => (a.h === 'late' ? 0 : 1) - (b.h === 'late' ? 0 : 1)).slice(0, 6);

    return `<section class="page">
        ${band()}
        <header class="cover">
            <div class="cover-logo"><img src="logo/picard2030-embleme-fond-fixe.svg" alt="Picard 2030"></div>
            <p class="kicker">État d'avancement · ${fmtDate(today)}</p>
            <h1>${esc(s.title)}</h1>
            ${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ''}
        </header>

        <div class="summary">
            <div class="summary-main">
                ${donut(weightedProgress(themes), s.accent, 170, 18)}
                <p>Avancement global</p>
            </div>
            <div class="summary-rubs">${rubs.map(r => {
                const ts = themesOf(r.id);
                return `<div class="summary-rub" style="--c:${r.color}">
                    ${donut(weightedProgress(ts), r.color, 104, 12, r.icon)}
                    <div><h3>${esc(r.name)}</h3><p>${ts.length} thèmes · ${ts.reduce((n, t) => n + t.actions.length, 0)} actions</p></div>
                </div>`;
            }).join('')}</div>
        </div>

        <p class="kicker center">Météo des ${themes.length} thèmes</p>
        <div class="health-row">${['ok', 'warn', 'late', 'upcoming', 'done'].map(k => `
            <div class="health-cell ${HEALTH[k].cls}"><b>${counts[k]}</b><span><i class="${HEALTH[k].icon}"></i>${HEALTH[k].label}</span></div>`).join('')}
        </div>

        <div class="two-cols">
            <div class="box">
                <h2><i class="ri-flag-2-line"></i> Prochaines échéances</h2>
                ${deadlines.length ? `<ul class="list">${deadlines.map(d => `
                    <li><span class="when">${countdown(d.date)}</span>
                        <span class="what"><b>${esc(d.name)}</b><small style="color:${d.theme.color}">${esc(d.theme.name)} · ${fmtDate(d.date)}</small></span></li>`).join('')}</ul>`
                    : '<p class="muted">Aucune échéance à venir.</p>'}
            </div>
            <div class="box">
                <h2><i class="ri-alarm-warning-line"></i> Points d'attention</h2>
                ${attention.length ? `<ul class="list">${attention.map(x => `
                    <li><span class="dot ${HEALTH[x.h].cls}"></span>
                        <span class="what"><b>${esc(x.name)}</b><small style="color:${x.t.color}">${esc(x.kind)}</small>${opts.notes && x.note ? `<em>${esc(x.note)}</em>` : ''}</span></li>`).join('')}</ul>`
                    : '<p class="muted">Aucun point d\'attention : tout est dans les temps.</p>'}
            </div>
        </div>
        ${footer('Synthèse')}
    </section>`;
}

// ─── Une page par rubrique (timeline verticale) ──
// Choix des 5 étapes à montrer pour un thème : la dernière faite, l'étape en cours et les suivantes
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
    const h = actionHealth(a);
    if (h === 'late') return 'late';
    return actionRange(a).start <= today ? 'now' : 'next';
}

function themeRow(t) {
    const h = themeHealth(t), prog = themeProgress(t);
    const { steps, before, after } = themeSteps(t);
    const lastDone = steps.reduce((k, x, i) => (x.a.progress >= 100 ? i : k), -1);
    const span = Math.max(steps.length - 1, 0) * 20;                       // % de largeur entre 1re et dernière étape
    const fill = lastDone > 0 ? lastDone * 20 : 0;
    const head = `<div class="hrow-head">
            <h3>${t.icon ? `<i class="${esc(t.icon)}"></i>` : ''}${esc(t.name)}</h3>
            <p class="hrow-meta"><b>${prog}%</b>${pill(h)}</p>
            ${opts.notes && t.note ? `<p class="hrow-note">${esc(t.note)}</p>` : ''}
        </div>`;
    if (!opts.actions || !steps.length) {
        return `<div class="hrow" style="--c:${t.color}">${head}
            <div class="htrack simple"><span class="hbar"><span style="width:${prog}%"></span></span></div></div>`;
    }
    return `<div class="hrow" style="--c:${t.color}">${head}
        <div class="htrack">
            <span class="hline" style="width:${span}%"></span>
            <span class="hline fill" style="width:${fill}%"></span>
            ${before ? `<span class="hmore before">+${before}</span>` : ''}
            ${after ? `<span class="hmore after">+${after}</span>` : ''}
            ${steps.map(({ a }) => {
                const st = stepState(a), d = actionRange(a).end;
                return `<div class="hstep ${st}">
                    <span class="hdate">${isMilestone(a) ? `${d.getDate()} ` : ''}${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}</span>
                    <span class="hnode">${st === 'done' ? '✓' : ''}</span>
                    <span class="hname">${esc(a.name)}</span>
                    <span class="hval">${isMilestone(a) ? 'Jalon' : `${a.progress}%`}</span>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

function rubriquePage(r) {
    const themes = sortThemes(themesOf(r.id), 'date');
    const nActions = themes.reduce((n, t) => n + t.actions.length, 0);
    return `<section class="page" style="--rub:${r.color}">
        ${band()}
        <header class="rub-head">
            <div>
                <p class="kicker">${esc(settings().title)} · État d'avancement</p>
                <h1><i class="${esc(r.icon)}"></i> ${esc(r.name)}</h1>
                <p class="sub">${themes.length} thèmes · ${nActions} actions · classés par échéance</p>
            </div>
            ${donut(weightedProgress(themes), r.color, 110, 13)}
        </header>
        <div class="hlegend">
            <span><i class="hnode-lg done">✓</i>Fait</span><span><i class="hnode-lg now"></i>En cours</span>
            <span><i class="hnode-lg late"></i>En retard</span><span><i class="hnode-lg next"></i>À venir</span>
        </div>
        <div class="hrows">${themes.map(themeRow).join('') || '<p class="muted center">Aucun thème dans cette rubrique.</p>'}</div>
        ${footer(r.name)}
    </section>`;
}

function render() {
    document.title = `${settings().title} — État d'avancement`;
    document.documentElement.style.setProperty('--accent', settings().accent);
    $id('report').innerHTML = summaryPage() + rubriques().map(rubriquePage).join('');
}

function $id(id) { return document.getElementById(id); }

loadData();
$id('opt-rubrique').innerHTML = `<option value="all">Toutes les rubriques</option>` +
    store.data.rubriques.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
$id('opt-actions').onchange = e => { opts.actions = e.target.checked; render(); };
$id('opt-notes').onchange = e => { opts.notes = e.target.checked; render(); };
$id('opt-rubrique').onchange = e => { opts.rubrique = e.target.value; render(); };
$id('btn-print').onclick = () => window.print();
render();
