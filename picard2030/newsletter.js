/* ============================================================
   PICARD2030 — Newsletter (Brevo / Outlook)
   Construit à partir des données publiées une lettre très simple,
   lisible par tous : grands chantiers, frise, chiffres clés.

   Contraintes e-mail (Outlook, Brevo, Gmail) : mise en page en
   tableaux, styles en ligne, largeur 600 px, pas de SVG ni de CSS
   avancé. Les images sont appelées par une adresse publique.
   ============================================================ */

const SITE_URL = 'https://slvlmr.github.io/picard-eliot/picard2030/';
const LOGO_URL = SITE_URL + 'logo/picard2030-email.png';
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

const C = {
    page: '#ece8e1', page2: '#f6f3ee', card: '#ffffff', ink: '#16161a', ink2: '#55555e', muted: '#8a8a94', line: '#e7e3dc',
    dark: '#0b0b0d', gold: '#e2b064', goldSoft: '#fbf3e4', goldInk: '#8a5d17',
    done: '#2f9e6e', doneSoft: '#e5f5ee', next: '#cfc9bf',
};
const FONT = "Inter, 'Segoe UI', Arial, Helvetica, sans-serif";
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const opts = { intro: '' };
const INTRO_DEFAUT = "Picard 2030, c'est notre feuille de route pour les années à venir. Chaque mois, on fait le point ensemble : ce qui avance, ce qui est fait et ce qui arrive.";

function $id(id) { return document.getElementById(id); }
function moisAnnee(d) { return `${MOIS[d.getMonth()]} ${d.getFullYear()}`; }
function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── Données ─────────────────────────────────────
function themesNewsletter() { return publicThemes(); }

function axes() {
    const themes = themesNewsletter(), pris = new Set();
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
        return { ...a, prog, start, end, etat, nDone: acts.filter(x => x.progress >= 100).length, n: acts.length };
    });
}

function chiffres() {
    const acts = themesNewsletter().flatMap(t => t.actions);
    return {
        total: acts.length,
        fait: acts.filter(a => a.progress >= 100).length,
        encours: acts.filter(a => a.progress < 100 && actionRange(a).start <= today).length,
        avenir: acts.filter(a => a.progress < 100 && actionRange(a).start > today).length,
        prog: weightedProgress(themesNewsletter()),
    };
}

// Frise : lancement, étapes passées, aujourd'hui, prochains rendez-vous, fin des chantiers
function frise() {
    const themes = themesNewsletter(), ax = axes();
    if (!themes.length) return [];
    const ev = [];
    const debut = new Date(Math.min(...themes.map(t => themeRange(t).start)));
    ev.push({ d: debut, txt: 'Lancement', etat: 'fait' });
    themes.forEach(t => t.actions.filter(isMilestone).forEach(a => {
        const d = actionRange(a).end;
        ev.push({ d, txt: courte(a.name), etat: a.progress >= 100 || d < today ? 'fait' : 'avenir', rdv: true });
    }));
    ax.forEach(a => ev.push({ d: a.end, txt: a.titre, etat: a.etat === 'fait' ? 'fait' : 'avenir', fin: true }));
    ev.push({ d: today, txt: "Aujourd'hui", etat: 'ici' });
    // regroupe par mois
    const byMonth = new Map();
    ev.sort((a, b) => a.d - b.d).forEach(e => {
        const k = e.etat === 'ici' ? 'ici' : `${e.d.getFullYear()}-${e.d.getMonth()}`;
        if (!byMonth.has(k)) byMonth.set(k, { d: e.d, etat: e.etat, items: [] });
        const g = byMonth.get(k);
        if (e.etat !== 'ici') g.items.push(e);
        if (e.etat === 'avenir') g.etat = 'avenir';
    });
    let pts = [...byMonth.values()].sort((a, b) => a.d - b.d);
    // au plus 6 points : le lancement, le dernier passé, aujourd'hui, puis les suivants
    const iIci = pts.findIndex(p => p.etat === 'ici');
    const passes = pts.slice(0, iIci), futurs = pts.slice(iIci + 1);
    const garde = [passes[0], passes.length > 1 ? passes[passes.length - 1] : null].filter(Boolean);
    pts = [...garde, pts[iIci], ...futurs].slice(0, 6);
    if (futurs.length && !pts.includes(futurs[futurs.length - 1])) pts[pts.length - 1] = futurs[futurs.length - 1];
    return pts.map(p => ({ ...p, label: p.etat === 'ici' ? "Aujourd'hui" : resume(p.items), sub: detail(p) }));
}

