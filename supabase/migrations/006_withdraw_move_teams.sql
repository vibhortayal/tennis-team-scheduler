-- Migration 006: withdraw and move team features
alter table public.dashboard_matches
add column if not exists excluded_from_standings boolean not null default false,
add column if not exists standings_override jsonb;

create table if not exists public.team_group_moves (
  id uuid primary key default gen_random_uuid(),
  team_number text not null,
  old_group text not null,
  new_group text not null,
  cancelled_matches int not null default 0,
  moved_at timestamptz not null default now()
);

alter table public.team_group_moves enable row level security;
create policy "public moves access" on public.team_group_moves
  for all to anon, authenticated using (true) with check (true);
