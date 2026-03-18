/* ============================================
   PICARD · ELIOT — Communication Dashboard
   Full Interactive App
   ============================================ */

// ─── State ───────────────────────────────────────
const APP = {
    currentSection: 'plan-media',
    currentView: 'month',
    currentBrand: 'all',
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    editingEventId: null,
    events: [],
    budgets: {},
    charts: {},
    dragEvent: null,
};

// ─── Category Config ─────────────────────────────
const CATEGORIES = {
    'plan-media':      { label: 'Plan Média',       icon: 'ri-broadcast-fill',            color: '#8b5cf6' },
    'plan-digital':    { label: 'Plan Digital',      icon: 'ri-global-fill',               color: '#3b82f6' },
    'newsletters':     { label: 'Newsletters',       icon: 'ri-mail-send-fill',            color: '#06b6d4' },
    'reseaux-sociaux': { label: 'Réseaux Sociaux',   icon: 'ri-twitter-x-fill',            color: '#ec4899' },
    'salons-foires':   { label: 'Salons · Foires',   icon: 'ri-store-3-fill',              color: '#f59e0b' },
    'usine-interne':   { label: 'Usine · Interne',   icon: 'ri-building-4-fill',           color: '#10b981' },
    'produits':        { label: 'Produits',           icon: 'ri-box-3-fill',                color: '#f97316' },
    'ressources':      { label: 'Ressources',        icon: 'ri-folder-5-fill',             color: '#6366f1' },
};

const STATUS_LABELS = {
    'planned': 'Planifié',
    'in-progress': 'En cours',
    'completed': 'Terminé',
    'cancelled': 'Annulé',
};

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

