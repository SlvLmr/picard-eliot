/* ============================================================
   PICARD-ATC — Connexion à Supabase (projet « COMMERCE »)
   Même contrat que le mode démo (demo.js).
   ============================================================ */

function createCloudStore(url, key) {
    const sb = window.supabase.createClient(url, key);
    const listeners = [];
    let timer;
    const notify = () => { clearTimeout(timer); timer = setTimeout(() => listeners.forEach(f => f()), 500); };
    const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
    const all = async (table, order) => { // lecture complète, par pages de 1000 lignes
        const out = [];
        for (let from = 0; ; from += 1000) {
            let q = sb.from(table).select('*').range(from, from + 999);
            if (order) q = q.order(order);
            const rows = ok(await q) || []; out.push(...rows);
            if (rows.length < 1000) return out;
        }
    };
    const upsertChunks = async (table, rows, onConflict) => { for (let i = 0; i < rows.length; i += 500) ok(await sb.from(table).upsert(rows.slice(i, i + 500), onConflict ? { onConflict } : undefined)); };

    return {
        mode: 'cloud',
        async init() {
            const ch = sb.channel('picard-atc-live');
            for (const t of ['imports', 'etats', 'commerciaux', 'affectations', 'zones_info', 'reglages']) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, notify);
            ch.subscribe();
            return true;
        },
        onChange(f) { listeners.push(f); },

        // ─── Connexion ───
        async session() {
            const { data } = await sb.auth.getSession();
            if (!data.session) return { isAdmin: false, email: '' };
            const { data: admin, error } = await sb.rpc('is_admin');
            return { isAdmin: !error && admin === true, email: data.session.user.email || '' };
        },
        async signIn(email, password) {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message);
            const s = await this.session();
            if (!s.isAdmin) { await sb.auth.signOut(); throw new Error("Ce compte n'a pas accès à l'administration."); }
            return s;
        },
        async signOut() { await sb.auth.signOut(); },

        // ─── Lecture ───
        async loadAll() {
            const [reg, com, sec, zi, am, jo, sm, pf, et, imp] = await Promise.all([
                sb.from('reglages').select('*').eq('id', 1).maybeSingle().then(ok),
                all('commerciaux', 'ordre'), all('affectations'), all('zones_info'), all('atc_mois'), all('jours', 'date'), all('societe_mois'), all('portefeuille', 'date'), all('etats'),
                sb.from('imports').select('created_at').order('created_at', { ascending: false }).limit(1).then(ok),
            ]);
            const affectations = {}; for (const a of sec) ((affectations[a.force] ||= {})[a.secteur] ||= []).push(a.commercial_id);
            const zonesInfo = {}; for (const z of zi) zonesInfo[z.zone] = { potentiel: +z.potentiel, iap: z.iap };
            const jours = jo.map(j => ({ d: j.date, enr: +j.enregistre, fact: +j.facture }));
            return {
                reglages: reg || {}, commerciaux: com, affectations, zonesInfo, etats: Object.fromEntries(et.map(e => [e.type, e.contenu])),
                atcMois: am.map(x => ({ c: x.commercial_id, a: x.annee, m: x.mois, g: x.gamme, r: x.realise == null ? null : +x.realise, b: +x.budget, q: x.qte == null ? null : +x.qte, n1: +x.realise_n1 })),
                jours,
                societeMois: sm.map(x => ({ a: x.annee, m: x.mois, b_enr: +x.budget_enr, b_fact: +x.budget_fact, jours_ouvres: x.jours_ouvres, n1_enr: +x.n1_enr, n1_fact: +x.n1_fact })),
                portefeuille: pf.map(x => ({ d: x.date, ...x.data })),
                etat: { derniere_date: jours.at(-1)?.d || null, dernier_import: imp?.[0]?.created_at || null, source: 'fichiers' },
            };
        },

        // ─── Admin ───
        async saveReglages(p) { ok(await sb.from('reglages').update({ ...p, updated_at: new Date().toISOString() }).eq('id', 1)); },
        async saveCommercial(c) {
            const row = { code: c.code || null, prenom: c.prenom || '', nom: c.nom, equipe: c.equipe || 'DIR', couleur: c.couleur, fonction: c.fonction || null, clientele: c.clientele || [],
                objectif_marge: c.objectif_marge ?? null, iap_objectif: c.iap_objectif || 0, iap_nouveaux: c.iap_nouveaux || 0,
                email: c.email || null, telephone: c.telephone || null, notes: c.notes || null, alias: c.alias || [], actif: c.actif !== false, ordre: c.ordre ?? 0 };
            if (c.id) { ok(await sb.from('commerciaux').update(row).eq('id', c.id)); return c; }
            return ok(await sb.from('commerciaux').insert(row).select().single());
        },
        async deleteCommercial(id) { ok(await sb.from('commerciaux').delete().eq('id', id)); },
        async setAffectation(force, secteur, ids) {
            ok(await sb.from('affectations').delete().eq('force', force).eq('secteur', secteur));
            if (ids.length) ok(await sb.from('affectations').insert(ids.map((commercial_id, ordre) => ({ force, secteur, commercial_id, ordre }))));
        },
        async setZoneInfo(zone, info) { ok(await sb.from('zones_info').upsert({ zone, potentiel: info.potentiel ?? 0, iap: info.iap ?? 0 })); },
        async listImports() { return ok(await sb.from('imports').select('*').order('created_at', { ascending: false }).limit(40)) || []; },

        // ─── Import des fichiers Picard ───
        async importer(kind, data, meta) {
            if (kind.startsWith('etat_')) {
                ok(await sb.from('etats').upsert({ type: kind.slice(5), date_etat: data.date || null, contenu: data, maj: new Date().toISOString() }));
            } else if (kind === 'quotidien') {
                await upsertChunks('jours', data.jours.map(j => ({ date: j.d, enregistre: j.enr, facture: j.fact })));
                await upsertChunks('societe_mois', data.mois.map(x => ({ annee: x.a, mois: x.m, budget_enr: x.b_enr, budget_fact: x.b_fact, jours_ouvres: x.jours_ouvres, n1_enr: x.n1_enr, n1_fact: x.n1_fact })));
            } else if (kind === 'portefeuille') {
                await upsertChunks('portefeuille', data.jours.map(({ d, ...rest }) => ({ date: d, data: rest })));
            } else if (kind === 'repartition') {
                const existants = await all('commerciaux');
                const ids = {}; const parEquipe = {};
                for (const p of data.personnes) {
                    const k = parEquipe[p.equipe] = (parEquipe[p.equipe] ?? -1) + 1;
                    let c = existants.find(x => x.code === p.code || norm(x.prenom + ' ' + x.nom) === norm(p.prenom + ' ' + p.nom));
                    if (!c) {
                        c = ok(await sb.from('commerciaux').insert({ code: p.code, prenom: p.prenom, nom: p.nom, equipe: p.equipe, couleur: nuance(equipeDe(p.equipe).couleur, k),
                            fonction: p.equipe === 'DIR' ? 'Direction' : p.equipe === 'DOM' ? 'Zone DOM-TOM' : 'ATC', ordre: existants.length }).select().single());
                        existants.push(c); // secteurs : à affecter dans l'admin (onglet Secteurs)
                    } else if (c.equipe !== p.equipe || c.code !== p.code) { // le fichier fait foi pour l'équipe et le libellé
                        ok(await sb.from('commerciaux').update({ equipe: p.equipe, code: p.code }).eq('id', c.id)); c.equipe = p.equipe; c.code = p.code;
                    }
                    ids[p.code] = c.id;
                }
                await upsertChunks('atc_mois', data.lignes.filter(l => ids[l.code]).map(l => ({ commercial_id: ids[l.code], annee: l.a, mois: l.m, gamme: l.g, realise: l.r, budget: l.b, qte: l.q, realise_n1: l.n1 })));
            }
            ok(await sb.from('imports').insert({ type: kind, fichier: meta.fichier, lignes: meta.lignes }));
        },
    };
}

function createStore() {
    const cfg = window.COMMERCE_CONFIG || {};
    if (cfg.supabaseUrl && cfg.supabaseKey && window.supabase?.createClient) return createCloudStore(cfg.supabaseUrl, cfg.supabaseKey);
    return createDemoStore();
}
