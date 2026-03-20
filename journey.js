/* ============================================
   PARCOURS CLIENT — Journey Builder
   Interactive flow map with SVG curves + glow
   Multi-parent connections supported
   ============================================ */

const JOURNEY = {
    nodes: [],
    editingNodeId: null,
    dragState: null,
    canvasOffset: { x: 0, y: 0 },
    linkingFromId: null, // ID of node we're linking FROM (as parent)
};

const LEAD_SOURCES = [
    { id: 'lead-internet', text: 'Lead Internet', desc: 'Site web, formulaire, chat', icon: 'ri-global-line', color: '#3b82f6', x: 80, y: 40 },
    { id: 'lead-phone', text: 'Lead Téléphonique', desc: 'Appel entrant, standard', icon: 'ri-phone-line', color: '#10b981', x: 360, y: 40 },
    { id: 'lead-agency', text: 'Lead Agence', desc: 'Visite en magasin, showroom', icon: 'ri-store-2-line', color: '#f59e0b', x: 640, y: 40 },
    { id: 'lead-email', text: 'Lead Email', desc: 'Demande par email, NL', icon: 'ri-mail-line', color: '#ec4899', x: 920, y: 40 },
];

/* ─── Helper: get parentIds array (handles legacy parentId) ─── */
function getParentIds(node) {
    if (Array.isArray(node.parentIds)) return node.parentIds;
    if (node.parentId) return [node.parentId];
    return [];
}

function setParentIds(node, ids) {
    node.parentIds = ids;
    delete node.parentId; // remove legacy field
}

/* ─── Migrate legacy data ─── */
function migrateNodes(nodes) {
    nodes.forEach(n => {
        if (!Array.isArray(n.parentIds)) {
            n.parentIds = n.parentId ? [n.parentId] : [];
            delete n.parentId;
        }
    });
    return nodes;
}

function loadJourney() {
    try {
        const data = localStorage.getItem('picard_eliot_journey_v1');
        if (data) {
            JOURNEY.nodes = migrateNodes(JSON.parse(data));
            saveJourney();
            return;
        }
    } catch(e) { console.warn(e); }
    resetJourney();
}

function saveJourney() {
    localStorage.setItem('picard_eliot_journey_v1', JSON.stringify(JOURNEY.nodes));
}

