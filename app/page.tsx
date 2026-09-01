'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Group = 'Group A' | 'Group B';
type View = 'dashboard' | 'scheduling';

type Match = {
  id: string;
  matchup: string;
  match_date: string;
  match_time: string;
  court: string;
  status: string;
  result?: string | null;
  cancellation_reason?: string | null;
  league_group?: Group;
};

type Draft = Omit<Match, 'id'>;
type Team = readonly [string, string];

type Suggestion = {
  opponentId: string;
  date: string;
  yourGap: number;
  opponentGap: number;
  score: number;
};

const groups: Record<Group, readonly Team[]> = {
  'Group A': [
    ['2', 'Sudharssun, Kaushik'],
    ['5', 'Prathmesh, Tushar'],
    ['7', 'Akhil, Subrata'],
    ['9', 'Chaitanya, Prashant'],
    ['11', 'Niranjan, Naveen'],
    ['12', 'Dipen, Raja'],
  ],
  'Group B': [
    ['1', 'Dipesh, Vipin'],
    ['3', 'Gaurav, Anish'],
    ['4', 'Amit, Ananth'],
    ['6', 'Nissarg, Aniket'],
    ['8', 'Manikumar, Arindam'],
    ['10', 'Vibhor, Gourav'],
    ['13', 'Manoj, Srinivas'],
  ],
};

const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const api = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/dashboard_matches`
  : '';

const headers = {
  'Content-Type': 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`,
  Prefer: 'return=representation',
};

const teamDisplay = (g: Group, id: string) => {
  const team = groups[g].find(([teamId]) => teamId === id);

  if (!team) {
    return `#${id}`;
  }

  const [first, second] = team[1].split(',').map(name => name.trim());

  return `#${team[0]} · ${first} & ${second}`;
};

const teamNames = (g: Group, id: string) => {
  const team = groups[g].find(([teamId]) => teamId === id);

  if (!team) {
    return `Team #${id}`;
  }

  const [first, second] = team[1].split(',').map(name => name.trim());

  return `${first} & ${second}`;
};

const blank = (g: Group): Draft => ({
  matchup: '',
  match_date: '',
  match_time: '10:00',
  court: 'Court 2',
  status: 'Scheduled',
  result: '',
  cancellation_reason: '',
  league_group: g,
});

const dateText = (d: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${d}T12:00:00`));

const fremontNow = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find(part => part.type === type)?.value || '';

  return `${value('year')}-${value('month')}-${value('day')}T${value(
    'hour'
  )}:${value('minute')}`;
};

const matchDateTime = (m: Match) =>
  `${m.match_date}T${m.match_time.slice(0, 5)}`;

const currentDateInFremont = () => fremontNow().slice(0, 10);

const dayValue = (date: string) => new Date(`${date}T12:00:00`).getTime();

const daysBetween = (from: string, to: string) =>
  Math.floor((dayValue(to) - dayValue(from)) / 86400000);

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isBlockingStatus = (status: string) => {
  const value = status.toLowerCase();
  return value === 'scheduled' || value === 'completed';
};

const matchIncludesTeam = (matchup: string, teamId: string) => {
  const marker = `Team #${teamId}`;
  let from = 0;

  while (from <= matchup.length) {
    const index = matchup.indexOf(marker, from);

    if (index === -1) {
      return false;
    }

    const after = matchup[index + marker.length];

    if (!after || after < '0' || after > '9') {
      return true;
    }

    from = index + 1;
  }

  return false;
};

const teamIds = (m: Match, g: Group) =>
  groups[g]
    .filter(([id]) => matchIncludesTeam(m.matchup, id))
    .map(([id]) => id);

const isSameFixture = (
  match: Match,
  group: Group,
  firstId: string,
  secondId: string
) => {
  if ((match.league_group || 'Group B') !== group) {
    return false;
  }

  const ids = teamIds(match, group);

  return (
    (ids.includes(firstId) && ids.includes(secondId)) ||
    (matchIncludesTeam(match.matchup, firstId) &&
      matchIncludesTeam(match.matchup, secondId))
  );
};

const existingFixture = (
  allMatches: Match[],
  group: Group,
  firstId: string,
  secondId: string
) =>
  allMatches.find(
    match =>
      isBlockingStatus(match.status) &&
      isSameFixture(match, group, firstId, secondId)
  );

