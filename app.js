/* ============================================
   PICARD · ELIOT — Communication Dashboard
   Horizontal Timeline + Task Checklist
   ============================================ */

// ─── State ───────────────────────────────────────
const APP = {
    currentSection: 'plan-media',
    currentBrand: 'all',
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    editingEventId: null,
    events: [],
    budgets: {},
    charts: {},
    modalTasks: [], // temp tasks in the create/edit modal
};

// ─── Config ──────────────────────────────────────
const CATEGORIES = {
    'plan-media':      { label: 'Plan Média',       icon: 'ri-broadcast-fill',    color: '#8b5cf6' },
    'plan-digital':    { label: 'Plan Digital',      icon: 'ri-global-fill',       color: '#3b82f6' },
    'newsletters':     { label: 'Newsletters',       icon: 'ri-mail-send-fill',    color: '#06b6d4' },
    'reseaux-sociaux': { label: 'Réseaux Sociaux',   icon: 'ri-twitter-x-fill',    color: '#ec4899' },
    'salons-foires':   { label: 'Salons · Foires',   icon: 'ri-store-3-fill',      color: '#f59e0b' },
    'usine-interne':   { label: 'Usine · Interne',   icon: 'ri-building-4-fill',   color: '#10b981' },
    'produits':        { label: 'Produits',           icon: 'ri-box-3-fill',        color: '#f97316' },
    'ressources':      { label: 'Ressources',        icon: 'ri-folder-5-fill',     color: '#6366f1' },
};

const STATUS_LABELS = { 'planned': 'Planifié', 'in-progress': 'En cours', 'completed': 'Terminé', 'cancelled': 'Annulé' };
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

// ─── Helpers ─────────────────────────────────────
const generateId = () => 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
const taskId = () => 'tsk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function formatDateRange(start, end) {
    if (!end || start === end) return formatDate(start);
    return `${formatDate(start)} → ${formatDate(end)}`;
}
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function dateToStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Persistence ─────────────────────────────────
function saveData() {
    localStorage.setItem('picard_eliot_events_v2', JSON.stringify(APP.events));
    localStorage.setItem('picard_eliot_budgets', JSON.stringify(APP.budgets));
}

function loadData() {
    try {
        const evts = localStorage.getItem('picard_eliot_events_v2');
        if (evts) APP.events = JSON.parse(evts);
        const budgets = localStorage.getItem('picard_eliot_budgets');
        if (budgets) APP.budgets = JSON.parse(budgets);
    } catch(e) { console.warn('Load error:', e); }

    if (APP.events.length === 0) {
        APP.events = generateSampleEvents();
        saveData();
    }
    if (!APP.budgets || Object.keys(APP.budgets).length === 0) {
        APP.budgets = { picard: { allocated: 120000, spent: 45000 }, eliot: { allocated: 85000, spent: 28000 } };
        saveData();
    }
}