function resetJourney() {
    const nid = () => 'jn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    JOURNEY.nodes = [];

    // Create lead sources
    LEAD_SOURCES.forEach(ls => {
        JOURNEY.nodes.push({ id: ls.id, text: ls.text, desc: ls.desc, icon: ls.icon, color: ls.color, x: ls.x, y: ls.y, parentIds: [], isLead: true });
    });

    // Sample child nodes
    const sample = [
        // Internet branch
        { id: nid(), text: 'Formulaire contact', desc: 'Remplissage formulaire web', icon: 'ri-file-list-line', color: '#3b82f6', x: 40, y: 180, parentIds: ['lead-internet'] },
        { id: nid(), text: 'Qualification lead', desc: 'Vérification & scoring', icon: 'ri-shield-check-line', color: '#6366f1', x: 60, y: 320, parentIds: ['lead-internet'] },
        { id: nid(), text: 'Rappel commercial', desc: 'Appel dans les 24h', icon: 'ri-phone-line', color: '#8b5cf6', x: 30, y: 460, parentIds: ['lead-internet'] },

        // Phone branch
        { id: nid(), text: 'Accueil téléphonique', desc: 'Standard, identification besoin', icon: 'ri-customer-service-line', color: '#10b981', x: 320, y: 180, parentIds: ['lead-phone'] },
        { id: nid(), text: 'Prise de RDV', desc: 'Planification intervention', icon: 'ri-calendar-check-line', color: '#06b6d4', x: 340, y: 320, parentIds: ['lead-phone'] },

        // Agency branch
        { id: nid(), text: 'Accueil showroom', desc: 'Visite & démonstration', icon: 'ri-store-2-line', color: '#f59e0b', x: 600, y: 180, parentIds: ['lead-agency'] },
        { id: nid(), text: 'Devis sur place', desc: 'Établissement du devis', icon: 'ri-file-list-line', color: '#f97316', x: 620, y: 320, parentIds: ['lead-agency'] },

        // Email branch
        { id: nid(), text: 'Réponse automatique', desc: 'Accusé de réception + info', icon: 'ri-mail-line', color: '#ec4899', x: 880, y: 180, parentIds: ['lead-email'] },
        { id: nid(), text: 'Traitement demande', desc: 'Analyse & affectation', icon: 'ri-user-line', color: '#a855f7', x: 900, y: 320, parentIds: ['lead-email'] },
    ];

    // Shared bottom steps
    const sharedDevisId = nid();
    const sharedInterventionId = nid();
    const sharedSatisfactionId = nid();

    sample.forEach(n => JOURNEY.nodes.push(n));

    // Shared convergence nodes
    JOURNEY.nodes.push({ id: sharedDevisId, text: 'Envoi devis', desc: 'Devis personnalisé envoyé', icon: 'ri-file-list-line', color: '#8b5cf6', x: 400, y: 500, parentIds: [] });
    JOURNEY.nodes.push({ id: sharedInterventionId, text: 'Intervention / Installation', desc: 'Pose de la serrure', icon: 'ri-tools-line', color: '#10b981', x: 380, y: 640, parentIds: [sharedDevisId] });
    JOURNEY.nodes.push({ id: sharedSatisfactionId, text: 'Suivi satisfaction', desc: 'Appel J+7, enquête NPS', icon: 'ri-star-line', color: '#f59e0b', x: 400, y: 780, parentIds: [sharedInterventionId] });
    JOURNEY.nodes.push({ id: nid(), text: 'Fidélisation', desc: 'Programme fidélité, parrainage', icon: 'ri-repeat-line', color: '#ec4899', x: 420, y: 920, parentIds: [sharedSatisfactionId] });

    saveJourney();
}

// ─── Render ──────────────────────────────────────
function renderJourney() {
    const container = document.getElementById('journeyNodes');
    const svg = document.getElementById('journeySvg');
    if (!container || !svg) return;

    container.innerHTML = '';

    // Render nodes
    JOURNEY.nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = `journey-node${node.isLead ? ' lead-source' : ''}`;
        if (JOURNEY.linkingFromId && JOURNEY.linkingFromId !== node.id) {
            el.classList.add('link-target');
        }
        if (JOURNEY.linkingFromId === node.id) {
            el.classList.add('linking-source');
        }
        el.dataset.nodeId = node.id;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        el.style.borderColor = node.color;

        const parentIds = getParentIds(node);
        const childCount = JOURNEY.nodes.filter(n => getParentIds(n).includes(node.id)).length;
        const parentCount = parentIds.length;

        el.innerHTML = `
            <div class="journey-node-glow" style="background:radial-gradient(ellipse,${hexToRgbaJ(node.color, 0.15)},transparent)"></div>
            <div class="journey-node-header">
                <div class="journey-node-icon" style="background:${hexToRgbaJ(node.color, 0.15)};color:${node.color}">
                    <i class="${node.icon}"></i>
                </div>
                <div class="journey-node-title" contenteditable="true" data-node-id="${node.id}" spellcheck="false">${node.text}</div>
            </div>
            <div class="journey-node-desc" contenteditable="true" data-node-id="${node.id}" spellcheck="false">${node.desc || ''}</div>
            <div class="journey-node-footer">
                <div class="journey-node-actions">
                    <button class="journey-node-btn add-child" data-node-id="${node.id}" title="Ajouter une étape enfant"><i class="ri-add-circle-line"></i></button>
                    <button class="journey-node-btn link-btn" data-node-id="${node.id}" title="Relier à un autre bloc"><i class="ri-link"></i></button>
                    <button class="journey-node-btn edit-btn" data-node-id="${node.id}" title="Modifier"><i class="ri-edit-line"></i></button>
                    ${!node.isLead ? `<button class="journey-node-btn delete-btn" data-node-id="${node.id}" title="Supprimer"><i class="ri-delete-bin-6-line"></i></button>` : ''}
                </div>
                <div class="journey-node-meta">
                    ${parentCount > 1 ? `<span class="journey-node-parent-count" title="${parentCount} parents">${parentCount} <i class="ri-arrow-up-s-line"></i></span>` : ''}
                    ${childCount > 0 ? `<span class="journey-node-children-count">${childCount} étape${childCount > 1 ? 's' : ''}</span>` : ''}
                </div>
            </div>
        `;

        // Box shadow glow
        el.style.boxShadow = `0 0 20px ${hexToRgbaJ(node.color, 0.15)}, 0 4px 20px rgba(0,0,0,0.3)`;

        container.appendChild(el);
    });

    // Linking mode banner
    let banner = document.getElementById('linkingBanner');
    if (JOURNEY.linkingFromId) {
        const sourceNode = JOURNEY.nodes.find(n => n.id === JOURNEY.linkingFromId);
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'linkingBanner';
            document.getElementById('journeyCanvas').parentElement.prepend(banner);
        }
        banner.innerHTML = `<i class="ri-link"></i> Mode liaison : cliquez sur un bloc pour le relier à <strong>${sourceNode ? sourceNode.text : ''}</strong> <button id="cancelLinking" class="btn btn-ghost btn-sm">Annuler</button>`;
        banner.style.display = 'flex';
        banner.querySelector('#cancelLinking').addEventListener('click', () => {
            JOURNEY.linkingFromId = null;
            renderJourney();
        });
    } else if (banner) {
        banner.style.display = 'none';
    }

    // Draw curves
    drawCurves();

    // Bind events
    bindJourneyNodeEvents();

    // Update canvas size
    updateCanvasSize();
}

