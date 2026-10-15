/* ============================================================
   PICARD-ATC — Tableau de bord
   Sélection : toute la société, une équipe (« eq:NORD ») ou un ATC.
   ============================================================ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = c => c.equipe === 'DIR' && !c.prenom ? 'DIR' : ((c.prenom?.[0] || '') + (c.nom?.[0] || '')).toUpperCase();
const fullName = c => `${c.prenom} ${c.nom}`.trim();
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const S = {
    store: null, base: null, D: null, ref: new Date(),
    period: 'mois', who: null, zone: null, mapMode: 'secteurs', clientsMode: 'clients',
    charts: {}, session: { isAdmin: false },
};
try { const p = JSON.parse(localStorage.getItem('picard_atc_vue') || '{}'); Object.assign(S, { period: p.period || S.period, mapMode: p.mapMode || S.mapMode, clientsMode: p.clientsMode || S.clientsMode }); } catch (e) {}
const remember = () => { try { localStorage.setItem('picard_atc_vue', JSON.stringify({ period: S.period, mapMode: S.mapMode, clientsMode: S.clientsMode })); } catch (e) {} };

const commercial = id => S.base.commerciaux.find(c => c.id === id);
const actifs = () => S.base.commerciaux.filter(c => c.actif !== false);
const equipesUtilisees = () => EQUIPES.filter(e => actifs().some(c => c.equipe === e.code));
const membres = code => actifs().filter(c => c.equipe === code);
const isEquipe = w => typeof w === 'string' && w.startsWith('eq:');
const idsFor = (who = S.who) => new Set(!who ? actifs().map(c => c.id) : isEquipe(who) ? membres(who.slice(3)).map(c => c.id) : [who]);
const zonesOf = id => Object.entries(S.base.secteurs).filter(([, c]) => c === id).map(([z]) => z);
const zonesFor = (who = S.who) => { const ids = idsFor(who); return Object.entries(S.base.secteurs).filter(([, c]) => ids.has(c)).map(([z]) => z); };
const zoneInfo = new Map(CARTE.zones.map(z => [z.code, z]));
const pinfo = (p = S.period) => periodInfo(p, S.ref);

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

// ─── Chargement ─────────────────────────────────────────────
async function loadAll() {
    S.base = await S.store.loadAll();
    S.D = { idx: buildIndex(S.base.atcMois) };
    S.ref = S.base.etat?.derniere_date ? parseIso(S.base.etat.derniere_date) : new Date();
    if (S.who && !isEquipe(S.who) && !commercial(S.who)) S.who = null;
    document.title = S.base.reglages.nom || 'PICARD-ATC';
}

function renderAll({ animate = true } = {}) {
    S.kCache = new Map();
    renderSide(); renderHead(); renderSignals(); renderKpis(animate); renderGammes(); renderGauges(); renderTrajectory();
    renderMap(); renderMonths(); renderRank(); renderClients(); renderCarnet(); renderLive();
}
const Kc = (who, p) => { const k = `${who}|${p}`; if (!S.kCache.has(k)) S.kCache.set(k, K(who, p)); return S.kCache.get(k); };

// ─── Menu de gauche ─────────────────────────────────────────
function ringHtml(k) {
    const st = statut(k.rythme, S.base.reglages);
    const p = Math.max(0, Math.min(100, k.atteinte ?? 0));
    return { html: `<span>${k.atteinte == null ? '—' : Math.round(k.atteinte)}</span>`, style: `--p:${p}`, st };
}
function itemHtml(who, avatar, titre, sous, k, i, cls = '') {
    const r = ringHtml(k);
    return `<button class="team-item ${cls} ${S.who === who ? 'active' : ''}" data-who="${who}" style="animation-delay:${i * 18}ms" title="${esc(r.st.label)} · ${pct(k.atteinte)} du budget">
        ${avatar}<span class="ti-text"><strong>${esc(titre)}</strong><small>${sous}</small></span><span class="ring" style="${r.style}">${r.html}</span></button>`;
}
function renderSide() {
    const q = norm($('#search').value);
    const soc = Kc(null, S.period); const r = ringHtml(soc);
    const ring = $('#team-ring'); ring.innerHTML = r.html; ring.setAttribute('style', r.style);
    $('#team-count').textContent = `${actifs().filter(c => c.equipe !== 'DIR').length} ATC · ${euros(soc.realise)}`;
    $('#team-all').classList.toggle('active', !S.who);
    let i = 0;
    const html = equipesUtilisees().map(e => {
        const ms = membres(e.code).filter(c => !q || norm(fullName(c) + ' ' + c.code + ' ' + e.nom).includes(q));
        if (q && !ms.length) return '';
        const ke = Kc('eq:' + e.code, S.period);
        const head = e.code === 'DIR' ? '' : itemHtml('eq:' + e.code, `<span class="avatar eq" style="--c:${e.couleur}">${e.code === 'RA' ? 'RA' : e.code.slice(0, 2)}</span>`, `Équipe ${e.nom}`, `${ms.length} ATC · ${euros(ke.realise)}`, ke, i++, 'eq-item');
        return `<div class="group">${esc(e.nom)}</div>` + head + ms.map(c => {
            const k = Kc(c.id, S.period);
            return itemHtml(c.id, `<span class="avatar" style="--c:${c.couleur}">${esc(initials(c))}</span>`, fullName(c), `${euros(k.realise)} · ${pct(k.atteinte)}`, k, i++, 'side-atc ' + (c.actif === false ? 'inactive' : ''));
        }).join('');
    }).join('');
    $('#team-list').innerHTML = html || '<div class="empty">Aucun résultat</div>';
}

function select(who) {
    S.who = who || null; S.zone = null;
    $('#side').classList.remove('open');
    renderAll();
    const url = new URL(location); if (S.who) url.searchParams.set('c', S.who); else url.searchParams.delete('c');
    history.replaceState(null, '', url);
    zoomToSelection();
}

// ─── En-tête ────────────────────────────────────────────────
function iapDe(who = S.who) {
    const zones = zonesFor(who); const ids = idsFor(who);
    const nb = zones.reduce((s, z) => s + (S.base.zonesInfo[z]?.iap || 0), 0);
    const cs = [...ids].map(commercial).filter(Boolean);
    return { nb, objectif: cs.reduce((s, c) => s + (+c.iap_objectif || 0), 0), nouveaux: cs.reduce((s, c) => s + (+c.iap_nouveaux || 0), 0) };
}
function renderHead() {
    const p = pinfo(); const lab = p.label[0].toUpperCase() + p.label.slice(1);
    const src = S.base.etat?.source === 'demo' ? 'données fictives' : `données au ${dateLongue(S.ref)}`;
    if (S.who && !isEquipe(S.who)) {
        const c = commercial(S.who); const e = equipeDe(c.equipe); const zones = zonesOf(c.id); const iap = iapDe();
        $('#who').innerHTML = `<span class="avatar lg" style="--c:${c.couleur}">${esc(initials(c))}</span>
            <div><h1>${esc(fullName(c))}${c.fonction ? ` <span class="role">${esc(c.fonction)}</span>` : ''}</h1><div class="meta">
                <span class="eq-chip" data-who="eq:${e.code}" style="--c:${e.couleur}">Équipe ${esc(e.nom)}</span>
                <span><i class="ri-map-pin-2-line"></i>${zones.length} zone${zones.length > 1 ? 's' : ''}</span>
                <span><i class="ri-community-line"></i>${iap.nb} IAP</span>
                ${c.email ? `<a href="mailto:${esc(c.email)}"><i class="ri-mail-line"></i>${esc(c.email)}</a>` : ''}
                ${c.telephone ? `<a href="tel:${esc(c.telephone.replace(/\s/g, ''))}"><i class="ri-phone-line"></i>${esc(c.telephone)}</a>` : ''}
            </div>${(c.clientele || []).length ? `<div class="tags">${c.clientele.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>`;
    } else if (isEquipe(S.who)) {
        const e = equipeDe(S.who.slice(3)); const ms = membres(e.code);
        $('#who').innerHTML = `<span class="team-hero" style="background:${e.couleur}">${e.code === 'RA' ? 'RA' : e.code.slice(0, 2)}</span>
            <div><h1>Équipe ${esc(e.nom)}</h1><div class="meta"><span><i class="ri-calendar-2-line"></i>${lab} · ${src}</span><span><i class="ri-user-star-line"></i>${ms.map(c => esc(c.prenom || c.nom)).join(', ')}</span></div></div>`;
    } else {
        $('#who').innerHTML = `<span class="team-hero"><i class="ri-building-2-fill"></i></span>
            <div><h1>Tous les ATC</h1><div class="meta"><span><i class="ri-calendar-2-line"></i>${lab} · ${src}</span><span><i class="ri-user-star-line"></i>${equipesUtilisees().filter(e => e.code !== 'DIR').length} équipes · ${actifs().filter(c => c.equipe !== 'DIR').length} ATC</span></div></div>`;
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
    const p = pinfo(); const reg = S.base.reglages; const k = Kc(S.who, S.period);
    const out = [];
    if (k.budget) {
        const ok = k.ecartProjection >= 0;
        out.push({ cls: ok ? 'ok' : 'warn', html: `Atterrissage ${p.label} : <b>${euros(k.projection)}</b>, soit <b>${euros(k.ecartProjection, { sign: true })}</b> vs budget${k.carnet ? ' (carnet inclus)' : ''}` });
    }
    if (!S.who || isEquipe(S.who)) {
        const late = [...idsFor()].map(commercial).filter(c => c && c.equipe !== 'DIR').map(c => ({ c, k: Kc(c.id, S.period) }))
            .filter(x => statut(x.k.rythme, reg).key === 'late').sort((a, b) => a.k.rythme - b.k.rythme);
        if (late.length) out.push({ cls: 'late', html: `<b>${late.length}</b> ATC en retard : ` + late.slice(0, 4).map(x => `<button class="chip-btn" data-who="${x.c.id}">${esc(x.c.prenom || x.c.nom)} ${pct(x.k.rythme)}</button>`).join(' ') });
        else out.push({ cls: 'ok', html: 'Aucun ATC en retard sur son rythme' });
    } else if (k.reste > 0 && p.joursRestants > 0) {
        out.push({ cls: 'info', html: `Pour tenir le budget : <b>${euros(k.reste / p.joursRestants)}</b> par jour ouvré sur ${p.joursRestants} jours` });
    }
    let worst = null;
    for (const g of CA_GAMMES) { const kg = K(S.who, S.period, [g]); if (kg.n1 > 0 && kg.evol != null && (!worst || kg.evol < worst.evol)) worst = { g, evol: kg.evol }; }
    if (worst && worst.evol < 0) out.push({ cls: 'warn', html: `Gamme en recul : <b>${gammeNom(worst.g)}</b> ${pct(worst.evol, { sign: true })} vs ${p.y - 1}` });
    $('#signals').innerHTML = out.map((s, i) => `<div class="signal ${s.cls}" style="animation-delay:${i * 60}ms"><span>${s.html}</span></div>`).join('');
}

// ─── KPI ────────────────────────────────────────────────────
function delta(v, fmt = x => pct(x, { sign: true })) {
    if (v == null || isNaN(v)) return '<span class="delta flat">—</span>';
    const cls = Math.abs(v) < 0.05 ? 'flat' : v > 0 ? 'up' : 'down';
    const ico = cls === 'flat' ? 'ri-subtract-line' : v > 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
    return `<span class="delta ${cls}"><i class="${ico}"></i>${fmt(v)}</span>`;
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
function sparkline(vals) {
    vals = vals.filter(v => v != null);
    if (vals.length < 2) return '';
    const max = Math.max(...vals) || 1, w = 84, h = 30;
    const line = smoothPath(vals.map((v, i) => [i / (vals.length - 1) * w, h - 3 - v / max * (h - 6)]));
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${line}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".7"/></svg>`;
}
function enregistre(p) { // prises de commande société sur la période
    const jours = S.base.jours.filter(j => { const d = parseIso(j.d); return d.getFullYear() === p.y && p.months.includes(d.getMonth() + 1) && d <= p.ref; });
    const enr = jours.reduce((s, j) => s + j.enr, 0);
    const sm = m => S.base.societeMois.find(x => x.a === p.y && x.m === m) || {};
    let b = 0, n1 = 0;
    for (const m of p.months) { const x = sm(m); const f = m < p.m ? 1 : m === p.m ? p.frac : 0; b += (x.b_enr || 0) * f; n1 += (x.n1_enr || 0) * f; }
    return { enr, bADate: b, n1, has: jours.length > 0 };
}
const exemple = '<span class="ex" title="Donnée d\'exemple : non fournie par les fichiers">exemple</span>';

function renderKpis(animate) {
    const p = pinfo(); const k = Kc(S.who, S.period); const iap = iapDe();
    const serie = !S.who && S.period === 'mois' ? S.base.jours.filter(j => j.d.startsWith(iso(S.ref).slice(0, 7))).map(j => j.fact) : serieMois(S.D, idsFor(), p.y).map(x => x.hasR ? x.r : null);
    const cards = [
        { label: 'Facturé', val: k.realise, fmt: v => euros(v), extra: sparkline(serie),
            row: `${delta(k.evol)}<span>vs ${euros(k.n1)} en ${p.y - 1}</span>`, sub: `<span>Budget ${p.label}</span><b>${euros(k.budget)} · ${pct(k.atteinte)}</b>` },
        { label: 'Atterrissage prévu', val: k.projection, fmt: v => euros(v),
            row: k.budget ? `${delta(k.ecartProjection, v => euros(v, { sign: true }))}<span>vs budget${k.carnet ? ' · carnet inclus' : ''}</span>` : '<span>au rythme actuel</span>',
            sub: `<span>Reste à faire</span><b>${euros(k.reste)}${p.joursRestants && k.reste ? ` · ${euros(k.reste / p.joursRestants)}/j` : ''}</b>` },
    ];
    if (!S.who) {
        const e = enregistre(p);
        cards.push({ label: 'Prises de commande', val: e.enr, fmt: v => euros(v),
            row: `${delta(e.n1 ? (e.enr / e.n1 - 1) * 100 : null)}<span>vs ${p.y - 1} · enregistré</span>`,
            sub: `<span>Objectif à date</span><b>${euros(e.bADate)} · ${pct(e.bADate ? e.enr / e.bADate * 100 : null)}</b>` });
    } else {
        const q = g => K(S.who, S.period, [g]).qte;
        cards.push({ label: 'Quantités', val: k.qte, fmt: v => nf0.format(v) + ' u.',
            row: `<span>unités facturées · ${p.label}</span>`,
            sub: `<span>Serr. ${nf0.format(q('serrures'))} · Blind. ${nf0.format(q('diamant'))} · Hall ${nf0.format(q('hall'))}</span>` });
    }
    cards.push({ label: `IAP${S.base.etat?.zonesExemple ? ' ' + exemple : ''}`, val: iap.nb, fmt: v => nf0.format(v),
        row: `<span>installateurs agréés Picard</span>`,
        sub: `<span>Objectif ${nf0.format(iap.objectif)}${iap.objectif ? ` · ${pct(iap.nb / iap.objectif * 100)}` : ''}</span><b>+${iap.nouveaux} en ${p.y}</b>` });
    const rnd = seedFrom(String(S.who) + S.period); const marge = 31 + rnd() * 7, mObj = 34;
    cards.push({ label: `Taux de marge ${exemple}`, val: marge, fmt: v => pct(v, { dec: 1 }),
        row: `${delta((rnd() - 0.5) * 3, pts)}<span>vs ${p.y - 1}</span>`, sub: `<span>Objectif ${pct(mObj, { dec: 1 })}</span><b class="${marge >= mObj ? 'ok-text' : 'late-text'}">${pts(marge - mObj)}</b>` });
    $('#kpis').innerHTML = cards.map((c, i) => `<article class="kpi" style="animation-delay:${i * 50}ms">
        ${c.extra || ''}<div class="kpi-top">${c.label}</div>
        <div class="kpi-val" data-val="${c.val ?? ''}" data-i="${i}">${c.val == null ? '—' : c.fmt(c.val)}</div>
        <div class="kpi-row">${c.row}</div><div class="kpi-sub">${c.sub}</div></article>`).join('');
    if (animate) $$('#kpis .kpi-val').forEach(el => { const v = parseFloat(el.dataset.val); if (!isNaN(v)) countUp(el, v, cards[+el.dataset.i].fmt); });
}
function countUp(el, to, fmt, ms = 900) {
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
}

// ─── Gammes ─────────────────────────────────────────────────
function renderGammes() {
    const p = pinfo(); const tot = Kc(S.who, S.period).realise || 1;
    $('#gammes').innerHTML = GAMMES.map((g, i) => {
        const k = K(S.who, S.period, [g.k]);
        return `<div class="gamme" style="animation-delay:${i * 50}ms" title="${esc(g.nom)} : ${euros(k.realise, { compact: false })} sur un budget de ${euros(k.budget, { compact: false })}">
            <div class="g-top"><i class="${g.icon}"></i>${esc(g.nom)}${g.sub ? `<small>${esc(g.sub)}</small>` : ''}</div>
            <div class="g-val">${euros(k.realise)}<small>${g.k === 'eliot' ? 'dans Serrures' : pct(k.realise / tot * 100) + ' du CA'}</small></div>
            <div class="g-mix" title="Atteinte du budget"><span data-w="${Math.min(100, k.atteinte || 0)}"></span>${k.attendu != null ? `<i style="left:${Math.min(100, k.attendu)}%"></i>` : ''}</div>
            <div class="g-foot"><span>${pct(k.atteinte)} du budget${k.qte ? ` · ${nf0.format(k.qte)} u.` : ''}</span>${delta(k.evol)}</div></div>`;
    }).join('');
    requestAnimationFrame(() => $$('#gammes .g-mix span').forEach(s => s.style.width = s.dataset.w + '%'));
}

// ─── Jauges ─────────────────────────────────────────────────
function renderGauges() {
    const el = $('#gauges');
    if (!el.dataset.ready) {
        el.innerHTML = ['mois', 'trimestre', 'annee'].map(p => `<button class="gauge" data-period="${p}"><div class="g-chart"></div><div class="g-title"></div><div class="g-sub"></div><span class="g-status"></span></button>`).join('');
        el.dataset.ready = 1;
    }
    for (const g of $$('.gauge', el)) {
        const p = g.dataset.period; const k = Kc(S.who, p); const pi = pinfo(p);
        const st = statut(k.rythme, S.base.reglages);
        g.classList.toggle('on', p === S.period);
        $('.g-title', g).textContent = { mois: MOIS_LONG[pi.m - 1], trimestre: pi.label.split(' ')[0], annee: String(pi.y) }[p];
        $('.g-sub', g).textContent = k.budget ? `${euros(k.realise)} / ${euros(k.budget)}` : 'Aucun budget';
        const s = $('.g-status', g); s.className = 'g-status ' + st.key; s.textContent = st.label;
        const chart = S.charts['g' + p] || (S.charts['g' + p] = echarts.init($('.g-chart', g), null, { renderer: 'svg' }));
        const val = Math.min(k.atteinte ?? 0, 100), mark = Math.min(k.attendu ?? 0, 100);
        chart.setOption({
            animationDuration: 1100, animationEasingUpdate: 'cubicOut', animationDurationUpdate: 900,
            series: [
                { type: 'gauge', startAngle: 90, endAngle: -270, min: 0, max: 100, radius: '88%', center: ['50%', '50%'],
                  progress: { show: true, width: 9, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#2563eb' }, { offset: 1, color: '#22d3ee' }]) } },
                  axisLine: { lineStyle: { width: 9, color: [[1, css('--surface-3')]] } },
                  pointer: { show: false }, anchor: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, title: { show: false },
                  detail: { valueAnimation: true, offsetCenter: [0, 0], fontSize: g.offsetWidth < 170 ? 20 : 26, fontWeight: 300, fontFamily: 'Roboto', color: css('--text'), formatter: () => k.atteinte == null ? '—' : `${Math.round(k.atteinte)}%` },
                  data: [{ value: val }] },
                { type: 'gauge', startAngle: 90, endAngle: -270, min: 0, max: 100, radius: '88%', center: ['50%', '50%'],
                  axisLine: { show: false }, progress: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, detail: { show: false }, title: { show: false }, anchor: { show: false },
                  pointer: { show: k.attendu != null, icon: 'rect', length: '14%', width: 2, offsetCenter: [0, '-80%'], itemStyle: { color: css('--target') } },
                  data: [{ value: mark }] },
            ],
        });
        g.title = k.budget ? `Réalisé ${pct(k.atteinte)} du budget · attendu à date ${pct(k.attendu)} · rythme ${pct(k.rythme)}` : '';
    }
}

// ─── Courbes ────────────────────────────────────────────────
function baseAxis() {
    return { axisLine: { lineStyle: { color: css('--chart-grid') } }, axisTick: { show: false },
        axisLabel: { color: css('--chart-axis'), fontSize: 11, fontFamily: 'Roboto' }, splitLine: { lineStyle: { color: css('--chart-grid'), type: [3, 4] } } };
}
const tooltipStyle = () => ({ backgroundColor: css('--surface-3'), borderColor: css('--line-strong'), borderWidth: 1, padding: [8, 12],
    textStyle: { color: css('--text'), fontSize: 12, fontFamily: 'Roboto' }, extraCssText: 'border-radius:0;box-shadow:0 12px 30px rgba(0,0,0,.25)' });
const C = { real: '#22d3ee', real2: '#2563eb', proj: '#22d3ee' };
const gradLine = () => new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#2563eb' }, { offset: 1, color: '#22d3ee' }]);
const gradArea = (a = .5) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `rgba(34,211,238,${a})` }, { offset: .7, color: 'rgba(37,99,235,.1)' }, { offset: 1, color: 'rgba(37,99,235,0)' }]);
const n1Area = () => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(84,118,184,.35)' }, { offset: 1, color: 'rgba(84,118,184,.02)' }]);
const smooth = { smooth: .45, smoothMonotone: 'x', showSymbol: false };

function renderTrajectory() {
    const p = pinfo(); const k = Kc(S.who, S.period);
    const chart = S.charts.traj || (S.charts.traj = echarts.init($('#chart-traj'), null, { renderer: 'svg' }));
    let dates, series, legend, fmtX, interval;
    const jm = S.base.jours.filter(j => j.d.startsWith(iso(S.ref).slice(0, 7)));
    if (!S.who && S.period === 'mois' && jm.length) {
        // Société, mois en cours : jour par jour (facturé, enregistré, objectif)
        const sm = S.base.societeMois.find(x => x.a === p.y && x.m === p.m) || {};
        const deb = new Date(p.y, p.m - 1, 1), fin = new Date(p.y, p.m, 0);
        dates = []; for (let d = new Date(deb); d <= fin; d = addDays(d, 1)) if (isWorkday(d)) dates.push(iso(d));
        const map = new Map(jm.map(j => [j.d, j])); let cf = 0, ce = 0;
        const fact = [], enr = []; dates.forEach(d => { const j = map.get(d); if (d <= iso(S.ref)) { cf += j?.fact || 0; ce += j?.enr || 0; fact.push(cf); enr.push(ce); } else { fact.push(null); enr.push(null); } });
        const obj = dates.map((_, i) => (sm.b_fact || k.budget) * (i + 1) / dates.length);
        const idx = fact.reduce((m, v, i) => v != null ? i : m, -1);
        const proj = dates.map((_, i) => i === idx ? fact[idx] : i === dates.length - 1 ? k.projection : null);
        series = [
            { name: 'Objectif', type: 'line', data: obj, ...smooth, lineStyle: { width: 1.3, type: [5, 5], color: css('--target'), opacity: .75 }, itemStyle: { color: css('--target') } },
            { name: 'Enregistré', type: 'line', data: enr, ...smooth, lineStyle: { width: 1.6, color: '#a78bfa' }, itemStyle: { color: '#a78bfa' } },
            { name: 'Atterrissage', type: 'line', data: proj, connectNulls: true, showSymbol: false, lineStyle: { width: 1.8, type: [2, 5], color: C.proj }, itemStyle: { color: C.proj } },
            { name: 'Facturé', type: 'line', data: fact, ...smooth, lineStyle: { width: 2.6, color: gradLine() }, itemStyle: { color: C.real }, areaStyle: { color: gradArea() } },
        ];
        legend = [['Facturé', C.real], ['Enregistré', '#a78bfa'], ['Objectif', css('--target'), 1], ['Atterrissage (carnet)', C.proj, 1]];
        fmtX = s => String(parseIso(s).getDate()); interval = 3;
        $('#traj-sub').textContent = `· ${p.label} · jour par jour`;
    } else {
        // Cumul mois par mois sur l'année
        const sm = serieMois(S.D, idsFor(), p.y); let cr = 0, cb = 0, cn = 0;
        dates = MOIS.map(m => m.replace('.', ''));
        const real = [], bud = [], n1 = [];
        sm.forEach((x, i) => { cb += x.b; cn += x.n1; bud.push(cb); n1.push(cn); if (i + 1 <= p.m) { cr += x.r; real.push(cr); } else real.push(null); });
        const ka = Kc(S.who, 'annee');
        const proj = dates.map((_, i) => i === p.m - 1 ? real[i] : i === 11 ? ka.projection : null);
        series = [
            { name: String(p.y - 1), type: 'line', data: n1, ...smooth, lineStyle: { width: 1.3, color: css('--n1') }, itemStyle: { color: css('--n1') }, areaStyle: { color: n1Area() } },
            { name: 'Budget', type: 'line', data: bud, ...smooth, lineStyle: { width: 1.3, type: [5, 5], color: css('--target'), opacity: .75 }, itemStyle: { color: css('--target') } },
            { name: 'Atterrissage', type: 'line', data: proj, connectNulls: true, showSymbol: false, lineStyle: { width: 1.8, type: [2, 5], color: C.proj }, itemStyle: { color: C.proj } },
            { name: 'Facturé', type: 'line', data: real, ...smooth, lineStyle: { width: 2.6, color: gradLine() }, itemStyle: { color: C.real }, areaStyle: { color: gradArea() } },
        ];
        legend = [['Facturé', C.real], ['Budget', css('--target'), 1], [String(p.y - 1), css('--n1')], ['Atterrissage', C.proj, 1]];
        fmtX = s => s; interval = 1;
        $('#traj-sub').textContent = `· cumul ${p.y}`;
    }
    $('#traj-legend').innerHTML = legend.map(([n, c, dash]) => `<span><i class="lg-line ${dash ? 'lg-dash' : ''}" style="border-color:${c}"></i>${n}</span>`).join('');
    chart.setOption({
        animationDuration: 1100, animationEasing: 'cubicOut', grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), axisPointer: { type: 'line', lineStyle: { color: css('--line-strong'), type: 'dashed' } },
            formatter: ps => `<b>${fmtX(dates[ps[0].dataIndex])}</b><br>` + ps.filter(x => x.value != null).map(x => `${x.marker}${x.seriesName} <b style="float:right;margin-left:16px">${euros(x.value)}</b>`).join('<br>') },
        xAxis: { type: 'category', data: dates, boundaryGap: false, ...baseAxis(), splitLine: { show: false }, axisLabel: { ...baseAxis().axisLabel, formatter: fmtX, interval } },
        yAxis: { type: 'value', ...baseAxis(), axisLine: { show: false }, axisLabel: { ...baseAxis().axisLabel, formatter: v => euros(v) } },
        series,
    }, true);
}

function renderMonths() {
    const p = pinfo(); const sm = serieMois(S.D, idsFor(), p.y); const km = Kc(S.who, 'mois');
    const real = sm.map((x, i) => i + 1 < p.m ? x.r : null);
    const proj = sm.map((x, i) => i + 1 === p.m - 1 ? x.r : i + 1 === p.m ? km.projection : null);
    $('#months-sub').textContent = `· ${p.y} vs ${p.y - 1}`;
    $('#months-legend').innerHTML = `<span><i class="lg-line" style="border-color:${C.real}"></i>${p.y}</span><span><i class="lg-line lg-dash" style="border-color:${C.proj}"></i>${MOIS_LONG[p.m - 1]} projeté</span><span><i class="lg-line" style="border-color:${css('--n1')}"></i>${p.y - 1}</span><span><i class="lg-line lg-dash" style="border-color:${css('--target')}"></i>Budget</span>`;
    const chart = S.charts.months || (S.charts.months = echarts.init($('#chart-months'), null, { renderer: 'svg' }));
    chart.setOption({
        animationDuration: 1100, animationEasing: 'cubicOut', grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), axisPointer: { type: 'line', lineStyle: { color: css('--line-strong'), type: 'dashed' } },
            formatter: ps => { const m = ps[0].dataIndex; const x = sm[m];
                return `<b>${MOIS_LONG[m]}</b><br>${p.y} : <b>${x.hasR ? euros(x.r) : '—'}</b>${m + 1 === p.m ? ' (à date)' : ''}${x.hasR && x.n1 && m + 1 < p.m ? ` · ${pct((x.r / x.n1 - 1) * 100, { sign: true })}` : ''}<br>${p.y - 1} : <b>${euros(x.n1)}</b><br>Budget : <b>${euros(x.b)}</b>${x.hasR && x.b && m + 1 < p.m ? ` · ${pct(x.r / x.b * 100)}` : ''}`; } },
        xAxis: { type: 'category', data: MOIS.map(m => m.replace('.', '')), boundaryGap: false, ...baseAxis(), splitLine: { show: false } },
        yAxis: { type: 'value', ...baseAxis(), axisLine: { show: false }, axisLabel: { ...baseAxis().axisLabel, formatter: v => euros(v) } },
        series: [
            { name: String(p.y - 1), type: 'line', data: sm.map(x => x.n1), ...smooth, lineStyle: { width: 1.3, color: css('--n1') }, itemStyle: { color: css('--n1') }, areaStyle: { color: n1Area() } },
            { name: 'Budget', type: 'line', data: sm.map(x => x.b), ...smooth, lineStyle: { width: 1.3, type: [5, 5], color: css('--target'), opacity: .75 }, itemStyle: { color: css('--target') } },
            { name: 'Projection', type: 'line', data: proj, ...smooth, lineStyle: { width: 1.8, type: [2, 5], color: C.proj }, itemStyle: { color: C.proj } },
            { name: String(p.y), type: 'line', data: real, smooth: .45, smoothMonotone: 'x', symbol: 'circle', symbolSize: 5, itemStyle: { color: C.real, borderColor: css('--surface'), borderWidth: 1.5 },
              lineStyle: { width: 2.6, color: gradLine() }, areaStyle: { color: gradArea(.45) } },
        ],
    }, true);
}

// ─── Classement / détail par gamme ──────────────────────────
function rankRow(who, avatar, nom, k, i) {
    const st = statut(k.rythme, S.base.reglages);
    return `<button class="rank-row" data-who="${who}" style="animation-delay:${i * 25}ms" title="${esc(st.label)} · rythme ${pct(k.rythme)}">
        ${avatar}<span><span class="r-name">${esc(nom)}<small>${euros(k.realise)}</small></span>
        <span class="bar"><span data-w="${Math.min(100, (k.atteinte || 0))}"></span>${k.attendu != null ? `<i style="left:${Math.min(100, k.attendu)}%"></i>` : ''}</span></span>
        <span class="r-val">${pct(k.atteinte)}<small class="${st.key}">${k.evol == null ? '' : pct(k.evol, { sign: true })}</small></span></button>`;
}
function renderRank() {
    if (S.who && !isEquipe(S.who)) {
        $('#rank-title').innerHTML = 'Détail par gamme <small>· réalisé / budget</small>'; $('#rank-hint').innerHTML = '';
        $('#rank').innerHTML = GAMMES.map((g, i) => {
            const k = K(S.who, S.period, [g.k]); const st = statut(k.rythme, S.base.reglages);
            return `<div class="rank-row static" style="animation-delay:${i * 25}ms"><span class="g-ico"><i class="${g.icon}"></i></span>
                <span><span class="r-name">${esc(g.nom)}<small>${euros(k.realise)} / ${euros(k.budget)}</small></span>
                <span class="bar"><span data-w="${Math.min(100, k.atteinte || 0)}"></span>${k.attendu != null ? `<i style="left:${Math.min(100, k.attendu)}%"></i>` : ''}</span></span>
                <span class="r-val">${pct(k.atteinte)}<small class="${st.key}">${k.evol == null ? '' : pct(k.evol, { sign: true })}</small></span></div>`;
        }).join('');
    } else {
        $('#rank-title').innerHTML = `Classement <small>· % du budget</small>`;
        $('#rank-hint').innerHTML = '<i class="ri-cursor-line"></i>Cliquez pour ouvrir';
        const list = [...idsFor()].map(commercial).filter(c => c && c.equipe !== 'DIR').map(c => ({ c, k: Kc(c.id, S.period) })).sort((a, b) => (b.k.rythme ?? -1) - (a.k.rythme ?? -1));
        $('#rank').innerHTML = list.map(({ c, k }, i) => rankRow(c.id, `<span class="avatar" style="--c:${c.couleur}">${esc(initials(c))}</span>`, fullName(c), k, i)).join('') || '<div class="empty">Aucun ATC</div>';
    }
    requestAnimationFrame(() => $$('#rank .bar > span').forEach(s => s.style.width = s.dataset.w + '%'));
}

// ─── Clients (exemple) ──────────────────────────────────────
function renderClients() {
    const p = pinfo(); const total = Kc(S.who, S.period).realise || 0;
    $('#clients-sub').innerHTML = `· ${p.label} ${exemple}`;
    $$('#clients-mode button').forEach(x => x.classList.toggle('on', x.dataset.cmode === S.clientsMode));
    moveGlider($('#clients-mode'));
    const r = seedFrom(String(S.who) + S.clientsMode);
    let rows;
    if (S.clientsMode === 'segments') {
        const c = S.who && !isEquipe(S.who) ? commercial(S.who) : null;
        const types = (S.base.reglages.types_clientele || []).slice(0, 6);
        const w = types.map(() => 0.3 + r()); const sw = w.reduce((a, b) => a + b, 0);
        rows = types.map((t, i) => ({ n: t, v: total * w[i] / sw, star: c?.clientele?.includes(t) })).sort((a, b) => b.v - a.v);
    } else {
        rows = [0.13, 0.09, 0.075, 0.06, 0.05, 0.042, 0.036].map((s, i) => ({ n: `Client ${i + 1}`, v: total * s * (0.85 + r() * 0.3) })).sort((a, b) => b.v - a.v).map((x, i) => ({ ...x, n: `Client ${i + 1}` }));
    }
    const max = rows[0]?.v || 1;
    $('#clients').innerHTML = rows.map((x, i) => `<div class="client-row" style="animation-delay:${i * 30}ms"><span class="num">${x.star ? '<i class="ri-star-fill grad-text"></i>' : i + 1}</span>
        <span><span class="c-name">${esc(x.n)}</span><span class="bar"><span data-w="${x.v / max * 100}"></span></span></span>
        <span class="r-val">${euros(x.v)}<small>${pct(total ? x.v / total * 100 : null)}</small></span></div>`).join('');
    requestAnimationFrame(() => $$('#clients .bar > span').forEach(s => s.style.width = s.dataset.w + '%'));
}

// ─── Carnet de commandes (reste à livrer, société) ──────────
const PF_GAMMES = [['serr', 'Serrures'], ['diam', 'Portes blindées'], ['tech', 'Portes techniques'], ['hall', 'Portes de Hall'], ['tol', 'Tôlerie']];
function renderCarnet() {
    const pf = S.base.portefeuille; const card = $('#card-carnet');
    if (!pf.length) { card.hidden = true; return; }
    card.hidden = false;
    const last = pf.at(-1); const debMois = pf.find(x => x.d.slice(0, 7) === last.d.slice(0, 7)) || pf[0];
    $('#carnet-sub').textContent = `· reste à livrer au ${dateLongue(parseIso(last.d))}`;
    const maxG = Math.max(...PF_GAMMES.map(([g]) => last['pf_' + g] || 0)) || 1;
    const ech = [['Ce mois', last.lm_total], ['M+1', last.m1_total], ['M+2', last.m2_total]];
    const maxE = Math.max(...ech.map(e => e[1] || 0)) || 1;
    const feuq = (last.pf_tech || 0) + (last.pf_hall || 0), brog = (last.pf_serr || 0) + (last.pf_diam || 0) + (last.pf_tol || 0);
    $('#carnet').innerHTML = `
        <div class="cn-col">
            <div class="cn-big">${euros(last.pf_total)}${delta(debMois.pf_total ? (last.pf_total / debMois.pf_total - 1) * 100 : null)}<small>depuis le 1er du mois</small></div>
            ${PF_GAMMES.map(([g, n]) => `<div class="cn-row"><span>${n}</span><span class="bar"><span data-w="${(last['pf_' + g] || 0) / maxG * 100}"></span></span><b>${euros(last['pf_' + g] || 0)}</b></div>`).join('')}
        </div>
        <div class="cn-col">
            <div class="cn-h">Échéancier de livraison</div>
            ${ech.map(([n, v]) => `<div class="cn-row"><span>${n}</span><span class="bar"><span data-w="${(v || 0) / maxE * 100}"></span></span><b>${euros(v || 0)}</b></div>`).join('')}
            <div class="cn-note">Facturé du mois + livrable ce mois = <b>${euros(Kc(null, 'mois').projection)}</b> d'atterrissage ${MOIS_LONG[S.ref.getMonth()]}</div>
            <div class="cn-sites"><span>Feuquières<b>${euros(feuq)}</b><small>techniques · hall</small></span><span>Broglie<b>${euros(brog)}</b><small>serrures · blindées · tôlerie</small></span></div>
        </div>
        <div class="cn-col"><div class="cn-h">Évolution du carnet</div><div class="chart" id="chart-carnet" style="height:190px"></div></div>`;
    requestAnimationFrame(() => $$('#carnet .bar > span').forEach(s => s.style.width = s.dataset.w + '%'));
    if (S.charts.carnet) S.charts.carnet.dispose();
    const ch = S.charts.carnet = echarts.init($('#chart-carnet'), null, { renderer: 'svg' });
    ch.setOption({
        animationDuration: 1000, grid: { left: 6, right: 8, top: 10, bottom: 2, containLabel: true },
        tooltip: { trigger: 'axis', ...tooltipStyle(), formatter: ps => `<b>${dateLongue(parseIso(pf[ps[0].dataIndex].d))}</b><br>` + ps.map(x => `${x.marker}${x.seriesName} <b style="float:right;margin-left:14px">${euros(x.value)}</b>`).join('<br>') },
        xAxis: { type: 'category', data: pf.map(x => x.d), boundaryGap: false, ...baseAxis(), splitLine: { show: false }, axisLabel: { ...baseAxis().axisLabel, formatter: s => MOIS[parseIso(s).getMonth()], interval: (i, s) => s.endsWith('-01') || i === 0 ? true : false, hideOverlap: true } },
        yAxis: { type: 'value', ...baseAxis(), axisLine: { show: false }, axisLabel: { ...baseAxis().axisLabel, formatter: v => euros(v) } },
        series: [
            { name: 'Carnet total', type: 'line', data: pf.map(x => x.pf_total), ...smooth, lineStyle: { width: 2.2, color: gradLine() }, itemStyle: { color: C.real }, areaStyle: { color: gradArea(.4) } },
            { name: 'Livrable ce mois', type: 'line', data: pf.map(x => x.lm_total), ...smooth, lineStyle: { width: 1.3, color: '#a78bfa' }, itemStyle: { color: '#a78bfa' } },
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
    const stops = document.documentElement.dataset.theme === 'light' ? ['#d9f2f3', '#86d9df', '#2563eb', '#0b8aa0', '#0b5e6e'] : ['#33505b', '#147d8f', '#2563eb', '#3fdcbc', '#b9f7e4'];
    return interpolate(stops, t);
}
function divColor(t) {
    const neutral = document.documentElement.dataset.theme === 'light' ? '#e3eaed' : '#3a5460';
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
    if (!c) return 'var(--zone-empty)';
    if (S.mapMode === 'secteurs') return c.couleur;
    const k = Kc(c.id, S.period);
    if (S.mapMode === 'atteinte') return k.rythme == null ? 'var(--zone-empty)' : divColor((k.rythme - 100) / 25);
    return k.evol == null ? 'var(--zone-empty)' : divColor(k.evol / 25);
}

function sectorCenters() {
    const acc = new Map();
    for (const z of CARTE.zones) {
        const o = S.base.secteurs[z.code]; if (!o || z.inset !== undefined) continue;
        const e = acc.get(o) || acc.set(o, { x: 0, y: 0, a: 0 }).get(o);
        e.x += z.c[0] * z.a; e.y += z.c[1] * z.a; e.a += z.a;
    }
    for (const z of CARTE.zones) {
        const o = S.base.secteurs[z.code]; if (!o || acc.has(o) || z.inset === undefined) continue;
        acc.set(o, { x: z.c[0], y: z.c[1] - 30, a: 1 });
    }
    return [...acc].map(([id, e]) => ({ id, x: e.x / e.a, y: e.y / e.a }));
}

function renderBadges(svg) {
    const g = $('g.badges', svg); if (!g) return;
    g.innerHTML = '';
    if (S.mapMode !== 'secteurs') return;
    const ids = idsFor();
    for (const { id, x, y } of sectorCenters()) {
        const c = commercial(id); if (!c || (S.who && !ids.has(id))) continue;
        const solo = S.who === id;
        const b = el('g', { class: 'badge' + (solo ? ' on' : ''), 'data-who': id }, g);
        b.style.transform = `translate(${x}px, ${y}px) scale(var(--s))`;
        if (solo) {
            const w = 20 + fullName(c).length * 6.3;
            el('rect', { x: -14, y: -14, width: w + 16, height: 28, class: 'badge-pill' }, b);
            el('text', { x: 18, y: 4, class: 'badge-name' }, b).textContent = fullName(c);
        }
        el('circle', { r: 11, fill: c.couleur, class: 'badge-dot' }, b);
        el('text', { y: 3.3, class: 'badge-txt' }, b).textContent = initials(c).slice(0, 3);
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
    paintBorders(svg, z => S.base.secteurs[z], mine ? z => mine.has(z) : null);
    renderBadges(svg); renderZoneLabels(svg, mine);
    $$('#map-mode button').forEach(b => b.classList.toggle('on', b.dataset.map === S.mapMode));
    moveGlider($('#map-mode'));
    renderMapLegend(maxPot);
    renderPotentiel();
}

function renderMapLegend(maxPot) {
    const el = $('#map-legend');
    el.hidden = S.mapMode === 'secteurs';
    if (S.mapMode === 'atteinte') el.innerHTML = `<strong>Rythme vs budget à date</strong><div class="ramp" style="background:linear-gradient(90deg,${[-1, -.5, 0, .5, 1].map(divColor).join(',')})"></div><div class="ramp-lbl"><span>75 %</span><span>100 %</span><span>125 %</span></div>`;
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
        box.innerHTML = `<header><span><i class="ri-focus-3-line"></i>Potentiel ${exemple}</span><button class="pt-x" data-pt-close title="Fermer"><i class="ri-close-line"></i></button></header>
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
        box.innerHTML = `<header><span><i class="ri-focus-3-line"></i>Potentiel ${exemple}</span></header>
            <h4>${S.who ? (isEquipe(S.who) ? 'Équipe ' + esc(equipeDe(S.who.slice(3)).nom) : esc(fullName(commercial(S.who)))) : 'Tous les ATC'}</h4>
            <div class="pt-big">${euros(pot)}<small>potentiel annuel · ${zones.length} zones</small></div>
            <div class="pt-grid">
                <span>Atterrissage ${S.ref.getFullYear()}<b>${euros(ka.projection)}</b></span>
                <span>Couverture<b>${pot ? pct(ka.projection / pot * 100) : '—'}</b></span>
                <span>IAP installés<b>${iap}</b></span>
                <span>Potentiel / IAP<b>${iap ? euros(pot / iap) : '—'}</b></span>
            </div>
            <p class="pt-hint"><i class="ri-cursor-line"></i>Cliquez une zone pour son détail</p>`;
    }
}

function bindMap(svg) {
    const tip = $('#tip');
    svg.addEventListener('mousemove', e => {
        if (MAP.moving) return;
        const bd = e.target.closest('.badge');
        if (bd) {
            const c = commercial(bd.dataset.who); const k = Kc(c.id, S.period); const st = statut(k.rythme, S.base.reglages);
            tip.innerHTML = `<h4><i class="dot" style="background:${c.couleur}"></i>${esc(fullName(c))}</h4>
                <div class="t-row"><span>Facturé ${pinfo().label}</span><b>${euros(k.realise)}</b></div>
                <div class="t-row"><span>Budget atteint</span><b>${pct(k.atteinte)}</b></div>
                <div class="t-row"><span>Statut</span><b>${st.label}</b></div>`;
            return placeTip(e);
        }
        const t = e.target.closest('[data-zone]');
        if (!t) { tip.classList.remove('show'); return; }
        const code = t.dataset.zone; const zi = zoneInfo.get(code); const owner = commercial(S.base.secteurs[code]); const info = S.base.zonesInfo[code] || {};
        const k = owner ? Kc(owner.id, S.period) : null;
        tip.innerHTML = `<h4>${esc(zi?.nom || code)} <small class="muted">${/^\d/.test(code) ? code : ''}</small></h4>
            <div class="t-row"><span>ATC</span><b>${owner ? `<i class="dot" style="background:${owner.couleur}"></i> ${esc(fullName(owner))}` : 'Non attribuée'}</b></div>
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
    // On laisse de la place à gauche pour l'encart Potentiel
    const panel = $('#potentiel')?.offsetWidth || 0; const free = Math.max(0.4, 1 - (panel + 24) / r.width);
    w = w / free;
    if (w / h > ratio) h = w / ratio; else w = h * ratio;
    const cx = (b[0] + b[2]) / 2 - w * (1 - free) / 2;
    animateVb([cx - w / 2, (b[1] + b[3]) / 2 - h / 2, w, h]);
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
    $('#live-label').textContent = e.derniere_date ? `Données au ${dateLongue(parseIso(e.derniere_date))}` : 'Aucune donnée';
    $('#live-sub').textContent = e.source === 'demo' ? 'Démonstration (fictif)' : e.dernier_import ? `Import ${relative(new Date(e.dernier_import))}` : 'En attente des fichiers';
    const b = $('#demo-banner');
    if (S.store.mode === 'demo') {
        b.hidden = false;
        b.innerHTML = e.source === 'demo' ? '<i class="ri-flask-line"></i><span><strong>Démonstration</strong> — noms et chiffres fictifs. Importez vos fichiers dans l\'admin pour voir vos données (elles restent dans ce navigateur).</span>'
            : '<i class="ri-hard-drive-2-line"></i><span><strong>Vos fichiers</strong> — données stockées uniquement dans ce navigateur, en attendant Supabase.</span>';
    } else b.hidden = true;
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
const SECTIONS = '.grid-a, .grid-b, .signals, .foot, #gammes, #card-carnet';
function showLocked() {
    $('#who').innerHTML = '<span class="team-hero"><i class="ri-lock-2-fill"></i></span><div><h1>Accès réservé</h1><div class="meta"><span>Le tableau de bord est privé</span></div></div>';
    $('#kpis').innerHTML = `<div class="card empty" style="grid-column:1/-1"><i class="ri-shield-keyhole-line"></i>Connectez-vous pour voir les chiffres.<br><br><button class="btn btn-primary" onclick="document.querySelector('#btn-admin').click()"><i class="ri-login-circle-line"></i>Se connecter</button></div>`;
    $$(SECTIONS).forEach(e => e.hidden = true);
}

async function refresh(msg) {
    S.session = await S.store.session();
    await loadAll();
    if (locked()) return showLocked();
    $$(SECTIONS).forEach(e => e.hidden = false);
    renderAll({ animate: false });
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
    applyThemeIcon();
    try {
        await S.store.init();
        S.session = await S.store.session();
        await loadAll();
    } catch (err) {
        $('#kpis').innerHTML = `<div class="card empty" style="grid-column:1/-1"><i class="ri-wifi-off-line"></i>Impossible de charger les données : ${esc(err.message)}</div>`;
        return;
    }
    const c = new URL(location).searchParams.get('c'); if (c && (isEquipe(c) || commercial(c))) S.who = c;
    if (locked()) showLocked(); else { renderAll(); zoomToSelection(); }
    S.store.onChange(() => refresh('Nouvelles données reçues'));
    setInterval(() => S.base && renderLive(), 30000);

    document.addEventListener('click', e => {
        const w = e.target.closest('[data-who]');
        if (w && !e.target.closest('#admin')) select(w.dataset.who);
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
        const list = [null, ...$$('#team-list [data-who]').map(b => b.dataset.who)]; const i = list.indexOf(S.who);
        if (e.key === 'ArrowDown') { e.preventDefault(); select(list[(i + 1) % list.length]); }
        if (e.key === 'ArrowUp') { e.preventDefault(); select(list[(i - 1 + list.length) % list.length]); }
        if (e.key === 'Escape') select(null);
    });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { Object.values(S.charts).forEach(c => c.resize()); moveGlider($('#period')); moveGlider($('#map-mode')); moveGlider($('#clients-mode')); }, 120); });
    window.dispatchEvent(new Event('commerce:ready'));
}
document.addEventListener('DOMContentLoaded', boot);
