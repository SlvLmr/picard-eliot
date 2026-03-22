/* ============================================
   PICARD · ELIOT — Communication Dashboard
   Horizontal Timeline + Nested Tasks + Assignees + Custom Colors
   ============================================ */

// ─── State ───────────────────────────────────────
const APP = {
    currentSection: 'all',
    currentBrand: 'all',
    currentView: 'year',
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    editingEventId: null,
    events: [],
    budgets: {},
    charts: {},
    modalTasks: [],
};

// ─── Config ──────────────────────────────────────
const CATEGORIES = {
    'plan-media':      { label: 'Plan Média',       icon: 'ri-broadcast-fill',    color: '#8b5cf6' },
    'plan-digital':    { label: 'Plan Digital',      icon: 'ri-global-fill',       color: '#3b82f6' },
    'sites-web':       { label: 'Sites Web',          icon: 'ri-window-fill',       color: '#14b8a6' },
    'newsletters':     { label: 'Newsletters',       icon: 'ri-mail-send-fill',    color: '#06b6d4' },
    'reseaux-sociaux': { label: 'Réseaux Sociaux',   icon: 'ri-share-fill',    color: '#ec4899' },
    'salons-foires':   { label: 'Salons · Foires',   icon: 'ri-store-3-fill',      color: '#f59e0b' },
    'usine-interne':   { label: 'Usine · Interne',   icon: 'ri-building-4-fill',   color: '#10b981' },
    'produits':        { label: 'Produits',           icon: 'ri-box-3-fill',        color: '#f97316' },
    'ressources':      { label: 'Ressources et outils', icon: 'ri-folder-5-fill',    color: '#6366f1' },
    'taches-diverses': { label: 'Tâches diverses',    icon: 'ri-task-fill',         color: '#78716c' },
};

const STATUS_LABELS = { 'planned': 'Planifié', 'in-progress': 'En cours', 'completed': 'Terminé', 'cancelled': 'Annulé' };
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

// ─── Helpers ─────────────────────────────────────
const genId = () => 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
const tskId = () => 'tsk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