function updateCanvasSize() {
    const canvas = document.getElementById('journeyCanvas');
    if (!canvas) return;
    let maxX = 800, maxY = 600;
    JOURNEY.nodes.forEach(n => {
        if (n.x + 260 > maxX) maxX = n.x + 260;
        if (n.y + 200 > maxY) maxY = n.y + 200;
    });
    canvas.style.minWidth = maxX + 'px';
    canvas.style.minHeight = maxY + 'px';
}

// ─── SVG Curves ──────────────────────────────────
function drawCurves() {
    const svg = document.getElementById('journeySvg');
    if (!svg) return;

    // Clear existing paths (keep defs)
    svg.querySelectorAll('path').forEach(p => p.remove());

    JOURNEY.nodes.forEach(node => {
        const parentIds = getParentIds(node);
        if (parentIds.length === 0) return;

        const childEl = document.querySelector(`.journey-node[data-node-id="${node.id}"]`);
        if (!childEl) return;

        parentIds.forEach(pid => {
            const parent = JOURNEY.nodes.find(n => n.id === pid);
            if (!parent) return;

            const parentEl = document.querySelector(`.journey-node[data-node-id="${parent.id}"]`);
            if (!parentEl) return;

            const pRect = { x: parent.x + parentEl.offsetWidth / 2, y: parent.y + parentEl.offsetHeight };
            const cRect = { x: node.x + childEl.offsetWidth / 2, y: node.y };

            const midY = (pRect.y + cRect.y) / 2;
            const d = `M ${pRect.x} ${pRect.y} C ${pRect.x} ${midY}, ${cRect.x} ${midY}, ${cRect.x} ${cRect.y}`;

            const curveColor = node.color || parent.color;

            // Glow path (thick, blurred)
            const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            glowPath.setAttribute('d', d);
            glowPath.setAttribute('fill', 'none');
            glowPath.setAttribute('stroke', curveColor);
            glowPath.setAttribute('stroke-width', '6');
            glowPath.setAttribute('stroke-opacity', '0.25');
            glowPath.setAttribute('filter', 'url(#glowStrong)');
            glowPath.setAttribute('stroke-linecap', 'round');
            svg.appendChild(glowPath);

            // Main path
            const mainPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            mainPath.setAttribute('d', d);
            mainPath.setAttribute('fill', 'none');
            mainPath.setAttribute('stroke', curveColor);
            mainPath.setAttribute('stroke-width', '2.5');
            mainPath.setAttribute('stroke-opacity', '0.7');
            mainPath.setAttribute('stroke-linecap', 'round');
            mainPath.setAttribute('filter', 'url(#glowFilter)');
            svg.appendChild(mainPath);

            // Bright core line
            const corePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            corePath.setAttribute('d', d);
            corePath.setAttribute('fill', 'none');
            corePath.setAttribute('stroke', curveColor);
            corePath.setAttribute('stroke-width', '1.5');
            corePath.setAttribute('stroke-opacity', '0.9');
            corePath.setAttribute('stroke-linecap', 'round');
            svg.appendChild(corePath);
        });
    });
}