// ─── Helpers ─────────────────────────────────────
function generateId() { return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatDateRange(start, end) {
    if (!end || start === end) return formatDate(start);
    return `${formatDate(start)} → ${formatDate(end)}`;
}

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function daysBetween(d1, d2) {
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function dateToStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Persistence ─────────────────────────────────
function saveData() {
    localStorage.setItem('picard_eliot_events', JSON.stringify(APP.events));
    localStorage.setItem('picard_eliot_budgets', JSON.stringify(APP.budgets));
}

function loadData() {
    try {
        const evts = localStorage.getItem('picard_eliot_events');
        if (evts) APP.events = JSON.parse(evts);
        const budgets = localStorage.getItem('picard_eliot_budgets');
        if (budgets) APP.budgets = JSON.parse(budgets);
    } catch(e) { console.warn('Error loading data:', e); }

    if (APP.events.length === 0) {
        APP.events = generateSampleEvents();
        saveData();
    }

    // Init budgets if empty
    if (!APP.budgets || Object.keys(APP.budgets).length === 0) {
        APP.budgets = {
            picard: { allocated: 120000, spent: 45000 },
            eliot:  { allocated: 85000,  spent: 28000 },
        };
        saveData();
    }
}

function generateSampleEvents() {
    const year = 2026;
    return [
        { id: generateId(), name: 'Campagne TV Picard Q1', category: 'plan-media', brand: 'picard', start: `${year}-01-15`, end: `${year}-02-28`, status: 'completed', priority: 'high', desc: 'Campagne nationale TV pour Picard Serrures' },
        { id: generateId(), name: 'Campagne Radio Eliot', category: 'plan-media', brand: 'eliot', start: `${year}-03-01`, end: `${year}-03-31`, status: 'in-progress', priority: 'high', desc: 'Spots radio stations nationales' },
        { id: generateId(), name: 'Refonte site Picard', category: 'plan-digital', brand: 'picard', start: `${year}-02-01`, end: `${year}-04-30`, status: 'in-progress', priority: 'urgent', desc: 'Refonte complète du site web Picard Serrures' },
        { id: generateId(), name: 'SEO / SEA Eliot', category: 'plan-digital', brand: 'eliot', start: `${year}-03-10`, end: `${year}-06-30`, status: 'planned', priority: 'medium', desc: 'Stratégie SEO et campagnes Google Ads' },
        { id: generateId(), name: 'NL Mars - Nouveautés', category: 'newsletters', brand: 'both', start: `${year}-03-15`, end: `${year}-03-15`, status: 'planned', priority: 'medium', desc: 'Newsletter mensuelle mars' },
        { id: generateId(), name: 'NL Avril - Promo Printemps', category: 'newsletters', brand: 'picard', start: `${year}-04-01`, end: `${year}-04-01`, status: 'planned', priority: 'low', desc: 'Offres spéciales printemps' },
        { id: generateId(), name: 'Post LinkedIn - Salon', category: 'reseaux-sociaux', brand: 'both', start: `${year}-03-20`, end: `${year}-03-20`, status: 'planned', priority: 'medium', desc: 'Annonce participation salon sécurité' },
        { id: generateId(), name: 'Campagne Instagram Eliot', category: 'reseaux-sociaux', brand: 'eliot', start: `${year}-03-05`, end: `${year}-03-25`, status: 'in-progress', priority: 'high', desc: 'Série de posts produits Eliot' },
        { id: generateId(), name: 'Salon Sécurité Paris', category: 'salons-foires', brand: 'both', start: `${year}-04-15`, end: `${year}-04-18`, status: 'planned', priority: 'urgent', desc: 'Stand commun Picard + Eliot' },
        { id: generateId(), name: 'Foire de Lyon', category: 'salons-foires', brand: 'picard', start: `${year}-05-10`, end: `${year}-05-14`, status: 'planned', priority: 'high', desc: 'Présence Picard Serrures' },
        { id: generateId(), name: 'Visite usine presse', category: 'usine-interne', brand: 'picard', start: `${year}-03-25`, end: `${year}-03-25`, status: 'planned', priority: 'medium', desc: 'Accueil journalistes pour visite usine' },
        { id: generateId(), name: 'Team Building Com', category: 'usine-interne', brand: 'both', start: `${year}-04-05`, end: `${year}-04-05`, status: 'planned', priority: 'low', desc: 'Journée team building équipe communication' },
        { id: generateId(), name: 'Lancement Serrure connectée V3', category: 'produits', brand: 'picard', start: `${year}-05-01`, end: `${year}-05-15`, status: 'planned', priority: 'urgent', desc: 'Lancement officiel de la serrure connectée V3' },
        { id: generateId(), name: 'Packaging Eliot refonte', category: 'produits', brand: 'eliot', start: `${year}-03-01`, end: `${year}-04-15`, status: 'in-progress', priority: 'high', desc: 'Nouveau packaging gamme Eliot' },
        { id: generateId(), name: 'Shooting photo produits', category: 'ressources', brand: 'both', start: `${year}-03-18`, end: `${year}-03-19`, status: 'in-progress', priority: 'high', desc: 'Photos studio nouvelles gammes' },
        { id: generateId(), name: 'Vidéo corporate Picard', category: 'ressources', brand: 'picard', start: `${year}-04-20`, end: `${year}-05-10`, status: 'planned', priority: 'medium', desc: 'Film institutionnel Picard Serrures' },
        { id: generateId(), name: 'Presse spécialisée Q2', category: 'plan-media', brand: 'both', start: `${year}-04-01`, end: `${year}-06-30`, status: 'planned', priority: 'medium', desc: 'Insertions presse BTP et sécurité' },
        { id: generateId(), name: 'Webinar Sécurité connectée', category: 'plan-digital', brand: 'both', start: `${year}-03-28`, end: `${year}-03-28`, status: 'planned', priority: 'medium', desc: 'Webinar avec partenaires' },
    ];
}

// ─── DOM Elements ────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
    sidebar: $('#sidebar'),
    mainContent: $('#mainContent'),
    pageTitle: $('#pageTitle'),
    pageBadge: $('#pageBadge'),
    monthLabel: $('#monthLabel'),
    calendarHeader: $('#calendarHeader'),
    calendarGrid: $('#calendarGrid'),
    calendarContainer: $('#calendarContainer'),
    timelineContainer: $('#timelineContainer'),
    listContainer: $('#listContainer'),
    kpiContainer: $('#kpiContainer'),
    allContainer: $('#allContainer'),
    modalOverlay: $('#modalOverlay'),
    eventForm: $('#eventForm'),
    modalTitle: $('#modalTitle'),
    submitLabel: $('#submitLabel'),
    deleteEventBtn: $('#deleteEventBtn'),
    toastContainer: $('#toastContainer'),
    contentArea: $('#contentArea'),
};

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initNavigation();
    initViewToggle();
    initMonthNav();
    initBrandFilter();
    initModal();
    initMenuToggle();
    render();
});

// ─── Navigation ──────────────────────────────────
function initNavigation() {
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            $$('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            APP.currentSection = item.dataset.section;
            render();
        });
    });
}