// Une ligne d'explication sous chaque étape de la route
function detail(p) {
    if (p.etat === 'ici') { const k = chiffres(); return `${k.encours} actions en cours · ${k.fait} terminées`; }
    const rdv = p.items.filter(i => i.rdv), fins = p.items.filter(i => i.fin);
    if (p.items.length === 1 && p.items[0].txt === 'Lancement') return 'Les premiers chantiers démarrent';
    if (rdv.length > 1) return rdv.slice(0, 2).map(i => i.txt).join(' · ') + (rdv.length > 2 ? '…' : '');
    if (rdv.length === 1 && fins.length) return `Et l'objectif pour : ${fins.map(f => f.txt).join(', ')}`;
    if (fins.length === 1) return p.etat === 'fait' ? 'Chantier terminé' : 'Fin prévue du chantier';
    if (fins.length > 1) return fins.map(f => f.txt).join(', ');
    return '';
}

function resume(items) {
    const rdv = items.filter(i => i.rdv), fins = items.filter(i => i.fin);
    if (rdv.length === 1) return rdv[0].txt;
    if (rdv.length > 1) return `${rdv.length} étapes clés`;
    if (fins.length === 1) return fins[0].txt;
    if (fins.length > 1) return `${fins.length} chantiers à boucler`;
    return items[0]?.txt || '';
}

