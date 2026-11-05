/* ============================================================
   PICARD2030 — Grands chantiers (partagé : newsletter + rapport)
   Regroupe les thèmes en quelques chantiers aux noms simples,
   et calcule les chiffres utilisés par les versions « usine »
   et « commerciaux & bureaux ».
   ============================================================ */

const SITE_URL = 'https://slvlmr.github.io/picard-eliot/picard2030/';
const IDEE_URL = SITE_URL + 'idee.html';

// Les grands chantiers, en mots simples. Un thème absent de cette liste
// (ajouté plus tard) apparaît seul, sous son propre nom.
const AXES = [
    { emoji: '👥', titre: 'Nos équipes', texte: 'Recruter, redessiner les secteurs et accompagner chacun.', themes: ['c-recrutement', 'c-organisation'] },
    { emoji: '🤝', titre: 'Nos installateurs agréés', texte: 'Un nouveau partenariat avec nos installateurs IAP.', themes: ['c-iap'] },
    { emoji: '🔐', titre: 'Nos produits', texte: 'Des gammes plus claires et de nouveaux produits.', themes: ['c-mkt-produits', 'c-reflex-confort'] },
    { emoji: '📣', titre: 'Faire connaître Picard', texte: 'Publicité, salons, réseaux sociaux et infos internes.', themes: ['c-mkt-operationnel', 'c-communication'] },
    { emoji: '🎧', titre: 'Nos clients', texte: 'Un service client et un SAV encore plus efficaces.', themes: ['c-service-client'] },
    { emoji: '🛡️', titre: 'Eliot', texte: 'Une nouvelle feuille de route pour Eliot.', themes: ['c-eliot'] },
];

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function moisAnnee(d) { return `${MOIS[d.getMonth()]} ${d.getFullYear()}`; }
function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function themesPublics() { return publicThemes(); }

// Réglage par action dans l'admin : « masquée » (n'apparaît pas dans les listes de la newsletter)
// ou « mise en avant » (passe en tête de « Ça arrive »). Les pourcentages, eux, ne changent pas.
function nlVisible(a) { return a.nl !== 'hide'; }

function axes() {
    const themes = themesPublics(), pris = new Set();
    const list = AXES.map(a => {
        const ts = themes.filter(t => a.themes.includes(t.id));
        ts.forEach(t => pris.add(t.id));
        return { ...a, ts };
    }).filter(a => a.ts.length);
    themes.filter(t => !pris.has(t.id)).forEach(t => list.push({ emoji: '📌', titre: t.name, texte: '', ts: [t] }));
    return list.map(a => {
        const acts = a.ts.flatMap(t => t.actions);
        const prog = weightedProgress(a.ts);
        const start = new Date(Math.min(...a.ts.map(t => themeRange(t).start)));
        const end = new Date(Math.max(...a.ts.map(t => themeRange(t).end)));
        const etat = prog >= 100 ? 'fait' : start > today ? 'avenir' : prog > 0 ? 'encours' : 'lance';
        const encours = a.ts.flatMap(t => t.actions.filter(x => nlVisible(x) && actionCounts(x) && x.progress < 100 && !isMilestone(x)).map(x => ({ a: x, t })))
            .sort((x, y) => y.a.progress - x.a.progress);
        const prochaine = upcomingDeadlines(a.ts).filter(x => !x.action || nlVisible(x.action))[0] || null;
        return { ...a, prog, start, end, etat, encours, prochaine, nDone: acts.filter(x => x.progress >= 100).length, n: acts.length };
    });
}

function chiffres() {
    const acts = themesPublics().flatMap(t => t.actions);
    return {
        total: acts.length,
        fait: acts.filter(a => a.progress >= 100).length,
        encours: acts.filter(a => a.progress < 100 && actionCounts(a)).length,
        avenir: acts.filter(a => !actionCounts(a)).length,
        prog: weightedProgress(themesPublics()),
    };
}

function prochainRdv() {
    const rdv = themesPublics().flatMap(t => t.actions.filter(a => nlVisible(a) && isMilestone(a) && a.progress < 100).map(a => ({ a, t, d: actionRange(a).end })))
        .filter(x => x.d >= today).sort((x, y) => x.d - y.d);
    return rdv[0] || null;
}

function faits(n = 4) {
    return themesPublics().flatMap(t => t.actions.filter(a => nlVisible(a) && a.progress >= 100).map(a => ({ a, t, d: actionRange(a).end })))
        .sort((x, y) => (y.a.nl === 'top') - (x.a.nl === 'top') || y.d - x.d).slice(0, n);
}

function aVenir(n = 3) {
    const rdv = prochainRdv();
    return upcomingDeadlines(themesPublics())
        .filter(x => (!rdv || x.action !== rdv.a) && (!x.action || nlVisible(x.action)))
        .sort((x, y) => ((y.action && y.action.nl === 'top') - (x.action && x.action.nl === 'top')) || x.date - y.date)
        .slice(0, n);
}

// Actions qui demandent un coup d'accélérateur (en retard ou en vigilance)
function aSurveiller(n = 4) {
    return themesPublics().flatMap(t => t.actions.filter(a => nlVisible(a) && ['late', 'warn'].includes(actionHealth(a))).map(a => ({ a, t, h: actionHealth(a), d: actionRange(a).end })))
        .sort((x, y) => (x.h === 'late' ? 0 : 1) - (y.h === 'late' ? 0 : 1) || x.d - y.d).slice(0, n);
}

// Trois phrases à retenir, pour la version usine
function aRetenir() {
    const k = chiffres(), ax = axes(), rdv = prochainRdv();
    const top = ax.slice().sort((x, y) => y.prog - x.prog)[0];
    const fin = ax.filter(a => a.etat !== 'fait' && a.end.getFullYear() === today.getFullYear()).length;
    const out = [{ icone: '✅', txt: `${k.fait} action${k.fait > 1 ? 's' : ''} déjà terminée${k.fait > 1 ? 's' : ''}, ${k.encours} en cours.` }];
    if (top) out.push({ icone: '🚀', txt: `Le chantier le plus avancé : ${top.titre} (${top.prog} %).` });
    if (fin) out.push({ icone: '🎯', txt: `${fin} chantier${fin > 1 ? 's' : ''} à boucler d'ici la fin de l'année.` });
    else if (rdv) out.push({ icone: '📅', txt: `Prochain rendez-vous : ${rdv.a.name}, le ${fmtDate(rdv.d)}.` });
    return out;
}