function initViewToggle() {
    $$('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.currentView = btn.dataset.view;
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
    $('#menuToggle').addEventListener('click', () => {
        DOM.sidebar.classList.toggle('open');
    });
    DOM.mainContent.addEventListener('click', () => {
        DOM.sidebar.classList.remove('open');
    });
}

// ─── Filter Events ───────────────────────────────
function getFilteredEvents() {
    let evts = [...APP.events];

    // Filter by section/category
    if (APP.currentSection !== 'kpi' && APP.currentSection !== 'all' && APP.currentSection !== 'budget') {
        evts = evts.filter(e => e.category === APP.currentSection);
    }

    // Filter by brand
    if (APP.currentBrand !== 'all') {
        evts = evts.filter(e => e.brand === APP.currentBrand || e.brand === 'both');
    }

    return evts;
}

// ─── Render ──────────────────────────────────────
function render() {
    updatePageTitle();
    updateMonthLabel();

    // Hide all containers
    DOM.calendarContainer.classList.add('hidden');
    DOM.timelineContainer.classList.add('hidden');
    DOM.listContainer.classList.add('hidden');
    DOM.kpiContainer.classList.add('hidden');
    DOM.allContainer.classList.add('hidden');

    // Also hide budget if exists
    const budgetContainer = $('#budgetContainer');
    if (budgetContainer) budgetContainer.classList.add('hidden');

    if (APP.currentSection === 'kpi') {
        DOM.kpiContainer.classList.remove('hidden');
        renderKPI();
    } else if (APP.currentSection === 'all') {
        DOM.allContainer.classList.remove('hidden');
        renderAllView();
    } else if (APP.currentSection === 'budget') {
        if (budgetContainer) budgetContainer.classList.remove('hidden');
        renderBudget();
    } else {
        // Calendar sections
        if (APP.currentView === 'month') {
            DOM.calendarContainer.classList.remove('hidden');
            renderCalendar();
        } else if (APP.currentView === 'timeline') {
            DOM.timelineContainer.classList.remove('hidden');
            renderTimeline();
        } else if (APP.currentView === 'list') {
            DOM.listContainer.classList.remove('hidden');
            renderList();
        }
    }
}

function updatePageTitle() {
    const section = APP.currentSection;
    if (section === 'kpi') {
        DOM.pageTitle.textContent = 'Indicateurs KPI';
        DOM.pageBadge.textContent = 'Analytics';
        DOM.pageBadge.style.background = 'rgba(16, 185, 129, 0.12)';
        DOM.pageBadge.style.color = '#10b981';
    } else if (section === 'all') {
        DOM.pageTitle.textContent = 'Vue Globale';
        DOM.pageBadge.textContent = 'Toutes catégories';
        DOM.pageBadge.style.background = 'rgba(167, 139, 250, 0.12)';
        DOM.pageBadge.style.color = '#a78bfa';
    } else if (section === 'budget') {
        DOM.pageTitle.textContent = 'Budget';
        DOM.pageBadge.textContent = 'Finances';
        DOM.pageBadge.style.background = 'rgba(245, 158, 11, 0.12)';
        DOM.pageBadge.style.color = '#f59e0b';
    } else {
        const cat = CATEGORIES[section];
        DOM.pageTitle.textContent = cat.label;
        DOM.pageBadge.textContent = 'Calendrier';
        DOM.pageBadge.style.background = `${cat.color}1a`;
        DOM.pageBadge.style.color = cat.color;
    }
}

function updateMonthLabel() {
    DOM.monthLabel.textContent = `${MONTHS_FR[APP.currentMonth]} ${APP.currentYear}`;
}

// ─── Calendar Month View ─────────────────────────
function renderCalendar() {
    const events = getFilteredEvents();

    // Header
    DOM.calendarHeader.innerHTML = DAYS_FR.map(d => `<div class="day-name">${d}</div>`).join('');

    // Build grid
    const firstDay = new Date(APP.currentYear, APP.currentMonth, 1);
    const lastDay = new Date(APP.currentYear, APP.currentMonth + 1, 0);
    let startDay = (firstDay.getDay() + 6) % 7; // Monday-based

    const cells = [];
    const totalCells = 42;

    // Previous month
    const prevMonthLast = new Date(APP.currentYear, APP.currentMonth, 0);
    for (let i = startDay - 1; i >= 0; i--) {
        const day = prevMonthLast.getDate() - i;
        const date = new Date(APP.currentYear, APP.currentMonth - 1, day);
        cells.push({ date, otherMonth: true });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(APP.currentYear, APP.currentMonth, d);
        cells.push({ date, otherMonth: false });
    }

    // Next month
    let nextDay = 1;
    while (cells.length < totalCells) {
        const date = new Date(APP.currentYear, APP.currentMonth + 1, nextDay++);
        cells.push({ date, otherMonth: true });
    }

    const today = new Date();
    DOM.calendarGrid.innerHTML = '';

    cells.forEach(cell => {
        const cellEl = document.createElement('div');
        cellEl.className = 'calendar-cell';
        if (cell.otherMonth) cellEl.classList.add('other-month');
        if (isSameDay(cell.date, today)) cellEl.classList.add('today');

        const dateStr = dateToStr(cell.date);
        cellEl.dataset.date = dateStr;

        // Date number
        const dateEl = document.createElement('div');
        dateEl.className = 'cell-date';
        dateEl.textContent = cell.date.getDate();
        cellEl.appendChild(dateEl);

        // Events for this day
        const dayEvents = events.filter(e => {
            const start = new Date(e.start);
            const end = e.end ? new Date(e.end) : start;
            return cell.date >= new Date(start.toDateString()) && cell.date <= new Date(end.toDateString());
        });

        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'cell-events';

        const maxShow = 3;
        dayEvents.slice(0, maxShow).forEach(evt => {
            const evtEl = document.createElement('div');
            evtEl.className = `cell-event brand-${evt.brand} cat-${evt.category}`;
            evtEl.textContent = evt.name;
            evtEl.dataset.eventId = evt.id;
            evtEl.draggable = true;

            evtEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(evt.id);
            });

            evtEl.addEventListener('dragstart', (e) => {
                APP.dragEvent = evt.id;
                evtEl.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            evtEl.addEventListener('dragend', () => {
                evtEl.classList.remove('dragging');
                APP.dragEvent = null;
            });

            eventsContainer.appendChild(evtEl);
        });

        if (dayEvents.length > maxShow) {
            const more = document.createElement('div');
            more.className = 'cell-more';
            more.textContent = `+${dayEvents.length - maxShow} de plus`;
            eventsContainer.appendChild(more);
        }

        cellEl.appendChild(eventsContainer);

        // Drop handlers
        cellEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            cellEl.classList.add('drag-over');
        });
        cellEl.addEventListener('dragleave', () => {
            cellEl.classList.remove('drag-over');
        });
        cellEl.addEventListener('drop', (e) => {
            e.preventDefault();
            cellEl.classList.remove('drag-over');
            if (APP.dragEvent) {
                moveEventToDate(APP.dragEvent, dateStr);
            }
        });

        // Click to add
        cellEl.addEventListener('click', () => {
            openAddModal(dateStr);
        });

        DOM.calendarGrid.appendChild(cellEl);
    });
}

