-- ============================================================
--  COMMERCE — schéma Supabase
--  Pilotage du chiffre des commerciaux.
--  À appliquer une fois sur le projet Supabase « COMMERCE ».
-- ============================================================

-- ─── Droits ────────────────────────────────────────────────
-- Les deux administrateurs (mêmes personnes que Picard 2030)
create or replace function public.is_admin()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'email') in ('gdaillere@picard-serrures.com', 'slamour@picard-serrures.com'), false);
$$;

-- ─── Tables ────────────────────────────────────────────────
create table public.reglages (
  id int primary key default 1 check (id = 1),
  nom text not null default 'Commerce',
  sous_titre text not null default 'Pilotage du chiffre des commerciaux',
  lecture_publique boolean not null default true,
  seuil_vert numeric not null default 100,   -- % du rythme attendu à date : à partir de là, « dans les temps »
  seuil_orange numeric not null default 90,  -- en dessous : « en retard »
  types_clientele text[] not null default array['Serruriers', 'Menuisiers', 'Installateurs', 'Négoces & distributeurs', 'Entreprises du bâtiment', 'Grands comptes', 'Collectivités', 'Industriels'],
  gammes text[] not null default array['Serrures', 'Portes blindées', 'Portes techniques', 'Portes de Hall', 'Eliot'],
  fonctions text[] not null default array['ATC', 'ATS', 'Chef de secteur', 'Responsable grands comptes', 'Agent commercial'],
  updated_at timestamptz not null default now()
);
insert into public.reglages default values;

-- Lecture du tableau de bord : publique (réglable dans l'admin) ou réservée aux admins
create or replace function public.peut_lire()
returns boolean language sql stable set search_path = '' as $$
  select public.is_admin() or coalesce((select lecture_publique from public.reglages where id = 1), false);
$$;

create table public.commerciaux (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  nom text not null,
  code text unique,              -- code utilisé dans le fichier quotidien (ex. « CLA »)
  email text,
  telephone text,
  couleur text not null default '#2a78d6',
  fonction text,                 -- ATC, chef de secteur, grands comptes…
  clientele text[] not null default '{}',  -- types de clientèle suivis
  objectif_marge numeric,        -- taux de marge visé (%)
  notes text,
  actif boolean not null default true,
  ordre int not null default 0,
  created_at timestamptz not null default now()
);

-- Secteurs : une zone de la carte (département, province, canton, pays) → un commercial
create table public.secteurs (
  zone text primary key,
  commercial_id uuid references public.commerciaux on delete set null
);

create table public.objectifs (
  commercial_id uuid not null references public.commerciaux on delete cascade,
  annee int not null,
  mois int not null check (mois between 1 and 12),
  montant numeric not null default 0,
  primary key (commercial_id, annee, mois)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  fichier text,
  lignes int not null default 0,
  montant numeric not null default 0,
  date_min date,
  date_max date,
  mode text not null default 'remplacer',
  par text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

create table public.ventes (
  id bigint generated always as identity primary key,
  date date not null,
  commercial_id uuid references public.commerciaux on delete set null,
  zone text,
  client text,
  segment text,                  -- type de clientèle (colonne facultative du fichier)
  gamme text,                    -- gamme produit : Serrures, Portes blindées… (colonne facultative)
  ca numeric not null default 0,
  marge numeric,
  commandes int not null default 1,
  import_id uuid references public.imports on delete cascade
);
create index ventes_date_idx on public.ventes (date);
create index ventes_commercial_date_idx on public.ventes (commercial_id, date);
create index ventes_import_idx on public.ventes (import_id);

-- ─── Sécurité (RLS) ────────────────────────────────────────
alter table public.reglages enable row level security;
alter table public.commerciaux enable row level security;
alter table public.secteurs enable row level security;
alter table public.objectifs enable row level security;
alter table public.imports enable row level security;
alter table public.ventes enable row level security;

-- Réglages : toujours lisibles (nom de l'outil, mode de lecture)
create policy lecture on public.reglages for select using (true);
create policy admin_maj on public.reglages for update using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['commerciaux', 'secteurs', 'objectifs', 'imports', 'ventes'] loop
    execute format('create policy lecture on public.%I for select using (public.peut_lire())', t);
    execute format('create policy admin_ajout on public.%I for insert with check (public.is_admin())', t);
    execute format('create policy admin_maj on public.%I for update using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy admin_suppr on public.%I for delete using (public.is_admin())', t);
  end loop;
end $$;

-- ─── Lecture agrégée (une seule requête, pas de limite de lignes) ──
-- CA, marge, commandes par jour et par commercial
create or replace function public.serie_jour(p_debut date, p_fin date)
returns json language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_array(d, c, ca, mg, nb) order by d), '[]'::json)
  from (
    select date as d, commercial_id as c, sum(ca) as ca, sum(coalesce(marge, 0)) as mg, sum(commandes) as nb
    from public.ventes where date between p_debut and p_fin
    group by date, commercial_id
  ) s;
$$;

-- Par zone de la carte, sur une période (et éventuellement un commercial)
create or replace function public.par_zone(p_debut date, p_fin date, p_commercial uuid default null)
returns json language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_array(zone, ca, mg, nb)), '[]'::json)
  from (
    select zone, sum(ca) as ca, sum(coalesce(marge, 0)) as mg, sum(commandes) as nb
    from public.ventes
    where date between p_debut and p_fin and zone is not null
      and (p_commercial is null or commercial_id = p_commercial)
    group by zone
  ) s;
