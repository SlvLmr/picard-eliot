import fs from 'fs';
import * as d3 from 'd3-geo';
import { topology } from 'topojson-server';
import { feature, merge } from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';

const adm1 = JSON.parse(fs.readFileSync('adm1.geojson'));
const world = JSON.parse(fs.readFileSync('countries.json'));

const NOMS_BE = { 'BE-VWV':'Flandre-Occidentale','BE-WHT':'Hainaut','BE-WNA':'Namur','BE-WLX':'Luxembourg (BE)','BE-WLG':'Liège','BE-VOV':'Flandre-Orientale','BE-VAN':'Anvers','BE-VLI':'Limbourg','BE-BRU':'Bruxelles-Capitale','BE-VBR':'Brabant flamand','BE-WBR':'Brabant wallon' };
const NOMS_CH = { 'CH-VS':'Valais','CH-TI':'Tessin','CH-GR':'Grisons','CH-SH':'Schaffhouse','CH-TG':'Thurgovie','CH-ZH':'Zurich','CH-AG':'Argovie','CH-BS':'Bâle-Ville','CH-BL':'Bâle-Campagne','CH-SG':'Saint-Gall','CH-SO':'Soleure','CH-JU':'Jura (CH)','CH-GE':'Genève','CH-VD':'Vaud','CH-NE':'Neuchâtel','CH-BE':'Berne','CH-LU':'Lucerne','CH-ZG':'Zoug','CH-UR':'Uri','CH-SZ':'Schwytz','CH-GL':'Glaris','CH-NW':'Nidwald','CH-FR':'Fribourg','CH-OW':'Obwald','CH-AR':'Appenzell Rh.-Ext.','CH-AI':'Appenzell Rh.-Int.' };
const DOM = { 'FR-GP':['971','Guadeloupe'], 'FR-MQ':['972','Martinique'], 'FR-GF':['973','Guyane'], 'FR-RE':['974','La Réunion'], 'FR-YT':['976','Mayotte'] };
const FIX = { 'FR-77':'Seine-et-Marne', 'FR-68':'Haut-Rhin' };

const feats = {};
for (const f of adm1.features) {
  const p = f.properties, iso = p.iso_3166_2;
  if (p.adm0_a3 === 'FRA') {
    if (DOM[iso]) feats[DOM[iso][0]] = { ...f, properties: { code: DOM[iso][0], nom: DOM[iso][1], pays: 'FR', dom: true } };
    else { const c = iso.slice(3); feats[c] = { ...f, properties: { code: c, nom: FIX[iso] || p.name, pays: 'FR' } }; }
  } else if (p.adm0_a3 === 'BEL') feats[iso] = { ...f, properties: { code: iso, nom: NOMS_BE[iso], pays: 'BE' } };
  else if (p.adm0_a3 === 'CHE') feats[iso] = { ...f, properties: { code: iso, nom: NOMS_CH[iso], pays: 'CH' } };
  else if (p.adm0_a3 === 'LUX') feats['LU-' + iso] = { ...f, properties: { code: 'LU', pays: 'LU' } };
}
const COM = { '666': ['975', 'Saint-Pierre-et-Miquelon'], '258': ['987', 'Polynésie française'], '540': ['988', 'Nouvelle-Calédonie'] };
for (const g of feature(world, world.objects.countries).features) {
  if (COM[g.id]) feats[COM[g.id][0]] = { ...g, properties: { code: COM[g.id][0], nom: COM[g.id][1], pays: 'FR', dom: true } };
}
// Rewind rings for d3 (spherical winding)
function rewind(f) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) {
    if (d3.geoArea({ type: 'Polygon', coordinates: [ring] }) > 2 * Math.PI) ring.reverse();
  }
  return f;
}
const isDom = k => feats[k].properties.dom;
function simpl(keys, q) { const o = {}; keys.forEach(k => o[k] = feats[k]); const pre = presimplify(topology(o, 1e6)); return simplify(pre, quantile(pre, q)); }
const simp = simpl(Object.keys(feats).filter(k => !isDom(k)), 0.12);
const simpDom = simpl(Object.keys(feats).filter(isDom), 0.6);
const out = {};
for (const k of Object.keys(feats)) if (!k.startsWith('LU-')) out[k] = rewind(feature(isDom(k) ? simpDom : simp, (isDom(k) ? simpDom : simp).objects[k]));
const lu = merge(simp, Object.keys(feats).filter(k => k.startsWith('LU-')).map(k => simp.objects[k]));
out['LU'] = rewind({ type: 'Feature', properties: { code: 'LU', nom: 'Luxembourg', pays: 'LU' }, geometry: lu });

