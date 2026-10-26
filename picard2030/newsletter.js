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
    page: '#f4f2ee', card: '#ffffff', ink: '#1a1a1f', ink2: '#55555e', muted: '#8a8a94', line: '#e7e3dc',
    dark: '#0b0b0d', gold: '#d9a656', goldSoft: '#fbf3e4', goldInk: '#7a5418',
    done: '#2f9e6e', doneSoft: '#e5f5ee', next: '#c9c4bb', violet: '#6d5bd0',
};
const FONT = "Inter, 'Segoe UI', Arial, Helvetica, sans-serif";
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const opts = { intro: '' };
const INTRO_DEFAUT = "Picard 2030, c'est notre feuille de route pour les prochaines années. Voici, en un coup d'œil, où nous en sommes côté commercial.";

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
    return pts.map(p => ({ ...p, label: p.etat === 'ici' ? "Aujourd'hui" : resume(p.items) }));
}

function resume(items) {
    const rdv = items.filter(i => i.rdv), fins = items.filter(i => i.fin);
    if (rdv.length === 1) return rdv[0].txt;
    if (rdv.length > 1) return `${rdv.length} étapes clés`;
    if (fins.length === 1) return fins[0].txt;
    if (fins.length === 2) return fins.map(f => f.txt.replace(/^(Nos|Faire) /, '')).map(capital).join(' · ');
    if (fins.length > 2) return `${fins.length} chantiers`;
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
function bar(pct, color, h = 10) {
    const p = clamp(Math.round(pct), 0, 100);
    const plein = p > 0 ? `<td width="${p}%" height="${h}" bgcolor="${color}" style="background:${color};height:${h}px;font-size:0;line-height:0;border-radius:${h}px">&nbsp;</td>` : '';
    const vide = p < 100 ? `<td height="${h}" bgcolor="${C.line}" style="background:${C.line};height:${h}px;font-size:0;line-height:0;border-radius:${h}px">&nbsp;</td>` : '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>${plein}${vide}</tr></table>`;
}

function ligne(color) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="3" bgcolor="${color}" style="background:${color};height:3px;font-size:0;line-height:0">&nbsp;</td></tr></table>`;
}

function point(etat) {
    const s = {
        fait: { bg: C.done, txt: '✓', size: 22 },
        ici: { bg: C.gold, txt: '★', size: 28 },
        avenir: { bg: '#ffffff', txt: '', size: 18, border: C.next },
    }[etat];
    return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="${s.size}" height="${s.size}" align="center" valign="middle" bgcolor="${s.bg}"
            style="width:${s.size}px;height:${s.size}px;background:${s.bg};border-radius:${s.size}px;${s.border ? `border:3px solid ${s.border};` : ''}color:#ffffff;font:bold 12px/${s.size}px ${FONT};text-align:center">${s.txt || '&nbsp;'}</td>
    </tr></table>`;
}

