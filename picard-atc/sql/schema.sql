-- ============================================================
--  PICARD-ATC — schéma Supabase (projet « COMMERCE »)
--  Données alimentées par les 3 fichiers Picard, importés dans l'admin.
-- ============================================================

-- ─── Droits ────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'email') in ('gdaillere@picard-serrures.com', 'slamour@picard-serrures.com'), false);
$$;

-- ─── Réglages ──────────────────────────────────────────────
create table public.reglages (
  id int primary key default 1 check (id = 1),
  nom text not null default 'PICARD-ATC',
  sous_titre text not null default 'Pilotage du chiffre des ATC',
  lecture_publique boolean not null default false,
  -- statuts sur le % du budget réalisé : rouge ≤ orange < … ≤ jaune < … ≤ vert < vert
  seuil_vert numeric not null default 90,    -- vert au-delà
  seuil_jaune numeric not null default 85,   -- jaune au-delà (jusqu'au seuil vert)
  seuil_orange numeric not null default 60,  -- orange au-delà (jusqu'au seuil jaune), rouge en dessous
  types_clientele text[] not null default array['Serruriers', 'Menuisiers', 'Installateurs', 'Négoces & distributeurs', 'Entreprises du bâtiment', 'Grands comptes', 'Collectivités', 'Syndics & bailleurs'],
  fonctions text[] not null default array['ATC', 'Spécialiste Diamant', 'Spécialiste Hall', 'Chef de secteur', 'Direction'],
  updated_at timestamptz not null default now()
);
insert into public.reglages default values;

create or replace function public.peut_lire()
returns boolean language sql stable set search_path = '' as $$
  select public.is_admin() or coalesce((select lecture_publique from public.reglages where id = 1), false);
$$;

-- ─── Référentiel ───────────────────────────────────────────
create table public.commerciaux (
  id uuid primary key default gen_random_uuid(),
  code text unique,                 -- libellé exact dans le fichier « Répartition budget ATC » (ex. « DUPONT Jean »)
  prenom text not null default '',
  nom text not null,
  equipe text not null default 'DIR', -- IDF, NORD, OUEST, RA, PACA, DIR
  couleur text not null default '#0fb5d0',
  fonction text,
  clientele text[] not null default '{}',
  objectif_marge numeric,
  iap_objectif int not null default 0,  -- nombre d'IAP visé
  iap_nouveaux int not null default 0,  -- IAP recrutés dans l'année
  email text,
  telephone text,
  notes text,
  actif boolean not null default true,
  ordre int not null default 0,
  created_at timestamptz not null default now()
);

-- Zone de la carte → ATC
create table public.secteurs (
  zone text primary key,
  commercial_id uuid references public.commerciaux on delete set null
);

-- Potentiel de marché et IAP installés, par zone
create table public.zones_info (
  zone text primary key,
  potentiel numeric not null default 0,
  iap int not null default 0
);

-- ─── Chiffres ──────────────────────────────────────────────
-- Fichier « Répartition budget ATC » : par ATC, mois et gamme (serrures, diamant, hall, technica, eliot)
create table public.atc_mois (
  commercial_id uuid not null references public.commerciaux on delete cascade,
  annee int not null,
  mois int not null check (mois between 1 and 12),
  gamme text not null,
  realise numeric,          -- facturé ; vide pour un mois pas encore commencé
  budget numeric not null default 0,
  qte numeric,
  realise_n1 numeric not null default 0,
  primary key (commercial_id, annee, mois, gamme)
);

-- Fichier « Tableau commercial quotidien » : société, jour par jour
create table public.jours (
  date date primary key,
  enregistre numeric not null default 0,
  facture numeric not null default 0
);
create table public.societe_mois (
  annee int not null,
  mois int not null check (mois between 1 and 12),
  budget_enr numeric, budget_fact numeric, jours_ouvres int,
  n1_enr numeric, n1_fact numeric,
  primary key (annee, mois)
);

-- Fichier « Valorisation portefeuille » : reste à livrer, jour par jour (montants par gamme et échéance)
create table public.portefeuille (
  date date primary key,
  data jsonb not null
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  fichier text,
  lignes int not null default 0,
  par text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

-- ─── Sécurité (RLS) ────────────────────────────────────────
alter table public.reglages enable row level security;
create policy lecture on public.reglages for select using (true);
create policy admin_maj on public.reglages for update using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['commerciaux', 'secteurs', 'zones_info', 'atc_mois', 'jours', 'societe_mois', 'portefeuille', 'imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy lecture on public.%I for select using (public.peut_lire())', t);
    execute format('create policy admin_ajout on public.%I for insert with check (public.is_admin())', t);
    execute format('create policy admin_maj on public.%I for update using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy admin_suppr on public.%I for delete using (public.is_admin())', t);
  end loop;
end $$;

-- ─── Comptes : seuls les deux administrateurs peuvent exister ──
create or replace function public.inscriptions_reservees()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email not in ('gdaillere@picard-serrures.com', 'slamour@picard-serrures.com') then
    raise exception 'Inscriptions fermées';
  end if;
  return new;
end $$;
create trigger inscriptions_reservees before insert on auth.users
  for each row execute function public.inscriptions_reservees();

-- ─── Temps réel : chaque import rafraîchit les écrans ouverts ──
alter publication supabase_realtime add table public.imports, public.commerciaux, public.secteurs, public.zones_info, public.reglages;
