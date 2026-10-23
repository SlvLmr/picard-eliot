/* ============================================================
   PICARD2030 — Noyau partagé (application + rapport PDF)
   Chargement des données, utilitaires de dates et calculs
   d'avancement. Aucune manipulation du DOM ici.
   ============================================================ */

const STORAGE_KEY = 'picard2030_data_v2';
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
    done:     { label: 'Terminé',        icon: 'ri-checkbox-circle-fill', cls: 'h-done' },
    ok:       { label: 'Dans les temps', icon: 'ri-sun-fill',             cls: 'h-ok' },
    warn:     { label: 'Vigilance',      icon: 'ri-cloudy-fill',          cls: 'h-warn' },
    late:     { label: 'En retard',      icon: 'ri-thunderstorms-fill',   cls: 'h-late' },
    upcoming: { label: 'À venir',        icon: 'ri-time-line',            cls: 'h-upcoming' },
};

const ICONS = [
    ['ri-store-2-line', 'Boutique'], ['ri-tools-line', 'Outils'], ['ri-shopping-cart-line', 'Panier'],
    ['ri-truck-line', 'Logistique'], ['ri-building-4-line', 'Usine'], ['ri-team-line', 'Équipe'],
    ['ri-megaphone-line', 'Marketing'], ['ri-line-chart-line', 'Finance'], ['ri-computer-line', 'Informatique'],
    ['ri-database-2-line', 'Données'], ['ri-shield-check-line', 'Qualité'], ['ri-leaf-line', 'Environnement'],
    ['ri-lightbulb-line', 'Innovation'], ['ri-global-line', 'International'], ['ri-user-heart-line', 'RH'],
    ['ri-hand-coin-line', 'Ventes'], ['ri-settings-5-line', 'Process'], ['ri-flag-2-line', 'Objectif'],
    ['ri-folder-line', 'Dossier'],
];

const today = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();