function generateSampleEvents() {
    const y = 2026;
    return [
        { id: generateId(), name: 'Campagne TV Picard Q1', category: 'plan-media', brand: 'picard', start: `${y}-01-15`, end: `${y}-02-28`, status: 'completed', priority: 'high', desc: 'Campagne nationale TV', tasks: [
            { id: taskId(), text: 'Brief agence', done: true },
            { id: taskId(), text: 'Validation storyboard', done: true },
            { id: taskId(), text: 'Tournage', done: true },
            { id: taskId(), text: 'Post-production', done: true },
        ]},
        { id: generateId(), name: 'Campagne Radio Eliot', category: 'plan-media', brand: 'eliot', start: `${y}-03-01`, end: `${y}-03-31`, status: 'in-progress', priority: 'high', desc: 'Spots radio stations nationales', tasks: [
            { id: taskId(), text: 'Écriture script', done: true },
            { id: taskId(), text: 'Enregistrement voix off', done: true },
            { id: taskId(), text: 'Mixage audio', done: false },
            { id: taskId(), text: 'Diffusion', done: false },
        ]},
        { id: generateId(), name: 'Refonte site Picard', category: 'plan-digital', brand: 'picard', start: `${y}-02-01`, end: `${y}-04-30`, status: 'in-progress', priority: 'urgent', desc: 'Refonte complète du site web', tasks: [
            { id: taskId(), text: 'Audit UX actuel', done: true },
            { id: taskId(), text: 'Wireframes', done: true },
            { id: taskId(), text: 'Maquettes Figma', done: true },
            { id: taskId(), text: 'Développement front', done: false },
            { id: taskId(), text: 'Intégration CMS', done: false },
            { id: taskId(), text: 'Tests & recette', done: false },
            { id: taskId(), text: 'Mise en production', done: false },
        ]},
        { id: generateId(), name: 'SEO / SEA Eliot', category: 'plan-digital', brand: 'eliot', start: `${y}-03-10`, end: `${y}-06-30`, status: 'planned', priority: 'medium', desc: 'Stratégie SEO et Google Ads', tasks: [
            { id: taskId(), text: 'Audit SEO', done: false },
            { id: taskId(), text: 'Stratégie mots-clés', done: false },
            { id: taskId(), text: 'Setup campagnes Ads', done: false },
        ]},
        { id: generateId(), name: 'NL Mars - Nouveautés', category: 'newsletters', brand: 'both', start: `${y}-03-15`, end: `${y}-03-15`, status: 'planned', priority: 'medium', desc: 'Newsletter mensuelle mars', tasks: [
            { id: taskId(), text: 'Rédaction contenu', done: false },
            { id: taskId(), text: 'Design template', done: false },
            { id: taskId(), text: 'Envoi test', done: false },
            { id: taskId(), text: 'Envoi final', done: false },
        ]},
        { id: generateId(), name: 'NL Avril - Promo Printemps', category: 'newsletters', brand: 'picard', start: `${y}-04-01`, end: `${y}-04-01`, status: 'planned', priority: 'low', desc: 'Offres spéciales printemps', tasks: [] },
        { id: generateId(), name: 'Post LinkedIn - Salon', category: 'reseaux-sociaux', brand: 'both', start: `${y}-03-20`, end: `${y}-03-20`, status: 'planned', priority: 'medium', desc: 'Annonce salon sécurité', tasks: [
            { id: taskId(), text: 'Rédaction post', done: false },
            { id: taskId(), text: 'Création visuel', done: false },
            { id: taskId(), text: 'Publication', done: false },
        ]},
        { id: generateId(), name: 'Campagne Instagram Eliot', category: 'reseaux-sociaux', brand: 'eliot', start: `${y}-03-05`, end: `${y}-03-25`, status: 'in-progress', priority: 'high', desc: 'Série de posts produits', tasks: [
            { id: taskId(), text: 'Planning éditorial', done: true },
            { id: taskId(), text: 'Shooting photos', done: true },
            { id: taskId(), text: 'Création posts Sem 1', done: true },
            { id: taskId(), text: 'Création posts Sem 2', done: false },
            { id: taskId(), text: 'Création posts Sem 3', done: false },
        ]},
        { id: generateId(), name: 'Salon Sécurité Paris', category: 'salons-foires', brand: 'both', start: `${y}-04-15`, end: `${y}-04-18`, status: 'planned', priority: 'urgent', desc: 'Stand commun Picard + Eliot', tasks: [
            { id: taskId(), text: 'Réservation emplacement', done: true },
            { id: taskId(), text: 'Design stand', done: false },
            { id: taskId(), text: 'Commande PLV', done: false },
            { id: taskId(), text: 'Organisation logistique', done: false },
            { id: taskId(), text: 'Briefing équipe', done: false },
        ]},
        { id: generateId(), name: 'Foire de Lyon', category: 'salons-foires', brand: 'picard', start: `${y}-05-10`, end: `${y}-05-14`, status: 'planned', priority: 'high', desc: 'Présence Picard', tasks: [] },
        { id: generateId(), name: 'Visite usine presse', category: 'usine-interne', brand: 'picard', start: `${y}-03-25`, end: `${y}-03-25`, status: 'planned', priority: 'medium', desc: 'Accueil journalistes', tasks: [
            { id: taskId(), text: 'Liste invités presse', done: false },
            { id: taskId(), text: 'Parcours de visite', done: false },
            { id: taskId(), text: 'Dossier de presse', done: false },
        ]},
        { id: generateId(), name: 'Team Building Com', category: 'usine-interne', brand: 'both', start: `${y}-04-05`, end: `${y}-04-05`, status: 'planned', priority: 'low', desc: 'Journée team building', tasks: [] },
        { id: generateId(), name: 'Lancement Serrure V3', category: 'produits', brand: 'picard', start: `${y}-05-01`, end: `${y}-05-15`, status: 'planned', priority: 'urgent', desc: 'Lancement serrure connectée V3', tasks: [
            { id: taskId(), text: 'Kit de lancement', done: false },
            { id: taskId(), text: 'Communiqué de presse', done: false },
            { id: taskId(), text: 'Vidéo démo', done: false },
            { id: taskId(), text: 'Emailing distributeurs', done: false },
        ]},
        { id: generateId(), name: 'Packaging Eliot refonte', category: 'produits', brand: 'eliot', start: `${y}-03-01`, end: `${y}-04-15`, status: 'in-progress', priority: 'high', desc: 'Nouveau packaging', tasks: [
            { id: taskId(), text: 'Brief créatif', done: true },
            { id: taskId(), text: 'Propositions DA', done: true },
            { id: taskId(), text: 'Validation', done: false },
            { id: taskId(), text: 'BAT impression', done: false },
        ]},
        { id: generateId(), name: 'Shooting photo produits', category: 'ressources', brand: 'both', start: `${y}-03-18`, end: `${y}-03-19`, status: 'in-progress', priority: 'high', desc: 'Photos studio nouvelles gammes', tasks: [
            { id: taskId(), text: 'Sélection produits', done: true },
            { id: taskId(), text: 'Booking photographe', done: true },
            { id: taskId(), text: 'Shooting jour 1', done: false },
            { id: taskId(), text: 'Shooting jour 2', done: false },
            { id: taskId(), text: 'Retouches', done: false },
        ]},
        { id: generateId(), name: 'Vidéo corporate Picard', category: 'ressources', brand: 'picard', start: `${y}-04-20`, end: `${y}-05-10`, status: 'planned', priority: 'medium', desc: 'Film institutionnel', tasks: [] },
        { id: generateId(), name: 'Presse spécialisée Q2', category: 'plan-media', brand: 'both', start: `${y}-04-01`, end: `${y}-06-30`, status: 'planned', priority: 'medium', desc: 'Insertions presse BTP', tasks: [] },
        { id: generateId(), name: 'Webinar Sécurité connectée', category: 'plan-digital', brand: 'both', start: `${y}-03-28`, end: `${y}-03-28`, status: 'planned', priority: 'medium', desc: 'Webinar partenaires', tasks: [
            { id: taskId(), text: 'Programme & speakers', done: false },
            { id: taskId(), text: 'Landing page inscription', done: false },
            { id: taskId(), text: 'Emailing invitation', done: false },
        ]},
    ];
}