const matchesForTeam = (allMatches: Match[], group: Group, teamId: string) =>
  allMatches.filter(
    match =>
      (match.league_group || 'Group B') === group &&
      isBlockingStatus(match.status) &&
      matchIncludesTeam(match.matchup, teamId)
  );

const restGapAroundDate = (teamMatches: Match[], date: string) => {
  const previous = teamMatches
    .filter(match => match.match_date < date)
    .sort((a, b) => b.match_date.localeCompare(a.match_date))[0];

  const nextMatch = teamMatches
    .filter(match => match.match_date > date)
    .sort((a, b) => a.match_date.localeCompare(b.match_date))[0];

  const previousGap = previous ? daysBetween(previous.match_date, date) : 99;
  const nextGap = nextMatch ? daysBetween(date, nextMatch.match_date) : 99;

  return Math.min(previousGap, nextGap);
};

function TeamLine({ group, id }: { group: Group; id: string }) {
  return (
    <div className="team-line">
      <span className="team-number">#{id}</span>
      <span className="team-names">{teamNames(group, id)}</span>
    </div>
  );
}

function teamMatchLine(match: Match, group: Group, id: string) {
  const opponent = teamIds(match, group).find(teamId => teamId !== id);
  const vs = opponent ? teamDisplay(group, opponent) : 'Opponent';

  if (match.status.toLowerCase() === 'completed') {
    return `${dateText(match.match_date)} vs ${vs}${match.result ? ` · ${match.result}` : ''}`;
  }

  return `${dateText(match.match_date)} vs ${vs} · ${match.match_time.slice(0, 5)} · ${match.court}`;
}

function TeamContext({
  group,
  id,
  matches,
}: {
  group: Group;
  id: string;
  matches: Match[];
}) {
  const today = currentDateInFremont();
  const teamMatches = matchesForTeam(matches, group, id);

  const last = teamMatches
    .filter(match => match.status.toLowerCase() === 'completed')
    .sort(
      (a, b) =>
        b.match_date.localeCompare(a.match_date) ||
        b.match_time.localeCompare(a.match_time)
    )[0];

  const next = teamMatches
    .filter(
      match =>
        match.status.toLowerCase() === 'scheduled' && match.match_date >= today
    )
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) ||
        a.match_time.localeCompare(b.match_time)
    )[0];

  return (
    <div className="team-with-info">
      <TeamLine group={group} id={id} />
      <div className="info-inline">
        <p>
          <b>Last match:</b> {last ? teamMatchLine(last, group, id) : 'None'}
        </p>
        <p>
          <b>Next match:</b> {next ? teamMatchLine(next, group, id) : 'None'}
        </p>
      </div>
    </div>
  );
}

function Matchup({ match, group }: { match: Match; group: Group }) {
  const ids = teamIds(match, group);

  if (ids.length !== 2) {
    return <h3>{match.matchup}</h3>;
  }

  return (
    <div className="matchup">
      <TeamLine group={group} id={ids[0]} />
      <span className="versus">vs</span>
      <TeamLine group={group} id={ids[1]} />
    </div>
  );
}