function formatDate(d) { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
function formatDateRange(s, e) { if (!e || s === e) return formatDate(s); return `${formatDate(s)} → ${formatDate(e)}`; }
function isSameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function dateToStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// Count all tasks+subtasks recursively
function countTasks(tasks) {
    let total = 0, done = 0;
    (tasks || []).forEach(t => {
        total++; if (t.done) done++;
        (t.subtasks || []).forEach(s => { total++; if (s.done) done++; });
    });
    return { total, done };
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Persistence ─────────────────────────────────
function saveData() {
    localStorage.setItem('picard_eliot_events_v3', JSON.stringify(APP.events));
    localStorage.setItem('picard_eliot_budgets', JSON.stringify(APP.budgets));
}

function loadData() {
    try {
        const v3 = localStorage.getItem('picard_eliot_events_v3');
        if (v3) APP.events = JSON.parse(v3);
        const b = localStorage.getItem('picard_eliot_budgets');
        if (b) APP.budgets = JSON.parse(b);
    } catch(e) { console.warn('Load error:', e); }
    if (!APP.events.length) { APP.events = sampleEvents(); saveData(); }
    if (!APP.budgets || !Object.keys(APP.budgets).length) {
        APP.budgets = { picard: { allocated: 120000, spent: 45000 }, eliot: { allocated: 85000, spent: 28000 } };
        saveData();
    }
}

function sampleEvents() {
    const y = 2026;
    return [
        { id: genId(), name: 'Campagne TV Picard Q1', category: 'plan-media', brand: 'picard', start: `${y}-01-15`, end: `${y}-02-28`, status: 'completed', priority: 'high', desc: 'Campagne nationale TV', barColor: '#3b82f6', tasks: [
            { id: tskId(), text: 'Brief agence', done: true, assignee: 'Sophie M.', subtasks: [] },
            { id: tskId(), text: 'Validation storyboard', done: true, assignee: 'Marc D.', subtasks: [] },
            { id: tskId(), text: 'Tournage', done: true, assignee: 'Sophie M.', subtasks: [
                { id: tskId(), text: 'Repérages lieux', done: true, assignee: 'Paul R.' },
                { id: tskId(), text: 'Casting figurants', done: true, assignee: 'Sophie M.' },
            ]},
            { id: tskId(), text: 'Post-production', done: true, assignee: 'Marc D.', subtasks: [] },
        ]},
        { id: genId(), name: 'Campagne Radio Eliot', category: 'plan-media', brand: 'eliot', start: `${y}-03-01`, end: `${y}-03-31`, status: 'in-progress', priority: 'high', desc: 'Spots radio stations nationales', barColor: '#f59e0b', tasks: [
            { id: tskId(), text: 'Écriture script', done: true, assignee: 'Julie L.', subtasks: [] },
            { id: tskId(), text: 'Enregistrement voix off', done: true, assignee: 'Julie L.', subtasks: [] },
            { id: tskId(), text: 'Mixage audio', done: false, assignee: 'Thomas B.', subtasks: [
                { id: tskId(), text: 'Mix version 30s', done: false, assignee: 'Thomas B.' },
                { id: tskId(), text: 'Mix version 15s', done: false, assignee: 'Thomas B.' },
            ]},
            { id: tskId(), text: 'Diffusion', done: false, assignee: 'Sophie M.', subtasks: [] },
        ]},
        { id: genId(), name: 'Refonte site Picard', category: 'plan-digital', brand: 'picard', start: `${y}-02-01`, end: `${y}-04-30`, status: 'in-progress', priority: 'urgent', desc: 'Refonte complète du site web', barColor: '#ef4444', tasks: [
            { id: tskId(), text: 'Audit UX actuel', done: true, assignee: 'Claire V.', subtasks: [] },
            { id: tskId(), text: 'Wireframes', done: true, assignee: 'Claire V.', subtasks: [] },
            { id: tskId(), text: 'Maquettes Figma', done: true, assignee: 'Claire V.', subtasks: [
                { id: tskId(), text: 'Pages principales', done: true, assignee: 'Claire V.' },
                { id: tskId(), text: 'Pages produits', done: true, assignee: 'Claire V.' },
                { id: tskId(), text: 'Responsive mobile', done: false, assignee: 'Claire V.' },
            ]},
            { id: tskId(), text: 'Développement front', done: false, assignee: 'Luc G.', subtasks: [
                { id: tskId(), text: 'Header & navigation', done: false, assignee: 'Luc G.' },
                { id: tskId(), text: 'Pages contenu', done: false, assignee: 'Luc G.' },
                { id: tskId(), text: 'Formulaires', done: false, assignee: 'Luc G.' },
            ]},
            { id: tskId(), text: 'Intégration CMS', done: false, assignee: 'Luc G.', subtasks: [] },
            { id: tskId(), text: 'Tests & recette', done: false, assignee: 'Marc D.', subtasks: [] },
            { id: tskId(), text: 'Mise en production', done: false, assignee: 'Luc G.', subtasks: [] },
        ]},
        { id: genId(), name: 'SEO / SEA Eliot', category: 'plan-digital', brand: 'eliot', start: `${y}-03-10`, end: `${y}-06-30`, status: 'planned', priority: 'medium', desc: 'Stratégie SEO et Google Ads', barColor: '#06b6d4', tasks: [
            { id: tskId(), text: 'Audit SEO', done: false, assignee: 'Claire V.', subtasks: [] },
            { id: tskId(), text: 'Stratégie mots-clés', done: false, assignee: 'Claire V.', subtasks: [] },
            { id: tskId(), text: 'Setup campagnes Ads', done: false, assignee: 'Thomas B.', subtasks: [] },
        ]},
        { id: genId(), name: 'NL Mars - Nouveautés', category: 'newsletters', brand: 'both', start: `${y}-03-15`, end: `${y}-03-15`, status: 'planned', priority: 'medium', desc: 'Newsletter mensuelle mars', barColor: '#06b6d4', tasks: [
            { id: tskId(), text: 'Rédaction contenu', done: false, assignee: 'Julie L.', subtasks: [] },
            { id: tskId(), text: 'Design template', done: false, assignee: 'Claire V.', subtasks: [] },
            { id: tskId(), text: 'Envoi test', done: false, assignee: 'Julie L.', subtasks: [] },
            { id: tskId(), text: 'Envoi final', done: false, assignee: 'Julie L.', subtasks: [] },
        ]},
        { id: genId(), name: 'NL Avril - Promo Printemps', category: 'newsletters', brand: 'picard', start: `${y}-04-01`, end: `${y}-04-01`, status: 'planned', priority: 'low', desc: 'Offres spéciales printemps', barColor: '#10b981', tasks: [] },
        { id: genId(), name: 'Post LinkedIn - Salon', category: 'reseaux-sociaux', brand: 'both', start: `${y}-03-20`, end: `${y}-03-20`, status: 'planned', priority: 'medium', desc: 'Annonce salon sécurité', barColor: '#ec4899', tasks: [
            { id: tskId(), text: 'Rédaction post', done: false, assignee: 'Julie L.', subtasks: [] },
            { id: tskId(), text: 'Création visuel', done: false, assignee: 'Claire V.', subtasks: [] },
            { id: tskId(), text: 'Publication', done: false, assignee: 'Julie L.', subtasks: [] },
        ]},
        { id: genId(), name: 'Campagne Instagram Eliot', category: 'reseaux-sociaux', brand: 'eliot', start: `${y}-03-05`, end: `${y}-03-25`, status: 'in-progress', priority: 'high', desc: 'Série de posts produits', barColor: '#ec4899', tasks: [
            { id: tskId(), text: 'Planning éditorial', done: true, assignee: 'Julie L.', subtasks: [] },
            { id: tskId(), text: 'Shooting photos', done: true, assignee: 'Paul R.', subtasks: [
                { id: tskId(), text: 'Setup studio', done: true, assignee: 'Paul R.' },
                { id: tskId(), text: 'Retouches Lightroom', done: true, assignee: 'Paul R.' },
            ]},
            { id: tskId(), text: 'Création posts Sem 1-2', done: true, assignee: 'Claire V.', subtasks: [] },
            { id: tskId(), text: 'Création posts Sem 3', done: false, assignee: 'Claire V.', subtasks: [] },
        ]},
        { id: genId(), name: 'Salon Sécurité Paris', category: 'salons-foires', brand: 'both', start: `${y}-04-15`, end: `${y}-04-18`, status: 'planned', priority: 'urgent', desc: 'Stand commun Picard + Eliot', barColor: '#f59e0b', tasks: [
            { id: tskId(), text: 'Réservation emplacement', done: true, assignee: 'Sophie M.', subtasks: [] },
            { id: tskId(), text: 'Design stand', done: false, assignee: 'Claire V.', subtasks: [
                { id: tskId(), text: 'Plans 3D', done: false, assignee: 'Claire V.' },
                { id: tskId(), text: 'Validation direction', done: false, assignee: 'Marc D.' },
            ]},
            { id: tskId(), text: 'Commande PLV', done: false, assignee: 'Sophie M.', subtasks: [] },
            { id: tskId(), text: 'Organisation logistique', done: false, assignee: 'Paul R.', subtasks: [] },
            { id: tskId(), text: 'Briefing équipe', done: false, assignee: 'Marc D.', subtasks: [] },
        ]},
        { id: genId(), name: 'Foire de Lyon', category: 'salons-foires', brand: 'picard', start: `${y}-05-10`, end: `${y}-05-14`, status: 'planned', priority: 'high', desc: 'Présence Picard', barColor: '#3b82f6', tasks: [] },
        { id: genId(), name: 'Visite usine presse', category: 'usine-interne', brand: 'picard', start: `${y}-03-25`, end: `${y}-03-25`, status: 'planned', priority: 'medium', desc: 'Accueil journalistes', barColor: '#10b981', tasks: [
            { id: tskId(), text: 'Liste invités presse', done: false, assignee: 'Sophie M.', subtasks: [] },
            { id: tskId(), text: 'Parcours de visite', done: false, assignee: 'Marc D.', subtasks: [] },
            { id: tskId(), text: 'Dossier de presse', done: false, assignee: 'Julie L.', subtasks: [] },
        ]},
        { id: genId(), name: 'Team Building Com', category: 'usine-interne', brand: 'both', start: `${y}-04-05`, end: `${y}-04-05`, status: 'planned', priority: 'low', desc: 'Journée team building', barColor: '#a855f7', tasks: [] },
        { id: genId(), name: 'Lancement Serrure V3', category: 'produits', brand: 'picard', start: `${y}-05-01`, end: `${y}-05-15`, status: 'planned', priority: 'urgent', desc: 'Lancement serrure connectée V3', barColor: '#ef4444', tasks: [
            { id: tskId(), text: 'Kit de lancement', done: false, assignee: 'Sophie M.', subtasks: [
                { id: tskId(), text: 'Fiche technique', done: false, assignee: 'Luc G.' },
                { id: tskId(), text: 'Argumentaire commercial', done: false, assignee: 'Julie L.' },
                { id: tskId(), text: 'Visuels produit', done: false, assignee: 'Claire V.' },
            ]},
            { id: tskId(), text: 'Communiqué de presse', done: false, assignee: 'Julie L.', subtasks: [] },
            { id: tskId(), text: 'Vidéo démo', done: false, assignee: 'Paul R.', subtasks: [
                { id: tskId(), text: 'Script vidéo', done: false, assignee: 'Julie L.' },
                { id: tskId(), text: 'Tournage', done: false, assignee: 'Paul R.' },
                { id: tskId(), text: 'Montage & motion', done: false, assignee: 'Thomas B.' },
            ]},
            { id: tskId(), text: 'Emailing distributeurs', done: false, assignee: 'Sophie M.', subtasks: [] },
        ]},
        { id: genId(), name: 'Packaging Eliot refonte', category: 'produits', brand: 'eliot', start: `${y}-03-01`, end: `${y}-04-15`, status: 'in-progress', priority: 'high', desc: 'Nouveau packaging', barColor: '#f97316', tasks: [
            { id: tskId(), text: 'Brief créatif', done: true, assignee: 'Marc D.', subtasks: [] },
            { id: tskId(), text: 'Propositions DA', done: true, assignee: 'Claire V.', subtasks: [] },
            { id: tskId(), text: 'Validation', done: false, assignee: 'Marc D.', subtasks: [] },
            { id: tskId(), text: 'BAT impression', done: false, assignee: 'Sophie M.', subtasks: [] },
        ]},
        { id: genId(), name: 'Shooting photo produits', category: 'ressources', brand: 'both', start: `${y}-03-18`, end: `${y}-03-19`, status: 'in-progress', priority: 'high', desc: 'Photos studio nouvelles gammes', barColor: '#6366f1', tasks: [
            { id: tskId(), text: 'Sélection produits', done: true, assignee: 'Marc D.', subtasks: [] },
            { id: tskId(), text: 'Booking photographe', done: true, assignee: 'Sophie M.', subtasks: [] },
            { id: tskId(), text: 'Shooting jour 1', done: false, assignee: 'Paul R.', subtasks: [] },
            { id: tskId(), text: 'Shooting jour 2', done: false, assignee: 'Paul R.', subtasks: [] },
            { id: tskId(), text: 'Retouches', done: false, assignee: 'Paul R.', subtasks: [] },
        ]},
        { id: genId(), name: 'Vidéo corporate Picard', category: 'ressources', brand: 'picard', start: `${y}-04-20`, end: `${y}-05-10`, status: 'planned', priority: 'medium', desc: 'Film institutionnel', barColor: '#8b5cf6', tasks: [] },
        { id: genId(), name: 'Presse spécialisée Q2', category: 'plan-media', brand: 'both', start: `${y}-04-01`, end: `${y}-06-30`, status: 'planned', priority: 'medium', desc: 'Insertions presse BTP', barColor: '#a855f7', tasks: [] },
        { id: genId(), name: 'Webinar Sécurité connectée', category: 'plan-digital', brand: 'both', start: `${y}-03-28`, end: `${y}-03-28`, status: 'planned', priority: 'medium', desc: 'Webinar partenaires', barColor: '#3b82f6', tasks: [
            { id: tskId(), text: 'Programme & speakers', done: false, assignee: 'Marc D.', subtasks: [] },
            { id: tskId(), text: 'Landing page inscription', done: false, assignee: 'Luc G.', subtasks: [] },
            { id: tskId(), text: 'Emailing invitation', done: false, assignee: 'Julie L.', subtasks: [] },
        ]},
    ];
}

// ─── DOM ─────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const DOM = {};

function cacheDom() {
    DOM.sidebar = $('#sidebar');
    DOM.mainContent = $('#mainContent');
    DOM.pageTitle = $('#pageTitle');
    DOM.pageBadge = $('#pageBadge');
    DOM.monthLabel = $('#monthLabel');
    DOM.htimelineContainer = $('#htimelineContainer');
    DOM.allTimelineContainer = $('#allTimelineContainer');
    DOM.kpiContainer = $('#kpiContainer');
    DOM.modalOverlay = $('#modalOverlay');
    DOM.eventForm = $('#eventForm');
    DOM.modalTitle = $('#modalTitle');
    DOM.submitLabel = $('#submitLabel');
    DOM.deleteEventBtn = $('#deleteEventBtn');
    DOM.toastContainer = $('#toastContainer');
    DOM.contentArea = $('#contentArea');
    DOM.detailPanel = $('#detailPanel');
    DOM.detailTitle = $('#detailTitle');
    DOM.detailBody = $('#detailBody');
    DOM.detailClose = $('#detailClose');
    DOM.tasksList = $('#tasksList');
    DOM.journeyContainer = $('#journeyContainer');
}

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    loadData();
    loadJourney();
    initNav(); initMonthNav(); initBrandFilter(); initModal(); initMenuToggle(); initDetailPanel(); initColorPicker();
    initNodeModal(); initJourneyToolbar();
    render();
});