// ─── DOM ─────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {};
function cacheDom() {
    DOM.sidebar = $('#sidebar');
    DOM.mainContent = $('#mainContent');
    DOM.pageTitle = $('#pageTitle');
    DOM.pageBadge = $('#pageBadge');
    DOM.monthLabel = $('#monthLabel');
    DOM.htimelineContainer = $('#htimelineContainer');
    DOM.kpiContainer = $('#kpiContainer');
    DOM.allContainer = $('#allContainer');
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
}

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    loadData();
    initNavigation();
    initMonthNav();
    initBrandFilter();
    initModal();
    initMenuToggle();
    initDetailPanel();
    render();
});

// ─── Navigation ──────────────────────────────────
function initNavigation() {
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
        APP.currentMonth--;
        if (APP.currentMonth < 0) { APP.currentMonth = 11; APP.currentYear--; }
        render();
    });
    $('#nextMonth').addEventListener('click', () => {
        APP.currentMonth++;
        if (APP.currentMonth > 11) { APP.currentMonth = 0; APP.currentYear++; }
        render();
    });
    $('#todayBtn').addEventListener('click', () => {
        const now = new Date();
        APP.currentMonth = now.getMonth();
        APP.currentYear = now.getFullYear();
        render();
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

// ─── Filters ─────────────────────────────────────
function getFilteredEvents() {
    let evts = [...APP.events];
    if (APP.currentSection !== 'kpi' && APP.currentSection !== 'all' && APP.currentSection !== 'budget') {
        evts = evts.filter(e => e.category === APP.currentSection);
    }
    if (APP.currentBrand !== 'all') {
        evts = evts.filter(e => e.brand === APP.currentBrand || e.brand === 'both');
    }
    return evts;
}

// ─── Render ──────────────────────────────────────
function render() {
    updatePageTitle();
    updateMonthLabel();

    DOM.htimelineContainer.classList.add('hidden');
    DOM.kpiContainer.classList.add('hidden');
    DOM.allContainer.classList.add('hidden');
    const budgetEl = $('#budgetContainer');
    if (budgetEl) budgetEl.classList.add('hidden');

    if (APP.currentSection === 'kpi') {
        DOM.kpiContainer.classList.remove('hidden');
        renderKPI();
    } else if (APP.currentSection === 'all') {
        DOM.allContainer.classList.remove('hidden');
        renderAllView();
    } else if (APP.currentSection === 'budget') {
        renderBudget();
    } else {
        DOM.htimelineContainer.classList.remove('hidden');
        renderHorizontalTimeline();
    }
}

function updatePageTitle() {
    const s = APP.currentSection;
    if (s === 'kpi') {
        DOM.pageTitle.textContent = 'Indicateurs KPI';
        DOM.pageBadge.textContent = 'Analytics';
        DOM.pageBadge.style.background = 'rgba(16,185,129,0.12)'; DOM.pageBadge.style.color = '#10b981';
    } else if (s === 'all') {
        DOM.pageTitle.textContent = 'Vue Globale';
        DOM.pageBadge.textContent = 'Toutes catégories';
        DOM.pageBadge.style.background = 'rgba(167,139,250,0.12)'; DOM.pageBadge.style.color = '#a78bfa';
    } else if (s === 'budget') {
        DOM.pageTitle.textContent = 'Budget';
        DOM.pageBadge.textContent = 'Finances';
        DOM.pageBadge.style.background = 'rgba(245,158,11,0.12)'; DOM.pageBadge.style.color = '#f59e0b';
    } else {
        const cat = CATEGORIES[s];
        DOM.pageTitle.textContent = cat.label;
        DOM.pageBadge.textContent = 'Timeline';
        DOM.pageBadge.style.background = `${cat.color}1a`; DOM.pageBadge.style.color = cat.color;
    }
}

function updateMonthLabel() {
    DOM.monthLabel.textContent = `${MONTHS_FR[APP.currentMonth]} ${APP.currentYear}`;
}

// ─── Horizontal Timeline ─────────────────────────
function renderHorizontalTimeline() {
    const events = getFilteredEvents().sort((a, b) => new Date(a.start) - new Date(b.start));
    const daysInMonth = new Date(APP.currentYear, APP.currentMonth + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getMonth() === APP.currentMonth && today.getFullYear() === APP.currentYear;

    // Header with days
    let html = `<div class="htimeline-header">`;
    html += `<div class="htimeline-label-col">Projets / Actions</div>`;
    html += `<div class="htimeline-days-wrap">`;

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(APP.currentYear, APP.currentMonth, d);
        const isToday = isSameDay(date, today);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const dayLetter = DAYS_SHORT[date.getDay()].charAt(0);
        html += `<div class="htimeline-day-cell${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}">`;
        html += `<span class="day-letter">${dayLetter}</span>`;
        html += `<span class="day-num">${d}</span>`;
        html += `</div>`;
    }
    html += `</div></div>`;

    // Body
    html += `<div class="htimeline-body">`;

    if (events.length === 0) {
        html += `<div class="htimeline-empty">
            <i class="ri-calendar-todo-fill"></i>
            <p>Aucune action planifiée</p>
            <small>Cliquez sur "Ajouter" pour créer votre première action</small>
        </div>`;
    } else {
        events.forEach(evt => {
            const tasks = evt.tasks || [];
            const tasksDone = tasks.filter(t => t.done).length;
            const tasksTotal = tasks.length;
            const taskPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
            const brandLabel = evt.brand === 'picard' ? 'Picard' : evt.brand === 'eliot' ? 'Eliot' : 'P+E';

            html += `<div class="htimeline-row" data-event-id="${evt.id}">`;

            // Label
            html += `<div class="htimeline-row-label" data-event-id="${evt.id}">`;
            html += `<div class="htimeline-row-brand ${evt.brand}"></div>`;
            html += `<div class="htimeline-row-info">`;
            html += `<div class="htimeline-row-title">${evt.name}</div>`;
            html += `<div class="htimeline-row-meta">`;
            html += `<span class="htimeline-row-status ${evt.status}">${STATUS_LABELS[evt.status]}</span>`;
            html += `<span>${brandLabel}</span>`;
            html += `<span>${formatDateRange(evt.start, evt.end)}</span>`;
            html += `</div></div>`;

            // Task progress mini
            if (tasksTotal > 0) {
                html += `<div class="htimeline-row-tasks">`;
                html += `<div class="task-progress-mini"><div class="task-progress-mini-fill" style="width:${taskPct}%"></div></div>`;
                html += `<span class="task-progress-label">${tasksDone}/${tasksTotal}</span>`;
                html += `</div>`;
            }

            html += `</div>`; // end label

            // Bars area
            html += `<div class="htimeline-bars-area">`;

            // Background day cells
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(APP.currentYear, APP.currentMonth, d);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                html += `<div class="htimeline-bar-bg${isWeekend ? ' weekend' : ''}"></div>`;
            }

            // Bar
            const startDate = new Date(evt.start);
            const endDate = evt.end ? new Date(evt.end) : startDate;
            const monthStart = new Date(APP.currentYear, APP.currentMonth, 1);
            const monthEnd = new Date(APP.currentYear, APP.currentMonth, daysInMonth);

            if (endDate >= monthStart && startDate <= monthEnd) {
                const effectiveStart = startDate < monthStart ? 1 : startDate.getDate();
                const effectiveEnd = endDate > monthEnd ? daysInMonth : endDate.getDate();
                const leftPct = ((effectiveStart - 1) / daysInMonth) * 100;
                const widthPct = Math.max(((effectiveEnd - effectiveStart + 1) / daysInMonth) * 100, (1 / daysInMonth) * 100);

                html += `<div class="htimeline-bar brand-${evt.brand}" style="left:${leftPct}%;width:${widthPct}%" data-event-id="${evt.id}"></div>`;
            }

            // Today line
            if (isCurrentMonth) {
                const todayPos = ((today.getDate() - 0.5) / daysInMonth) * 100;
                html += `<div class="htimeline-today-line" style="left:${todayPos}%"></div>`;
            }

            html += `</div>`; // end bars area
            html += `</div>`; // end row
        });
    }

    html += `</div>`; // end body

    DOM.htimelineContainer.innerHTML = html;

    // Click handlers — label opens detail panel, bar opens detail panel
    DOM.htimelineContainer.querySelectorAll('.htimeline-row-label').forEach(label => {
        label.addEventListener('click', (e) => {
            openDetailPanel(label.dataset.eventId);
        });
    });

    DOM.htimelineContainer.querySelectorAll('.htimeline-bar[data-event-id]').forEach(bar => {
        bar.addEventListener('click', (e) => {
            e.stopPropagation();
            openDetailPanel(bar.dataset.eventId);
        });
    });
}

// ─── Detail Panel (right side) ───────────────────
function initDetailPanel() {
    DOM.detailClose.addEventListener('click', closeDetailPanel);
}

function closeDetailPanel() {
    DOM.detailPanel.classList.add('hidden');
}

function openDetailPanel(eventId) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt) return;

    const cat = CATEGORIES[evt.category];
    const tasks = evt.tasks || [];
    const tasksDone = tasks.filter(t => t.done).length;
    const tasksTotal = tasks.length;
    const taskPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
    const brandLabel = evt.brand === 'picard' ? 'Picard Serrures' : evt.brand === 'eliot' ? 'Eliot' : 'Picard + Eliot';

    DOM.detailTitle.textContent = evt.name;

    let html = '';

    // Info section
    html += `<div class="detail-section">`;
    html += `<div class="detail-section-title">Informations</div>`;
    html += `<div class="detail-info-grid">`;
    html += `<div class="detail-info-item"><label>Catégorie</label><span style="color:${cat.color}"><i class="${cat.icon}" style="margin-right:6px"></i>${cat.label}</span></div>`;
    html += `<div class="detail-info-item"><label>Marque</label><span>${brandLabel}</span></div>`;
    html += `<div class="detail-info-item"><label>Dates</label><span>${formatDateRange(evt.start, evt.end)}</span></div>`;
    html += `<div class="detail-info-item"><label>Statut</label><span class="htimeline-row-status ${evt.status}" style="display:inline-block">${STATUS_LABELS[evt.status]}</span></div>`;
    html += `<div class="detail-info-item"><label>Priorité</label><span style="display:flex;align-items:center;gap:6px"><span class="priority-indicator ${evt.priority}"></span>${evt.priority.charAt(0).toUpperCase() + evt.priority.slice(1)}</span></div>`;
    html += `</div></div>`;

    // Description
    if (evt.desc) {
        html += `<div class="detail-section">`;
        html += `<div class="detail-section-title">Description</div>`;
        html += `<div class="detail-desc">${evt.desc}</div>`;
        html += `</div>`;
    }

    // Tasks section
    html += `<div class="detail-section">`;
    html += `<div class="detail-section-title">Tâches à finaliser (${tasksDone}/${tasksTotal})</div>`;

    if (tasksTotal > 0) {
        html += `<div class="detail-task-progress">`;
        html += `<div class="detail-task-progress-bar"><div class="detail-task-progress-fill" style="width:${taskPct}%"></div></div>`;
        html += `<span class="detail-task-progress-label">${taskPct}%</span>`;
        html += `</div>`;
    }

    html += `<div class="detail-tasks" style="margin-top:12px">`;
    tasks.forEach(task => {
        html += `<div class="detail-task${task.done ? ' done' : ''}" data-task-id="${task.id}" data-event-id="${evt.id}">`;
        html += `<div class="detail-task-checkbox" data-task-id="${task.id}" data-event-id="${evt.id}">${task.done ? '<i class="ri-check-line"></i>' : ''}</div>`;
        html += `<span class="detail-task-text">${task.text}</span>`;
        html += `<button class="detail-task-delete" data-task-id="${task.id}" data-event-id="${evt.id}"><i class="ri-close-line"></i></button>`;
        html += `</div>`;
    });
    html += `</div>`;

    // Add task input
    html += `<div class="detail-task-add">`;
    html += `<input type="text" placeholder="Ajouter une tâche..." id="detailNewTask" data-event-id="${evt.id}">`;
    html += `<button id="detailAddTaskBtn" data-event-id="${evt.id}"><i class="ri-add-line"></i></button>`;
    html += `</div>`;
    html += `</div>`;

    // Actions
    html += `<div style="display:flex;gap:8px;margin-top:20px">`;
    html += `<button class="btn btn-primary" onclick="openEditModal('${evt.id}')" style="flex:1"><i class="ri-edit-line"></i> Modifier</button>`;
    html += `<button class="btn btn-danger" onclick="deleteEvent('${evt.id}')" style="flex:0"><i class="ri-delete-bin-6-line"></i></button>`;
    html += `</div>`;

    DOM.detailBody.innerHTML = html;
    DOM.detailPanel.classList.remove('hidden');

    // Bind task interactions
    bindDetailTaskEvents(evt.id);
}

