-- Private, first-party analytics: visitors and Donate clicks.
-- No IPs, cookies or third parties. Each browser keeps a random id in
-- localStorage; one row per (day, browser, kind) with a counter. The public
-- can only call track(); only admins can read, through analytics_summary().

create table if not exists analytics_events (
  day date not null,
  vid uuid not null,
  kind text not null check (kind in ('visit', 'donate')),
  n integer not null default 1,
  primary key (day, vid, kind)
);
alter table analytics_events enable row level security;
-- No policies on purpose: nobody reads or writes the table directly.

create or replace function track(p_kind text, p_vid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('visit', 'donate') or p_vid is null then
    return;
  end if;
  insert into analytics_events (day, vid, kind)
  values ((now() at time zone 'Africa/Lagos')::date, p_vid, p_kind)
  on conflict (day, vid, kind) do update set n = least(analytics_events.n + 1, 1000);
end;
$$;
revoke all on function track(text, uuid) from public;
grant execute on function track(text, uuid) to anon, authenticated;

create or replace function analytics_summary(p_days integer default 30)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
  result json;
begin
  if not is_admin() then
    raise exception 'not allowed';
  end if;
  select json_build_object(
    'visitors', (select count(distinct vid) from analytics_events where kind = 'visit'),
    'visitors_today', (select count(distinct vid) from analytics_events where kind = 'visit' and day = today),
    'visitors_7d', (select count(distinct vid) from analytics_events where kind = 'visit' and day > today - 7),
    'page_views', (select coalesce(sum(n), 0) from analytics_events where kind = 'visit'),
    'donate_clicks', (select coalesce(sum(n), 0) from analytics_events where kind = 'donate'),
    'donate_clickers', (select count(distinct vid) from analytics_events where kind = 'donate'),
    'daily', (
      select coalesce(json_agg(d order by d.day), '[]'::json)
      from (
        select g.day::date as day,
          count(distinct e.vid) filter (where e.kind = 'visit') as visitors,
          coalesce(sum(e.n) filter (where e.kind = 'donate'), 0) as clicks
        from generate_series(today - (p_days - 1), today, interval '1 day') as g(day)
        left join analytics_events e on e.day = g.day::date
        group by g.day
      ) d
    )
  ) into result;
  return result;
end;
$$;
revoke all on function analytics_summary(integer) from public;
grant execute on function analytics_summary(integer) to authenticated;