// ─── Navigation ──────────────────────────────────
function initNav() {
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            $$('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            APP.currentSection = item.dataset.section;
            closeDetailPanel();
            render();
        });
    });
}

function initMonthNav() {
    $('#prevMonth').addEventListener('click', () => {
        if (APP.currentView === 'year') { APP.currentYear--; }
        else { APP.currentMonth--; if (APP.currentMonth<0){APP.currentMonth=11;APP.currentYear--;} }
        render();
    });
    $('#nextMonth').addEventListener('click', () => {
        if (APP.currentView === 'year') { APP.currentYear++; }
        else { APP.currentMonth++; if (APP.currentMonth>11){APP.currentMonth=0;APP.currentYear++;} }
        render();
    });
    $('#todayBtn').addEventListener('click', () => { const n=new Date(); APP.currentMonth=n.getMonth(); APP.currentYear=n.getFullYear(); render(); });
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.currentView = btn.dataset.view;
            render();
        });
    });
}

function initBrandFilter() {
    $$('.brand-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.brand-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.currentBrand = btn.dataset.brand;
            render();
        });
    });
}

function initMenuToggle() {
    $('#menuToggle').addEventListener('click', () => DOM.sidebar.classList.toggle('open'));
    DOM.mainContent.addEventListener('click', () => DOM.sidebar.classList.remove('open'));
}

function initColorPicker() {
    $$('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            $('#eventBarColor').value = sw.dataset.color;
            $$('.color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
        });
    });
}

// ─── Filters ─────────────────────────────────────
function getFilteredEvents(section) {
    let evts = [...APP.events];
    const s = section || APP.currentSection;
    if (s !== 'kpi' && s !== 'all' && s !== 'budget') evts = evts.filter(e => e.category === s);
    if (APP.currentBrand !== 'all') evts = evts.filter(e => e.brand === APP.currentBrand || e.brand === 'both');
    return evts;
}

// ─── Render ──────────────────────────────────────
function render() {
    updatePageTitle(); updateMonthLabel();

    DOM.htimelineContainer.classList.add('hidden');
    DOM.allTimelineContainer.classList.add('hidden');
    DOM.kpiContainer.classList.add('hidden');
    DOM.journeyContainer.classList.add('hidden');
    const budgetEl = $('#budgetContainer');
    if (budgetEl) budgetEl.classList.add('hidden');

    if (APP.currentSection === 'kpi') {
        DOM.kpiContainer.classList.remove('hidden');
        renderKPI();
    } else if (APP.currentSection === 'budget') {
        renderBudget();
    } else if (APP.currentSection === 'all') {
        DOM.allTimelineContainer.classList.remove('hidden');
        renderAllTimeline();
    } else if (APP.currentSection === 'parcours-client') {
        DOM.journeyContainer.classList.remove('hidden');
        renderJourney();
    } else if (APP.currentSection === 'comite-iap') {
        DOM.htimelineContainer.classList.remove('hidden');
        renderTimeline(DOM.htimelineContainer, [], {});
    } else {
        DOM.htimelineContainer.classList.remove('hidden');
        renderTimeline(DOM.htimelineContainer, getFilteredEvents());
    }
}

function updatePageTitle() {
    const s = APP.currentSection;
    if (s === 'kpi') { DOM.pageTitle.textContent='Indicateurs KPI'; DOM.pageBadge.textContent='Analytics'; DOM.pageBadge.style.background='rgba(16,185,129,0.12)'; DOM.pageBadge.style.color='#10b981'; }
    else if (s === 'budget') { DOM.pageTitle.textContent='Budget'; DOM.pageBadge.textContent='Finances'; DOM.pageBadge.style.background='rgba(245,158,11,0.12)'; DOM.pageBadge.style.color='#f59e0b'; }
    else if (s === 'all') { DOM.pageTitle.textContent='Vue Globale'; DOM.pageBadge.textContent='Toutes catégories'; DOM.pageBadge.style.background='rgba(167,139,250,0.12)'; DOM.pageBadge.style.color='#a78bfa'; }
    else if (s === 'parcours-client') { DOM.pageTitle.textContent='Projet Leads'; DOM.pageBadge.textContent='Journey Map'; DOM.pageBadge.style.background='rgba(6,182,212,0.12)'; DOM.pageBadge.style.color='#06b6d4'; }
    else if (s === 'comite-iap') { DOM.pageTitle.textContent='Comité stratégique IAP'; DOM.pageBadge.textContent='Groupe de Travail'; DOM.pageBadge.style.background='rgba(244,114,182,0.12)'; DOM.pageBadge.style.color='#f472b6'; }
    else { const c=CATEGORIES[s]; DOM.pageTitle.textContent=c.label; DOM.pageBadge.textContent='Timeline'; DOM.pageBadge.style.background=`${c.color}1a`; DOM.pageBadge.style.color=c.color; }
}

function updateMonthLabel() {
    DOM.monthLabel.textContent = APP.currentView === 'year' ? `${APP.currentYear}` : `${MONTHS_FR[APP.currentMonth]} ${APP.currentYear}`;
}

// ─── Timeline Helpers ────────────────────────────
function getTimeContext(today, isYearView) {
    if (isYearView) {
        const isLeap = (APP.currentYear % 4 === 0 && APP.currentYear % 100 !== 0) || APP.currentYear % 400 === 0;
        return {
            isYearView: true,
            totalDays: isLeap ? 366 : 365,
            isCurrent: today.getFullYear() === APP.currentYear,
            rangeStart: new Date(APP.currentYear, 0, 1),
            rangeEnd: new Date(APP.currentYear, 11, 31),
            cellCount: 12
        };
    } else {
        const daysInMonth = new Date(APP.currentYear, APP.currentMonth + 1, 0).getDate();
        return {
            isYearView: false,
            totalDays: daysInMonth,
            isCurrent: today.getMonth() === APP.currentMonth && today.getFullYear() === APP.currentYear,
            rangeStart: new Date(APP.currentYear, APP.currentMonth, 1),
            rangeEnd: new Date(APP.currentYear, APP.currentMonth, daysInMonth),
            cellCount: daysInMonth
        };
    }
}

function renderTimelineHeader(today, isYearView) {
    let html = '';
    if (isYearView) {
        const isCurYear = today.getFullYear() === APP.currentYear;
        for (let m = 0; m < 12; m++) {
            const isCurMonth = isCurYear && today.getMonth() === m;
            html += `<div class="htimeline-day-cell htimeline-month-cell${isCurMonth ? ' today' : ''}"><span class="day-num">${MONTHS_SHORT[m]}</span></div>`;
        }
    } else {
        const daysInMonth = new Date(APP.currentYear, APP.currentMonth + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(APP.currentYear, APP.currentMonth, d);
            const isToday = isSameDay(dt, today);
            const isWe = dt.getDay() === 0 || dt.getDay() === 6;
            html += `<div class="htimeline-day-cell${isToday ? ' today' : ''}${isWe ? ' weekend' : ''}"><span class="day-letter">${DAYS_SHORT[dt.getDay()].charAt(0)}</span><span class="day-num">${d}</span></div>`;
        }
    }
    return html;
}

// ─── Timeline Renderer (reusable) ────────────────
function renderTimeline(container, events, options = {}) {
    events = events.sort((a,b) => new Date(a.start)-new Date(b.start));
    const today = new Date();
    const isYearView = APP.currentView === 'year';
    const timeCtx = getTimeContext(today, isYearView);

    let html = `<div class="htimeline-header">`;
    html += `<div class="htimeline-label-col">Projets / Actions</div>`;
    html += `<div class="htimeline-days-wrap">`;
    html += renderTimelineHeader(today, isYearView);
    html += `</div></div><div class="htimeline-body">`;

    if (events.length === 0) {
        html += `<div class="htimeline-empty"><i class="ri-calendar-todo-fill"></i><p>Aucune action planifiée</p><small>Cliquez sur "Ajouter" pour créer votre première action</small></div>`;
    } else {
        events.forEach(evt => {
            html += renderTimelineRow(evt, timeCtx, today);
        });
    }
    html += `</div>`;
    container.innerHTML = html;
    bindTimelineEvents(container);
}