// ─── Drag & Drop ─────────────────────────────────
function bindJourneyNodeEvents() {
    const nodes = document.querySelectorAll('.journey-node');

    nodes.forEach(el => {
        // If in linking mode, clicking on a node links it
        if (JOURNEY.linkingFromId) {
            el.addEventListener('click', e => {
                if (e.target.closest('button')) return;
                const targetId = el.dataset.nodeId;
                if (targetId === JOURNEY.linkingFromId) return; // can't link to self

                linkNodes(JOURNEY.linkingFromId, targetId);
            });
        }

        // Drag
        el.addEventListener('mousedown', e => {
            if (e.target.closest('button') || e.target.closest('[contenteditable]') || e.target.tagName === 'INPUT') return;
            if (JOURNEY.linkingFromId) return; // don't drag in linking mode

            e.preventDefault();
            const nodeId = el.dataset.nodeId;
            const node = JOURNEY.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const origX = node.x;
            const origY = node.y;
            el.classList.add('dragging');

            const onMove = (ev) => {
                node.x = origX + (ev.clientX - startX);
                node.y = origY + (ev.clientY - startY);
                node.x = Math.max(0, node.x);
                node.y = Math.max(0, node.y);
                el.style.left = node.x + 'px';
                el.style.top = node.y + 'px';
                drawCurves();
            };

            const onUp = () => {
                el.classList.remove('dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                saveJourney();
                updateCanvasSize();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // Touch drag
        el.addEventListener('touchstart', e => {
            if (e.target.closest('button') || e.target.closest('[contenteditable]')) return;
            if (JOURNEY.linkingFromId) return;

            const nodeId = el.dataset.nodeId;
            const node = JOURNEY.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            const origX = node.x;
            const origY = node.y;
            el.classList.add('dragging');

            const onMove = (ev) => {
                ev.preventDefault();
                const t = ev.touches[0];
                node.x = Math.max(0, origX + (t.clientX - startX));
                node.y = Math.max(0, origY + (t.clientY - startY));
                el.style.left = node.x + 'px';
                el.style.top = node.y + 'px';
                drawCurves();
            };

            const onEnd = () => {
                el.classList.remove('dragging');
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
                saveJourney();
                updateCanvasSize();
            };

            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        }, { passive: false });
    });

    // Inline editing — title
    document.querySelectorAll('.journey-node-title[contenteditable]').forEach(el => {
        el.addEventListener('blur', () => {
            const node = JOURNEY.nodes.find(n => n.id === el.dataset.nodeId);
            if (node) { node.text = el.textContent.trim() || node.text; saveJourney(); }
        });
        el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    });

    // Inline editing — desc
    document.querySelectorAll('.journey-node-desc[contenteditable]').forEach(el => {
        el.addEventListener('blur', () => {
            const node = JOURNEY.nodes.find(n => n.id === el.dataset.nodeId);
            if (node) { node.desc = el.textContent.trim(); saveJourney(); }
        });
        el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    });

    // Add child
    document.querySelectorAll('.journey-node-btn.add-child').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            addChildNode(btn.dataset.nodeId);
        });
    });

    // Link button — enter linking mode
    document.querySelectorAll('.journey-node-btn.link-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const nodeId = btn.dataset.nodeId;
            if (JOURNEY.linkingFromId === nodeId) {
                // Toggle off
                JOURNEY.linkingFromId = null;
            } else {
                JOURNEY.linkingFromId = nodeId;
            }
            renderJourney();
        });
    });

    // Edit
    document.querySelectorAll('.journey-node-btn.edit-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            openNodeModal(btn.dataset.nodeId);
        });
    });

    // Delete
    document.querySelectorAll('.journey-node-btn.delete-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            deleteNode(btn.dataset.nodeId);
        });
    });
}