function moveEventToDate(eventId, newDateStr) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt) return;

    const oldStart = new Date(evt.start);
    const newStart = new Date(newDateStr);
    const diffDays = daysBetween(oldStart, newStart);

    evt.start = newDateStr;
    if (evt.end) {
        const oldEnd = new Date(evt.end);
        oldEnd.setDate(oldEnd.getDate() + diffDays);
        evt.end = dateToStr(oldEnd);
    }

    saveData();
    render();
    showToast('Événement déplacé', 'success');
}

// ─── Timeline View ───────────────────────────────
function renderTimeline() {
    const events = getFilteredEvents();
    const daysInMonth = new Date(APP.currentYear, APP.currentMonth + 1, 0).getDate();
    const today = new Date();

    let html = '<div class="timeline-header"><div class="timeline-label-col">Action</div><div class="timeline-days">';
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(APP.currentYear, APP.currentMonth, d);
        const isToday = isSameDay(date, today);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        html += `<div class="timeline-day${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}">${d}</div>`;
    }
    html += '</div></div>';

    // Sort events by start date
    const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));

    sorted.forEach(evt => {
        const brandColor = evt.brand === 'picard' ? '#3b82f6' : evt.brand === 'eliot' ? '#f59e0b' : '#a78bfa';

        html += `<div class="timeline-row" data-event-id="${evt.id}">`;
        html += `<div class="timeline-row-label">`;
        html += `<span class="brand-indicator" style="background:${brandColor};box-shadow:0 0 6px ${brandColor}40"></span>`;
        html += `<span>${evt.name}</span></div>`;
        html += `<div class="timeline-bars" style="position:relative">`;

        // Background cells
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(APP.currentYear, APP.currentMonth, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            html += `<div class="timeline-bar-bg${isWeekend ? ' weekend' : ''}"></div>`;
        }

        // Bar
        const startDate = new Date(evt.start);
        const endDate = evt.end ? new Date(evt.end) : startDate;

        const monthStart = new Date(APP.currentYear, APP.currentMonth, 1);
        const monthEnd = new Date(APP.currentYear, APP.currentMonth, daysInMonth);

        if (endDate >= monthStart && startDate <= monthEnd) {
            const barStart = Math.max(1, startDate.getDate() - (startDate.getMonth() === APP.currentMonth && startDate.getFullYear() === APP.currentYear ? 0 : startDate.getDate() - 1));
            const effectiveStart = startDate < monthStart ? 1 : startDate.getDate();
            const effectiveEnd = endDate > monthEnd ? daysInMonth : endDate.getDate();

            const leftPercent = ((effectiveStart - 1) / daysInMonth) * 100;
            const widthPercent = ((effectiveEnd - effectiveStart + 1) / daysInMonth) * 100;

            html += `<div class="timeline-bar brand-${evt.brand}" style="left:${leftPercent}%;width:${widthPercent}%" data-event-id="${evt.id}">${evt.name}</div>`;
        }

        // Today line
        if (today.getMonth() === APP.currentMonth && today.getFullYear() === APP.currentYear) {
            const todayPos = ((today.getDate() - 0.5) / daysInMonth) * 100;
            html += `<div class="timeline-today-line" style="left:${todayPos}%"></div>`;
        }

        html += '</div></div>';
    });

    DOM.timelineContainer.innerHTML = html;

    // Click handlers
    DOM.timelineContainer.querySelectorAll('.timeline-row').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.dataset.eventId;
            if (id) openEditModal(id);
        });
    });

    DOM.timelineContainer.querySelectorAll('.timeline-bar').forEach(bar => {
        bar.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = bar.dataset.eventId;
            if (id) openEditModal(id);
        });
    });
}