function renderTimelineRow(evt, ctx, today, compact = false) {
    const barColor = evt.barColor || CATEGORIES[evt.category]?.color || '#8b5cf6';

    let html = `<div class="htimeline-row${compact ? ' htimeline-row-compact' : ''}" data-event-id="${evt.id}">`;

    // Label col
    html += `<div class="htimeline-row-label" data-event-id="${evt.id}">`;
    html += `<div class="htimeline-row-brand ${evt.brand}"></div>`;
    html += `<div class="htimeline-row-info">`;
    html += `<div class="htimeline-row-title">${evt.name}</div>`;
    if (!compact) {
        const brandLabel = evt.brand==='picard'?'Picard':evt.brand==='eliot'?'Eliot':'P+E';
        html += `<div class="htimeline-row-meta">`;
        html += `<span class="htimeline-row-status ${evt.status}">${STATUS_LABELS[evt.status]}</span>`;
        html += `<span>${brandLabel}</span>`;
        html += `<span>${formatDateRange(evt.start, evt.end)}</span>`;
        html += `</div>`;
    }
    html += `</div>`;

    html += `</div>`;

    // Bars area
    html += `<div class="htimeline-bars-area">`;
    for (let i = 0; i < ctx.cellCount; i++) {
        if (ctx.isYearView) {
            html += `<div class="htimeline-bar-bg"></div>`;
        } else {
            const dt = new Date(APP.currentYear, APP.currentMonth, i + 1);
            const isWe = dt.getDay() === 0 || dt.getDay() === 6;
            html += `<div class="htimeline-bar-bg${isWe ? ' weekend' : ''}"></div>`;
        }
    }

    const startDate = new Date(evt.start);
    const endDate = evt.end ? new Date(evt.end) : startDate;

    if (endDate >= ctx.rangeStart && startDate <= ctx.rangeEnd) {
        const effStart = startDate < ctx.rangeStart ? ctx.rangeStart : startDate;
        const effEnd = endDate > ctx.rangeEnd ? ctx.rangeEnd : endDate;
        if (ctx.isYearView) {
            const dayStart = Math.floor((effStart - ctx.rangeStart) / 86400000);
            const dayEnd = Math.floor((effEnd - ctx.rangeStart) / 86400000);
            const leftPct = (dayStart / ctx.totalDays) * 100;
            const widthPct = Math.max(((dayEnd - dayStart + 1) / ctx.totalDays) * 100, (1 / ctx.totalDays) * 100);
            html += `<div class="htimeline-bar" style="left:${leftPct}%;width:${widthPct}%;background:linear-gradient(90deg,${hexToRgba(barColor,0.9)},${hexToRgba(barColor,0.4)});color:white;box-shadow:0 0 12px ${hexToRgba(barColor,0.35)}" data-event-id="${evt.id}"></div>`;
        } else {
            const effS = effStart.getDate();
            const effE = effEnd.getDate();
            const leftPct = ((effS - 1) / ctx.totalDays) * 100;
            const widthPct = Math.max(((effE - effS + 1) / ctx.totalDays) * 100, (1 / ctx.totalDays) * 100);
            html += `<div class="htimeline-bar" style="left:${leftPct}%;width:${widthPct}%;background:linear-gradient(90deg,${hexToRgba(barColor,0.9)},${hexToRgba(barColor,0.4)});color:white;box-shadow:0 0 12px ${hexToRgba(barColor,0.35)}" data-event-id="${evt.id}"></div>`;
        }
    }

    if (ctx.isCurrent) {
        let todayPos;
        if (ctx.isYearView) {
            const dayOfYear = Math.floor((today - ctx.rangeStart) / 86400000);
            todayPos = ((dayOfYear + 0.5) / ctx.totalDays) * 100;
        } else {
            todayPos = ((today.getDate() - 0.5) / ctx.totalDays) * 100;
        }
        html += `<div class="htimeline-past-overlay" style="width:${todayPos}%"></div>`;
        html += `<div class="htimeline-today-line" style="left:${todayPos}%"></div>`;
    }

    html += `</div></div>`;
    return html;
}

function bindTimelineEvents(container) {
    container.querySelectorAll('.htimeline-row-label').forEach(el => {
        el.addEventListener('click', () => openDetailPanel(el.dataset.eventId));
    });
    container.querySelectorAll('.htimeline-bar[data-event-id]').forEach(el => {
        el.addEventListener('click', e => { e.stopPropagation(); openDetailPanel(el.dataset.eventId); });
    });
}

// ─── All View = Timeline grouped by category ─────
function renderAllTimeline() {
    const today = new Date();
    const isYearView = APP.currentView === 'year';
    const timeCtx = getTimeContext(today, isYearView);

    let html = `<div class="htimeline-header">`;
    html += `<div class="htimeline-label-col">Vue Globale</div>`;
    html += `<div class="htimeline-days-wrap">`;
    html += renderTimelineHeader(today, isYearView);
    html += `</div></div><div class="htimeline-body">`;

    Object.entries(CATEGORIES).forEach(([key, cat]) => {
        let evts = APP.events.filter(e => e.category === key);
        if (APP.currentBrand !== 'all') evts = evts.filter(e => e.brand===APP.currentBrand || e.brand==='both');
        evts.sort((a,b) => new Date(a.start)-new Date(b.start));

        // Category header row
        html += `<div class="htimeline-cat-row" style="color:${cat.color}"><i class="${cat.icon}"></i><span>${cat.label}</span><span class="htimeline-cat-count">${evts.length}</span></div>`;

        evts.forEach(evt => {
            html += renderTimelineRow(evt, timeCtx, today, true);
        });

        if (evts.length === 0) {
            html += `<div style="padding:8px 20px 8px 40px;font-size:12px;color:var(--text-muted)">Aucune action</div>`;
        }
    });

    html += `</div>`;
    DOM.allTimelineContainer.innerHTML = html;
    bindTimelineEvents(DOM.allTimelineContainer);
}

// ─── Detail Panel ────────────────────────────────
function initDetailPanel() { DOM.detailClose.addEventListener('click', closeDetailPanel); }
function closeDetailPanel() { DOM.detailPanel.classList.add('hidden'); }

function openDetailPanel(eventId) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt) return;

    const cat = CATEGORIES[evt.category];
    const tasks = evt.tasks || [];
    const { total, done } = countTasks(tasks);
    const pct = total>0 ? Math.round((done/total)*100) : 0;
    const brandLabel = evt.brand==='picard'?'Picard Serrures':evt.brand==='eliot'?'Eliot':'Picard + Eliot';
    const barColor = evt.barColor || cat.color;

    DOM.detailTitle.textContent = evt.name;
    let html = '';

    // Info
    html += `<div class="detail-section"><div class="detail-section-title">Informations</div><div class="detail-info-grid">`;
    html += `<div class="detail-info-item"><label>Catégorie</label><span style="color:${cat.color}"><i class="${cat.icon}" style="margin-right:6px"></i>${cat.label}</span></div>`;
    html += `<div class="detail-info-item"><label>Marque</label><span>${brandLabel}</span></div>`;
    html += `<div class="detail-info-item"><label>Dates</label><span>${formatDateRange(evt.start,evt.end)}</span></div>`;
    html += `<div class="detail-info-item"><label>Statut</label><span class="htimeline-row-status ${evt.status}" style="display:inline-block">${STATUS_LABELS[evt.status]}</span></div>`;
    html += `<div class="detail-info-item"><label>Priorité</label><span style="display:flex;align-items:center;gap:6px"><span class="priority-indicator ${evt.priority}"></span>${evt.priority.charAt(0).toUpperCase()+evt.priority.slice(1)}</span></div>`;
    html += `<div class="detail-info-item"><label>Couleur barre</label><span style="display:flex;align-items:center;gap:8px"><span style="width:20px;height:20px;border-radius:6px;background:${barColor};box-shadow:0 0 8px ${hexToRgba(barColor,0.4)}"></span>${barColor}</span></div>`;
    html += `</div></div>`;

    if (evt.desc) {
        html += `<div class="detail-section"><div class="detail-section-title">Description</div><div class="detail-desc">${evt.desc}</div></div>`;
    }

    // Tasks section
    html += `<div class="detail-section"><div class="detail-section-title">Tâches (${done}/${total})</div>`;
    if (total > 0) {
        html += `<div class="detail-task-progress"><div class="detail-task-progress-bar"><div class="detail-task-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,${barColor},${hexToRgba(barColor,0.6)})"></div></div><span class="detail-task-progress-label">${pct}%</span></div>`;
    }

    html += `<div class="detail-tasks" style="margin-top:12px">`;
    tasks.forEach(task => {
        html += renderDetailTask(task, evt.id);
    });
    html += `</div>`;

    // Add task
    html += `<div class="detail-task-add"><input type="text" placeholder="Nouvelle tâche..." id="detailNewTask" data-eid="${evt.id}"><input type="text" placeholder="Responsable..." id="detailNewAssignee" class="assignee-input" data-eid="${evt.id}"><button id="detailAddTaskBtn" data-eid="${evt.id}"><i class="ri-add-line"></i></button></div>`;
    html += `</div>`;

    // Actions
    html += `<div style="display:flex;gap:8px;margin-top:20px"><button class="btn btn-primary" onclick="openEditModal('${evt.id}')" style="flex:1"><i class="ri-edit-line"></i> Modifier</button><button class="btn btn-danger" onclick="deleteEvent('${evt.id}')" style="flex:0"><i class="ri-delete-bin-6-line"></i></button></div>`;

    DOM.detailBody.innerHTML = html;
    DOM.detailPanel.classList.remove('hidden');
    bindDetailEvents(evt.id);
}