/* ─── Link two nodes (parent → child) ─── */
function linkNodes(parentId, childId) {
    const child = JOURNEY.nodes.find(n => n.id === childId);
    if (!child) return;

    const parentIds = getParentIds(child);

    // Check if already linked
    if (parentIds.includes(parentId)) {
        showToast('Ces blocs sont déjà reliés', 'info');
        JOURNEY.linkingFromId = null;
        renderJourney();
        return;
    }

    // Prevent self-referencing cycles (simple check)
    if (wouldCreateCycle(parentId, childId)) {
        showToast('Impossible : cela créerait une boucle', 'error');
        JOURNEY.linkingFromId = null;
        renderJourney();
        return;
    }

    parentIds.push(parentId);
    setParentIds(child, parentIds);

    JOURNEY.linkingFromId = null;
    saveJourney();
    renderJourney();
    showToast('Liaison créée', 'success');
}

/* ─── Cycle detection ─── */
function wouldCreateCycle(parentId, childId) {
    // If we add parentId as a parent of childId,
    // check if childId is already an ancestor of parentId
    const visited = new Set();
    const check = (nodeId) => {
        if (nodeId === childId) return true;
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);
        const node = JOURNEY.nodes.find(n => n.id === nodeId);
        if (!node) return false;
        return getParentIds(node).some(pid => check(pid));
    };
    return check(parentId);
}

function addChildNode(parentId) {
    const parent = JOURNEY.nodes.find(n => n.id === parentId);
    if (!parent) return;

    const id = 'jn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const childCount = JOURNEY.nodes.filter(n => getParentIds(n).includes(parentId)).length;

    JOURNEY.nodes.push({
        id,
        text: 'Nouvelle étape',
        desc: 'Description...',
        icon: 'ri-arrow-right-line',
        color: parent.color,
        x: parent.x + (childCount * 40) - 20,
        y: parent.y + 140,
        parentIds: [parentId],
        isLead: false,
    });

    saveJourney();
    renderJourney();
    showToast('Étape ajoutée', 'success');
}

function deleteNode(nodeId) {
    // Also delete all descendants (nodes whose only parents are in the deleted set)
    const toDelete = new Set();
    const collect = (id) => {
        toDelete.add(id);
        JOURNEY.nodes.filter(n => getParentIds(n).includes(id)).forEach(child => {
            // Only cascade-delete if ALL parents are being deleted
            const childParents = getParentIds(child);
            const remainingParents = childParents.filter(pid => !toDelete.has(pid));
            if (remainingParents.length === 0) {
                collect(child.id);
            }
        });
    };
    collect(nodeId);

    // For nodes NOT being deleted, remove references to deleted nodes from their parentIds
    JOURNEY.nodes.forEach(n => {
        if (toDelete.has(n.id)) return;
        const parentIds = getParentIds(n);
        const filtered = parentIds.filter(pid => !toDelete.has(pid));
        if (filtered.length !== parentIds.length) {
            setParentIds(n, filtered);
        }
    });

    JOURNEY.nodes = JOURNEY.nodes.filter(n => !toDelete.has(n.id));
    saveJourney();
    renderJourney();
    showToast('Bloc supprimé', 'info');
}