function bindDetailTaskEvents(eventId) {
    // Toggle task
    DOM.detailBody.querySelectorAll('.detail-task-checkbox').forEach(cb => {
        cb.addEventListener('click', (e) => {
            e.stopPropagation();
            const tId = cb.dataset.taskId;
            const eId = cb.dataset.eventId;
            toggleTask(eId, tId);
        });
    });

    // Delete task
    DOM.detailBody.querySelectorAll('.detail-task-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tId = btn.dataset.taskId;
            const eId = btn.dataset.eventId;
            removeTask(eId, tId);
        });
    });

    // Add task
    const addBtn = $('#detailAddTaskBtn');
    const addInput = $('#detailNewTask');
    if (addBtn && addInput) {
        const doAdd = () => {
            const text = addInput.value.trim();
            if (!text) return;
            addTask(eventId, text);
            addInput.value = '';
        };
        addBtn.addEventListener('click', doAdd);
        addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    }
}

function toggleTask(eventId, taskIdVal) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt || !evt.tasks) return;
    const task = evt.tasks.find(t => t.id === taskIdVal);
    if (task) {
        task.done = !task.done;
        saveData();
        openDetailPanel(eventId); // refresh panel
        render(); // refresh timeline (mini progress)
    }
}

function removeTask(eventId, taskIdVal) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt || !evt.tasks) return;
    evt.tasks = evt.tasks.filter(t => t.id !== taskIdVal);
    saveData();
    openDetailPanel(eventId);
    render();
    showToast('Tâche supprimée', 'info');
}