const W = 1000, MAIN_H = 900;
const main = Object.values(out).filter(f => !f.properties.dom);
const proj = d3.geoConicConformal().parallels([44, 49]).rotate([-3, 0]).fitExtent([[24, 16], [W - 24, MAIN_H - 10]], { type: 'FeatureCollection', features: main });
const R = n => Math.round(n * 100) / 100;
// Projection plane (+ filtre des îlots hors cadre pour les encarts)
function planar(f, pr, box) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const res = [];
  for (const poly of polys) {
    const rings = poly.map(ring => ring.map(p => { const q = pr(p); return [R(q[0]), R(q[1])]; }).reverse());
    if (box) { const inside = rings[0].some(([x, y]) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]); if (!inside) continue; }
    res.push(rings);
  }
  return { type: 'Feature', properties: f.properties, geometry: { type: 'MultiPolygon', coordinates: res } };
}
const planarFeats = {};
main.forEach(f => planarFeats[f.properties.code] = planar(f, proj));
const order = ['971', '972', '973', '974', '976', '975', '987', '988'];
const clip = { '987': [[-150.0, -17.92], [-149.1, -17.45]], '988': [[163.6, -22.75], [167.2, -20.0]] };
const IW = (W - 20 - 7 * 10) / 8, IY = MAIN_H + 14, IH = 118;
const insets = [];
order.forEach((code, i) => {
  const f = out[code]; const x = 10 + i * (IW + 10);
  const target = clip[code] ? { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[clip[code][0], [clip[code][1][0], clip[code][0][1]], clip[code][1], [clip[code][0][0], clip[code][1][1]], clip[code][0]].reverse()] } } : f;
  const pr = d3.geoMercator().fitExtent([[x + 14, IY + 24], [x + IW - 14, IY + IH - 10]], target);
  const pf = planar(f, pr, [x + 2, IY + 2, x + IW - 2, IY + IH - 2]);
  pf.properties = { ...pf.properties, inset: i };
  planarFeats[code] = pf;
  insets.push({ code, nom: f.properties.nom, x: R(x), y: IY, w: R(IW), h: IH });
});
// Topologie plane : arcs partagés → frontières entre zones
const topo = topology(planarFeats);
const fmt = n => Math.round(n * 10) / 10;
const ringsToD = rings => rings.map(r => 'M' + r.map(p => fmt(p[0]) + ',' + fmt(p[1])).join('L') + 'Z').join('');
const linesToD = lines => lines.map(l => 'M' + l.map(p => fmt(p[0]) + ',' + fmt(p[1])).join('L')).join('');
const zones = [];
const arcOwners = new Map();
const walk = (arcs, code) => { for (const a of arcs) { if (Array.isArray(a)) walk(a, code); else { const k = a < 0 ? ~a : a; (arcOwners.get(k) || arcOwners.set(k, []).get(k)).push(code); } } };
for (const code of Object.keys(planarFeats)) {
  const g = topo.objects[code]; walk(g.arcs || [], code);
  const f = feature(topo, g);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const d = polys.map(ringsToD).join('');
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, ax = 0, ay = 0, A = 0;
  for (const poly of polys) {
    const ring = poly[0]; let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) { const [xa, ya] = ring[i], [xb, yb] = ring[i + 1]; const c = xa * yb - xb * ya; a += c; cx += (xa + xb) * c; cy += (ya + yb) * c; }
    for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (a) { ax += cx / 3; ay += cy / 3; A += a; }
  }
  zones.push({ ...planarFeats[code].properties, d, c: [fmt(ax / A), fmt(ay / A)], b: [x0, y0, x1, y1].map(fmt), a: Math.round(Math.abs(A) / 2) });
}
const groups = new Map();
for (const [arc, owners] of arcOwners) { const k = [...new Set(owners)].sort().join('|'); (groups.get(k) || groups.set(k, []).get(k)).push(arc); }
const borders = [];
for (const [k, arcs] of groups) {
  const [a, b] = k.split('|');
  const ml = feature(topo, { type: 'MultiLineString', arcs: arcs.map(i => [i]) });
  borders.push({ a, b: b || null, d: linesToD(ml.geometry.coordinates) });
}
// Pays voisins (fond en filigrane)
const voisins = ['724', '380', '276', '528', '826', '040', '020', '492', '438', '372', '056', '442', '756'];
const wf = feature(world, world.objects.countries).features.filter(f => voisins.includes(String(f.id)) && !['056', '442', '756'].includes(String(f.id)));
const wtopo = presimplify(topology({ v: { type: 'FeatureCollection', features: wf } }, 1e5));
const wsimp = simplify(wtopo, quantile(wtopo, 0.25));
const fondPath = d3.geoPath(proj.clipExtent([[-40, -40], [W + 40, MAIN_H + 10]])).digits(1);
const fond = fondPath(feature(wsimp, wsimp.objects.v));
proj.clipExtent(null);
const H = IY + IH + 8;
const js = '/* Carte Commerce — généré par carte-build.mjs (Natural Earth, domaine public). Ne pas modifier à la main. */\nwindow.CARTE = ' + JSON.stringify({ w: W, h: H, mainH: MAIN_H, insets, fond, zones, borders }) + ';\n';
fs.writeFileSync('carte.js', js);
console.log(zones.length, 'zones', borders.length, 'frontières', (js.length / 1024).toFixed(0), 'Ko');