// ─── Node Modal ──────────────────────────────────
function initNodeModal() {
    const overlay = document.getElementById('nodeModalOverlay');
    const closeBtn = document.getElementById('nodeModalClose');
    const cancelBtn = document.getElementById('nodeModalCancel');
    const saveBtn = document.getElementById('nodeModalSave');
    const deleteBtn = document.getElementById('nodeDeleteBtn');

    closeBtn.addEventListener('click', closeNodeModal);
    cancelBtn.addEventListener('click', closeNodeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeNodeModal(); });

    saveBtn.addEventListener('click', saveNodeModal);
    deleteBtn.addEventListener('click', () => {
        if (JOURNEY.editingNodeId) {
            deleteNode(JOURNEY.editingNodeId);
            closeNodeModal();
        }
    });

    // Node color swatches
    document.querySelectorAll('.node-color-sw').forEach(sw => {
        sw.addEventListener('click', () => {
            document.getElementById('nodeColor').value = sw.dataset.color;
            document.querySelectorAll('.node-color-sw').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
        });
    });
}

function openNodeModal(nodeId) {
    const node = JOURNEY.nodes.find(n => n.id === nodeId);
    if (!node) return;

    JOURNEY.editingNodeId = nodeId;

    document.getElementById('nodeText').value = node.text;
    document.getElementById('nodeDesc').value = node.desc || '';
    document.getElementById('nodeColor').value = node.color;
    document.getElementById('nodeIcon').value = node.icon;

    document.querySelectorAll('.node-color-sw').forEach(s => s.classList.toggle('active', s.dataset.color === node.color));

    // Hide delete for lead sources
    document.getElementById('nodeDeleteBtn').style.display = node.isLead ? 'none' : 'flex';

    // Render parent connections list
    renderParentsList(node);

    document.getElementById('nodeModalOverlay').classList.remove('hidden');
}

function renderParentsList(node) {
    let container = document.getElementById('nodeParentsList');
    if (!container) return;

    const parentIds = getParentIds(node);
    if (parentIds.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Aucune connexion parente</span>';
        return;
    }

    container.innerHTML = parentIds.map(pid => {
        const parent = JOURNEY.nodes.find(n => n.id === pid);
        if (!parent) return '';
        return `<div class="parent-link-item">
            <span class="parent-link-color" style="background:${parent.color}"></span>
            <span class="parent-link-name">${parent.text}</span>
            ${!node.isLead ? `<button type="button" class="parent-link-remove" data-parent-id="${pid}" title="Retirer cette liaison"><i class="ri-close-line"></i></button>` : ''}
        </div>`;
    }).join('');

    // Bind remove buttons
    container.querySelectorAll('.parent-link-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const pid = btn.dataset.parentId;
            const n = JOURNEY.nodes.find(n => n.id === JOURNEY.editingNodeId);
            if (!n) return;
            const pids = getParentIds(n).filter(id => id !== pid);
            setParentIds(n, pids);
            saveJourney();
            renderParentsList(n);
            renderJourney();
            showToast('Liaison retirée', 'info');
            // Re-open modal on the same node
            openNodeModal(JOURNEY.editingNodeId);
        });
    });
}

function closeNodeModal() {
    document.getElementById('nodeModalOverlay').classList.add('hidden');
    JOURNEY.editingNodeId = null;
}

function saveNodeModal() {
    const node = JOURNEY.nodes.find(n => n.id === JOURNEY.editingNodeId);
    if (!node) return;

    node.text = document.getElementById('nodeText').value.trim() || node.text;
    node.desc = document.getElementById('nodeDesc').value.trim();
    node.color = document.getElementById('nodeColor').value;
    node.icon = document.getElementById('nodeIcon').value;

    saveJourney();
    closeNodeModal();
    renderJourney();
    showToast('Bloc modifié', 'success');
}

// ─── Reset ───────────────────────────────────────
function initJourneyToolbar() {
    const resetBtn = document.getElementById('journeyResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Réinitialiser le parcours client ? Toutes les modifications seront perdues.')) {
                resetJourney();
                renderJourney();
                showToast('Parcours réinitialisé', 'info');
            }
        });
    }
}

// ─── Helper ──────────────────────────────────────
function hexToRgbaJ(hex, alpha) {
    if (!hex || hex.charAt(0) !== '#') return `rgba(139,92,246,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// showToast is defined in app.js — if this runs standalone, define fallback
if (typeof showToast === 'undefined') {
    window.showToast = function(msg, type) { console.log(`[${type}] ${msg}`); };
}