function addTask(eventId, text) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt) return;
    if (!evt.tasks) evt.tasks = [];
    evt.tasks.push({ id: taskId(), text, done: false });
    saveData();
    openDetailPanel(eventId);
    render();
    showToast('Tâche ajoutée', 'success');
}

function deleteEvent(eventId) {
    APP.events = APP.events.filter(e => e.id !== eventId);
    saveData();
    closeDetailPanel();
    render();
    showToast('Événement supprimé', 'info');
}

// ─── All View ────────────────────────────────────
function renderAllView() {
    let html = '';
    Object.entries(CATEGORIES).forEach(([key, cat]) => {
        let evts = APP.events.filter(e => e.category === key);
        if (APP.currentBrand !== 'all') evts = evts.filter(e => e.brand === APP.currentBrand || e.brand === 'both');
        evts.sort((a, b) => new Date(a.start) - new Date(b.start));

        html += `<div class="all-section" data-category="${key}">`;
        html += `<div class="all-section-header" onclick="this.parentElement.classList.toggle('collapsed')">`;
        html += `<div class="all-section-title" style="color:${cat.color}"><i class="${cat.icon}"></i>${cat.label}</div>`;
        html += `<span class="all-section-count">${evts.length} action${evts.length !== 1 ? 's' : ''}</span>`;
        html += `</div><div class="all-section-body">`;

        if (evts.length === 0) {
            html += `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Aucune action</div>`;
        } else {
            evts.forEach(evt => {
                const brandLabel = evt.brand === 'picard' ? 'Picard' : evt.brand === 'eliot' ? 'Eliot' : 'Les deux';
                const tasks = evt.tasks || [];
                const tasksDone = tasks.filter(t => t.done).length;
                const tasksTotal = tasks.length;
                html += `<div class="list-item" data-event-id="${evt.id}">`;
                html += `<div class="list-item-color" style="background:${cat.color};box-shadow:0 0 8px ${cat.color}40"></div>`;
                html += `<div class="priority-indicator ${evt.priority}"></div>`;
                html += `<div class="list-item-info">`;
                html += `<div class="list-item-title">${evt.name}</div>`;
                html += `<div class="list-item-meta">`;
                html += `<span><i class="ri-calendar-line"></i> ${formatDateRange(evt.start, evt.end)}</span>`;
                if (tasksTotal > 0) html += `<span><i class="ri-checkbox-circle-line"></i> ${tasksDone}/${tasksTotal} tâches</span>`;
                html += `</div></div>`;
                html += `<span class="list-item-brand ${evt.brand}">${brandLabel}</span>`;
                html += `<span class="list-item-status ${evt.status}">${STATUS_LABELS[evt.status]}</span>`;
                html += `</div>`;
            });
        }
        html += '</div></div>';
    });

    DOM.allContainer.innerHTML = html;
    DOM.allContainer.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => openDetailPanel(item.dataset.eventId));
    });
}

