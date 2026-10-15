/* ============================================================
   COMMERCE — Connexion à Supabase (projet « COMMERCE »)
   Même contrat que le mode démo (demo.js).
   - lecture : fonctions agrégées (serie_jour, par_zone, top_clients)
   - admin : connexion e-mail / mot de passe, 2 comptes autorisés
   - temps réel : chaque injection rafraîchit tous les écrans ouverts
   ============================================================ */

function createCloudStore(url, key) {
    const sb = window.supabase.createClient(url, key);
    const listeners = [];
    let timer;
    const notify = () => { clearTimeout(timer); timer = setTimeout(() => listeners.forEach(f => f()), 400); };
    const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
    const CHUNK = 2000;

    return {
        mode: 'cloud',
        async init() {
            sb.channel('commerce-live')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'imports' }, notify)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'commerciaux' }, notify)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'secteurs' }, notify)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'objectifs' }, notify)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'reglages' }, notify)
                .subscribe();
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
        async loadBase() {
            const [reg, com, sec, obj, etat] = await Promise.all([
                sb.from('reglages').select('*').eq('id', 1).maybeSingle(),
                sb.from('commerciaux').select('*').order('ordre').order('nom'),
                sb.from('secteurs').select('*'),
                sb.from('objectifs').select('*').range(0, 9999),
                sb.rpc('etat'),
            ]);
            const secteurs = {};
            for (const s of ok(sec) || []) if (s.commercial_id) secteurs[s.zone] = s.commercial_id;
            return {
                reglages: ok(reg) || {}, commerciaux: ok(com) || [], secteurs,
                objectifs: (ok(obj) || []).map(o => ({ ...o, montant: +o.montant })),
                etat: ok(etat) || {},
            };
        },
        async serieJour(a, b) { return ok(await sb.rpc('serie_jour', { p_debut: a, p_fin: b })) || []; },
        async parZone(a, b, c) { return ok(await sb.rpc('par_zone', { p_debut: a, p_fin: b, p_commercial: c || null })) || []; },
        async topClients(a, b, c, n = 8) { return ok(await sb.rpc('top_clients', { p_debut: a, p_fin: b, p_commercial: c || null, p_limite: n })) || []; },
        async parGamme(a, b, c) { return ok(await sb.rpc('par_gamme', { p_debut: a, p_fin: b, p_commercial: c || null })) || []; },
        async parSegment(a, b, c) { return ok(await sb.rpc('par_segment', { p_debut: a, p_fin: b, p_commercial: c || null })) || []; },

        // ─── Admin ───
        async saveReglages(p) { ok(await sb.from('reglages').update({ ...p, updated_at: new Date().toISOString() }).eq('id', 1)); },
        async saveCommercial(c) {
            const row = { prenom: c.prenom, nom: c.nom, code: c.code || null, email: c.email || null, telephone: c.telephone || null, couleur: c.couleur, actif: c.actif, ordre: c.ordre ?? 0,
                fonction: c.fonction || null, clientele: c.clientele || [], objectif_marge: c.objectif_marge ?? null, notes: c.notes || null };
            if (c.id) { ok(await sb.from('commerciaux').update(row).eq('id', c.id)); return c; }
            return ok(await sb.from('commerciaux').insert(row).select().single());
        },
        async deleteCommercial(id) { ok(await sb.from('commerciaux').delete().eq('id', id)); },
        async setSecteurs(list) {
            const up = list.filter(s => s.commercial_id), del = list.filter(s => !s.commercial_id).map(s => s.zone);
            if (up.length) ok(await sb.from('secteurs').upsert(up));
            if (del.length) ok(await sb.from('secteurs').delete().in('zone', del));
        },
        async saveObjectifs(list) { if (list.length) ok(await sb.from('objectifs').upsert(list)); },
        async listImports() { return ok(await sb.from('imports').select('*').order('created_at', { ascending: false }).limit(60)) || []; },
        async deleteImport(id) { ok(await sb.from('imports').delete().eq('id', id)); },
        async injecter(meta, lignes, onProgress) {
            let id = null;
            for (let i = 0; i < Math.max(1, lignes.length); i += CHUNK) {
                id = ok(await sb.rpc('injecter_ventes', { p_meta: meta, p_lignes: lignes.slice(i, i + CHUNK), p_import: id }));
                onProgress?.(Math.min(1, (i + CHUNK) / lignes.length));
            }
            return id;
        },
    };
}

function createStore() {
    const cfg = window.COMMERCE_CONFIG || {};
    if (cfg.supabaseUrl && cfg.supabaseKey && window.supabase?.createClient) return createCloudStore(cfg.supabaseUrl, cfg.supabaseKey);
    return createDemoStore();
}
