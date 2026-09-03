-- Distinguish "available" vs "blocked" rows, and track the selection mode
-- (anytime/all-day vs specific time windows) so the UI can render accurate
-- calendar states without guessing from the stored time range alone.
-- Existing rows default to kind='available', mode='time_windows' to preserve
-- their current meaning.
alter table public.player_availability
  add column if not exists kind text not null default 'available'
    check (kind in ('available', 'blocked')),
  add column if not exists mode text not null default 'time_windows'
    check (mode in ('anytime', 'time_windows', 'all_day'));

create index if not exists player_availability_kind_idx
  on public.player_availability (player_key, kind);