// ─── KPI ─────────────────────────────────────────
function renderKPI() {
    renderKPICards();
    renderKPICharts();
    renderUpcomingList();
}

function renderKPICards() {
    const events = APP.currentBrand === 'all' ? APP.events : APP.events.filter(e => e.brand === APP.currentBrand || e.brand === 'both');
    const total = events.length;
    const inProgress = events.filter(e => e.status === 'in-progress').length;
    const completed = events.filter(e => e.status === 'completed').length;
    const planned = events.filter(e => e.status === 'planned').length;
    const urgent = events.filter(e => e.priority === 'urgent').length;

    // Task stats
    let totalTasks = 0, doneTasks = 0;
    events.forEach(e => { const t = e.tasks || []; totalTasks += t.length; doneTasks += t.filter(x => x.done).length; });
    const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const cards = [
        { icon: 'ri-list-check-3', color: '#8b5cf6', value: total, label: 'Actions totales', bg: 'rgba(139,92,246,0.12)' },
        { icon: 'ri-loader-4-fill', color: '#3b82f6', value: inProgress, label: 'En cours', bg: 'rgba(59,130,246,0.12)' },
        { icon: 'ri-check-double-fill', color: '#10b981', value: completed, label: 'Terminées', bg: 'rgba(16,185,129,0.12)' },
        { icon: 'ri-calendar-schedule-fill', color: '#f59e0b', value: planned, label: 'Planifiées', bg: 'rgba(245,158,11,0.12)' },
        { icon: 'ri-alarm-warning-fill', color: '#ef4444', value: urgent, label: 'Urgentes', bg: 'rgba(239,68,68,0.12)' },
        { icon: 'ri-checkbox-circle-fill', color: '#06b6d4', value: `${taskPct}%`, label: `Tâches (${doneTasks}/${totalTasks})`, bg: 'rgba(6,182,212,0.12)' },
    ];

    $('#kpiCards').innerHTML = cards.map(c => `
        <div class="kpi-card">
            <div class="kpi-card-icon" style="background:${c.bg};color:${c.color}"><i class="${c.icon}"></i></div>
            <div class="kpi-card-value" style="color:${c.color}">${c.value}</div>
            <div class="kpi-card-label">${c.label}</div>
        </div>
    `).join('');
}