$$;

-- Meilleurs clients d'une période
create or replace function public.top_clients(p_debut date, p_fin date, p_commercial uuid default null, p_limite int default 8)
returns json language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_array(client, ca, nb) order by ca desc), '[]'::json)
  from (
    select client, sum(ca) as ca, sum(commandes) as nb
    from public.ventes
    where date between p_debut and p_fin and client is not null
      and (p_commercial is null or commercial_id = p_commercial)
    group by client order by sum(ca) desc limit p_limite
  ) s;
$$;

-- Par type de clientèle
create or replace function public.par_segment(p_debut date, p_fin date, p_commercial uuid default null)
returns json language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_array(segment, ca, nb) order by ca desc), '[]'::json)
  from (
    select coalesce(segment, 'Non renseigné') as segment, sum(ca) as ca, sum(commandes) as nb
    from public.ventes
    where date between p_debut and p_fin
      and (p_commercial is null or commercial_id = p_commercial)
    group by 1
  ) s;
$$;

-- Par gamme produit
create or replace function public.par_gamme(p_debut date, p_fin date, p_commercial uuid default null)
returns json language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_array(gamme, ca, mg, nb) order by ca desc), '[]'::json)
  from (
    select coalesce(gamme, 'Non renseignée') as gamme, sum(ca) as ca, sum(coalesce(marge, 0)) as mg, sum(commandes) as nb
    from public.ventes
    where date between p_debut and p_fin
      and (p_commercial is null or commercial_id = p_commercial)
    group by 1
  ) s;
$$;

-- Fraîcheur des données
create or replace function public.etat()
returns json language sql stable security invoker set search_path = '' as $$
  select json_build_object(
    'derniere_date', (select max(date) from public.ventes),
    'dernier_import', (select max(created_at) from public.imports)
  );
$$;

-- ─── Injection du fichier quotidien ────────────────────────
-- Premier appel (p_import null) : crée l'import et, en mode « remplacer »,
-- efface les ventes des dates présentes dans le fichier. Appels suivants : ajout par lots.
create or replace function public.injecter_ventes(p_meta jsonb, p_lignes jsonb, p_import uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid := p_import;
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  if v_id is null then
    if p_meta ->> 'mode' = 'remplacer' then
      delete from public.ventes
      where date in (select (jsonb_array_elements_text(p_meta -> 'dates'))::date);
    end if;
    insert into public.imports (fichier, mode, date_min, date_max)
    values (p_meta ->> 'fichier', coalesce(p_meta ->> 'mode', 'remplacer'), (p_meta ->> 'date_min')::date, (p_meta ->> 'date_max')::date)
    returning id into v_id;
  end if;
  insert into public.ventes (date, commercial_id, zone, client, segment, gamme, ca, marge, commandes, import_id)
  select (l ->> 'date')::date, nullif(l ->> 'commercial_id', '')::uuid, nullif(l ->> 'zone', ''), nullif(l ->> 'client', ''), nullif(l ->> 'segment', ''), nullif(l ->> 'gamme', ''),
         coalesce((l ->> 'ca')::numeric, 0), (l ->> 'marge')::numeric, coalesce((l ->> 'commandes')::int, 1), v_id
  from jsonb_array_elements(p_lignes) l;
  update public.imports i set
    lignes = i.lignes + jsonb_array_length(p_lignes),
    montant = i.montant + (select coalesce(sum((l ->> 'ca')::numeric), 0) from jsonb_array_elements(p_lignes) l)
  where i.id = v_id;
  return v_id;
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

-- ─── Temps réel : le tableau de bord se rafraîchit à chaque injection ──
alter publication supabase_realtime add table public.imports, public.commerciaux, public.secteurs, public.objectifs, public.reglages;
