-- This tournament uses an honor-based roster identity rather than user accounts.
-- Availability is keyed to the player selected in the dashboard picker.
create table if not exists public.player_availability (
  id uuid primary key default gen_random_uuid(),
  player_key text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists player_availability_player_window_idx
  on public.player_availability (player_key, starts_at, ends_at);

alter table public.player_availability enable row level security;

-- Availability is intentionally public to tournament participants. Players are
-- expected to edit only their own roster identity's windows.
drop policy if exists "public availability access" on public.player_availability;
create policy "public availability access" on public.player_availability
  for all to anon, authenticated using (true) with check (true);