function renderKPICharts() {
    Object.values(APP.charts).forEach(c => { if (c && c.destroy) c.destroy(); });
    APP.charts = {};

    const events = APP.currentBrand === 'all' ? APP.events : APP.events.filter(e => e.brand === APP.currentBrand || e.brand === 'both');

    // By category
    const catCounts = {};
    Object.keys(CATEGORIES).forEach(k => catCounts[k] = 0);
    events.forEach(e => { if (catCounts[e.category] !== undefined) catCounts[e.category]++; });

    APP.charts.category = new Chart($('#chartCategory'), {
        type: 'bar',
        data: {
            labels: Object.keys(CATEGORIES).map(k => CATEGORIES[k].label),
            datasets: [{ data: Object.values(catCounts), backgroundColor: Object.keys(CATEGORIES).map(k => CATEGORIES[k].color + '40'), borderColor: Object.keys(CATEGORIES).map(k => CATEGORIES[k].color), borderWidth: 2, borderRadius: 8, borderSkipped: false }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', font: { size: 10 } } }, y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', stepSize: 1 } } } }
    });

    // By brand
    const brandCounts = { picard: 0, eliot: 0, both: 0 };
    events.forEach(e => { if (brandCounts[e.brand] !== undefined) brandCounts[e.brand]++; });

    APP.charts.brand = new Chart($('#chartBrand'), {
        type: 'doughnut',
        data: { labels: ['Picard', 'Eliot', 'Les deux'], datasets: [{ data: [brandCounts.picard, brandCounts.eliot, brandCounts.both], backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(167,139,250,0.7)'], borderColor: ['#3b82f6', '#f59e0b', '#a78bfa'], borderWidth: 2, hoverOffset: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#8b8da3', padding: 16, font: { size: 11 } } } } }
    });

    // Monthly
    const monthlyData = Array(12).fill(0);
    events.forEach(e => { const d = new Date(e.start); if (d.getFullYear() === APP.currentYear) monthlyData[d.getMonth()]++; });

    const ctx3 = $('#chartTimeline').getContext('2d');
    const grad = ctx3.createLinearGradient(0, 0, 0, 250);
    grad.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    grad.addColorStop(1, 'rgba(139, 92, 246, 0.01)');

    APP.charts.timeline = new Chart($('#chartTimeline'), {
        type: 'line',
        data: { labels: MONTHS_FR.map(m => m.substring(0, 3)), datasets: [{ data: monthlyData, borderColor: '#8b5cf6', backgroundColor: grad, borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: '#8b5cf6', pointBorderColor: '#1a1b26', pointBorderWidth: 3, pointRadius: 5, pointHoverRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', font: { size: 11 } } }, y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', stepSize: 1 }, beginAtZero: true } } }
    });

    // Status
    const statusCounts = { 'planned': 0, 'in-progress': 0, 'completed': 0, 'cancelled': 0 };
    events.forEach(e => { if (statusCounts[e.status] !== undefined) statusCounts[e.status]++; });

    APP.charts.status = new Chart($('#chartStatus'), {
        type: 'polarArea',
        data: { labels: Object.values(STATUS_LABELS), datasets: [{ data: Object.values(statusCounts), backgroundColor: ['rgba(139,92,246,0.6)', 'rgba(59,130,246,0.6)', 'rgba(16,185,129,0.6)', 'rgba(239,68,68,0.6)'], borderColor: ['#8b5cf6', '#3b82f6', '#10b981', '#ef4444'], borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8b8da3', padding: 12, font: { size: 11 } } } }, scales: { r: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { display: false } } } }
    });
}

function renderUpcomingList() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let events = APP.currentBrand === 'all' ? APP.events : APP.events.filter(e => e.brand === APP.currentBrand || e.brand === 'both');
    const upcoming = events.filter(e => new Date(e.start) >= today && e.status !== 'completed' && e.status !== 'cancelled').sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 6);
    const container = $('#upcomingList');
    if (!container) return;
    container.innerHTML = upcoming.map(evt => {
        const cat = CATEGORIES[evt.category];
        return `<div class="upcoming-item" data-event-id="${evt.id}" style="cursor:pointer">
            <div class="upcoming-dot" style="background:${cat.color};box-shadow:0 0 6px ${cat.color}60"></div>
            <div class="upcoming-info"><div class="upcoming-title">${evt.name}</div><div class="upcoming-date">${formatDate(evt.start)}</div></div>
            <div class="priority-indicator ${evt.priority}"></div>
        </div>`;
    }).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">Aucune échéance</div>';

    container.querySelectorAll('.upcoming-item').forEach(item => {
        item.addEventListener('click', () => openDetailPanel(item.dataset.eventId));
    });
}

// ─── Budget ──────────────────────────────────────
function renderBudget() {
    let el = $('#budgetContainer');
    if (!el) {
        el = document.createElement('div');
        el.id = 'budgetContainer';
        el.className = 'budget-container';
        DOM.contentArea.appendChild(el);
    }
    el.classList.remove('hidden');

    const p = APP.budgets.picard || { allocated: 0, spent: 0 };
    const e = APP.budgets.eliot || { allocated: 0, spent: 0 };
    const tA = p.allocated + e.allocated, tS = p.spent + e.spent, tR = tA - tS;
    const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
    const pctP = p.allocated > 0 ? Math.round((p.spent / p.allocated) * 100) : 0;
    const pctE = e.allocated > 0 ? Math.round((e.spent / e.allocated) * 100) : 0;
    const pctT = tA > 0 ? Math.round((tS / tA) * 100) : 0;

    el.innerHTML = `
        <div class="budget-total-card">
            <div class="budget-total-header"><i class="ri-money-euro-circle-fill"></i><h3>Budget Global Communication</h3></div>
            <div class="budget-total-grid">
                <div class="budget-metric"><span class="budget-metric-label">Budget alloué</span><span class="budget-metric-value allocated">${fmt(tA)}</span></div>
                <div class="budget-metric"><span class="budget-metric-label">Budget dépensé</span><span class="budget-metric-value spent">${fmt(tS)}</span></div>
                <div class="budget-metric"><span class="budget-metric-label">Solde restant</span><span class="budget-metric-value remaining ${tR<0?'negative':''}">${fmt(tR)}</span></div>
            </div>
            <div class="budget-progress-container"><div class="budget-progress-bar"><div class="budget-progress-fill" style="width:${Math.min(pctT,100)}%"><div class="budget-progress-glow"></div></div></div><span class="budget-progress-label">${pctT}% utilisé</span></div>
        </div>
        <div class="budget-brands">
            <div class="budget-brand-card picard">
                <div class="budget-brand-header"><div class="budget-brand-dot picard"></div><h4>Picard Serrures</h4></div>
                <div class="budget-fields">
                    <div class="budget-field"><label>Budget alloué</label><div class="budget-input-wrap"><span class="budget-input-prefix">€</span><input type="number" class="budget-input" data-brand="picard" data-field="allocated" value="${p.allocated}" min="0" step="1000"></div></div>
                    <div class="budget-field"><label>Budget dépensé</label><div class="budget-input-wrap"><span class="budget-input-prefix">€</span><input type="number" class="budget-input" data-brand="picard" data-field="spent" value="${p.spent}" min="0" step="500"></div></div>
                    <div class="budget-field"><label>Solde</label><div class="budget-solde ${(p.allocated-p.spent)<0?'negative':''}">${fmt(p.allocated-p.spent)}</div></div>
                </div>
                <div class="budget-progress-container"><div class="budget-progress-bar picard"><div class="budget-progress-fill picard" style="width:${Math.min(pctP,100)}%"><div class="budget-progress-glow picard"></div></div></div><span class="budget-progress-label">${pctP}%</span></div>
            </div>
            <div class="budget-brand-card eliot">
                <div class="budget-brand-header"><div class="budget-brand-dot eliot"></div><h4>Eliot</h4></div>
                <div class="budget-fields">
                    <div class="budget-field"><label>Budget alloué</label><div class="budget-input-wrap"><span class="budget-input-prefix">€</span><input type="number" class="budget-input" data-brand="eliot" data-field="allocated" value="${e.allocated}" min="0" step="1000"></div></div>
                    <div class="budget-field"><label>Budget dépensé</label><div class="budget-input-wrap"><span class="budget-input-prefix">€</span><input type="number" class="budget-input" data-brand="eliot" data-field="spent" value="${e.spent}" min="0" step="500"></div></div>
                    <div class="budget-field"><label>Solde</label><div class="budget-solde ${(e.allocated-e.spent)<0?'negative':''}">${fmt(e.allocated-e.spent)}</div></div>
                </div>
                <div class="budget-progress-container"><div class="budget-progress-bar eliot"><div class="budget-progress-fill eliot" style="width:${Math.min(pctE,100)}%"><div class="budget-progress-glow eliot"></div></div></div><span class="budget-progress-label">${pctE}%</span></div>
            </div>
        </div>
        <div class="budget-chart-container"><div class="chart-card wide"><h3>Répartition budgétaire</h3><canvas id="chartBudget" height="200"></canvas><div class="chart-glow" style="background:radial-gradient(ellipse,rgba(245,158,11,0.12),transparent)"></div></div></div>
    `;

    el.querySelectorAll('.budget-input').forEach(input => {
        input.addEventListener('change', (ev) => {
            const brand = ev.target.dataset.brand;
            const field = ev.target.dataset.field;
            if (!APP.budgets[brand]) APP.budgets[brand] = { allocated: 0, spent: 0 };
            APP.budgets[brand][field] = parseFloat(ev.target.value) || 0;
            saveData();
            renderBudget();
            showToast('Budget mis à jour', 'success');
        });
    });

    if (APP.charts.budget) APP.charts.budget.destroy();
    const chartEl = $('#chartBudget');
    if (chartEl) {
        APP.charts.budget = new Chart(chartEl, {
            type: 'bar',
            data: {
                labels: ['Picard Serrures', 'Eliot'],
                datasets: [
                    { label: 'Alloué', data: [p.allocated, e.allocated], backgroundColor: ['rgba(59,130,246,0.5)', 'rgba(245,158,11,0.5)'], borderColor: ['#3b82f6', '#f59e0b'], borderWidth: 2, borderRadius: 8, borderSkipped: false },
                    { label: 'Dépensé', data: [p.spent, e.spent], backgroundColor: ['rgba(59,130,246,0.2)', 'rgba(245,158,11,0.2)'], borderColor: ['rgba(59,130,246,0.5)', 'rgba(245,158,11,0.5)'], borderWidth: 2, borderRadius: 8, borderSkipped: false }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b8da3', font: { size: 11 } } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770' } }, y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', callback: (v) => fmt(v) } } } }
        });
    }
}

// ─── Modal (Create / Edit) ───────────────────────
function initModal() {
    $('#addEventBtn').addEventListener('click', () => openAddModal());
    $('#modalClose').addEventListener('click', closeModal);
    $('#cancelBtn').addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', (e) => { if (e.target === DOM.modalOverlay) closeModal(); });
    DOM.eventForm.addEventListener('submit', handleFormSubmit);
    DOM.deleteEventBtn.addEventListener('click', handleDelete);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeDetailPanel(); } });

    // Modal task add
    $('#addTaskBtn').addEventListener('click', addModalTask);
    $('#newTaskInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addModalTask(); } });
}

