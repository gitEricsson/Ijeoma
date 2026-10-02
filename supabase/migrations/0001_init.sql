-- Spydey Tracker schema. Expedition -> Stop -> Leg is the core chain;
-- everything on the map is derived from it.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table if not exists countries (
  iso2 text primary key check (iso2 ~ '^[A-Z]{2}$'),
  name text not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'current', 'visited')),
  first_entered_on date,
  centroid_lng double precision not null,
  centroid_lat double precision not null,
  cancer_fact text,
  ig_highlight_url text,
  is_home boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index if not exists countries_one_current on countries (status) where status = 'current';

create table if not exists expeditions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date,
  summary text,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date is null or end_date >= start_date)
);

create table if not exists stops (
  id uuid primary key default gen_random_uuid(),
  expedition_id uuid not null references expeditions (id),
  city text not null,
  country_iso2 text not null references countries (iso2),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  arrived_on date not null,
  left_on date,
  arrival_mode text not null default 'drive' check (arrival_mode in ('drive', 'ferry', 'flight', 'ship')),
  caption text,
  is_reconstructed boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (left_on is null or left_on >= arrived_on)
);
create index if not exists stops_expedition_order on stops (expedition_id, arrived_on, created_at);

create table if not exists legs (
  id uuid primary key default gen_random_uuid(),
  expedition_id uuid not null references expeditions (id),
  from_stop_id uuid not null references stops (id),
  to_stop_id uuid not null references stops (id),
  mode text not null check (mode in ('drive', 'ferry', 'flight', 'ship')),
  geometry jsonb not null,
  distance_km numeric(10, 1) not null default 0,
  is_fallback boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists legs_pair on legs (from_stop_id, to_stop_id);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid references stops (id),
  country_iso2 text references countries (iso2),
  url text not null,
  shortcode text not null,
  kind text not null default 'post' check (kind in ('post', 'reel')),
  author text not null default 'michaelspyder',
  posted_on date,
  caption text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists posts_shortcode on posts (shortcode) where deleted_at is null;

create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  link text,
  panel text not null,
  tier text not null default 'partner',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists site_state (
  id integer primary key default 1 check (id = 1),
  status text not null default 'at_base' check (status in ('on_the_road', 'at_base', 'paused')),
  raised_usd numeric(12, 2) not null default 0,
  goal_usd numeric(12, 2) not null default 1000000,
  raised_updated_at timestamptz,
  next_country_iso2 text references countries (iso2),
  count_home boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- auth helpers

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Recompute every country's status from the stops table: any country with a
-- stop is visited, the country of the latest stop is current.
create or replace function refresh_country_status() returns void
language plpgsql security definer set search_path = public as $$
declare
  latest text;
begin
  -- Requests through the API carry a role claim; direct SQL (migrations) does not.
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not is_admin() then
    raise exception 'not allowed';
  end if;

  select country_iso2 into latest
  from stops s join expeditions e on e.id = s.expedition_id
  where s.deleted_at is null and e.deleted_at is null
  order by s.arrived_on desc, s.created_at desc
  limit 1;

  update countries c set
    status = case when exists (
        select 1 from stops s join expeditions e on e.id = s.expedition_id
        where s.country_iso2 = c.iso2 and s.deleted_at is null and e.deleted_at is null
      ) then 'visited' else 'upcoming' end,
    first_entered_on = (
      select min(s.arrived_on) from stops s join expeditions e on e.id = s.expedition_id
      where s.country_iso2 = c.iso2 and s.deleted_at is null and e.deleted_at is null
    ),
    updated_at = now();

  if latest is not null then
    update countries set status = 'current' where iso2 = latest;
  end if;
end;
$$;

-- ---------------------------------------------------------------- RLS

alter table admins enable row level security;
alter table countries enable row level security;
alter table expeditions enable row level security;
alter table stops enable row level security;
alter table legs enable row level security;
alter table posts enable row level security;
alter table sponsors enable row level security;
alter table site_state enable row level security;
alter table audit_log enable row level security;

grant usage on schema public to anon, authenticated;
grant select on countries, expeditions, stops, legs, posts, sponsors, site_state to anon, authenticated;
grant insert, update, delete on countries, expeditions, stops, legs, posts, sponsors, site_state to authenticated;
grant select on admins to authenticated;
grant select, insert on audit_log to authenticated;
grant usage, select on sequence audit_log_id_seq to authenticated;
grant execute on function is_admin() to anon, authenticated;
revoke execute on function refresh_country_status() from public, anon;
grant execute on function refresh_country_status() to authenticated;

drop policy if exists "admins see self" on admins;
create policy "admins see self" on admins for select to authenticated
  using (email = lower(auth.jwt() ->> 'email') or is_admin());

-- Tables without soft delete: public read, admin write.
do $$
declare t text;
begin
  foreach t in array array['countries', 'legs', 'site_state'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('create policy "admin write" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
  -- Tables with soft delete: the public never sees deleted rows, admins do.
  foreach t in array array['expeditions', 'stops', 'posts', 'sponsors'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (deleted_at is null or is_admin())', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('create policy "admin write" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

drop policy if exists "admin read" on audit_log;
create policy "admin read" on audit_log for select to authenticated using (is_admin());
drop policy if exists "admin insert" on audit_log;
create policy "admin insert" on audit_log for insert to authenticated with check (is_admin());