function Section({
  title,
  list,
  edit,
  empty,
  group,
}: {
  title: string;
  list: Match[];
  edit: (m: Match) => void;
  empty: string;
  group: Group;
}) {
  return (
    <section>
      <h2>{title}</h2>

      {list.length ? (
        <div className="grid">
          {list.map(m => (
            <article className="card" key={m.id}>
              <small>
                {dateText(m.match_date)} · {m.match_time.slice(0, 5)} ·{' '}
                <b>{m.status}</b>
              </small>

              <Matchup match={m} group={group} />

              <p>{m.court}</p>

              {m.result && (
                <p>
                  <b>{m.result}</b>
                </p>
              )}

              {m.cancellation_reason && (
                <p>Reason: {m.cancellation_reason}</p>
              )}

              <button onClick={() => edit(m)}>Update match</button>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">{empty}</p>
      )}
    </section>
  );
}

export default function Page() {
  const [view, setView] = useState<View>('dashboard');
  const [group, setGroup] = useState<Group>('Group B');
  const [scheduleGroup, setScheduleGroup] = useState<Group>('Group B');
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState('All');
  const [team, setTeam] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [draft, setDraft] = useState<Draft>(blank('Group B'));
  const [editing, setEditing] = useState<Match | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [suggestionTeam, setSuggestionTeam] = useState('');
  const [yourGapDays, setYourGapDays] = useState(3);
  const [opponentGapDays, setOpponentGapDays] = useState(3);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionNote, setSuggestionNote] = useState('');
  const [suggestionOpponent, setSuggestionOpponent] = useState('');

  const roster = groups[group];
  const scheduleRoster = groups[scheduleGroup];

  const load = async () => {
    if (!api || !key) {
      setNote('Missing Supabase public environment settings.');
      return;
    }

    const response = await fetch(
      `${api}?select=*&order=match_date.asc,match_time.asc`,
      { headers }
    );

    if (response.ok) {
      setMatches(await response.json());
    } else {
      setNote('Could not load matches.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setTeam('');

    if (!open) {
      setFirst(groups[group][0][0]);
      setSecond(groups[group][1][0]);
      setDraft(blank(group));
    }
  }, [group]);

  useEffect(() => {
    setSuggestionTeam('');
    setSuggestions([]);
    setSuggestionNote('');
    setSuggestionOpponent('');
  }, [scheduleGroup]);

  const scoped = useMemo(
    () =>
      matches.filter(
        m =>
          (m.league_group || 'Group B') === group &&
          (filter === 'All' || m.status === filter) &&
          (!team || teamIds(m, group).includes(team))
      ),
    [matches, group, filter, team]
  );

  const opponentOptions = useMemo(
    () => Array.from(new Set(suggestions.map(item => item.opponentId))),
    [suggestions]
  );

  const visibleSuggestions = useMemo(() => {
    const filtered = suggestionOpponent
      ? suggestions.filter(item => item.opponentId === suggestionOpponent)
      : Object.values(
          suggestions.reduce<Record<string, Suggestion>>((best, item) => {
            if (!best[item.opponentId] || item.date < best[item.opponentId].date) {
              best[item.opponentId] = item;
            }
            return best;
          }, {})
        );

    return filtered.sort(
      (a, b) => a.date.localeCompare(b.date) || a.opponentId.localeCompare(b.opponentId)
    );
  }, [suggestions, suggestionOpponent]);

  const nowInFremont = fremontNow();

  const overdue = scoped.filter(
    m => m.status === 'Scheduled' && matchDateTime(m) < nowInFremont
  );

  const upcoming = scoped.filter(
    m => m.status === 'Scheduled' && matchDateTime(m) >= nowInFremont
  );

  const completed = scoped.filter(m => m.status === 'Completed');
  const cancelled = scoped.filter(m => m.status === 'Cancelled');
  const nextMatch = matches
    .filter(
      m => m.status === 'Scheduled' && matchDateTime(m) >= nowInFremont
    )
    .sort((a, b) => matchDateTime(a).localeCompare(matchDateTime(b)))[0];

  const nextMatchGroup: Group = (nextMatch?.league_group || 'Group B') as Group;

  const begin = (m?: Match) => {
    setEditing(m || null);

    if (m) {
      setDraft({ ...m, league_group: group });

      const ids = teamIds(m, group);
      setFirst(ids[0] || roster[0][0]);
      setSecond(ids[1] || roster[1][0]);
    } else {
      setDraft(blank(group));
    }

    setOpen(true);
    setNote('');
  };

  const findSuggestions = () => {
    if (!suggestionTeam) {
      setSuggestionNote('Choose your team first.');
      setSuggestions([]);
      setSuggestionOpponent('');
      return;
    }

    const today = currentDateInFremont();

    const possibleOpponents = scheduleRoster
      .map(([id]) => id)
      .filter(id => id !== suggestionTeam)
      .filter(
        opponentId =>
          !existingFixture(matches, scheduleGroup, suggestionTeam, opponentId)
      );

    const candidates: Suggestion[] = [];

    for (const opponentId of possibleOpponents) {
      const yourMatches = matchesForTeam(matches, scheduleGroup, suggestionTeam);
      const opponentMatches = matchesForTeam(
        matches,
        scheduleGroup,
        opponentId
      );

      for (let offset = 1; offset <= 30; offset += 1) {
        const date = addDays(today, offset);

        const youHaveMatch = yourMatches.some(
          match => match.match_date === date
        );
        const opponentHasMatch = opponentMatches.some(
          match => match.match_date === date
        );

        if (youHaveMatch || opponentHasMatch) {
          continue;
        }

        const yourGap = restGapAroundDate(yourMatches, date);
        const opponentGap = restGapAroundDate(opponentMatches, date);

        if (yourGap < yourGapDays || opponentGap < opponentGapDays) {
          continue;
        }

        candidates.push({
          opponentId,
          date,
          yourGap,
          opponentGap,
          score: yourGap + opponentGap,
        });
      }
    }

    const ranked = candidates.sort(
      (a, b) => a.date.localeCompare(b.date) || a.opponentId.localeCompare(b.opponentId)
    );

    setSuggestions(ranked);
    setSuggestionOpponent('');
    setSuggestionNote(
      ranked.length
        ? `Found suggested matches, sorted by date. Rest days count completed matches and scheduled upcoming matches.`
        : 'No suitable matches found in the next 30 days. Rest days count completed matches and scheduled upcoming matches.'
    );
  };

  const scheduleSuggestion = (suggestion: Suggestion) => {
    if (existingFixture(matches, scheduleGroup, suggestionTeam, suggestion.opponentId)) {
      setSuggestionNote(
        'That matchup is already scheduled or completed, so it cannot be suggested.'
      );
      setSuggestions(current =>
        current.filter(item => item.opponentId !== suggestion.opponentId)
      );
      return;
    }

    setGroup(scheduleGroup);
    setEditing(null);
    setFirst(suggestionTeam);
    setSecond(suggestion.opponentId);
    setDraft({
      ...blank(scheduleGroup),
      match_date: suggestion.date,
      match_time: '19:00',
      court: 'Court 2',
      league_group: scheduleGroup,
    });
    setOpen(true);
    setNote('');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();

    if (first === second) {
      setNote('Choose a different opponent.');
      return;
    }

    if (!draft.match_date || !draft.match_time || !draft.court) {
      setNote('Add a date, time, and court.');
      return;
    }

    if (draft.status === 'Completed' && !draft.result?.trim()) {
      setNote('Enter a result before completing the match.');
      return;
    }

    if (draft.status === 'Cancelled' && !draft.cancellation_reason?.trim()) {
      setNote('Enter a cancellation reason.');
      return;
    }

    const conflict = matches.find(
      m =>
        m.id !== editing?.id &&
        (m.league_group || 'Group B') === group &&
        m.match_date === draft.match_date &&
        m.status !== 'Cancelled' &&
        teamIds(m, group).some(id => id === first || id === second)
    );

    if (conflict) {
      setNote('One of these teams already has an active match on that date.');
      return;
    }

    const body = {
      ...draft,
      league_group: group,
      matchup: `Team #${first} vs Team #${second}`,
    };

    const response = await fetch(editing ? `${api}?id=eq.${editing.id}` : api, {
      method: editing ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      setNote('Could not save the match.');
      return;
    }

    setOpen(false);
    setNote('Match saved successfully.');
    load();
  };

  return (
    <main>
      <style>{`
        *{box-sizing:border-box}
        body{margin:0;background:#f5f6f1;font-family:Arial;color:#15231a}
        main{max-width:1100px;margin:auto;padding:24px}
        button,select,input,textarea{font:inherit}
        button{border:0;border-radius:9px;padding:10px 14px;background:#147a42;color:white;font-weight:700;cursor:pointer}
        .top,.hero,.card,form,.tabs{background:#fff;border:1px solid #e0e8df;border-radius:16px}
        .top{padding:18px;display:flex;justify-content:space-between;align-items:center}
        .tabs{display:flex;padding:5px;margin:18px 0;gap:5px}
        .tabs button{flex:1;background:transparent;color:#57705e}
        .tabs button.active{background:#147a42;color:#fff}
        .hero{padding:24px;display:flex;justify-content:space-between;gap:16px;background:linear-gradient(120deg,#fff,#edf8ef);margin:18px 0 0}
        .group-schedule{margin:0 0 16px}
        .eyebrow{color:#147a42;font-size:12px;font-weight:800;letter-spacing:1px}
        .badge{background:#147a42;color:#fff;height:max-content;border-radius:999px;padding:10px;font-weight:800}
        .filters{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}
        .filters button{background:#eaf4eb;color:#17663d}
        .filters button.active{background:#17231d;color:#fff}
        select,input,textarea{padding:10px;border:1px solid #d6dfd5;border-radius:8px;background:white}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .card{padding:16px}
        .card p{color:#5f7064}
        .empty,.notice{background:#fff;padding:16px;border-radius:12px;color:#5f7064}
        .notice{color:#17663d}
        .modal{position:fixed;inset:0;background:#10201588;display:grid;place-items:center;padding:15px}
        .modal form{padding:22px;width:min(620px,100%);max-height:90vh;overflow:auto}
        .fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .field{display:grid;gap:5px;font-size:13px;font-weight:bold}
        .wide{grid-column:1/-1}
        .actions{margin-top:16px;display:flex;justify-content:flex-end;gap:8px}
        .team-line{display:flex;align-items:center;gap:8px;min-width:0}
        .team-number{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-width:32px;height:26px;padding:0 8px;border-radius:999px;background:#eaf4eb;color:#17663d;font-size:12px;font-weight:800}
        .team-names{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#15231a;font-weight:750}
        .matchup{display:grid;gap:8px;margin:12px 0}
        .versus{color:#758278;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px}
        .team-with-info{display:grid;gap:6px;min-width:0}
        .info-inline{padding:8px 10px;border-radius:10px;background:#f1f7f1}
        .info-inline p{margin:0 0 4px;color:#47614d !important;font-size:12px;font-weight:400;line-height:1.4}
        .info-inline p:last-child{margin:0}
        .overdue-section{margin:20px 0;padding:18px;border:2px solid #d94924;border-radius:16px;background:#fff3ed}
        .overdue-heading{margin:0 0 6px;color:#a72c11}
        .overdue-copy{margin:0 0 16px;color:#8c351f}
        .overdue-card{border:2px solid #ef7d58;background:#fffaf7;box-shadow:0 4px 14px rgba(167,44,17,.14)}
        .overdue-card small{color:#a72c11}
        .overdue-card button{background:#c63d1c}
        .overdue-badge{display:inline-block;margin-bottom:8px;padding:5px 8px;border-radius:999px;background:#c63d1c;color:#fff;font-size:11px;font-weight:800;letter-spacing:.6px}
        .suggestions-panel{margin:6px 0 24px;padding:20px;border:1px solid #cbdccd;border-radius:16px;background:linear-gradient(120deg,#ffffff,#edf8ef)}
        .suggestions-panel h2{margin:5px 0 8px}
        .suggestions-panel p{color:#5f7064}
        .suggestion-step{margin-top:18px}
        .suggestion-step h3{margin:0 0 8px;font-size:14px}
        .suggestion-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end;margin-top:10px}
        .suggest-button{margin-top:16px}
        .suggestion-note{margin:14px 0 0;color:#17663d !important;font-weight:700}
        .suggestion-filter{margin-top:16px;max-width:360px}
        .suggestion-grid{margin-top:16px}
        .suggestion-card{border-color:#c3dac8;background:#ffffff}
        .suggestion-card > small{color:#147a42;font-weight:800;letter-spacing:.7px}
        .gap-text{padding:10px;border-radius:10px;background:#f1f7f1;color:#47614d !important;font-size:13px;line-height:1.5}
        @media(max-width:650px){
          main{padding:14px}
          .grid,.fields,.suggestion-fields{grid-template-columns:1fr}
          .wide{grid-column:auto}
          .hero{display:block}
          .badge{display:inline-block;margin-top:12px}
        }
      `}</style>

      <header className="top">
        <div>
          <b>🎾 Innovation Tennis Open</b>
        </div>
      </header>

      <div className="tabs">
        <button
          className={view === 'dashboard' ? 'active' : ''}
          onClick={() => setView('dashboard')}
        >
          Match Dashboard
        </button>

        <button
          className={view === 'scheduling' ? 'active' : ''}
          onClick={() => setView('scheduling')}
        >
          Smart Scheduling
        </button>
      </div>

      {note && <p className="notice">{note}</p>}

      {view === 'dashboard' ? (
        <>
          {nextMatch ? (
            <section className="hero">
              <div>
                <div className="eyebrow">
                  {nextMatchGroup.toUpperCase()} · NEXT MATCH
                </div>
                <Matchup match={nextMatch} group={nextMatchGroup} />
                <p>
                  {dateText(nextMatch.match_date)} ·{' '}
                  {nextMatch.match_time.slice(0, 5)} · {nextMatch.court}
                </p>
              </div>

              <div className="badge">UPCOMING</div>
            </section>
          ) : (
            <section className="hero">
              <div>
                <div className="eyebrow">NEXT MATCH</div>
                <h1>No upcoming matches scheduled.</h1>
                <p>Schedule the next match to get started.</p>
              </div>

              <div className="badge">UPCOMING</div>
            </section>
          )}

          <div className="tabs">
            {(['Group A', 'Group B'] as Group[]).map(g => (
              <button
                className={group === g ? 'active' : ''}
                onClick={() => setGroup(g)}
                key={g}
              >
                {g} · {groups[g].length} teams
              </button>
            ))}
          </div>

          <button className="group-schedule" onClick={() => begin()}>
            Schedule match
          </button>

          <div className="filters">
            {['All', 'Scheduled', 'Completed', 'Cancelled'].map(x => (
              <button
                className={filter === x ? 'active' : ''}
                onClick={() => setFilter(x)}
                key={x}
              >
                {x}
              </button>
            ))}

            <select value={team} onChange={e => setTeam(e.target.value)}>
              <option value="">All {group} teams</option>

              {roster.map(([id]) => (
                <option value={id} key={id}>
                  {teamDisplay(group, id)}
                </option>
              ))}
            </select>
          </div>

          {overdue.length > 0 && (
            <section className="overdue-section">
              <h2 className="overdue-heading">
                Action required — {overdue.length} past match
                {overdue.length === 1 ? '' : 'es'}
              </h2>

              <p className="overdue-copy">
                These scheduled match times have passed in Fremont. Update each
                match as completed with a result, or cancel it with a reason.
              </p>

              <div className="grid">
                {overdue.map(m => (
                  <article className="card overdue-card" key={m.id}>
                    <div className="overdue-badge">UPDATE REQUIRED</div>

                    <small>
                      {dateText(m.match_date)} · {m.match_time.slice(0, 5)} ·{' '}
                      <b>Scheduled</b>
                    </small>

                    <Matchup match={m} group={group} />
                    <p>{m.court}</p>

                    <button onClick={() => begin(m)}>Update match details</button>
                  </article>
                ))}
              </div>
            </section>
          )}

          <Section
            title="Upcoming matches"
            list={upcoming}
            edit={begin}
            empty="No upcoming matches."
            group={group}
          />

          <Section
            title="Recent results"
            list={completed}
            edit={begin}
            empty="No completed matches."
            group={group}
          />

          <Section
            title="Cancelled matches"
            list={cancelled}
            edit={begin}
            empty="No cancelled matches."
            group={group}
          />
        </>
      ) : (
        <section className="suggestions-panel">
          <div>
            <div className="eyebrow">SMART SCHEDULING</div>
            <h2>Find a fair date and available opponent</h2>
            <p>
              Select your group and team, then set rest-day rules for both sides.
              Already scheduled or completed matchups are never suggested. Rest
              days count completed matches and scheduled upcoming matches before
              and after the suggested date. Each suggestion shows that team&apos;s
              last match and next match.
            </p>
          </div>

          <div className="suggestion-step">
            <h3>Step 1 · Select your group</h3>
            <div className="tabs">
              {(['Group A', 'Group B'] as Group[]).map(g => (
                <button
                  className={scheduleGroup === g ? 'active' : ''}
                  onClick={() => setScheduleGroup(g)}
                  key={g}
                  type="button"
                >
                  {g} · {groups[g].length} teams
                </button>
              ))}
            </div>
          </div>

          <div className="suggestion-step">
            <h3>Step 2 · Select your team</h3>
            <label className="field">
              Your team
              <select
                value={suggestionTeam}
                onChange={e => setSuggestionTeam(e.target.value)}
              >
                <option value="">Choose your team</option>

                {scheduleRoster.map(([id]) => (
                  <option value={id} key={id}>
                    {teamDisplay(scheduleGroup, id)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="suggestion-step">
            <h3>Step 3 · Set rest-day rules</h3>
            <div className="suggestion-fields">
              <label className="field">
                Minimum days after your last match
                <select
                  value={yourGapDays}
                  onChange={e => setYourGapDays(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(days => (
                    <option value={days} key={days}>
                      {days} day{days === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Minimum days after opponent&apos;s last match
                <select
                  value={opponentGapDays}
                  onChange={e => setOpponentGapDays(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(days => (
                    <option value={days} key={days}>
                      {days} day{days === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <button className="suggest-button" onClick={findSuggestions}>
            Find available matches
          </button>

          {suggestionNote && <p className="suggestion-note">{suggestionNote}</p>}

          {suggestions.length > 0 && (
            <label className="field suggestion-filter">
              Filter by opponent
              <select
                value={suggestionOpponent}
                onChange={e => setSuggestionOpponent(e.target.value)}
              >
                <option value="">All opponents</option>

                {opponentOptions.map(id => (
                  <option value={id} key={id}>
                    {teamDisplay(scheduleGroup, id)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {visibleSuggestions.length > 0 && (
            <div className="grid suggestion-grid">
              {visibleSuggestions.map(suggestion => (
                <article
                  className="card suggestion-card"
                  key={`${suggestion.opponentId}-${suggestion.date}`}
                >
                  <small>SUGGESTED MATCH</small>

                  <div className="matchup">
                    <TeamContext
                      group={scheduleGroup}
                      id={suggestionTeam}
                      matches={matches}
                    />
                    <span className="versus">vs</span>
                    <TeamContext
                      group={scheduleGroup}
                      id={suggestion.opponentId}
                      matches={matches}
                    />
                  </div>

                  <p>
                    <b>{dateText(suggestion.date)}</b>
                    <br />
                    Suggested start: 7:00 PM
                  </p>

                  <p className="gap-text">
                    Your rest:{' '}
                    {suggestion.yourGap === 99
                      ? 'No nearby match'
                      : `${suggestion.yourGap} days`}
                    <br />
                    Opponent rest:{' '}
                    {suggestion.opponentGap === 99
                      ? 'No nearby match'
                      : `${suggestion.opponentGap} days`}
                  </p>

                  <button onClick={() => scheduleSuggestion(suggestion)}>
                    Schedule this match
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {open && (
        <div className="modal">
          <form onSubmit={save}>
            <h2>
              {editing ? 'Update' : 'Schedule'} {group} match
            </h2>

            <div className="fields">
              <label className="field">
                First team
                <select value={first} onChange={e => setFirst(e.target.value)}>
                  {roster
                    .filter(([id]) => id !== second)
                    .map(([id]) => (
                      <option value={id} key={id}>
                        {teamDisplay(group, id)}
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                Opponent
                <select value={second} onChange={e => setSecond(e.target.value)}>
                  {roster
                    .filter(([id]) => id !== first)
                    .map(([id]) => (
                      <option value={id} key={id}>
                        {teamDisplay(group, id)}
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                Date
                <input
                  type="date"
                  value={draft.match_date}
                  onChange={e =>
                    setDraft({ ...draft, match_date: e.target.value })
                  }
                />
              </label>

              <label className="field">
                Time
                <input
                  type="time"
                  value={draft.match_time}
                  onChange={e =>
                    setDraft({ ...draft, match_time: e.target.value })
                  }
                />
              </label>

              <label className="field">
                Court
                <input
                  value={draft.court}
                  onChange={e => setDraft({ ...draft, court: e.target.value })}
                />
              </label>

              <label className="field">
                Status
                <select
                  value={draft.status}
                  onChange={e => setDraft({ ...draft, status: e.target.value })}
                >
                  {['Scheduled', 'Completed', 'Cancelled'].map(status => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>

              {draft.status === 'Completed' && (
                <label className="field wide">
                  Result
                  <textarea
                    value={draft.result || ''}
                    onChange={e =>
                      setDraft({ ...draft, result: e.target.value })
                    }
                  />
                </label>
              )}

              {draft.status === 'Cancelled' && (
                <label className="field wide">
                  Cancellation reason
                  <textarea
                    value={draft.cancellation_reason || ''}
                    onChange={e =>
                      setDraft({
                        ...draft,
                        cancellation_reason: e.target.value,
                      })
                    }
                  />
                </label>
              )}
            </div>

            <div className="actions">
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>

              <button>Save match</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