function addModalTask() {
    const input = $('#newTaskInput');
    const text = input.value.trim();
    if (!text) return;
    APP.modalTasks.push({ id: taskId(), text, done: false });
    input.value = '';
    renderModalTasks();
}

function renderModalTasks() {
    DOM.tasksList.innerHTML = APP.modalTasks.map((t, i) => `
        <div class="task-item-form">
            <span>${t.done ? '✓ ' : ''}${t.text}</span>
            <button type="button" class="task-remove" data-idx="${i}"><i class="ri-close-line"></i></button>
        </div>
    `).join('');

    DOM.tasksList.querySelectorAll('.task-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            APP.modalTasks.splice(parseInt(btn.dataset.idx), 1);
            renderModalTasks();
        });
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

    renderModalTasks();
    DOM.modalOverlay.classList.remove('hidden');
    setTimeout(() => $('#eventName').focus(), 100);
}

function openEditModal(eventId) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt) return;

    APP.editingEventId = eventId;
    APP.modalTasks = (evt.tasks || []).map(t => ({ ...t }));
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

    renderModalTasks();
    DOM.modalOverlay.classList.remove('hidden');
}
// Make available globally for onclick in detail panel
window.openEditModal = openEditModal;
window.deleteEvent = deleteEvent;

function closeModal() {
    DOM.modalOverlay.classList.add('hidden');
    APP.editingEventId = null;
    APP.modalTasks = [];
}

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
        tasks: [...APP.modalTasks],
    };
    if (!data.name) return;

    if (APP.editingEventId) {
        const idx = APP.events.findIndex(e => e.id === APP.editingEventId);
        if (idx !== -1) {
            APP.events[idx] = { ...APP.events[idx], ...data };
            showToast('Événement modifié', 'success');
        }
    } else {
        data.id = generateId();
        APP.events.push(data);
        showToast('Événement créé', 'success');
    }

    saveData();
    closeModal();
    render();
    if (APP.editingEventId) openDetailPanel(APP.editingEventId);
}

function handleDelete() {
    if (!APP.editingEventId) return;
    deleteEvent(APP.editingEventId);
    closeModal();
}

// ─── Toast ───────────────────────────────────────
function showToast(message, type = 'info') {
    const icons = { success: 'ri-check-line', error: 'ri-error-warning-line', info: 'ri-information-line' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="${icons[type] || icons.info}"></i><span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