// Raccourcit un intitulé d'action pour la frise (avant « : » ou « (»)
function courte(s) {
    const t = s.split(/\s[:(–-]\s?/)[0].trim();
    return t.length > 34 ? t.slice(0, 32) + '…' : t;
}

function prochainRdv() {
    const rdv = themesNewsletter().flatMap(t => t.actions.filter(a => isMilestone(a) && a.progress < 100).map(a => ({ a, d: actionRange(a).end })))
        .filter(x => x.d >= today).sort((x, y) => x.d - y.d);
    return rdv[0] || null;
}

function faits() {
    return themesNewsletter().flatMap(t => t.actions.filter(a => a.progress >= 100).map(a => ({ a, t, d: actionRange(a).end })))
        .sort((x, y) => y.d - x.d).slice(0, 4);
}

function aVenir() {
    const rdv = prochainRdv();
    return upcomingDeadlines(themesNewsletter()).filter(x => !rdv || x.action !== rdv.a).slice(0, 3);
}

// ─── Briques e-mail (tableaux + styles en ligne) ──
const T = (attrs = '') => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${attrs}>`;

// Jauge en segments : robuste dans Outlook (cellules colorées), très lisible
function segments(pct, n, on, off, h = 12, gap = 3) {
    const plein = Math.round(clamp(pct, 0, 100) / 100 * n);
    const cells = Array.from({ length: n }, (_, i) =>
        `<td height="${h}" bgcolor="${i < plein ? on : off}" style="height:${h}px;background:${i < plein ? on : off};border-radius:3px;font-size:0;line-height:0">&nbsp;</td>`).join('');
    return `${T(`width="100%" cellspacing="${gap}" style="border-collapse:separate;margin:0 -${gap}px"`)}<tr>${cells}</tr></table>`;
}

function kicker(txt, color = C.gold) {
    return `<div style="font:bold 11px/14px ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${color}">${txt}</div>`;
}

function sectionTitre(k, t, dark) {
    return `${kicker(k, dark ? C.gold : C.goldInk)}<div style="font:bold 24px/30px ${FONT};color:${dark ? '#ffffff' : C.ink};letter-spacing:-.02em;padding:4px 0 18px">${t}</div>`;
}

function stat(nb, label, color, icone) {
    return `<td width="33%" valign="top" style="padding:0 4px">
        ${T(`width="100%" bgcolor="#16161a" style="background:#16161a;border:1px solid #26262c;border-radius:14px"`)}<tr><td style="padding:14px 14px 12px">
            <div style="font:bold 13px/16px ${FONT};color:${color}">${icone}</div>
            <div style="font:bold 30px/34px ${FONT};color:#ffffff;letter-spacing:-.02em;padding-top:4px">${nb}</div>
            <div style="font:12px/16px ${FONT};color:#a9a9b2">${label}</div>
        </td></tr></table>
    </td>`;
}

// Route verticale : passé ✓, « vous êtes ici », prochaines étapes, horizon 2030
function routeHtml() {
    const pts = frise();
    if (!pts.length) return '';
    const steps = [...pts, { d: new Date(2030, 0, 1), etat: 'horizon', label: 'Picard 2030', sub: "L'horizon de notre feuille de route" }];
    return T('width="100%"') + steps.map((p, i) => {
        const last = i === steps.length - 1, ici = p.etat === 'ici', fait = p.etat === 'fait', hz = p.etat === 'horizon';
        const nodeBg = fait ? C.done : ici ? C.gold : hz ? C.dark : '#ffffff';
        const nodeBd = fait ? C.done : ici ? C.gold : hz ? C.dark : C.next;
        const sym = fait ? '✓' : ici ? '★' : hz ? '⚑' : '';
        const lineCol = (steps[i + 1] && (steps[i + 1].etat === 'fait' || steps[i + 1].etat === 'ici')) ? C.done : C.next;
        const date = ici ? "AUJOURD'HUI" : hz ? '2030' : `${MONTHS[p.d.getMonth()].replace('.', '').toUpperCase()} ${p.d.getFullYear()}`;
        const sub = p.sub || (ici ? 'Vous êtes ici' : '');
        return `<tr>
            <td width="96" valign="top" align="right" style="padding:${ici ? 13 : 5}px 14px 0 0;font:bold 11px/14px ${FONT};letter-spacing:.06em;color:${ici ? C.goldInk : fait ? C.done : C.muted};white-space:nowrap">${date}</td>
            <td width="30" valign="top" align="center">
                ${T('width="30"')}<tr><td align="center" height="${ici ? 30 : 24}" valign="middle">
                    ${T()}<tr><td width="${ici ? 28 : 22}" height="${ici ? 28 : 22}" align="center" valign="middle" bgcolor="${nodeBg}"
                        style="width:${ici ? 28 : 22}px;height:${ici ? 28 : 22}px;background:${nodeBg};border:2px solid ${nodeBd};border-radius:30px;color:#ffffff;font:bold ${ici ? 14 : 12}px/${ici ? 28 : 22}px ${FONT};text-align:center">${sym || '&nbsp;'}</td></tr></table>
                </td></tr>
                ${last ? '' : `<tr><td align="center">${T()}<tr><td width="3" height="${ici ? 40 : 34}" bgcolor="${lineCol}" style="width:3px;height:${ici ? 40 : 34}px;background:${lineCol};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`}
                </table>
            </td>
            <td valign="top" style="padding:${ici ? 0 : 2}px 0 ${last ? 0 : 10}px 14px">
                ${ici ? `${T(`width="100%" bgcolor="${C.goldSoft}" style="background:${C.goldSoft};border:1px solid #efd9b0;border-radius:12px"`)}<tr><td style="padding:10px 14px">
                    <div style="font:bold 15px/20px ${FONT};color:${C.ink}">📍 Vous êtes ici</div>
                    <div style="font:13px/18px ${FONT};color:${C.goldInk}">${esc(p.sub || '')}</div></td></tr></table>`
                : `<div style="font:bold 15px/20px ${FONT};color:${hz ? C.ink : p.etat === 'avenir' ? C.ink : C.ink}">${esc(p.label)}</div>
                   ${sub ? `<div style="font:13px/18px ${FONT};color:${C.ink2}">${esc(sub)}</div>` : ''}`}
            </td>
        </tr>`;
    }).join('') + '</table>';
}

const ETATS = {
    fait: { txt: '✓ Terminé', bg: C.doneSoft, fg: C.done },
    encours: { txt: 'En cours', bg: C.goldSoft, fg: C.goldInk },
    lance: { txt: 'Lancé', bg: C.goldSoft, fg: C.goldInk },
    avenir: { txt: 'Bientôt', bg: '#f0eee9', fg: C.ink2 },
};

function carteChantier(a) {
    const e = ETATS[a.etat];
    return `${T(`width="100%" bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${C.line};border-radius:16px"`)}<tr><td style="padding:18px 18px 16px">
        ${T('width="100%"')}<tr>
            <td width="46" valign="top">${T()}<tr><td width="42" height="42" align="center" valign="middle" bgcolor="${C.goldSoft}" style="width:42px;height:42px;background:${C.goldSoft};border-radius:12px;font:22px/42px ${FONT};text-align:center">${a.emoji}</td></tr></table></td>
            <td valign="middle" align="right"><span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${e.bg};color:${e.fg};font:bold 11px/16px ${FONT};white-space:nowrap">${e.txt}</span></td>
        </tr></table>
        <div style="font:bold 16px/21px ${FONT};color:${C.ink};padding-top:12px;letter-spacing:-.01em">${esc(a.titre)}</div>
        <div style="font:12.5px/17px ${FONT};color:${C.ink2};padding-top:3px;min-height:34px">${esc(a.texte || '')}</div>
        <div style="font:bold 30px/34px ${FONT};color:${C.ink};letter-spacing:-.03em;padding-top:10px">${a.prog}<span style="font-size:15px;color:${C.muted}">&nbsp;%</span></div>
        <div style="padding-top:8px">${segments(a.prog, 10, a.etat === 'fait' ? C.done : C.gold, '#ece8e1', 8, 2)}</div>
        <div style="font:11.5px/16px ${FONT};color:${C.muted};padding-top:8px">${a.etat === 'fait' ? 'Objectif atteint' : `Objectif : ${moisAnnee(a.end)}`}</div>
    </td></tr></table>`;
}

function grilleChantiers(ax) {
    const rows = [];
    for (let i = 0; i < ax.length; i += 2) {
        rows.push(`<tr>
            <td class="col" width="50%" valign="top" style="padding:0 6px 12px 0">${carteChantier(ax[i])}</td>
            <td class="col" width="50%" valign="top" style="padding:0 0 12px 6px">${ax[i + 1] ? carteChantier(ax[i + 1]) : '&nbsp;'}</td>
        </tr>`);
    }
    return `${T('width="100%"')}${rows.join('')}</table>`;
}

function colonneListe(titreTxt, icone, color, items) {
    return `<div style="font:bold 15px/20px ${FONT};color:${C.ink};padding-bottom:12px"><span style="color:${color}">${icone}</span>&nbsp; ${titreTxt}</div>
    ${T('width="100%"')}${items.map(x => `<tr>
        <td width="4" bgcolor="${color}" style="background:${color};border-radius:4px;font-size:0">&nbsp;</td>
        <td valign="top" style="padding:2px 0 14px 12px">
            <div style="font:bold 13.5px/18px ${FONT};color:${C.ink}">${esc(x.txt)}</div>
            <div style="font:12px/16px ${FONT};color:${C.muted};padding-top:2px">${esc(x.sub)}</div>
        </td></tr>`).join('')}</table>`;
}

// ─── La lettre complète ──────────────────────────
function emailHtml(mode) {
    const s = settings(), k = chiffres(), ax = axes(), rdv = prochainRdv();
    const edition = capital(moisAnnee(today));
    const intro = (opts.intro || INTRO_DEFAUT).trim();
    const fait = faits().map(x => ({ txt: x.a.name, sub: x.t.name }));
    const venir = aVenir().map(x => ({ txt: x.name, sub: `${capital(moisAnnee(x.date))} · ${x.theme.name}` }));
    const brevo = mode === 'brevo';
    const jours = rdv ? daysBetween(today, rdv.d) : 0;

    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(s.title)} · La lettre · ${edition}</title>
<!--[if mso]><style>table,td,div,span,a{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:${C.page}}
  a{text-decoration:none}
  @media only screen and (max-width:620px){
    .wrap{width:100% !important}
    .px{padding-left:20px !important;padding-right:20px !important}
    .col{display:block !important;width:100% !important;padding:0 0 12px 0 !important}
    .big{font-size:64px !important;line-height:64px !important}
    .h1{font-size:30px !important;line-height:36px !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${k.prog} % du plan commercial réalisé · ${k.fait} actions terminées · ${rdv ? 'prochain rendez-vous : ' + esc(rdv.a.name) : ''}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</div>
${T(`width="100%" bgcolor="${C.page}" style="background:${C.page}"`)}
<tr><td align="center" style="padding:20px 10px 30px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
${T('class="wrap" width="600" style="width:600px;max-width:600px"')}
${brevo ? `<tr><td align="center" style="font:11px/16px ${FONT};color:${C.muted};padding:0 0 12px"><a href="{{ mirror }}" style="color:${C.muted};text-decoration:underline">Voir cette lettre dans le navigateur</a></td></tr>` : ''}

<!-- ══ Couverture ══ -->
<tr><td bgcolor="${C.dark}" style="background:${C.dark};border-radius:22px 22px 0 0;padding:28px 36px 0" class="px">
  ${T('width="100%"')}<tr>
    <td valign="middle" width="52"><img src="${LOGO_URL}" width="44" height="43" alt="Picard 2030" style="display:block;border:0;width:44px;height:43px"></td>
    <td valign="middle" style="padding-left:12px">${kicker('La lettre Picard 2030')}<div style="font:12px/16px ${FONT};color:#8a8a94;padding-top:2px">Plan commercial</div></td>
    <td valign="middle" align="right"><span style="display:inline-block;border:1px solid #2a2a30;border-radius:20px;padding:5px 12px;font:bold 11px/14px ${FONT};color:#ffffff;letter-spacing:.06em;text-transform:uppercase">${edition}</span></td>
  </tr></table>
  <div class="h1" style="font:bold 38px/44px ${FONT};color:#ffffff;letter-spacing:-.035em;padding-top:34px">Cap sur 2030.</div>
  <div style="font:bold 20px/26px ${FONT};color:${C.gold};letter-spacing:-.02em;padding-top:2px">Où en sommes-nous&nbsp;?</div>
  <div style="font:15px/24px ${FONT};color:#c4c4cc;padding-top:16px">${esc(intro).replace(/\n/g, '<br>')}</div>
</td></tr>
<tr><td bgcolor="${C.dark}" style="background:${C.dark};padding:30px 36px 8px" class="px">
  ${T('width="100%"')}<tr>
    <td valign="bottom"><div class="big" style="font:bold 84px/80px ${FONT};color:${C.gold};letter-spacing:-.05em">${k.prog}<span style="font-size:36px;letter-spacing:0">%</span></div></td>
    <td valign="bottom" align="right" style="font:14px/20px ${FONT};color:#c4c4cc;padding-bottom:8px">du plan commercial<br><b style="color:#ffffff">déjà réalisé</b></td>
  </tr></table>
  <div style="padding-top:16px">${segments(k.prog, 20, C.gold, '#24242a', 14, 3)}</div>
</td></tr>
<tr><td bgcolor="${C.dark}" style="background:${C.dark};padding:18px 32px 34px" class="px">
  ${T('width="100%"')}<tr>
    ${stat(k.fait, 'actions terminées', '#4ade80', '✓ FAIT')}
    ${stat(k.encours, 'actions en cours', C.gold, '▶ EN COURS')}
    ${stat(k.avenir, 'actions à venir', '#a9a9b2', '◷ À VENIR')}
  </tr></table>
</td></tr>
<tr><td height="5" bgcolor="${C.gold}" style="background:${C.gold};height:5px;font-size:0;line-height:0">&nbsp;</td></tr>

<!-- ══ La route ══ -->
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:36px 36px 26px" class="px">
  ${sectionTitre('La route Picard 2030', 'D’où on vient, où on va')}
  ${routeHtml()}
</td></tr>

<!-- ══ Chantiers ══ -->
<tr><td bgcolor="${C.page2}" style="background:${C.page2};padding:36px 30px 24px" class="px">
  <div style="padding:0 6px">${sectionTitre('Nos grands chantiers', `${ax.length} chantiers pour transformer notre façon de vendre`)}</div>
  ${grilleChantiers(ax)}
</td></tr>

${rdv ? `<!-- ══ Rendez-vous ══ -->
<tr><td bgcolor="${C.dark}" style="background:${C.dark};padding:30px 36px" class="px">
  ${T('width="100%"')}<tr>
    <td width="96" valign="middle">
      ${T(`width="84" bgcolor="${C.gold}" style="background:${C.gold};border-radius:16px"`)}<tr><td align="center" style="padding:12px 0 10px">
        <div style="font:bold 11px/14px ${FONT};color:${C.dark};letter-spacing:.1em;text-transform:uppercase">${MONTHS[rdv.d.getMonth()].replace('.', '')}</div>
        <div style="font:bold 38px/40px ${FONT};color:${C.dark};letter-spacing:-.03em">${rdv.d.getDate()}</div>
        <div style="font:bold 11px/14px ${FONT};color:${C.dark}">${rdv.d.getFullYear()}</div>
      </td></tr></table>
    </td>
    <td valign="middle" style="padding-left:18px">
      ${kicker('Prochain grand rendez-vous')}
      <div style="font:bold 20px/26px ${FONT};color:#ffffff;letter-spacing:-.02em;padding-top:6px">${esc(rdv.a.name)}</div>
      <div style="font:13px/18px ${FONT};color:#a9a9b2;padding-top:6px">${esc(rdv.a.note ? rdv.a.note.split('.')[0] : capital(fmtDate(rdv.d)))}</div>
      ${jours > 0 ? `<div style="padding-top:12px"><span style="display:inline-block;border:1px solid ${C.gold};color:${C.gold};border-radius:20px;padding:4px 12px;font:bold 12px/16px ${FONT}">Dans ${jours} jours</span></div>` : ''}
    </td>
  </tr></table>
</td></tr>` : ''}

<!-- ══ Fait / à venir ══ -->
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:34px 30px 18px" class="px">
  ${T('width="100%"')}<tr>
    ${fait.length ? `<td class="col" width="50%" valign="top" style="padding:0 14px 0 6px">${colonneListe('C’est fait', '✓', C.done, fait)}</td>` : ''}
    ${venir.length ? `<td class="col" width="50%" valign="top" style="padding:0 6px 0 14px">${colonneListe('Ça arrive', '→', C.gold, venir)}</td>` : ''}
  </tr></table>
</td></tr>

<!-- ══ Idées ══ -->
<tr><td bgcolor="${C.gold}" align="center" style="background:${C.gold};padding:34px 36px 36px;border-radius:0 0 22px 22px" class="px">
  <div style="font:40px/44px ${FONT}">💡</div>
  <div style="font:bold 24px/30px ${FONT};color:${C.dark};letter-spacing:-.02em;padding-top:8px">Et vous, une idée pour Picard 2030&nbsp;?</div>
  <div style="font:15px/22px ${FONT};color:#3a2a10;padding:8px 0 22px">Une remarque, une question, une piste d’amélioration&nbsp;:<br>écrivez-nous en une minute, on lit tout.</div>
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${IDEE_URL}" style="height:50px;v-text-anchor:middle;width:280px" arcsize="50%" stroke="f" fillcolor="${C.dark}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold">Je partage mon idée &#8594;</center></v:roundrect><![endif]-->
  <!--[if !mso]><!--><a href="${IDEE_URL}" style="display:inline-block;background:${C.dark};color:#ffffff;font:bold 16px/50px ${FONT};padding:0 32px;border-radius:50px;text-decoration:none">Je partage mon idée &#8594;</a><!--<![endif]-->
</td></tr>

<!-- ══ Pied ══ -->
<tr><td align="center" style="padding:22px 20px 0;font:12px/18px ${FONT};color:${C.muted}">
  <a href="${SITE_URL}" style="color:${C.goldInk};font-weight:bold;text-decoration:underline">Voir le suivi complet Picard 2030</a><br>
  Lettre interne Picard Serrures${brevo ? ` · <a href="{{ unsubscribe }}" style="color:${C.muted};text-decoration:underline">Se désinscrire</a>` : ''}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

// ─── Page : aperçu + export ──────────────────────
function render() {
    const html = emailHtml('outlook');
    const f = $id('preview');
    f.srcdoc = html;
    f.onload = () => { f.style.height = f.contentDocument.documentElement.scrollHeight + 'px'; };
}

function telecharger() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([emailHtml('brevo')], { type: 'text/html' }));
    a.download = `picard2030-newsletter-${iso(today).slice(0, 7)}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Fichier HTML téléchargé : à importer dans Brevo');
}