function renderDetailTask(task, eventId) {
    let html = `<div class="detail-task${task.done?' done':''}" data-tid="${task.id}" data-eid="${eventId}">`;
    html += `<div class="detail-task-checkbox" data-tid="${task.id}" data-eid="${eventId}">${task.done?'<i class="ri-check-line"></i>':''}</div>`;
    html += `<div class="detail-task-content"><div class="detail-task-text">${task.text}</div>`;
    if (task.assignee) html += `<div class="detail-task-assignee"><i class="ri-user-line"></i>${task.assignee}</div>`;
    html += `</div>`;
    html += `<div class="detail-task-actions">`;
    html += `<button class="detail-task-addsub" data-tid="${task.id}" data-eid="${eventId}" title="Ajouter sous-tâche"><i class="ri-node-tree"></i></button>`;
    html += `<button class="detail-task-delete" data-tid="${task.id}" data-eid="${eventId}"><i class="ri-close-line"></i></button>`;
    html += `</div></div>`;

    // Subtasks
    if (task.subtasks && task.subtasks.length > 0) {
        html += `<div class="detail-subtasks">`;
        task.subtasks.forEach(sub => {
            html += `<div class="detail-subtask${sub.done?' done':''}" data-sid="${sub.id}" data-tid="${task.id}" data-eid="${eventId}">`;
            html += `<div class="detail-subtask-checkbox" data-sid="${sub.id}" data-tid="${task.id}" data-eid="${eventId}">${sub.done?'<i class="ri-check-line"></i>':''}</div>`;
            html += `<div class="detail-subtask-content"><div class="detail-subtask-text">${sub.text}</div>`;
            if (sub.assignee) html += `<div class="detail-subtask-assignee"><i class="ri-user-line"></i>${sub.assignee}</div>`;
            html += `</div>`;
            html += `<button class="detail-subtask-delete" data-sid="${sub.id}" data-tid="${task.id}" data-eid="${eventId}"><i class="ri-close-line"></i></button>`;
            html += `</div>`;
        });
        html += `</div>`;
    }

    // Inline subtask add (hidden by default, shown when clicking addsub button)
    html += `<div class="detail-subtask-add" data-for-tid="${task.id}" data-eid="${eventId}" style="display:none">`;
    html += `<input type="text" placeholder="Sous-tâche..." class="subtask-text-input"><input type="text" placeholder="Responsable..." class="assignee-input subtask-assignee-input"><button class="subtask-add-btn"><i class="ri-add-line"></i></button>`;
    html += `</div>`;

    return html;
}

function bindDetailEvents(eventId) {
    // Toggle task
    DOM.detailBody.querySelectorAll('.detail-task-checkbox').forEach(cb => {
        cb.addEventListener('click', e => { e.stopPropagation(); toggleTask(cb.dataset.eid, cb.dataset.tid); });
    });
    // Toggle subtask
    DOM.detailBody.querySelectorAll('.detail-subtask-checkbox').forEach(cb => {
        cb.addEventListener('click', e => { e.stopPropagation(); toggleSubtask(cb.dataset.eid, cb.dataset.tid, cb.dataset.sid); });
    });
    // Delete task
    DOM.detailBody.querySelectorAll('.detail-task-delete').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); removeTask(btn.dataset.eid, btn.dataset.tid); });
    });
    // Delete subtask
    DOM.detailBody.querySelectorAll('.detail-subtask-delete').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); removeSubtask(btn.dataset.eid, btn.dataset.tid, btn.dataset.sid); });
    });
    // Show subtask add
    DOM.detailBody.querySelectorAll('.detail-task-addsub').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const addRow = DOM.detailBody.querySelector(`.detail-subtask-add[data-for-tid="${btn.dataset.tid}"]`);
            if (addRow) {
                addRow.style.display = addRow.style.display === 'none' ? 'flex' : 'none';
                if (addRow.style.display === 'flex') addRow.querySelector('.subtask-text-input').focus();
            }
        });
    });
    // Add subtask
    DOM.detailBody.querySelectorAll('.subtask-add-btn').forEach(btn => {
        const row = btn.closest('.detail-subtask-add');
        const doAdd = () => {
            const text = row.querySelector('.subtask-text-input').value.trim();
            if (!text) return;
            const assignee = row.querySelector('.subtask-assignee-input').value.trim();
            addSubtask(row.dataset.eid, row.dataset.forTid, text, assignee);
        };
        btn.addEventListener('click', doAdd);
        row.querySelector('.subtask-text-input').addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); doAdd(); } });
    });
    // Add task
    const addBtn = $('#detailAddTaskBtn');
    const addInput = $('#detailNewTask');
    const addAssignee = $('#detailNewAssignee');
    if (addBtn && addInput) {
        const doAdd = () => {
            const text = addInput.value.trim();
            if (!text) return;
            const assignee = addAssignee ? addAssignee.value.trim() : '';
            addTask(eventId, text, assignee);
            addInput.value = ''; if (addAssignee) addAssignee.value = '';
        };
        addBtn.addEventListener('click', doAdd);
        addInput.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); doAdd(); } });
    }
}

function toggleTask(eid, tid) {
    const evt = APP.events.find(e=>e.id===eid); if (!evt) return;
    const task = (evt.tasks||[]).find(t=>t.id===tid); if (!task) return;
    task.done = !task.done;
    saveData(); openDetailPanel(eid); render();
}

function toggleSubtask(eid, tid, sid) {
    const evt = APP.events.find(e=>e.id===eid); if (!evt) return;
    const task = (evt.tasks||[]).find(t=>t.id===tid); if (!task) return;
    const sub = (task.subtasks||[]).find(s=>s.id===sid); if (!sub) return;
    sub.done = !sub.done;
    saveData(); openDetailPanel(eid); render();
}

function removeTask(eid, tid) {
    const evt = APP.events.find(e=>e.id===eid); if (!evt) return;
    evt.tasks = (evt.tasks||[]).filter(t=>t.id!==tid);
    saveData(); openDetailPanel(eid); render(); showToast('Tâche supprimée','info');
}

function removeSubtask(eid, tid, sid) {
    const evt = APP.events.find(e=>e.id===eid); if (!evt) return;
    const task = (evt.tasks||[]).find(t=>t.id===tid); if (!task) return;
    task.subtasks = (task.subtasks||[]).filter(s=>s.id!==sid);
    saveData(); openDetailPanel(eid); render(); showToast('Sous-tâche supprimée','info');
}

function addTask(eid, text, assignee) {
    const evt = APP.events.find(e=>e.id===eid); if (!evt) return;
    if (!evt.tasks) evt.tasks = [];
    evt.tasks.push({ id: tskId(), text, done: false, assignee: assignee||'', subtasks: [] });
    saveData(); openDetailPanel(eid); render(); showToast('Tâche ajoutée','success');
}

function addSubtask(eid, tid, text, assignee) {
    const evt = APP.events.find(e=>e.id===eid); if (!evt) return;
    const task = (evt.tasks||[]).find(t=>t.id===tid); if (!task) return;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({ id: tskId(), text, done: false, assignee: assignee||'' });
    saveData(); openDetailPanel(eid); render(); showToast('Sous-tâche ajoutée','success');
}

function deleteEvent(eventId) {
    APP.events = APP.events.filter(e=>e.id!==eventId);
    saveData(); closeDetailPanel(); render(); showToast('Événement supprimé','info');
}

// ─── KPI ─────────────────────────────────────────
function renderKPI() { renderKPICards(); renderKPICharts(); renderUpcomingList(); }

function renderKPICards() {
    const events = APP.currentBrand==='all'?APP.events:APP.events.filter(e=>e.brand===APP.currentBrand||e.brand==='both');
    const total = events.length;
    const inProgress = events.filter(e=>e.status==='in-progress').length;
    const completed = events.filter(e=>e.status==='completed').length;
    const planned = events.filter(e=>e.status==='planned').length;
    const urgent = events.filter(e=>e.priority==='urgent').length;
    let totalTasks=0, doneTasks=0;
    events.forEach(e => { const c=countTasks(e.tasks); totalTasks+=c.total; doneTasks+=c.done; });
    const taskPct = totalTasks>0?Math.round((doneTasks/totalTasks)*100):0;

    const cards = [
        { icon:'ri-list-check-3', color:'#8b5cf6', value:total, label:'Actions totales', bg:'rgba(139,92,246,0.12)' },
        { icon:'ri-loader-4-fill', color:'#3b82f6', value:inProgress, label:'En cours', bg:'rgba(59,130,246,0.12)' },
        { icon:'ri-check-double-fill', color:'#10b981', value:completed, label:'Terminées', bg:'rgba(16,185,129,0.12)' },
        { icon:'ri-calendar-schedule-fill', color:'#f59e0b', value:planned, label:'Planifiées', bg:'rgba(245,158,11,0.12)' },
        { icon:'ri-alarm-warning-fill', color:'#ef4444', value:urgent, label:'Urgentes', bg:'rgba(239,68,68,0.12)' },
        { icon:'ri-checkbox-circle-fill', color:'#06b6d4', value:`${taskPct}%`, label:`Tâches (${doneTasks}/${totalTasks})`, bg:'rgba(6,182,212,0.12)' },
    ];
    $('#kpiCards').innerHTML = cards.map(c=>`<div class="kpi-card"><div class="kpi-card-icon" style="background:${c.bg};color:${c.color}"><i class="${c.icon}"></i></div><div class="kpi-card-value" style="color:${c.color}">${c.value}</div><div class="kpi-card-label">${c.label}</div></div>`).join('');
}

