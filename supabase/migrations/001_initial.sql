create extension if not exists btree_gist;

create type public.proposal_status as enum ('pending','confirmed','declined','expired','cancelled');
create type public.response_status as enum ('pending','approved','declined');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);
create table public.leagues (id uuid primary key default gen_random_uuid(), name text not null, timezone text not null default 'America/Los_Angeles');
create table public.teams (id uuid primary key default gen_random_uuid(), league_id uuid not null references public.leagues(id) on delete cascade, name text not null, unique (league_id,name));
create table public.team_members (id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, active boolean not null default true, unique(team_id,user_id));
create table public.venues (id uuid primary key default gen_random_uuid(), name text not null, address text);
create table public.courts (id uuid primary key default gen_random_uuid(), venue_id uuid not null references public.venues(id) on delete cascade, name text not null, unique(venue_id,name));
create table public.fixtures (id uuid primary key default gen_random_uuid(), league_id uuid not null references public.leagues(id) on delete cascade, team_a_id uuid not null references public.teams(id), team_b_id uuid not null references public.teams(id), status text not null default 'unscheduled' check(status in ('unscheduled','scheduled','played')), check(team_a_id <> team_b_id));
create table public.match_proposals (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id),
  court_id uuid not null references public.courts(id),
  starts_at timestamptz not null, ends_at timestamptz not null,
  approval_deadline timestamptz not null,
  status public.proposal_status not null default 'pending',
  notes text, created_at timestamptz not null default now(),
  check(ends_at > starts_at), check(approval_deadline > now() - interval '1 minute')
);
create table public.proposal_participants (proposal_id uuid not null references public.match_proposals(id) on delete cascade, user_id uuid not null references public.profiles(id), team_id uuid not null references public.teams(id), primary key(proposal_id,user_id));
create table public.proposal_responses (proposal_id uuid not null references public.match_proposals(id) on delete cascade, user_id uuid not null references public.profiles(id), status public.response_status not null default 'pending', comment text, responded_at timestamptz, primary key(proposal_id,user_id));
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), type text not null, proposal_id uuid references public.match_proposals(id) on delete cascade, delivered_at timestamptz, read_at timestamptz);

create or replace function public.is_fixture_player(p_fixture uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from fixtures f join team_members tm on tm.team_id in (f.team_a_id,f.team_b_id) where f.id=p_fixture and tm.user_id=auth.uid() and tm.active);
$$;

create or replace function public.try_confirm_proposal(p_proposal uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare p match_proposals%rowtype; participants uuid[];
begin
 select * into p from match_proposals where id=p_proposal for update;
 if p.status <> 'pending' then return false; end if;
 if p.approval_deadline < now() then update match_proposals set status='expired' where id=p_proposal; return false; end if;
 if exists(select 1 from proposal_responses where proposal_id=p_proposal and status <> 'approved') then return false; end if;
 select array_agg(user_id) into participants from proposal_participants where proposal_id=p_proposal;
 if exists(select 1 from match_proposals x where x.id<>p_proposal and x.status='confirmed' and x.court_id=p.court_id and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange(p.starts_at,p.ends_at,'[)')) then raise exception 'Court is no longer available'; end if;
 if exists(select 1 from match_proposals x join fixtures xf on xf.id=x.fixture_id join fixtures f on f.id=p.fixture_id where x.status='confirmed' and (xf.team_a_id in (f.team_a_id,f.team_b_id) or xf.team_b_id in (f.team_a_id,f.team_b_id)) and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange(p.starts_at,p.ends_at,'[)')) then raise exception 'A team has a conflicting match'; end if;
 if exists(select 1 from match_proposals x join proposal_participants pp on pp.proposal_id=x.id where x.status='confirmed' and pp.user_id=any(participants) and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange(p.starts_at,p.ends_at,'[)')) then raise exception 'A player has a conflicting match'; end if;
 update match_proposals set status='confirmed' where id=p_proposal;
 update fixtures set status='scheduled' where id=p.fixture_id;
 insert into notifications(user_id,type,proposal_id) select user_id,'match_confirmed',p_proposal from proposal_participants where proposal_id=p_proposal;
 return true;
end; $$;

create or replace function public.respond_to_proposal(p_proposal uuid, p_response public.response_status, p_comment text default null) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from proposal_participants where proposal_id=p_proposal and user_id=auth.uid()) then raise exception 'You are not a participant'; end if;
 if (select status from match_proposals where id=p_proposal) <> 'pending' then raise exception 'This proposal is no longer awaiting approval'; end if;
 update proposal_responses set status=p_response,comment=p_comment,responded_at=now() where proposal_id=p_proposal and user_id=auth.uid();
 if p_response='declined' then update match_proposals set status='declined' where id=p_proposal; return false; end if;
 return public.try_confirm_proposal(p_proposal);
end; $$;

alter table public.profiles enable row level security; alter table public.teams enable row level security; alter table public.team_members enable row level security; alter table public.fixtures enable row level security; alter table public.match_proposals enable row level security; alter table public.proposal_participants enable row level security; alter table public.proposal_responses enable row level security;
create policy "members view teams" on public.teams for select to authenticated using (exists(select 1 from team_members tm where tm.team_id=id and tm.user_id=auth.uid()));
create policy "members view fixtures" on public.fixtures for select to authenticated using (public.is_fixture_player(id));
create policy "players view own proposals" on public.match_proposals for select to authenticated using (public.is_fixture_player(fixture_id));
create policy "players view proposal participants" on public.proposal_participants for select to authenticated using (user_id=auth.uid() or exists(select 1 from proposal_participants mine where mine.proposal_id=proposal_id and mine.user_id=auth.uid()));
create policy "players view proposal responses" on public.proposal_responses for select to authenticated using (exists(select 1 from proposal_participants p where p.proposal_id=proposal_id and p.user_id=auth.uid()));

-- Seed the supplied roster. Link these names to authenticated profile IDs once players sign in.
insert into public.leagues(name) values ('Tennis League');
insert into public.teams(league_id,name) select id, team_name from public.leagues cross join (values ('Team #1'),('Team #3'),('Team #4'),('Team #6'),('Team #8'),('Team #10'),('Team #13')) as roster(team_name) where name='Tennis League';