async function copierOutlook() {
    const html = emailHtml('outlook');
    try {
        await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([$id('preview').contentDocument.body.innerText], { type: 'text/plain' }),
        })]);
        toast('Copié : collez-le dans un nouveau message Outlook (Ctrl+V)');
    } catch (e) {
        // repli : sélection de l'aperçu
        const doc = $id('preview').contentDocument, sel = doc.getSelection(), r = doc.createRange();
        r.selectNodeContents(doc.body); sel.removeAllRanges(); sel.addRange(r);
        doc.execCommand('copy');
        toast('Copié : collez-le dans un nouveau message Outlook (Ctrl+V)');
    }
}

async function copierCode() {
    try { await navigator.clipboard.writeText(emailHtml('brevo')); toast('Code HTML copié : collez-le dans Brevo (« Coller votre code »)'); }
    catch (e) { toast('Copie impossible : utilisez « Export HTML »', true); }
}

function toast(msg, err) {
    const t = $id('toast');
    t.textContent = msg; t.className = 'toast show' + (err ? ' error' : '');
    clearTimeout(t._t); t._t = setTimeout(() => t.className = 'toast', 3200);
}

loadData();
try { opts.intro = localStorage.getItem('picard2030_nl_intro') || ''; } catch (e) { /* ignore */ }
$id('intro').value = opts.intro || INTRO_DEFAUT;
$id('intro').oninput = e => {
    opts.intro = e.target.value;
    try { localStorage.setItem('picard2030_nl_intro', opts.intro); } catch (err) { /* ignore */ }
    clearTimeout(render._t); render._t = setTimeout(render, 300);
};
$id('btn-export').onclick = telecharger;
$id('btn-outlook').onclick = copierOutlook;
$id('btn-code').onclick = copierCode;
render();
// Version partagée (celle que voient tous les visiteurs)
if (initCloud()) refreshSession().then(() => fetchShared()).then(row => {
    if (row && !(store.isLocal && cloud.isAdmin)) { useShared(row); render(); }
}).catch(() => { /* hors ligne : données du fichier */ });