// ─── List View ───────────────────────────────────
function renderList() {
    const events = getFilteredEvents().sort((a, b) => new Date(a.start) - new Date(b.start));

    if (events.length === 0) {
        DOM.listContainer.innerHTML = `
            <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
                <i class="ri-calendar-todo-fill" style="font-size:48px;display:block;margin-bottom:16px;opacity:0.3"></i>
                <p style="font-size:15px;font-weight:500">Aucun événement</p>
                <p style="font-size:13px;margin-top:4px">Cliquez sur "Ajouter" pour créer votre première action</p>
            </div>`;
        return;
    }

    DOM.listContainer.innerHTML = events.map(evt => {
        const cat = CATEGORIES[evt.category];
        const brandLabel = evt.brand === 'picard' ? 'Picard' : evt.brand === 'eliot' ? 'Eliot' : 'Les deux';
        return `
        <div class="list-item" data-event-id="${evt.id}">
            <div class="list-item-color" style="background:${cat.color};box-shadow:0 0 8px ${cat.color}40"></div>
            <div class="priority-indicator ${evt.priority}"></div>
            <div class="list-item-info">
                <div class="list-item-title">${evt.name}</div>
                <div class="list-item-meta">
                    <span><i class="${cat.icon}"></i> ${cat.label}</span>
                    <span><i class="ri-calendar-line"></i> ${formatDateRange(evt.start, evt.end)}</span>
                </div>
            </div>
            <span class="list-item-brand ${evt.brand}">${brandLabel}</span>
            <span class="list-item-status ${evt.status}">${STATUS_LABELS[evt.status]}</span>
        </div>`;
    }).join('');

    DOM.listContainer.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => openEditModal(item.dataset.eventId));
    });
}

// ─── All View ────────────────────────────────────
function renderAllView() {
    let html = '';

    Object.entries(CATEGORIES).forEach(([key, cat]) => {
        let evts = APP.events.filter(e => e.category === key);
        if (APP.currentBrand !== 'all') {
            evts = evts.filter(e => e.brand === APP.currentBrand || e.brand === 'both');
        }
        evts.sort((a, b) => new Date(a.start) - new Date(b.start));

        html += `
        <div class="all-section" data-category="${key}">
            <div class="all-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <div class="all-section-title" style="color:${cat.color}">
                    <i class="${cat.icon}"></i>
                    ${cat.label}
                </div>
                <span class="all-section-count">${evts.length} action${evts.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="all-section-body">`;

        if (evts.length === 0) {
            html += `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Aucune action</div>`;
        } else {
            evts.forEach(evt => {
                const brandLabel = evt.brand === 'picard' ? 'Picard' : evt.brand === 'eliot' ? 'Eliot' : 'Les deux';
                html += `
                <div class="list-item" data-event-id="${evt.id}">
                    <div class="list-item-color" style="background:${cat.color};box-shadow:0 0 8px ${cat.color}40"></div>
                    <div class="priority-indicator ${evt.priority}"></div>
                    <div class="list-item-info">
                        <div class="list-item-title">${evt.name}</div>
                        <div class="list-item-meta">
                            <span><i class="ri-calendar-line"></i> ${formatDateRange(evt.start, evt.end)}</span>
                        </div>
                    </div>
                    <span class="list-item-brand ${evt.brand}">${brandLabel}</span>
                    <span class="list-item-status ${evt.status}">${STATUS_LABELS[evt.status]}</span>
                </div>`;
            });
        }

        html += '</div></div>';
    });

    DOM.allContainer.innerHTML = html;

    DOM.allContainer.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => openEditModal(item.dataset.eventId));
    });
}

// ─── KPI Dashboard ───────────────────────────────
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
    const thisMonth = events.filter(e => {
        const d = new Date(e.start);
        return d.getMonth() === APP.currentMonth && d.getFullYear() === APP.currentYear;
    }).length;

    const cards = [
        { icon: 'ri-list-check-3', color: '#8b5cf6', value: total, label: 'Actions totales', trend: null, bg: 'rgba(139,92,246,0.12)' },
        { icon: 'ri-loader-4-fill', color: '#3b82f6', value: inProgress, label: 'En cours', trend: null, bg: 'rgba(59,130,246,0.12)' },
        { icon: 'ri-check-double-fill', color: '#10b981', value: completed, label: 'Terminées', trend: null, bg: 'rgba(16,185,129,0.12)' },
        { icon: 'ri-calendar-schedule-fill', color: '#f59e0b', value: planned, label: 'Planifiées', trend: null, bg: 'rgba(245,158,11,0.12)' },
        { icon: 'ri-alarm-warning-fill', color: '#ef4444', value: urgent, label: 'Urgentes', trend: null, bg: 'rgba(239,68,68,0.12)' },
        { icon: 'ri-calendar-event-fill', color: '#06b6d4', value: thisMonth, label: 'Ce mois', trend: null, bg: 'rgba(6,182,212,0.12)' },
    ];

    $('#kpiCards').innerHTML = cards.map(c => `
        <div class="kpi-card">
            <div class="kpi-card-icon" style="background:${c.bg};color:${c.color}">
                <i class="${c.icon}"></i>
            </div>
            <div class="kpi-card-value" style="color:${c.color}">${c.value}</div>
            <div class="kpi-card-label">${c.label}</div>
        </div>
    `).join('');
}

