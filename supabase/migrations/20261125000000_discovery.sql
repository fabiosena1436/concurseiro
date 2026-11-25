-- Discovery data is accessible only through the Edge Function's service role.
create table if not exists public.source_candidates (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  url text not null unique,
  title text not null,
  year integer not null,
  banca text not null,
  orgao text not null default '',
  cargo text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  origin text not null default 'manual',
  note text not null default '',
  discovered_at timestamptz not null default now(),
  discovered_by text not null default '',
  reviewed_at timestamptz,
  reviewed_by text
);
create index if not exists source_candidates_newest on public.source_candidates (discovered_at desc, id desc);

create table if not exists public.telegram_inbox (
  id bigint primary key,
  from_id text not null,
  chat_id text not null,
  message_id bigint,
  text text not null default '',
  links text[] not null default '{}',
  file_name text not null default '',
  file_id text not null default '',
  file_unique_id text not null default '',
  mime_type text not null default '',
  file_size bigint not null default 0,
  status text not null default 'pending',
  received_at timestamptz not null default now()
);
create index if not exists telegram_inbox_newest on public.telegram_inbox (received_at desc, id desc);

create table if not exists public.discovery_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  terms text[] not null default '{}',
  last_run_at timestamptz,
  updated_at timestamptz,
  updated_by text
);
insert into public.discovery_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.discovery_runs (
  day date primary key,
  status text not null default 'started',
  term text,
  added integer,
  found integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.discovery_usage (
  user_id text not null,
  day date not null,
  count integer not null default 0 check (count between 0 and 10),
  primary key (user_id, day)
);

alter table public.source_candidates enable row level security;
alter table public.telegram_inbox enable row level security;
alter table public.discovery_settings enable row level security;
alter table public.discovery_runs enable row level security;
alter table public.discovery_usage enable row level security;

-- Function-level admin verification happens before calling these service-role-only RPCs.
create or replace function public.reserve_discovery_search(p_user_id text, p_day date)
returns boolean language plpgsql security definer set search_path = '' as $$
declare reserved integer;
begin
  insert into public.discovery_usage (user_id, day, count) values (p_user_id, p_day, 1)
  on conflict (user_id, day) do update set count = public.discovery_usage.count + 1
  where public.discovery_usage.count < 10
  returning count into reserved;
  return reserved is not null;
end;
$$;

create or replace function public.release_discovery_search(p_user_id text, p_day date)
returns void language sql security definer set search_path = '' as $$
  update public.discovery_usage set count = greatest(0, count - 1) where user_id = p_user_id and day = p_day;
$$;

revoke all on function public.reserve_discovery_search(text, date) from public, anon, authenticated;
revoke all on function public.release_discovery_search(text, date) from public, anon, authenticated;
grant execute on function public.reserve_discovery_search(text, date) to service_role;
grant execute on function public.release_discovery_search(text, date) to service_role;
