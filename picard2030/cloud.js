/* ============================================================
   PICARD2030 — Connexion à Supabase (projet « picard2030 »)
   - boîte à idées : dépôt des messages (ouvert à tous)
   - administration : connexion par e-mail / mot de passe
   - messages : lecture et traitement (réservés aux admins)

   La clé ci-dessous est la clé PUBLIQUE du projet : elle est faite
   pour figurer dans une page web. La sécurité est assurée côté
   base de données (règles RLS : seuls les admins lisent les messages).
   ============================================================ */

const SUPABASE_URL = 'https://mzojupdcixclofhwhulj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OendXIGv_fWk8U7GNPCjMg_iZmguYMq';

const cloud = { client: null, isAdmin: false, email: '', newCount: 0 };

function initCloud() {
    if (!window.supabase?.createClient) return false;
    cloud.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return true;
}

// Vérifie la session en cours et le droit d'administration (fonction is_admin côté base)
async function refreshSession() {
    cloud.isAdmin = false; cloud.email = '';
    if (!cloud.client) return false;
    const { data } = await cloud.client.auth.getSession();
    if (!data.session) return false;
    cloud.email = data.session.user.email || '';
    const { data: ok, error } = await cloud.client.rpc('is_admin');
    cloud.isAdmin = !error && ok === true;
    return cloud.isAdmin;
}

async function signIn(email, password) {
    if (!cloud.client) throw new Error('Service de connexion indisponible. Vérifiez votre connexion internet.');
    const { error } = await cloud.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message);
    if (!(await refreshSession())) {
        await cloud.client.auth.signOut();
        throw new Error("Ce compte n'a pas accès à l'administration.");
    }
}

async function signOut() {
    if (cloud.client) await cloud.client.auth.signOut();
    cloud.isAdmin = false; cloud.email = ''; cloud.newCount = 0;
}

// ─── Messages de la boîte à idées ────────────────
async function submitMessage({ type, sujet, message, nom }) {
    if (!cloud.client) throw new Error('Service indisponible');
    const { error } = await cloud.client.from('messages').insert({ type, sujet, message, nom: nom || null });
    if (error) throw new Error(error.message);
}

async function fetchMessages() {
    const { data, error } = await cloud.client.from('messages').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    cloud.newCount = data.filter(m => m.statut === 'nouveau').length;
    return data;
}

async function setMessageStatus(id, statut) {
    const { error } = await cloud.client.from('messages').update({ statut }).eq('id', id);
    if (error) throw new Error(error.message);
}

async function deleteMessage(id) {
    const { error } = await cloud.client.from('messages').delete().eq('id', id);
    if (error) throw new Error(error.message);
}