// ─── Utilitaires ─────────────────────────────────
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function parse(d) { const [y, m, j] = String(d).split('-').map(Number); return new Date(y, (m || 1) - 1, j || 1, 12); }
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmtDate(d) { const x = d instanceof Date ? d : parse(d); return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`; }
function fmtMonth(d) { const x = d instanceof Date ? d : parse(d); return `${MONTHS[x.getMonth()]} ${x.getFullYear()}`; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function daysBetween(a, b) { return Math.round((b - a) / DAY); }
function uid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 9); }

// ─── Données ─────────────────────────────────────
const store = { data: null, isLocal: false, shared: null };

function settings() { return { ...DEFAULT_SETTINGS, ...(store.data && store.data.settings) }; }

function normalize(d) {
    d.meta ||= { name: 'Picard2030' };
    d.settings = { ...DEFAULT_SETTINGS, ...d.settings };
    d.rubriques ||= [];
    d.themes ||= [];
    d.themes.forEach(t => {
        t.id ||= uid('t');
        t.actions ||= [];
        t.note ||= '';
        t.actions.forEach(a => { a.note ||= ''; a.estimated = !!a.estimated; a.progress = clamp(Number(a.progress) || 0, 0, 100); });
    });
    return d;
}

function loadData() {
    const base = structuredClone(window.PICARD2030_DATA || {});
    let local = null;
    try { local = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* stockage indisponible */ }
    store.isLocal = !!(local && Array.isArray(local.themes));
    // Une copie locale ancienne ne connaît pas les réglages ajoutés depuis (Masquée, Exemple) : on reprend ceux publiés
    if (store.isLocal) (local.rubriques || []).forEach(r => {
        const pub = (base.rubriques || []).find(x => x.id === r.id);
        if (pub) ['hidden', 'example'].forEach(k => { if (!(k in r) && k in pub) r[k] = pub[k]; });
    });
    store.data = normalize(store.isLocal ? local : base);
    return store.data;
}

// Version partagée (base Supabase) : c'est elle que voient tous les visiteurs
function useShared(row) {
    store.shared = row;
    store.data = normalize(structuredClone(row.data));
    store.isLocal = false;
}

function saveLocal() {
    store.data.meta.updatedAt = iso(today);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store.data)); } catch (e) { /* stockage indisponible */ }
    store.isLocal = true;
}

function clearLocal() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

function rubriqueOf(id) {
    return store.data.rubriques.find(r => r.id === id) || { id, name: id || '—', color: '#64748b', icon: 'ri-folder-line' };
}

// ─── Calculs ─────────────────────────────────────
function spanDays(start, end) { return Math.max(1, daysBetween(start, end) + 1); }

function linearExpected(start, end) {
    if (today < start) return 0;
    if (today >= end) return 100;
    return Math.round(100 * (today - start) / Math.max(DAY, end - start));
}

function actionRange(a) {
    const start = parse(a.start), end = parse(a.end || a.start);
    return { start, end: end < start ? start : end };
}

function isMilestone(a) { return !a.end || a.end === a.start; }

function themeRange(t) {
    if (t.start && t.end) return { start: parse(t.start), end: parse(t.end) };
    const dates = t.actions.flatMap(a => { const r = actionRange(a); return [r.start, r.end]; });
    if (t.start) dates.push(parse(t.start));
    if (t.end) dates.push(parse(t.end));
    if (!dates.length) return { start: today, end: today };
    return { start: new Date(Math.min(...dates)), end: new Date(Math.max(...dates)) };
}

// Avancement d'un thème : moyenne des actions pondérée par leur durée.
// Sans action, on utilise l'avancement saisi sur le thème.
function themeProgress(t) {
    if (!t.actions.length) return clamp(Number(t.progress) || 0, 0, 100);
    let w = 0, s = 0;
    t.actions.forEach(a => { const r = actionRange(a), d = spanDays(r.start, r.end); w += d; s += d * a.progress; });
    return Math.round(s / w);
}

function themeExpected(t) {
    if (!t.actions.length) { const r = themeRange(t); return linearExpected(r.start, r.end); }
    let w = 0, s = 0;
    t.actions.forEach(a => { const r = actionRange(a), d = spanDays(r.start, r.end); w += d; s += d * linearExpected(r.start, r.end); });
    return Math.round(s / w);
}

function timeElapsed(t) { const r = themeRange(t); return linearExpected(r.start, r.end); }

function rateHealth(progress, expected, start, overdue) {
    const s = settings();
    if (progress >= 100) return 'done';
    if (start > today) return 'upcoming';
    if (overdue) return 'late';
    const delta = progress - expected;
    if (delta < -s.lateThreshold) return 'late';
    if (delta < -s.warnThreshold) return 'warn';
    return 'ok';
}

function actionHealth(a) {
    const r = actionRange(a);
    return rateHealth(a.progress, linearExpected(r.start, r.end), r.start, r.end < today);
}

function overdueActions(t) { return t.actions.filter(a => a.progress < 100 && actionRange(a).end < today); }

function themeHealth(t) {
    const r = themeRange(t);
    return rateHealth(themeProgress(t), themeExpected(t), r.start, overdueActions(t).length > 0 || (!t.actions.length && r.end < today));
}

function weightedProgress(themes) {
    let w = 0, s = 0;
    themes.forEach(t => { const r = themeRange(t), d = spanDays(r.start, r.end); w += d; s += d * themeProgress(t); });
    return w ? Math.round(s / w) : 0;
}

// Prochaine échéance : fin d'une action non terminée (ou d'un thème sans action)
function upcomingDeadlines(themes) {
    return themes.flatMap(t => t.actions.length
        ? t.actions.filter(a => a.progress < 100).map(a => ({ name: a.name, date: actionRange(a).end, theme: t, action: a }))
        : (themeProgress(t) < 100 ? [{ name: t.name, date: themeRange(t).end, theme: t }] : []))
        .filter(x => x.date >= today)
        .sort((a, b) => a.date - b.date);
}

function countdown(date) {
    const n = daysBetween(today, date instanceof Date ? date : parse(date));
    if (n === 0) return "aujourd'hui";
    return n > 0 ? `J-${n}` : `J+${-n}`;
}

// Tri des thèmes : 'date' = par échéance (date de fin), 'theme' = ordre défini dans l'admin
function sortThemes(themes, by) {
    if (by !== 'date') return themes.slice();
    return themes.slice().sort((a, b) => {
        const ra = themeRange(a), rb = themeRange(b);
        return (ra.end - rb.end) || (ra.start - rb.start);
    });
}

function themesOf(rubriqueId) { return store.data.themes.filter(t => t.rubrique === rubriqueId); }

// Partie publique : les rubriques cochées « Masquée » dans l'admin n'apparaissent ni sur le site ni dans le rapport
function publicRubriques() { return store.data.rubriques.filter(r => !r.hidden); }
function publicThemes() { const ids = new Set(publicRubriques().map(r => r.id)); return store.data.themes.filter(t => ids.has(t.rubrique)); }

// ─── Visuels partagés ────────────────────────────
function gaugeSvg(value, color, size, stroke, animate) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - clamp(value, 0, 100) / 100);
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${value}%">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gauge-bg" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gauge-fg" stroke="${color}" stroke-width="${stroke}"
            stroke-dasharray="${c}" stroke-dashoffset="${animate ? c : off}" ${animate ? `data-offset="${off}"` : ''}
            transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
}
