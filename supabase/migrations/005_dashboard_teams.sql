-- Migration 005: dashboard teams persistence
-- Allows tournament organizers to add and manage doubles teams for Group A and Group B.
-- Tracks active vs. withdrawn status, preserving historical match references.

create table if not exists public.dashboard_teams (
  id uuid primary key default gen_random_uuid(),
  team_number text not null,
  player1_name text not null,
  player2_name text not null,
  player_names text not null,
  league_group text not null check (league_group in ('Group A', 'Group B')),
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_teams_team_number_key unique (team_number),
  constraint dashboard_teams_non_empty_team_number check (trim(team_number) <> ''),
  constraint dashboard_teams_non_empty_players check (trim(player1_name) <> '' and trim(player2_name) <> '')
);

create index if not exists dashboard_teams_group_status_idx
  on public.dashboard_teams (league_group, status);

create index if not exists dashboard_teams_number_idx
  on public.dashboard_teams (team_number);

alter table public.dashboard_teams enable row level security;

-- Open tournament policy: matches dashboard_matches and player_availability patterns
drop policy if exists "public teams access" on public.dashboard_teams;
create policy "public teams access" on public.dashboard_teams
  for all to anon, authenticated using (true) with check (true);

-- Seed initial tournament roster if not already present
insert into public.dashboard_teams (team_number, player1_name, player2_name, player_names, league_group, status)
values
  -- Group A
  ('2', 'Sudharssun', 'Kaushik', 'Sudharssun, Kaushik', 'Group A', 'active'),
  ('5', 'Prathmesh', 'Tushar', 'Prathmesh, Tushar', 'Group A', 'active'),
  ('7', 'Akhil', 'Subrata', 'Akhil, Subrata', 'Group A', 'active'),
  ('9', 'Chaitanya', 'Prashant', 'Chaitanya, Prashant', 'Group A', 'active'),
  ('11', 'Niranjan', 'Naveen', 'Niranjan, Naveen', 'Group A', 'active'),
  ('12', 'Dipen', 'Raja', 'Dipen, Raja', 'Group A', 'active'),
  -- Group B
  ('1', 'Dipesh', 'Vipin', 'Dipesh, Vipin', 'Group B', 'active'),
  ('3', 'Gaurav', 'Anish', 'Gaurav, Anish', 'Group B', 'active'),
  ('4', 'Amit', 'Ananth', 'Amit, Ananth', 'Group B', 'active'),
  ('6', 'Nisarg', 'Aniket', 'Nisarg, Aniket', 'Group B', 'active'),
  ('8', 'Manikumar', 'Arindam', 'Manikumar, Arindam', 'Group B', 'active'),
  ('10', 'Vibhor', 'Gourav', 'Vibhor, Gourav', 'Group B', 'active'),
  ('13', 'Manoj', 'Srinivas', 'Manoj, Srinivas', 'Group B', 'active')
on conflict (team_number) do nothing;
