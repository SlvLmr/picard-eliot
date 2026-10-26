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

// Frise des grands chantiers : une ligne par chantier, une colonne par trimestre.
// La barre couvre la durée prévue ; sa partie foncée montre l'avancement.
function friseChantiers() {
    const ax = axes();
    if (!ax.length) return '';
    const t0 = new Date(Math.min(...ax.map(a => a.start))), t1 = new Date(Math.max(...ax.map(a => a.end)));
    const q0 = new Date(t0.getFullYear(), Math.floor(t0.getMonth() / 3) * 3, 1);
    const qs = [];
    for (let d = q0; d <= t1; d = new Date(d.getFullYear(), d.getMonth() + 3, 1)) qs.push({ s: d, e: new Date(d.getFullYear(), d.getMonth() + 3, 0, 23) });
    const iNow = qs.findIndex(q => q.s <= today && today <= q.e);
    const LBL = 200, cw = Math.floor((600 - 72 - LBL) / qs.length);
    const cellBg = (i) => i === iNow ? '#fbf1df' : '#ffffff';

    // en-têtes : années puis trimestres
    const years = [];
    qs.forEach(q => { const y = q.s.getFullYear(); const last = years[years.length - 1]; if (last && last.y === y) last.n++; else years.push({ y, n: 1 }); });
    const head1 = `<tr><td class="lbl" width="${LBL}"></td>${years.map(y => `<td colspan="${y.n}" align="center" style="font:bold 12px/16px ${FONT};color:${C.ink};border-left:1px solid ${C.line};padding-bottom:2px">${y.y}</td>`).join('')}</tr>`;
    const head2 = `<tr><td class="lbl" width="${LBL}" style="font:11px/14px ${FONT};color:${C.muted};padding-bottom:6px">Trimestre</td>${qs.map((q, i) => `<td width="${cw}" align="center" bgcolor="${cellBg(i)}" style="background:${cellBg(i)};font:${i === iNow ? 'bold ' : ''}11px/14px ${FONT};color:${i === iNow ? C.goldInk : C.muted};padding:2px 0 6px;${q.s.getMonth() === 0 ? `border-left:1px solid ${C.line};` : ''}">T${q.s.getMonth() / 3 + 1}</td>`).join('')}</tr>`;
    const nowRow = iNow < 0 ? '' : `<tr><td class="lbl"></td>${qs.map((q, i) => `<td align="center" bgcolor="${cellBg(i)}" style="background:${cellBg(i)};font:bold 10px/12px ${FONT};color:${C.goldInk};padding-bottom:4px;white-space:nowrap">${i === iNow ? "▼ Aujourd'hui" : ''}</td>`).join('')}</tr>`;

    const rows = ax.map(a => {
        // point d'avancement : la part réalisée de la durée totale
        const pt = new Date(+a.start + (a.end - a.start) * a.prog / 100);
        const full = a.etat === 'fait' ? C.done : C.gold, light = '#f0dcb8';
        const cells = qs.map((q, i) => {
            const L = q.e - q.s, f = d => clamp((d - q.s) / L, 0, 1);
            const x0 = f(a.start), x1 = f(a.end), xp = clamp(f(pt), x0, x1);
            let bar = '&nbsp;';
            if (a.start <= q.e && a.end >= q.s && x1 > x0) {
                const startsHere = a.start >= q.s, endsHere = a.end <= q.e;
                const parts = [[x0, null], [xp - x0, full], [x1 - xp, light], [1 - x1, null]]
                    .map(([w, c]) => [Math.round(w * 100), c]).filter(([w]) => w > 0);
                const coloured = parts.filter(([, c]) => c);
                bar = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${parts.map(([w, c]) => {
                    if (!c) return `<td width="${w}%" style="font-size:0;line-height:0">&nbsp;</td>`;
                    const rl = startsHere && coloured[0][1] === c && coloured[0][0] === w ? '8px' : '0';
                    const rr = endsHere && coloured[coloured.length - 1][1] === c && coloured[coloured.length - 1][0] === w ? '8px' : '0';
                    return `<td width="${w}%" height="16" bgcolor="${c}" style="height:16px;background:${c};font-size:0;line-height:0;border-radius:${rl} ${rr} ${rr} ${rl}">&nbsp;</td>`;
                }).join('')}</tr></table>`;
            }
            return `<td valign="middle" bgcolor="${cellBg(i)}" style="background:${cellBg(i)};padding:9px 0;border-top:1px solid ${C.line};${q.s.getMonth() === 0 ? `border-left:1px solid ${C.line};` : ''}">${bar}</td>`;
        }).join('');
        const info = `<div style="font:bold 14px/18px ${FONT};color:${C.ink}">${a.emoji}&nbsp; ${esc(a.titre)}</div>
                ${a.texte ? `<div style="font:12px/16px ${FONT};color:${C.ink2};padding-top:3px">${esc(a.texte)}</div>` : ''}
                <div style="padding-top:7px;font:11.5px/16px ${FONT};color:${C.muted}"><b style="font-size:17px;color:${a.etat === 'fait' ? C.done : C.ink};letter-spacing:-.02em">${a.prog}&nbsp;%</b>&nbsp; <span style="display:inline-block;padding:1px 8px;border-radius:20px;background:${ETATS[a.etat].bg};color:${ETATS[a.etat].fg};font:bold 10.5px/15px ${FONT};vertical-align:2px">${ETATS[a.etat].txt}</span><br>Objectif : ${moisAnnee(a.end)}</div>`;
        // sur téléphone : le texte passe au-dessus de la barre (ligne masquée sur ordinateur)
        return `<tr class="mrow" style="display:none;mso-hide:all"><td colspan="${qs.length + 1}" style="padding:14px 0 2px;border-top:1px solid ${C.line}">${info}</td></tr>
            <tr><td class="lbl" width="${LBL}" valign="middle" style="padding:14px 12px 14px 0;border-top:1px solid ${C.line}">${info}</td>${cells}</tr>`;
    }).join('');

    const legende = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px"><tr>
        <td width="22" height="10" bgcolor="${C.gold}" style="background:${C.gold};border-radius:5px;font-size:0">&nbsp;</td>
        <td style="font:12px/16px ${FONT};color:${C.ink2};padding:0 16px 0 7px">Déjà réalisé</td>
        <td width="22" height="10" bgcolor="#f0dcb8" style="background:#f0dcb8;border-radius:5px;font-size:0">&nbsp;</td>
        <td style="font:12px/16px ${FONT};color:${C.ink2};padding:0 0 0 7px">Reste à faire</td>
    </tr></table>`;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed">${head1}${head2}${nowRow}${rows}</table>${legende}`;
}

const ETATS = {
    fait: { txt: '✓ Terminé', bg: C.doneSoft, fg: C.done },
    encours: { txt: 'En cours', bg: C.goldSoft, fg: C.goldInk },
    lance: { txt: 'Lancé', bg: C.goldSoft, fg: C.goldInk },
    avenir: { txt: 'Bientôt', bg: '#f0eee9', fg: C.ink2 },
};

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
    .lbl{display:none !important}
    .mrow{display:table-row !important}
    .mrow + tr td{border-top:0 !important;padding-top:6px !important}
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

<!-- ══ La frise ══ -->
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:36px 36px 26px" class="px">
  ${sectionTitre('La frise Picard 2030', `Nos ${ax.length} grands chantiers`)}
  ${friseChantiers()}
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