function renderKPICharts() {
    // Destroy existing charts
    Object.values(APP.charts).forEach(c => { if (c) c.destroy(); });
    APP.charts = {};

    const events = APP.currentBrand === 'all' ? APP.events : APP.events.filter(e => e.brand === APP.currentBrand || e.brand === 'both');

    // Chart 1: By Category
    const catCounts = {};
    Object.keys(CATEGORIES).forEach(k => catCounts[k] = 0);
    events.forEach(e => { if (catCounts[e.category] !== undefined) catCounts[e.category]++; });

    const catLabels = Object.keys(CATEGORIES).map(k => CATEGORIES[k].label);
    const catData = Object.keys(CATEGORIES).map(k => catCounts[k]);
    const catColors = Object.keys(CATEGORIES).map(k => CATEGORIES[k].color);

    APP.charts.category = new Chart($('#chartCategory'), {
        type: 'bar',
        data: {
            labels: catLabels,
            datasets: [{
                data: catData,
                backgroundColor: catColors.map(c => c + '40'),
                borderColor: catColors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', stepSize: 1 } },
            },
        }
    });

    // Chart 2: By Brand (Doughnut)
    const brandCounts = { picard: 0, eliot: 0, both: 0 };
    events.forEach(e => { if (brandCounts[e.brand] !== undefined) brandCounts[e.brand]++; });

    APP.charts.brand = new Chart($('#chartBrand'), {
        type: 'doughnut',
        data: {
            labels: ['Picard Serrures', 'Eliot', 'Les deux'],
            datasets: [{
                data: [brandCounts.picard, brandCounts.eliot, brandCounts.both],
                backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(167,139,250,0.7)'],
                borderColor: ['#3b82f6', '#f59e0b', '#a78bfa'],
                borderWidth: 2,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#8b8da3', padding: 16, font: { size: 11 } } },
            },
        }
    });

    // Chart 3: Monthly Timeline (area)
    const monthlyData = Array(12).fill(0);
    events.forEach(e => {
        const d = new Date(e.start);
        if (d.getFullYear() === APP.currentYear) monthlyData[d.getMonth()]++;
    });

    const ctx3 = $('#chartTimeline').getContext('2d');
    const gradient1 = ctx3.createLinearGradient(0, 0, 0, 250);
    gradient1.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient1.addColorStop(1, 'rgba(139, 92, 246, 0.01)');

    APP.charts.timeline = new Chart($('#chartTimeline'), {
        type: 'line',
        data: {
            labels: MONTHS_FR.map(m => m.substring(0, 3)),
            datasets: [{
                data: monthlyData,
                borderColor: '#8b5cf6',
                backgroundColor: gradient1,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#1a1b26',
                pointBorderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', font: { size: 11 } } },
                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770', stepSize: 1 }, beginAtZero: true },
            },
        }
    });

    // Chart 4: Status (Polar)
    const statusCounts = { 'planned': 0, 'in-progress': 0, 'completed': 0, 'cancelled': 0 };
    events.forEach(e => { if (statusCounts[e.status] !== undefined) statusCounts[e.status]++; });

    APP.charts.status = new Chart($('#chartStatus'), {
        type: 'polarArea',
        data: {
            labels: Object.values(STATUS_LABELS),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['rgba(139,92,246,0.6)', 'rgba(59,130,246,0.6)', 'rgba(16,185,129,0.6)', 'rgba(239,68,68,0.6)'],
                borderColor: ['#8b5cf6', '#3b82f6', '#10b981', '#ef4444'],
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#8b8da3', padding: 12, font: { size: 11 } } },
            },
            scales: {
                r: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { display: false },
                },
            },
        }
    });
}

function renderUpcomingList() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let events = APP.currentBrand === 'all' ? APP.events : APP.events.filter(e => e.brand === APP.currentBrand || e.brand === 'both');
    const upcoming = events
        .filter(e => new Date(e.start) >= today && e.status !== 'completed' && e.status !== 'cancelled')
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .slice(0, 6);

    const container = $('#upcomingList');
    if (!container) return;

    container.innerHTML = upcoming.map(evt => {
        const cat = CATEGORIES[evt.category];
        return `
        <div class="upcoming-item" data-event-id="${evt.id}" style="cursor:pointer">
            <div class="upcoming-dot" style="background:${cat.color};box-shadow:0 0 6px ${cat.color}60"></div>
            <div class="upcoming-info">
                <div class="upcoming-title">${evt.name}</div>
                <div class="upcoming-date">${formatDate(evt.start)}</div>
            </div>
            <div class="priority-indicator ${evt.priority}"></div>
        </div>`;
    }).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">Aucune échéance à venir</div>';

    container.querySelectorAll('.upcoming-item').forEach(item => {
        item.addEventListener('click', () => openEditModal(item.dataset.eventId));
    });
}

