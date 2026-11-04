begin;

-- auth.users and auth.uid() are supplied by Supabase, not this migration.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid not null unique default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 2 and 40),
  region text check (char_length(region) between 2 and 80),
  preferred_game text check (preferred_game in ('ffmax', 'bgmi', 'codm')),
  created_at timestamptz not null default now()
);
create table public.game_profiles (
  player_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('ffmax', 'bgmi', 'codm')),
  in_game_name text not null check (char_length(trim(in_game_name)) between 1 and 64),
  game_uid text not null check (char_length(trim(game_uid)) between 1 and 64),
  primary key (player_id, game)
);
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null check (char_length(trim(policy_version)) between 1 and 80),
  accepted_at timestamptz not null default now(),
  unique (player_id, policy_version)
);
-- These tables have no client write privileges. Provision roles/eligibility
-- only through a reviewed trusted backend. Never trust user_metadata roles.
create table public.role_assignments (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('player', 'moderator', 'admin'))
);
create table public.player_eligibility (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  eligible boolean not null default false,
  reviewed_at timestamptz not null default now()
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  subject_id uuid,
  occurred_at timestamptz not null default now()
);
create index audit_events_actor_time on public.audit_events(actor_id, occurred_at desc);
create index consent_records_player_time on public.consent_records(player_id, accepted_at desc);

alter table public.profiles enable row level security;
alter table public.game_profiles enable row level security;
alter table public.consent_records enable row level security;
alter table public.role_assignments enable row level security;
alter table public.player_eligibility enable row level security;
alter table public.audit_events enable row level security;

-- Private helper is deliberately SECURITY DEFINER to read the role lookup
-- without recursive RLS. It returns a boolean for the current identity only.
create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.role_assignments
    where player_id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

revoke all on public.profiles, public.game_profiles, public.consent_records,
  public.role_assignments, public.player_eligibility, public.audit_events
  from public, anon, authenticated;
grant select on public.profiles, public.game_profiles, public.consent_records,
  public.role_assignments, public.player_eligibility, public.audit_events to authenticated;
grant insert (id, display_name, region, preferred_game) on public.profiles to authenticated;
grant update (display_name, region, preferred_game) on public.profiles to authenticated;
grant insert (player_id, game, in_game_name, game_uid),
  update (in_game_name, game_uid), delete on public.game_profiles to authenticated;
grant insert (player_id, policy_version) on public.consent_records to authenticated;

create policy profile_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profile_create on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profile_edit on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Even admin clients cannot read game UIDs. Support access needs a separately
-- reviewed, audited server operation rather than broad database SELECT rights.
create policy game_identity_owner on public.game_profiles for all to authenticated
  using (player_id = (select auth.uid())) with check (player_id = (select auth.uid()));
create policy consent_read on public.consent_records for select to authenticated
  using (player_id = (select auth.uid()));
create policy consent_append on public.consent_records for insert to authenticated
  with check (player_id = (select auth.uid()));
create policy role_read on public.role_assignments for select to authenticated
  using (player_id = (select auth.uid()) or (select private.is_admin()));
create policy eligibility_read on public.player_eligibility for select to authenticated
  using (player_id = (select auth.uid()) or (select private.is_admin()));
create policy audit_admin_read on public.audit_events for select to authenticated
  using ((select private.is_admin()));

commit;