function renderKPICharts() {
    Object.values(APP.charts).forEach(c=>{if(c&&c.destroy)c.destroy()});
    APP.charts={};
    const events = APP.currentBrand==='all'?APP.events:APP.events.filter(e=>e.brand===APP.currentBrand||e.brand==='both');

    // --- Shared stylized options ---
    const glowGridColor = 'rgba(255,255,255,0.06)';
    const glowTickColor = '#6b7094';
    const styledScales = (extra)=>({x:{grid:{color:glowGridColor,lineWidth:1},ticks:{color:glowTickColor,font:{size:10,weight:'600'}},border:{color:'rgba(255,255,255,0.08)'}},y:{grid:{color:glowGridColor,lineWidth:1},ticks:{color:glowTickColor,font:{size:10},stepSize:1},border:{color:'rgba(255,255,255,0.08)'},beginAtZero:true,...(extra||{})}});
    const styledTooltip = {backgroundColor:'rgba(15,16,30,0.95)',borderColor:'rgba(255,255,255,0.12)',borderWidth:1,titleFont:{size:12,weight:'700'},bodyFont:{size:11},padding:12,cornerRadius:8,displayColors:true,boxPadding:4};
    const styledLegend = (pos)=>({position:pos||'bottom',labels:{color:'#a0a3bd',padding:16,font:{size:11,weight:'600'},usePointStyle:true,pointStyleWidth:10}});

    // Helper: rich gradient
    function makeGrad(ctx,color,opacity1,opacity2,h){
        const g=ctx.createLinearGradient(0,0,0,h||250);
        g.addColorStop(0,color.replace('1)',opacity1+')').replace('rgb','rgba'));
        g.addColorStop(0.6,color.replace('1)',((opacity1+opacity2)/2)+')').replace('rgb','rgba'));
        g.addColorStop(1,color.replace('1)',opacity2+')').replace('rgb','rgba'));
        return g;
    }

    // 1. Category Bar Chart — gradient bars
    const catCounts={}; Object.keys(CATEGORIES).forEach(k=>catCounts[k]=0); events.forEach(e=>{if(catCounts[e.category]!==undefined)catCounts[e.category]++});
    const ctxCat=$('#chartCategory').getContext('2d');
    const catColors=Object.keys(CATEGORIES).map(k=>CATEGORIES[k].color);
    const catGrads=catColors.map(c=>{const g=ctxCat.createLinearGradient(0,0,0,250);g.addColorStop(0,c+'cc');g.addColorStop(1,c+'15');return g;});
    APP.charts.category = new Chart(ctxCat,{type:'bar',data:{labels:Object.keys(CATEGORIES).map(k=>CATEGORIES[k].label),datasets:[{data:Object.values(catCounts),backgroundColor:catGrads,borderColor:catColors,borderWidth:2,borderRadius:10,borderSkipped:false,hoverBackgroundColor:catColors.map(c=>c+'ee')}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:styledTooltip},scales:styledScales(),animation:{duration:800,easing:'easeOutQuart'}}});

    // 2. Brand Doughnut — glow colors
    const brandCounts={picard:0,eliot:0,both:0}; events.forEach(e=>{if(brandCounts[e.brand]!==undefined)brandCounts[e.brand]++});
    APP.charts.brand = new Chart($('#chartBrand'),{type:'doughnut',data:{labels:['Picard','Eliot','Les deux'],datasets:[{data:[brandCounts.picard,brandCounts.eliot,brandCounts.both],backgroundColor:['rgba(59,130,246,0.75)','rgba(245,158,11,0.75)','rgba(167,139,250,0.75)'],borderColor:['#3b82f6','#f59e0b','#a78bfa'],borderWidth:3,hoverOffset:12,hoverBorderWidth:4,hoverBackgroundColor:['rgba(59,130,246,0.95)','rgba(245,158,11,0.95)','rgba(167,139,250,0.95)']}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:styledLegend(),tooltip:styledTooltip},animation:{animateRotate:true,duration:1000,easing:'easeOutQuart'}}});

    // 3. Monthly Evolution — rich gradient fill like reference
    const monthlyData=Array(12).fill(0); events.forEach(e=>{const d=new Date(e.start);if(d.getFullYear()===APP.currentYear)monthlyData[d.getMonth()]++});
    const ctx3=$('#chartTimeline').getContext('2d');
    const gradTimeline=ctx3.createLinearGradient(0,0,0,250);
    gradTimeline.addColorStop(0,'rgba(168,85,247,0.55)');
    gradTimeline.addColorStop(0.4,'rgba(139,92,246,0.3)');
    gradTimeline.addColorStop(0.7,'rgba(99,102,241,0.12)');
    gradTimeline.addColorStop(1,'rgba(99,102,241,0.01)');
    APP.charts.timeline = new Chart(ctx3,{type:'line',data:{labels:MONTHS_FR.map(m=>m.substring(0,3)),datasets:[{data:monthlyData,borderColor:'#a855f7',backgroundColor:gradTimeline,borderWidth:3.5,fill:true,tension:0.45,pointBackgroundColor:'#c084fc',pointBorderColor:'#1a1b26',pointBorderWidth:3,pointRadius:6,pointHoverRadius:10,pointHoverBackgroundColor:'#fff',pointHoverBorderColor:'#a855f7',pointHoverBorderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:styledTooltip},scales:styledScales(),animation:{duration:1000,easing:'easeOutQuart'}}});

    // 4. Status Polar — vivid colors
    const statusCounts={'planned':0,'in-progress':0,'completed':0,'cancelled':0}; events.forEach(e=>{if(statusCounts[e.status]!==undefined)statusCounts[e.status]++});
    APP.charts.status = new Chart($('#chartStatus'),{type:'polarArea',data:{labels:Object.values(STATUS_LABELS),datasets:[{data:Object.values(statusCounts),backgroundColor:['rgba(168,85,247,0.6)','rgba(59,130,246,0.6)','rgba(16,185,129,0.6)','rgba(239,68,68,0.6)'],borderColor:['#a855f7','#3b82f6','#10b981','#ef4444'],borderWidth:2.5,hoverBackgroundColor:['rgba(168,85,247,0.85)','rgba(59,130,246,0.85)','rgba(16,185,129,0.85)','rgba(239,68,68,0.85)']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:styledLegend(),tooltip:styledTooltip},scales:{r:{grid:{color:'rgba(255,255,255,0.06)'},ticks:{display:false},angleLines:{color:'rgba(255,255,255,0.05)'}}},animation:{duration:800,easing:'easeOutQuart'}}});

    // 5. Trafic & Leads Sites Web — ultra-stylized like reference image
    const trafficLeadsData = {
        picard_trafic:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        eliot_trafic:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        picard_leads:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        eliot_leads:    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    const ctxTL=$('#chartTrafficLeads').getContext('2d');
    // Rich gradients for each dataset
    const gradPicardT=ctxTL.createLinearGradient(0,0,0,320);
    gradPicardT.addColorStop(0,'rgba(59,130,246,0.50)');
    gradPicardT.addColorStop(0.4,'rgba(59,130,246,0.25)');
    gradPicardT.addColorStop(0.8,'rgba(99,102,241,0.08)');
    gradPicardT.addColorStop(1,'rgba(99,102,241,0.01)');
    const gradEliotT=ctxTL.createLinearGradient(0,0,0,320);
    gradEliotT.addColorStop(0,'rgba(245,158,11,0.45)');
    gradEliotT.addColorStop(0.4,'rgba(245,158,11,0.20)');
    gradEliotT.addColorStop(0.8,'rgba(251,191,36,0.06)');
    gradEliotT.addColorStop(1,'rgba(251,191,36,0.01)');
    const gradPicardL=ctxTL.createLinearGradient(0,0,0,320);
    gradPicardL.addColorStop(0,'rgba(96,165,250,0.35)');
    gradPicardL.addColorStop(0.5,'rgba(96,165,250,0.10)');
    gradPicardL.addColorStop(1,'rgba(96,165,250,0.01)');
    const gradEliotL=ctxTL.createLinearGradient(0,0,0,320);
    gradEliotL.addColorStop(0,'rgba(251,191,36,0.30)');
    gradEliotL.addColorStop(0.5,'rgba(251,191,36,0.08)');
    gradEliotL.addColorStop(1,'rgba(251,191,36,0.01)');
    APP.charts.trafficLeads = new Chart(ctxTL,{type:'line',data:{labels:MONTHS_FR.map(m=>m.substring(0,3)),datasets:[
        {label:'Trafic Picard',data:trafficLeadsData.picard_trafic,borderColor:'#3b82f6',backgroundColor:gradPicardT,borderWidth:3.5,fill:true,tension:0.45,pointBackgroundColor:'#60a5fa',pointBorderColor:'#1a1b26',pointBorderWidth:3,pointRadius:5,pointHoverRadius:9,pointHoverBackgroundColor:'#fff',pointHoverBorderColor:'#3b82f6',pointHoverBorderWidth:3,order:3},
        {label:'Trafic Eliot',data:trafficLeadsData.eliot_trafic,borderColor:'#f59e0b',backgroundColor:gradEliotT,borderWidth:3.5,fill:true,tension:0.45,pointBackgroundColor:'#fbbf24',pointBorderColor:'#1a1b26',pointBorderWidth:3,pointRadius:5,pointHoverRadius:9,pointHoverBackgroundColor:'#fff',pointHoverBorderColor:'#f59e0b',pointHoverBorderWidth:3,order:2},
        {label:'Leads Picard',data:trafficLeadsData.picard_leads,borderColor:'#93c5fd',backgroundColor:gradPicardL,borderWidth:2.5,fill:true,tension:0.45,pointBackgroundColor:'#93c5fd',pointBorderColor:'#1a1b26',pointBorderWidth:2,pointRadius:5,pointStyle:'diamond',pointHoverRadius:9,pointHoverBackgroundColor:'#fff',pointHoverBorderColor:'#93c5fd',yAxisID:'y1',order:1},
        {label:'Leads Eliot',data:trafficLeadsData.eliot_leads,borderColor:'#fde68a',backgroundColor:gradEliotL,borderWidth:2.5,fill:true,tension:0.45,pointBackgroundColor:'#fde68a',pointBorderColor:'#1a1b26',pointBorderWidth:2,pointRadius:5,pointStyle:'diamond',pointHoverRadius:9,pointHoverBackgroundColor:'#fff',pointHoverBorderColor:'#fde68a',yAxisID:'y1',order:0},
    ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:styledLegend(),tooltip:{...styledTooltip,callbacks:{label:function(ctx){return ctx.dataset.label+': '+ctx.parsed.y.toLocaleString('fr-FR')}}}},scales:{x:{grid:{color:glowGridColor},ticks:{color:glowTickColor,font:{size:11,weight:'600'}},border:{color:'rgba(255,255,255,0.08)'}},y:{position:'left',title:{display:true,text:'Trafic',color:'#6b7094',font:{size:11,weight:'700'}},grid:{color:glowGridColor},ticks:{color:glowTickColor,font:{size:10}},border:{color:'rgba(255,255,255,0.08)'}},y1:{position:'right',title:{display:true,text:'Leads',color:'#6b7094',font:{size:11,weight:'700'}},grid:{drawOnChartArea:false},ticks:{color:glowTickColor,font:{size:10}},border:{color:'rgba(255,255,255,0.08)'}}},animation:{duration:1200,easing:'easeOutQuart'}}});
}

function renderUpcomingList() {
    const today=new Date(); today.setHours(0,0,0,0);
    let events = APP.currentBrand==='all'?APP.events:APP.events.filter(e=>e.brand===APP.currentBrand||e.brand==='both');
    const upcoming = events.filter(e=>new Date(e.start)>=today&&e.status!=='completed'&&e.status!=='cancelled').sort((a,b)=>new Date(a.start)-new Date(b.start)).slice(0,6);
    const container=$('#upcomingList'); if(!container) return;
    container.innerHTML = upcoming.map(evt=>{
        const cat=CATEGORIES[evt.category];
        return `<div class="upcoming-item" data-event-id="${evt.id}" style="cursor:pointer"><div class="upcoming-dot" style="background:${cat.color};box-shadow:0 0 6px ${cat.color}60"></div><div class="upcoming-info"><div class="upcoming-title">${evt.name}</div><div class="upcoming-date">${formatDate(evt.start)}</div></div><div class="priority-indicator ${evt.priority}"></div></div>`;
    }).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">Aucune échéance</div>';
    container.querySelectorAll('.upcoming-item').forEach(item=>{item.addEventListener('click',()=>openDetailPanel(item.dataset.eventId))});
}

// ─── Budget ──────────────────────────────────────
function renderBudget() {
    let el=$('#budgetContainer'); if(!el){el=document.createElement('div');el.id='budgetContainer';el.className='budget-container';DOM.contentArea.appendChild(el);} el.classList.remove('hidden');
    const p=APP.budgets.picard||{allocated:0,spent:0}; const e=APP.budgets.eliot||{allocated:0,spent:0};
    const tA=p.allocated+e.allocated,tS=p.spent+e.spent,tR=tA-tS;
    const fmt=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
    const pctP=p.allocated>0?Math.round((p.spent/p.allocated)*100):0; const pctE=e.allocated>0?Math.round((e.spent/e.allocated)*100):0; const pctT=tA>0?Math.round((tS/tA)*100):0;

    el.innerHTML=`<div class="budget-total-card"><div class="budget-total-header"><i class="ri-money-euro-circle-fill"></i><h3>Budget Global Communication</h3></div><div class="budget-total-grid"><div class="budget-metric"><span class="budget-metric-label">Budget alloué</span><span class="budget-metric-value allocated">${fmt(tA)}</span></div><div class="budget-metric"><span class="budget-metric-label">Budget dépensé</span><span class="budget-metric-value spent">${fmt(tS)}</span></div><div class="budget-metric"><span class="budget-metric-label">Solde restant</span><span class="budget-metric-value remaining ${tR<0?'negative':''}">${fmt(tR)}</span></div></div><div class="budget-progress-container"><div class="budget-progress-bar"><div class="budget-progress-fill" style="width:${Math.min(pctT,100)}%"><div class="budget-progress-glow"></div></div></div><span class="budget-progress-label">${pctT}% utilisé</span></div></div><div class="budget-brands"><div class="budget-brand-card picard"><div class="budget-brand-header"><div class="budget-brand-dot picard"></div><h4>Picard Serrures</h4></div><div class="budget-fields"><div class="budget-field"><label>Budget alloué</label><div class="budget-input-wrap"><span class="budget-input-prefix">€</span><input type="number" class="budget-input" data-brand="picard" data-field="allocated" value="${p.allocated}" min="0" step="1000"></div></div><div class="budget-field"><label>Budget dépensé</label><div class="budget-input-wrap"><span class="budget-input-prefix">€</span><input type="number" class="budget-input" data-brand="picard" data-field="spent" value="${p.spent}" min="0" step="500"></div></div><div class="budget-field"><label>Solde</label><div class="budget-solde ${(p.allocated-p.spent)<0?'negative':''}">${fmt(p.allocated-p.spent)}</div></div></div><div class="budget-progress-container"><div class="budget-progress-bar picard"><div class="budget-progress-fill picard" style="width:${Math.min(pctP,100)}%"><div class="budget-progress-glow picard"></div></div></div><span class="budget-progress-label">${pctP}%</span></div></div><div class="budget-brand-card eliot"><div class="budget-brand-header"><div class="budget-brand-dot eliot"></div><h4>Eliot</h4></div><div class="budget-fields"><div class="budget-field"><label>Budget alloué</label><div class="budget-input-wrap"><span class="budget-input-prefix">€</span><input type="number" class="budget-input" data-brand="eliot" data-field="allocated" value="${e.allocated}" min="0" step="1000"></div></div><div class="budget-field"><label>Budget dépensé</label><div class="budget-input-wrap"><span class="budget-input-prefix">€</span><input type="number" class="budget-input" data-brand="eliot" data-field="spent" value="${e.spent}" min="0" step="500"></div></div><div class="budget-field"><label>Solde</label><div class="budget-solde ${(e.allocated-e.spent)<0?'negative':''}">${fmt(e.allocated-e.spent)}</div></div></div><div class="budget-progress-container"><div class="budget-progress-bar eliot"><div class="budget-progress-fill eliot" style="width:${Math.min(pctE,100)}%"><div class="budget-progress-glow eliot"></div></div></div><span class="budget-progress-label">${pctE}%</span></div></div></div><div class="budget-chart-container"><div class="chart-card wide"><h3>Répartition budgétaire</h3><canvas id="chartBudget" height="200"></canvas><div class="chart-glow" style="background:radial-gradient(ellipse,rgba(245,158,11,0.12),transparent)"></div></div></div>`;

    el.querySelectorAll('.budget-input').forEach(input=>{input.addEventListener('change',ev=>{const brand=ev.target.dataset.brand;const field=ev.target.dataset.field;if(!APP.budgets[brand])APP.budgets[brand]={allocated:0,spent:0};APP.budgets[brand][field]=parseFloat(ev.target.value)||0;saveData();renderBudget();showToast('Budget mis à jour','success')})});

    if(APP.charts.budget)APP.charts.budget.destroy();
    const chartEl=$('#chartBudget'); if(chartEl){APP.charts.budget=new Chart(chartEl,{type:'bar',data:{labels:['Picard Serrures','Eliot'],datasets:[{label:'Alloué',data:[p.allocated,e.allocated],backgroundColor:['rgba(59,130,246,0.5)','rgba(245,158,11,0.5)'],borderColor:['#3b82f6','#f59e0b'],borderWidth:2,borderRadius:8,borderSkipped:false},{label:'Dépensé',data:[p.spent,e.spent],backgroundColor:['rgba(59,130,246,0.2)','rgba(245,158,11,0.2)'],borderColor:['rgba(59,130,246,0.5)','rgba(245,158,11,0.5)'],borderWidth:2,borderRadius:8,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8b8da3',font:{size:11}}}},scales:{x:{grid:{color:'rgba(255,255,255,0.03)'},ticks:{color:'#555770'}},y:{grid:{color:'rgba(255,255,255,0.03)'},ticks:{color:'#555770',callback:v=>fmt(v)}}}}});}
}

// ─── Modal (Create / Edit) ───────────────────────
function initModal() {
    $('#addEventBtn').addEventListener('click', () => openAddModal());
    $('#modalClose').addEventListener('click', closeModal);
    $('#cancelBtn').addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', e => { if (e.target === DOM.modalOverlay) closeModal(); });
    DOM.eventForm.addEventListener('submit', handleFormSubmit);
    DOM.deleteEventBtn.addEventListener('click', handleDelete);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDetailPanel(); } });
    $('#addTaskBtn').addEventListener('click', addModalTask);
    $('#newTaskInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addModalTask(); } });
}

function addModalTask() {
    const input = $('#newTaskInput');
    const assigneeInput = $('#newTaskAssignee');
    const text = input.value.trim(); if (!text) return;
    const assignee = assigneeInput ? assigneeInput.value.trim() : '';
    APP.modalTasks.push({ id: tskId(), text, done: false, assignee, subtasks: [] });
    input.value = ''; if (assigneeInput) assigneeInput.value = '';
    renderModalTasks();
}

function addModalSubtask(parentIdx) {
    const row = DOM.tasksList.querySelector(`.subtask-add-form[data-pidx="${parentIdx}"]`);
    if (!row) return;
    const text = row.querySelector('.subtask-text-input').value.trim(); if (!text) return;
    const assignee = row.querySelector('.subtask-assignee-input').value.trim();
    if (!APP.modalTasks[parentIdx].subtasks) APP.modalTasks[parentIdx].subtasks = [];
    APP.modalTasks[parentIdx].subtasks.push({ id: tskId(), text, done: false, assignee });
    renderModalTasks();
}

function renderModalTasks() {
    let html = '';
    APP.modalTasks.forEach((t, i) => {
        html += `<div class="task-item-form"><span class="task-text">${t.text}</span>`;
        if (t.assignee) html += `<span class="task-assignee-badge"><i class="ri-user-line" style="margin-right:3px;font-size:9px"></i>${t.assignee}</span>`;
        html += `<button type="button" class="task-remove" data-idx="${i}"><i class="ri-close-line"></i></button></div>`;

        // Subtasks
        if (t.subtasks && t.subtasks.length > 0) {
            html += `<div class="task-subtasks-form">`;
            t.subtasks.forEach((s, si) => {
                html += `<div class="subtask-item-form"><span class="task-text">${s.text}</span>`;
                if (s.assignee) html += `<span class="task-assignee-badge" style="background:rgba(6,182,212,0.12);color:#06b6d4"><i class="ri-user-line" style="margin-right:2px;font-size:8px"></i>${s.assignee}</span>`;
                html += `<button type="button" class="task-remove" data-idx="${i}" data-sidx="${si}"><i class="ri-close-line"></i></button></div>`;
            });
            html += `</div>`;
        }

        // Subtask add
        html += `<div class="subtask-add-form" data-pidx="${i}"><input type="text" placeholder="Sous-tâche..." class="subtask-text-input"><input type="text" placeholder="Resp..." class="assignee-input subtask-assignee-input"><button type="button" class="subtask-modal-add-btn" data-pidx="${i}"><i class="ri-add-line"></i></button></div>`;
    });
    DOM.tasksList.innerHTML = html;

    // Bind remove
    DOM.tasksList.querySelectorAll('.task-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (btn.dataset.sidx !== undefined) {
                APP.modalTasks[idx].subtasks.splice(parseInt(btn.dataset.sidx), 1);
            } else {
                APP.modalTasks.splice(idx, 1);
            }
            renderModalTasks();
        });
    });

    // Bind subtask add
    DOM.tasksList.querySelectorAll('.subtask-modal-add-btn').forEach(btn => {
        btn.addEventListener('click', () => addModalSubtask(parseInt(btn.dataset.pidx)));
        const row = btn.closest('.subtask-add-form');
        row.querySelector('.subtask-text-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addModalSubtask(parseInt(btn.dataset.pidx)); } });
    });
}

function openAddModal() {
    APP.editingEventId = null;
    APP.modalTasks = [];
    DOM.modalTitle.textContent = 'Nouvel Événement';
    DOM.submitLabel.textContent = 'Créer';
    DOM.deleteEventBtn.classList.add('hidden');
    DOM.eventForm.reset();
    if (APP.currentSection !== 'kpi' && APP.currentSection !== 'all' && APP.currentSection !== 'budget') {
        $('#eventCategory').value = APP.currentSection;
    }
    const today = dateToStr(new Date());
    $('#eventStart').value = today;
    $('#eventEnd').value = today;
    $('#eventBarColor').value = CATEGORIES[$('#eventCategory').value]?.color || '#8b5cf6';
    $$('.color-swatch').forEach(s => s.classList.remove('active'));
    renderModalTasks();
    DOM.modalOverlay.classList.remove('hidden');
    setTimeout(() => $('#eventName').focus(), 100);
}

function openEditModal(eventId) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt) return;
    APP.editingEventId = eventId;
    APP.modalTasks = JSON.parse(JSON.stringify(evt.tasks || []));
    DOM.modalTitle.textContent = 'Modifier l\'Événement';
    DOM.submitLabel.textContent = 'Enregistrer';
    DOM.deleteEventBtn.classList.remove('hidden');
    $('#eventName').value = evt.name;
    $('#eventCategory').value = evt.category;
    $('#eventBrand').value = evt.brand;
    $('#eventStart').value = evt.start;
    $('#eventEnd').value = evt.end || '';
    $('#eventStatus').value = evt.status;
    $('#eventPriority').value = evt.priority;
    $('#eventDesc').value = evt.desc || '';
    $('#eventBarColor').value = evt.barColor || CATEGORIES[evt.category]?.color || '#8b5cf6';
    $$('.color-swatch').forEach(s => { s.classList.toggle('active', s.dataset.color === ($('#eventBarColor').value)); });
    renderModalTasks();
    DOM.modalOverlay.classList.remove('hidden');
}
window.openEditModal = openEditModal;
window.deleteEvent = deleteEvent;

function closeModal() { DOM.modalOverlay.classList.add('hidden'); APP.editingEventId = null; APP.modalTasks = []; }

function handleFormSubmit(e) {
    e.preventDefault();
    const data = {
        name: $('#eventName').value.trim(),
        category: $('#eventCategory').value,
        brand: $('#eventBrand').value,
        start: $('#eventStart').value,
        end: $('#eventEnd').value || $('#eventStart').value,
        status: $('#eventStatus').value,
        priority: $('#eventPriority').value,
        desc: $('#eventDesc').value.trim(),
        barColor: $('#eventBarColor').value,
        tasks: JSON.parse(JSON.stringify(APP.modalTasks)),
    };
    if (!data.name) return;

    if (APP.editingEventId) {
        const idx = APP.events.findIndex(e => e.id === APP.editingEventId);
        if (idx !== -1) { APP.events[idx] = { ...APP.events[idx], ...data }; showToast('Événement modifié','success'); }
    } else {
        data.id = genId();
        APP.events.push(data);
        showToast('Événement créé','success');
    }
    saveData(); closeModal(); render();
    if (APP.editingEventId) openDetailPanel(APP.editingEventId);
}

function handleDelete() { if (!APP.editingEventId) return; deleteEvent(APP.editingEventId); closeModal(); }

// ─── Toast ───────────────────────────────────────
function showToast(message, type='info') {
    const icons = { success:'ri-check-line', error:'ri-error-warning-line', info:'ri-information-line' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="${icons[type]||icons.info}"></i><span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.animation='toastOut 0.3s ease forwards'; setTimeout(()=>toast.remove(),300); }, 3000);
}