// ─── Budget Section ──────────────────────────────
function renderBudget() {
    let budgetContainer = $('#budgetContainer');
    if (!budgetContainer) {
        budgetContainer = document.createElement('div');
        budgetContainer.id = 'budgetContainer';
        budgetContainer.className = 'budget-container';
        DOM.contentArea.appendChild(budgetContainer);
    }
    budgetContainer.classList.remove('hidden');

    const picard = APP.budgets.picard || { allocated: 0, spent: 0 };
    const eliot = APP.budgets.eliot || { allocated: 0, spent: 0 };
    const totalAllocated = picard.allocated + eliot.allocated;
    const totalSpent = picard.spent + eliot.spent;
    const totalRemaining = totalAllocated - totalSpent;

    const formatMoney = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
    const pctPicard = picard.allocated > 0 ? Math.round((picard.spent / picard.allocated) * 100) : 0;
    const pctEliot = eliot.allocated > 0 ? Math.round((eliot.spent / eliot.allocated) * 100) : 0;
    const pctTotal = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

    budgetContainer.innerHTML = `
        <div class="budget-overview">
            <div class="budget-total-card">
                <div class="budget-total-header">
                    <i class="ri-money-euro-circle-fill"></i>
                    <h3>Budget Global Communication</h3>
                </div>
                <div class="budget-total-grid">
                    <div class="budget-metric">
                        <span class="budget-metric-label">Budget alloué</span>
                        <span class="budget-metric-value allocated">${formatMoney(totalAllocated)}</span>
                    </div>
                    <div class="budget-metric">
                        <span class="budget-metric-label">Budget dépensé</span>
                        <span class="budget-metric-value spent">${formatMoney(totalSpent)}</span>
                    </div>
                    <div class="budget-metric">
                        <span class="budget-metric-label">Solde restant</span>
                        <span class="budget-metric-value remaining ${totalRemaining < 0 ? 'negative' : ''}">${formatMoney(totalRemaining)}</span>
                    </div>
                </div>
                <div class="budget-progress-container">
                    <div class="budget-progress-bar">
                        <div class="budget-progress-fill" style="width:${Math.min(pctTotal, 100)}%">
                            <div class="budget-progress-glow"></div>
                        </div>
                    </div>
                    <span class="budget-progress-label">${pctTotal}% utilisé</span>
                </div>
            </div>
        </div>

        <div class="budget-brands">
            <div class="budget-brand-card picard">
                <div class="budget-brand-header">
                    <div class="budget-brand-dot picard"></div>
                    <h4>Picard Serrures</h4>
                </div>
                <div class="budget-fields">
                    <div class="budget-field">
                        <label>Budget alloué</label>
                        <div class="budget-input-wrap">
                            <span class="budget-input-prefix">€</span>
                            <input type="number" class="budget-input" data-brand="picard" data-field="allocated" value="${picard.allocated}" min="0" step="1000">
                        </div>
                    </div>
                    <div class="budget-field">
                        <label>Budget dépensé</label>
                        <div class="budget-input-wrap">
                            <span class="budget-input-prefix">€</span>
                            <input type="number" class="budget-input" data-brand="picard" data-field="spent" value="${picard.spent}" min="0" step="500">
                        </div>
                    </div>
                    <div class="budget-field">
                        <label>Solde</label>
                        <div class="budget-solde ${(picard.allocated - picard.spent) < 0 ? 'negative' : ''}">${formatMoney(picard.allocated - picard.spent)}</div>
                    </div>
                </div>
                <div class="budget-progress-container">
                    <div class="budget-progress-bar picard">
                        <div class="budget-progress-fill picard" style="width:${Math.min(pctPicard, 100)}%">
                            <div class="budget-progress-glow picard"></div>
                        </div>
                    </div>
                    <span class="budget-progress-label">${pctPicard}%</span>
                </div>
            </div>

            <div class="budget-brand-card eliot">
                <div class="budget-brand-header">
                    <div class="budget-brand-dot eliot"></div>
                    <h4>Eliot</h4>
                </div>
                <div class="budget-fields">
                    <div class="budget-field">
                        <label>Budget alloué</label>
                        <div class="budget-input-wrap">
                            <span class="budget-input-prefix">€</span>
                            <input type="number" class="budget-input" data-brand="eliot" data-field="allocated" value="${eliot.allocated}" min="0" step="1000">
                        </div>
                    </div>
                    <div class="budget-field">
                        <label>Budget dépensé</label>
                        <div class="budget-input-wrap">
                            <span class="budget-input-prefix">€</span>
                            <input type="number" class="budget-input" data-brand="eliot" data-field="spent" value="${eliot.spent}" min="0" step="500">
                        </div>
                    </div>
                    <div class="budget-field">
                        <label>Solde</label>
                        <div class="budget-solde ${(eliot.allocated - eliot.spent) < 0 ? 'negative' : ''}">${formatMoney(eliot.allocated - eliot.spent)}</div>
                    </div>
                </div>
                <div class="budget-progress-container">
                    <div class="budget-progress-bar eliot">
                        <div class="budget-progress-fill eliot" style="width:${Math.min(pctEliot, 100)}%">
                            <div class="budget-progress-glow eliot"></div>
                        </div>
                    </div>
                    <span class="budget-progress-label">${pctEliot}%</span>
                </div>
            </div>
        </div>

        <div class="budget-chart-container">
            <div class="chart-card wide">
                <h3>Répartition budgétaire</h3>
                <canvas id="chartBudget" height="200"></canvas>
                <div class="chart-glow" style="background:radial-gradient(ellipse, rgba(245,158,11,0.12), transparent)"></div>
            </div>
        </div>
    `;

    // Bind budget input changes
    budgetContainer.querySelectorAll('.budget-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const brand = e.target.dataset.brand;
            const field = e.target.dataset.field;
            const value = parseFloat(e.target.value) || 0;
            if (!APP.budgets[brand]) APP.budgets[brand] = { allocated: 0, spent: 0 };
            APP.budgets[brand][field] = value;
            saveData();
            renderBudget();
            showToast('Budget mis à jour', 'success');
        });
    });

    // Budget Chart
    if (APP.charts.budget) APP.charts.budget.destroy();

    const chartEl = $('#chartBudget');
    if (chartEl) {
        const ctx = chartEl.getContext('2d');
        const gradPicard = ctx.createLinearGradient(0, 0, 0, 200);
        gradPicard.addColorStop(0, 'rgba(59,130,246,0.6)');
        gradPicard.addColorStop(1, 'rgba(59,130,246,0.1)');

        const gradEliot = ctx.createLinearGradient(0, 0, 0, 200);
        gradEliot.addColorStop(0, 'rgba(245,158,11,0.6)');
        gradEliot.addColorStop(1, 'rgba(245,158,11,0.1)');

        APP.charts.budget = new Chart(chartEl, {
            type: 'bar',
            data: {
                labels: ['Picard Serrures', 'Eliot'],
                datasets: [
                    {
                        label: 'Alloué',
                        data: [picard.allocated, eliot.allocated],
                        backgroundColor: [gradPicard, gradEliot],
                        borderColor: ['#3b82f6', '#f59e0b'],
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false,
                    },
                    {
                        label: 'Dépensé',
                        data: [picard.spent, eliot.spent],
                        backgroundColor: ['rgba(59,130,246,0.3)', 'rgba(245,158,11,0.3)'],
                        borderColor: ['rgba(59,130,246,0.6)', 'rgba(245,158,11,0.6)'],
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#8b8da3', font: { size: 11 } } },
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#555770' } },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: {
                            color: '#555770',
                            callback: (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v),
                        }
                    },
                },
            }
        });
    }
}