function friseHtml() {
    const pts = frise();
    if (!pts.length) return '';
    const w = Math.floor(100 / pts.length);
    const cell = (p, i) => {
        const avant = i === 0 ? '#ffffff' : (p.etat === 'avenir' ? C.next : C.done);
        const apres = i === pts.length - 1 ? '#ffffff' : (pts[i + 1].etat === 'avenir' ? C.next : (p.etat === 'ici' ? C.next : C.done));
        const ici = p.etat === 'ici';
        return `<td width="${w}%" valign="top" align="center" style="padding:0">
            <div style="font:bold 11px/14px ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${ici ? C.goldInk : C.muted};height:28px">${ici ? 'Vous êtes ici' : capital(MONTHS[p.d.getMonth()]).replace('.', '')}<br>${ici ? '' : p.d.getFullYear()}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="50%" valign="middle">${ligne(avant)}</td>
                <td valign="middle" style="padding:0 2px">${point(p.etat)}</td>
                <td width="50%" valign="middle">${ligne(apres)}</td>
            </tr></table>
            <div style="font:${ici ? 'bold ' : ''}12px/16px ${FONT};color:${p.etat === 'avenir' ? C.ink2 : C.ink};padding:8px 4px 0">${esc(p.label)}</div>
        </td>`;
    };
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${pts.map(cell).join('')}</tr></table>`;
}

const ETATS = {
    fait: { txt: 'Terminé', bg: C.doneSoft, fg: C.done },
    encours: { txt: 'En cours', bg: C.goldSoft, fg: C.goldInk },
    lance: { txt: 'Lancé', bg: C.goldSoft, fg: C.goldInk },
    avenir: { txt: 'Bientôt', bg: '#f0eee9', fg: C.ink2 },
};

function axeHtml(a) {
    const e = ETATS[a.etat];
    const fin = a.etat === 'fait' ? '' : `Objectif : ${moisAnnee(a.end)}`;
    return `<tr><td style="padding:0 0 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:12px">
            <tr><td style="padding:16px 18px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="44" valign="top" style="font:26px/30px ${FONT}">${a.emoji}</td>
                    <td valign="top">
                        <div style="font:bold 16px/20px ${FONT};color:${C.ink}">${esc(a.titre)}</div>
                        ${a.texte ? `<div style="font:13px/18px ${FONT};color:${C.ink2};padding-top:2px">${esc(a.texte)}</div>` : ''}
                    </td>
                    <td width="86" valign="top" align="right">
                        <span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${e.bg};color:${e.fg};font:bold 11px/16px ${FONT};white-space:nowrap">${e.txt}</span>
                    </td>
                </tr></table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px"><tr>
                    <td valign="middle" style="padding-right:12px">${bar(a.prog, a.etat === 'fait' ? C.done : C.gold)}</td>
                    <td width="44" align="right" valign="middle" style="font:bold 15px/18px ${FONT};color:${C.ink}">${a.prog}%</td>
                </tr></table>
                ${fin ? `<div style="font:12px/16px ${FONT};color:${C.muted};padding-top:6px">${fin} · ${a.nDone} action${a.nDone > 1 ? 's' : ''} terminée${a.nDone > 1 ? 's' : ''} sur ${a.n}</div>` : ''}
            </td></tr>
        </table>
    </td></tr>`;
}

function tuile(nb, label, color, bg) {
    return `<td width="33%" align="center" valign="top" style="padding:0 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background:${bg};border-radius:12px"><tr>
            <td align="center" style="padding:14px 6px">
                <div style="font:bold 28px/32px ${FONT};color:${color}">${nb}</div>
                <div style="font:12px/16px ${FONT};color:${C.ink2}">${label}</div>
            </td></tr></table>
    </td>`;
}

function titre(txt) {
    return `<div style="font:bold 12px/16px ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${C.goldInk};padding:0 0 12px">${txt}</div>`;
}

function liste(items, puce, color) {
    return items.map(x => `<tr>
        <td width="26" valign="top" style="font:bold 14px/20px ${FONT};color:${color}">${puce}</td>
        <td valign="top" style="font:14px/20px ${FONT};color:${C.ink};padding-bottom:8px">${esc(x.txt)}<br><span style="font-size:12px;color:${C.muted}">${esc(x.sub)}</span></td>
    </tr>`).join('');
}

// ─── La lettre complète ──────────────────────────
function emailHtml(mode) {
    const s = settings(), k = chiffres(), ax = axes(), rdv = prochainRdv();
    const edition = `Édition de ${moisAnnee(today)}`;
    const intro = (opts.intro || INTRO_DEFAUT).trim();
    const fait = faits().map(x => ({ txt: x.a.name, sub: x.t.name }));
    const venir = aVenir().map(x => ({ txt: x.name, sub: `${capital(moisAnnee(x.date))} · ${x.theme.name}` }));
    const brevo = mode === 'brevo';

    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light only">
<title>${esc(s.title)} · ${edition}</title>
<!--[if mso]><style>table,td,div,span{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:${C.page}}
  @media only screen and (max-width:620px){ .wrap{width:100% !important} .px{padding-left:18px !important;padding-right:18px !important} .frise td div{font-size:10px !important} }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Picard 2030 : ${k.prog} % du plan commercial réalisé, ${k.fait} actions terminées, prochain rendez-vous${rdv ? ' le ' + fmtDate(rdv.d) : ''}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}">
<tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
${brevo ? `<tr><td align="center" style="font:11px/16px ${FONT};color:${C.muted};padding:0 0 10px"><a href="{{ mirror }}" style="color:${C.muted}">Voir cette lettre dans le navigateur</a></td></tr>` : ''}

<!-- En-tête -->
<tr><td bgcolor="${C.dark}" style="background:${C.dark};border-radius:16px 16px 0 0;padding:28px 32px 26px" class="px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="64" valign="middle"><img src="${LOGO_URL}" width="52" height="52" alt="Picard 2030" style="display:block;border:0;width:52px;height:52px"></td>
    <td valign="middle" style="padding-left:14px">
      <div style="font:bold 11px/14px ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${C.gold}">La lettre Picard 2030</div>
      <div style="font:bold 24px/30px ${FONT};color:#ffffff">Où en sommes-nous&nbsp;?</div>
      <div style="font:13px/18px ${FONT};color:#a9a9b2">${edition} · Commerce</div>
    </td>
  </tr></table>
</td></tr>
<tr><td height="4" bgcolor="${C.gold}" style="background:${C.gold};height:4px;font-size:0;line-height:0">&nbsp;</td></tr>

<!-- Introduction + chiffre clé -->
<tr><td bgcolor="${C.card}" style="background:${C.card};padding:26px 32px 8px" class="px">
  <div style="font:15px/23px ${FONT};color:${C.ink}">${esc(intro).replace(/\n/g, '<br>')}</div>
</td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};padding:18px 32px 6px" class="px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td valign="bottom" style="font:bold 44px/46px ${FONT};color:${C.ink}">${k.prog}<span style="font-size:22px;color:${C.muted}">&nbsp;%</span></td>
    <td valign="bottom" align="right" style="font:13px/18px ${FONT};color:${C.ink2};padding-bottom:6px">du plan commercial<br>réalisé à ce jour</td>
  </tr></table>
  <div style="padding-top:10px">${bar(k.prog, C.gold, 14)}</div>
</td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};padding:16px 28px 26px" class="px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    ${tuile(k.fait, 'actions terminées', C.done, C.doneSoft)}
    ${tuile(k.encours, 'actions en cours', C.goldInk, C.goldSoft)}
    ${tuile(k.avenir, 'à venir', C.ink2, '#f0eee9')}
  </tr></table>
</td></tr>

<!-- Frise -->
<tr><td bgcolor="${C.page}" style="background:${C.page};padding:26px 20px 24px" class="px">
  <div style="padding:0 12px">${titre('La route Picard 2030')}</div>
  <div class="frise">${friseHtml()}</div>
</td></tr>

<!-- Grands chantiers -->
<tr><td bgcolor="${C.page}" style="background:${C.page};padding:4px 32px 12px" class="px">
  ${titre('Nos grands chantiers')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${ax.map(axeHtml).join('')}</table>
</td></tr>

${rdv ? `<!-- Rendez-vous -->
<tr><td bgcolor="${C.page}" style="background:${C.page};padding:4px 32px 18px" class="px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.dark}" style="background:${C.dark};border-radius:14px"><tr>
    <td width="70" align="center" valign="middle" style="padding:18px 0 18px 18px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.gold}" style="background:${C.gold};border-radius:10px"><tr><td align="center" style="padding:8px 12px">
        <div style="font:bold 22px/24px ${FONT};color:${C.dark}">${rdv.d.getDate()}</div>
        <div style="font:bold 11px/14px ${FONT};color:${C.dark};text-transform:uppercase">${MONTHS[rdv.d.getMonth()].replace('.', '')}</div>
      </td></tr></table>
    </td>
    <td valign="middle" style="padding:18px 20px 18px 16px">
      <div style="font:bold 11px/14px ${FONT};letter-spacing:.12em;text-transform:uppercase;color:${C.gold}">Prochain rendez-vous</div>
      <div style="font:bold 16px/21px ${FONT};color:#ffffff;padding-top:3px">${esc(rdv.a.name)}</div>
      <div style="font:13px/18px ${FONT};color:#a9a9b2;padding-top:2px">${capital(fmtDate(rdv.d))}</div>
    </td>
  </tr></table>
</td></tr>` : ''}

<!-- Fait / à venir -->
<tr><td bgcolor="${C.card}" style="background:${C.card};padding:26px 32px 14px;border-radius:0" class="px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${fait.length ? `<tr><td colspan="2">${titre('C’est fait ✓')}</td></tr>${liste(fait, '✓', C.done)}` : ''}
    ${venir.length ? `<tr><td colspan="2" style="padding-top:14px">${titre('Dans les prochaines semaines')}</td></tr>${liste(venir, '→', C.gold)}` : ''}
  </table>
</td></tr>

<!-- Appel à l'action -->
<tr><td bgcolor="${C.card}" align="center" style="background:${C.card};padding:10px 32px 30px;border-radius:0 0 16px 16px" class="px">
  <div style="font:15px/22px ${FONT};color:${C.ink};padding-bottom:14px">Une idée, une question, une remarque&nbsp;? On vous lit.</div>
  <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${SITE_URL}#idee" style="height:44px;v-text-anchor:middle;width:260px" arcsize="50%" stroke="f" fillcolor="${C.gold}"><w:anchorlock/><center style="color:${C.dark};font-family:Arial,sans-serif;font-size:15px;font-weight:bold">💡 Je partage mon idée</center></v:roundrect><![endif]-->
  <!--[if !mso]><!--><a href="${SITE_URL}#idee" style="display:inline-block;background:${C.gold};color:${C.dark};font:bold 15px/44px ${FONT};padding:0 28px;border-radius:44px;text-decoration:none">💡 Je partage mon idée</a><!--<![endif]-->
  <div style="font:13px/18px ${FONT};padding-top:14px"><a href="${SITE_URL}" style="color:${C.goldInk};text-decoration:underline">Voir le suivi complet</a></div>
</td></tr>

<!-- Pied -->
<tr><td align="center" style="padding:18px 20px 0;font:11px/16px ${FONT};color:${C.muted}">
  ${esc(s.title)} · Lettre interne Picard Serrures<br>
  ${brevo ? `<a href="{{ unsubscribe }}" style="color:${C.muted}">Se désinscrire</a>` : ''}
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
