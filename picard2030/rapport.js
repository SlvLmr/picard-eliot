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
    const deadlines = upcomingDeadlines(themes).slice(0, 6);
    const attention = themes.flatMap(t => [
        ...(['late', 'warn'].includes(themeHealth(t)) ? [{ t, name: t.name, h: themeHealth(t), note: t.note, kind: 'Thème' }] : []),
        ...t.actions.filter(a => ['late', 'warn'].includes(actionHealth(a))).map(a => ({ t, name: a.name, h: actionHealth(a), note: a.note, kind: t.name })),
    ]).sort((a, b) => (a.h === 'late' ? 0 : 1) - (b.h === 'late' ? 0 : 1)).slice(0, 6);

    return `<section class="page">
        ${band()}
        <header class="cover">
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
function rubriquePage(r) {
    const themes = themesOf(r.id).slice().sort((a, b) => themeRange(a).start - themeRange(b).start);
    const nodes = themes.map((t, i) => {
        const tr = themeRange(t), h = themeHealth(t), prog = themeProgress(t);
        const content = `<div class="node-content">
            <p class="node-date" style="color:${t.color}">${fmtMonth(tr.start)} → ${fmtMonth(tr.end)}</p>
            <h3>${esc(t.name)}</h3>
            <p class="node-meta">${t.owner ? esc(t.owner) + ' · ' : ''}${pill(h)}</p>
            ${opts.notes && t.note ? `<p class="node-note">${esc(t.note)}</p>` : ''}
            ${opts.actions && t.actions.length ? `<ul class="node-actions">${t.actions.map(a => {
                const ah = actionHealth(a);
                return `<li><span class="dot ${HEALTH[ah].cls}"></span><span class="an">${esc(a.name)}</span>${isMilestone(a)
                    ? `<span class="ams"><i class="ri-flag-2-line"></i>${fmtDate(a.start)}</span>`
                    : `<span class="abar"><span style="width:${a.progress}%;background:${t.color}"></span></span><b>${a.progress}%</b>`}</li>`;
            }).join('')}</ul>` : ''}
        </div>`;
        const visual = `<div class="node-visual">${donut(prog, t.color, 112, 13, t.icon || 'ri-folder-line')}</div>`;
        const right = i % 2 === 0;
        return `<div class="node ${right ? 'right' : 'left'}" style="--c:${t.color}">
            <div class="side side-l">${right ? visual : content}</div>
            <div class="spine"><span class="seg"></span><span class="knot"></span><span class="arm"></span></div>
            <div class="side side-r">${right ? content : visual}</div>
        </div>`;
    }).join('');
    const nActions = themes.reduce((n, t) => n + t.actions.length, 0);
    return `<section class="page" style="--rub:${r.color}">
        ${band()}
        <header class="rub-head">
            <div>
                <p class="kicker">${esc(settings().title)} · État d'avancement</p>
                <h1><i class="${esc(r.icon)}"></i> ${esc(r.name)}</h1>
                <p class="sub">${themes.length} thèmes · ${nActions} actions</p>
            </div>
            ${donut(weightedProgress(themes), r.color, 110, 13)}
        </header>
        <div class="vtl">
            <div class="vtl-cap top"></div>
            ${nodes || '<p class="muted center">Aucun thème dans cette rubrique.</p>'}
            <div class="vtl-cap bottom"></div>
        </div>
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