// ─── Modal ───────────────────────────────────────
function initModal() {
    $('#addEventBtn').addEventListener('click', () => openAddModal());
    $('#modalClose').addEventListener('click', closeModal);
    $('#cancelBtn').addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', (e) => {
        if (e.target === DOM.modalOverlay) closeModal();
    });

    DOM.eventForm.addEventListener('submit', handleFormSubmit);
    DOM.deleteEventBtn.addEventListener('click', handleDelete);

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function openAddModal(dateStr) {
    APP.editingEventId = null;
    DOM.modalTitle.textContent = 'Nouvel Événement';
    DOM.submitLabel.textContent = 'Créer';
    DOM.deleteEventBtn.classList.add('hidden');
    DOM.eventForm.reset();

    // Pre-fill category based on current section
    if (APP.currentSection !== 'kpi' && APP.currentSection !== 'all' && APP.currentSection !== 'budget') {
        $('#eventCategory').value = APP.currentSection;
    }

    if (dateStr) {
        $('#eventStart').value = dateStr;
        $('#eventEnd').value = dateStr;
    } else {
        const today = dateToStr(new Date());
        $('#eventStart').value = today;
        $('#eventEnd').value = today;
    }

    DOM.modalOverlay.classList.remove('hidden');
    setTimeout(() => $('#eventName').focus(), 100);
}

function openEditModal(eventId) {
    const evt = APP.events.find(e => e.id === eventId);
    if (!evt) return;

    APP.editingEventId = eventId;
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

    DOM.modalOverlay.classList.remove('hidden');
}

function closeModal() {
    DOM.modalOverlay.classList.add('hidden');
    APP.editingEventId = null;
    DOM.eventForm.reset();
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
}

function handleDelete() {
    if (!APP.editingEventId) return;

    APP.events = APP.events.filter(e => e.id !== APP.editingEventId);
    saveData();
    closeModal();
    render();
    showToast('Événement supprimé', 'info');
}

// ─── Toasts ──────────────────────────────────────
function showToast(message, type = 'info') {
    const icons = {
        success: 'ri-check-line',
        error: 'ri-error-warning-line',
        info: 'ri-information-line',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="${icons[type] || icons.info}"></i><span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
