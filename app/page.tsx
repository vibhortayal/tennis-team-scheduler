'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Group,
  Identity,
  groups,
  IDENTITY_KEY,
  allPlayers,
  viewingIdentity,
  identityValue,
} from './teams';
import {
  Match,
  Draft,
  Suggestion,
  blank,
  fremontNow,
  matchDateTime,
  currentDateInFremont,
  addDays,
  teamIds,
  canUpdateMatch,
  existingFixture,
  matchesForTeam,
  restGapAroundDate,
} from './lib/matches';
import { api, supabaseKey as key, headers } from './lib/supabase';
import { computeStandings, ScoreEntryState, validateScores } from './lib/scoring';
import { Dashboard } from './components/Dashboard';
import { PlayerPicker } from './components/PlayerPicker';
import { IdentityPrompt, MatchModal } from './components/MatchModal';
import { SmartScheduling } from './components/SmartScheduling';
import { StandingsView } from './components/StandingsTable';
import { Styles } from './components/Styles';

type View = 'dashboard' | 'scheduling' | 'standings';

export default function Page() {
  const [view, setView] = useState<View>('dashboard');
  const [group, setGroup] = useState<Group>('Group A');
  const [scheduleGroup, setScheduleGroup] = useState<Group>('Group A');
  const [standingsGroup, setStandingsGroup] = useState<Group>('Group A');
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState('All');
  const [team, setTeam] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [draft, setDraft] = useState<Draft>(blank('Group A'));
  const [editing, setEditing] = useState<Match | null>(null);
  const [open, setOpen] = useState(false);
  const [identityPromptOpen, setIdentityPromptOpen] = useState(false);
  const [pendingIdentityValue, setPendingIdentityValue] = useState('');
  const [note, setNote] = useState('');
  const [suggestionTeam, setSuggestionTeam] = useState('');
  const [yourGapDays, setYourGapDays] = useState(3);
  const [opponentGapDays, setOpponentGapDays] = useState(3);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionNote, setSuggestionNote] = useState('');
  const [suggestionOpponent, setSuggestionOpponent] = useState('');
  const [identity, setIdentity] = useState<Identity>(viewingIdentity);

  const roster = groups[group];
  const scheduleRoster = groups[scheduleGroup];

  const load = async () => {
    if (!api || !key) {
      setNote('Missing Supabase public environment settings.');
      return;
    }

    const response = await fetch(`${api}?select=*&order=match_date.asc,match_time.asc`, {
      headers,
    });

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
    try {
      const saved = window.localStorage.getItem(IDENTITY_KEY);

      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as Identity;

      const savedIdentity = parsed.viewing
        ? viewingIdentity
        : allPlayers.find(
            (player) =>
              player.name === parsed.name &&
              player.teamId === parsed.teamId &&
              player.group === parsed.group
          );

      if (!savedIdentity) {
        return;
      }

      setIdentity(savedIdentity);

      if (savedIdentity.viewing) {
        setGroup('Group A');
        setScheduleGroup('Group A');
        setStandingsGroup('Group A');
        setSuggestionTeam('');
        return;
      }

      setGroup(savedIdentity.group);
      setScheduleGroup(savedIdentity.group);
      setStandingsGroup(savedIdentity.group);
      setSuggestionTeam(savedIdentity.teamId);
    } catch {
      setIdentity(viewingIdentity);
      setGroup('Group A');
      setScheduleGroup('Group A');
      setStandingsGroup('Group A');
      setSuggestionTeam('');
    }
  }, []);

  const chooseIdentity = (nextIdentity: Identity) => {
    setIdentity(nextIdentity);
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(nextIdentity));

    setSuggestions([]);
    setSuggestionNote('');
    setSuggestionOpponent('');

    if (!nextIdentity.viewing) {
      setGroup(nextIdentity.group);
      setScheduleGroup(nextIdentity.group);
      setStandingsGroup(nextIdentity.group);
      setSuggestionTeam(nextIdentity.teamId);
    } else {
      setGroup('Group A');
      setScheduleGroup('Group A');
      setStandingsGroup('Group A');
      setSuggestionTeam('');
    }
  };

  useEffect(() => {
    setTeam('');

    if (!open) {
      setFirst(groups[group][0][0]);
      setSecond(groups[group][1][0]);
      setDraft(blank(group));
    }
  }, [group, open]);

  const scoped = useMemo(
    () =>
      matches.filter(
        (match) =>
          (match.league_group || 'Group B') === group &&
          (filter === 'All' || match.status === filter) &&
          (!team || teamIds(match, group).includes(team))
      ),
    [matches, group, filter, team]
  );

  const standingsA = useMemo(() => computeStandings(matches, 'Group A'), [matches]);
  const standingsB = useMemo(() => computeStandings(matches, 'Group B'), [matches]);

  const opponentOptions = useMemo(
    () => Array.from(new Set(suggestions.map((item) => item.opponentId))),
    [suggestions]
  );

  const visibleSuggestions = useMemo(() => {
    const filtered = suggestionOpponent
      ? suggestions.filter((item) => item.opponentId === suggestionOpponent)
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
  const todayInFremont = currentDateInFremont();

  const overdue = scoped.filter(
    (match) => match.status === 'Scheduled' && matchDateTime(match) < nowInFremont
  );

  const upcoming = scoped.filter(
    (match) => match.status === 'Scheduled' && match.match_date >= todayInFremont
  );

  const completed = scoped.filter((match) => match.status === 'Completed');
  const cancelled = scoped.filter((match) => match.status === 'Cancelled');

  const upcomingAll = matches
    .filter((match) => match.status === 'Scheduled' && match.match_date >= todayInFremont)
    .sort((a, b) => matchDateTime(a).localeCompare(matchDateTime(b)));

  const nextMatchDate = upcomingAll[0]?.match_date || '';

  const nextMatches = upcomingAll.filter((match) => match.match_date === nextMatchDate);
  const hasTodayMatches = upcoming.some((match) => match.match_date === todayInFremont);

  const begin = (match?: Match) => {
    if (match && !canUpdateMatch(match, identity)) {
      setNote('Only players on this match can update it.');
      return;
    }

    setEditing(match || null);

    if (match) {
      const matchGroup = (match.league_group || 'Group B') as Group;
      const matchRoster = groups[matchGroup];
      const ids = teamIds(match, matchGroup);

      setDraft({ ...match, league_group: matchGroup });
      setFirst(ids[0] || matchRoster[0][0]);
      setSecond(ids[1] || matchRoster[1][0]);
    } else {
      setDraft(blank(group));
      setFirst(identity.teamId || roster[0][0]);
      setSecond(roster.find(([id]) => id !== identity.teamId)?.[0] || roster[0][0]);
    }

    setOpen(true);
    setNote('');
  };

  const startScheduling = () => {
    if (identity.viewing) {
      setPendingIdentityValue('');
      setIdentityPromptOpen(true);
      return;
    }

    begin();
  };

  const continueWithIdentity = () => {
    const selected = allPlayers.find((player) => identityValue(player) === pendingIdentityValue);

    if (!selected) {
      return;
    }

    chooseIdentity(selected);
    setIdentityPromptOpen(false);
    setPendingIdentityValue('');
    setEditing(null);
    setFirst(selected.teamId);

    setSecond(
      groups[selected.group].find(([id]) => id !== selected.teamId)?.[0] || selected.teamId
    );

    setDraft(blank(selected.group));
    setOpen(true);
    setNote('');
  };

  const findSuggestions = () => {
    if (identity.viewing || !suggestionTeam) {
      setSuggestionNote('Select who you are from the top-right menu first.');
      setSuggestions([]);
      setSuggestionOpponent('');
      return;
    }

    const today = currentDateInFremont();

    const possibleOpponents = scheduleRoster
      .map(([id]) => id)
      .filter((id) => id !== suggestionTeam)
      .filter((opponentId) => !existingFixture(matches, scheduleGroup, suggestionTeam, opponentId));

    const candidates: Suggestion[] = [];

    for (const opponentId of possibleOpponents) {
      const yourMatches = matchesForTeam(matches, scheduleGroup, suggestionTeam);

      const opponentMatches = matchesForTeam(matches, scheduleGroup, opponentId);

      for (let offset = 1; offset <= 30; offset += 1) {
        const date = addDays(today, offset);

        const youHaveMatch = yourMatches.some((match) => match.match_date === date);

        const opponentHasMatch = opponentMatches.some((match) => match.match_date === date);

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
        ? 'Found suggested matches, sorted by date. Rest days count completed matches and scheduled upcoming matches.'
        : 'No suitable matches found in the next 30 days. Rest days count completed matches and scheduled upcoming matches.'
    );
  };

  const scheduleSuggestion = (suggestion: Suggestion) => {
    if (existingFixture(matches, scheduleGroup, suggestionTeam, suggestion.opponentId)) {
      setSuggestionNote(
        'That matchup is already scheduled or completed, so it cannot be suggested.'
      );

      setSuggestions((current) =>
        current.filter((item) => item.opponentId !== suggestion.opponentId)
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

  const save = async (event: FormEvent, scores: ScoreEntryState) => {
    event.preventDefault();

    if (editing && !canUpdateMatch(editing, identity)) {
      setNote('Only players on this match can update it.');
      setOpen(false);
      return;
    }

    if (first === second) {
      setNote('Choose a different opponent.');
      return;
    }

    if (!draft.match_date || !draft.match_time || !draft.court) {
      setNote('Add a date, time, and court.');
      return;
    }

    let result = draft.result;
    if (draft.status === 'Completed') {
      const validation = validateScores(scores);
      if (validation.ok === false) {
        setNote(validation.error);
        return;
      }
      result = validation.result;
    }

    if (draft.status === 'Cancelled' && !draft.cancellation_reason?.trim()) {
      setNote('Enter a cancellation reason.');
      return;
    }

    const matchGroup = editing ? ((editing.league_group || 'Group B') as Group) : group;

    const conflict = matches.find(
      (match) =>
        match.id !== editing?.id &&
        (match.league_group || 'Group B') === matchGroup &&
        match.match_date === draft.match_date &&
        match.status !== 'Cancelled' &&
        teamIds(match, matchGroup).some((id) => id === first || id === second)
    );

    if (conflict) {
      setNote('One of these teams already has an active match on that date.');
      return;
    }

    const body = {
      ...draft,
      league_group: matchGroup,
      matchup: `Team #${first} vs Team #${second}`,
      result,
    };

    if (!api || !key) {
      setNote('Missing Supabase public environment settings.');
      return;
    }

    try {
      const response = await fetch(editing ? `${api}?id=eq.${editing.id}` : api, {
        method: editing ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setNote('Could not save the match.');
        return;
      }
    } catch {
      setNote('Could not save the match.');
      return;
    }

    setOpen(false);
    setNote('Match saved successfully.');
    await load();
  };

  return (
    <main>
      <Styles />

      <header className="top">
        <div>
          <b>🎾 Innovation Tennis Open</b>
        </div>

        <PlayerPicker identity={identity} onChange={chooseIdentity} />
      </header>

      <div className="tabs">
        <button
          className={view === 'dashboard' ? 'active' : ''}
          onClick={() => setView('dashboard')}
        >
          Match Dashboard
        </button>

        <button
          className={view === 'standings' ? 'active' : ''}
          onClick={() => setView('standings')}
        >
          Standings
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
        <Dashboard
          nextMatches={nextMatches}
          nextMatchDate={nextMatchDate}
          overdue={overdue}
          upcoming={upcoming}
          completed={completed}
          cancelled={cancelled}
          hasTodayMatches={hasTodayMatches}
          group={group}
          filter={filter}
          team={team}
          identity={identity}
          onGroupChange={setGroup}
          onSchedule={startScheduling}
          onFilterChange={setFilter}
          onTeamChange={setTeam}
          onEdit={begin}
        />
      ) : view === 'standings' ? (
        <StandingsView
          standingsA={standingsA}
          standingsB={standingsB}
          standingsGroup={standingsGroup}
          onGroupChange={setStandingsGroup}
          selectedTeamId={identity.viewing ? null : identity.teamId}
        />
      ) : (
        <SmartScheduling
          identity={identity}
          scheduleGroup={scheduleGroup}
          suggestionTeam={suggestionTeam}
          yourGapDays={yourGapDays}
          opponentGapDays={opponentGapDays}
          suggestions={suggestions}
          visibleSuggestions={visibleSuggestions}
          opponentOptions={opponentOptions}
          suggestionOpponent={suggestionOpponent}
          suggestionNote={suggestionNote}
          matches={matches}
          onYourGap={setYourGapDays}
          onOpponentGap={setOpponentGapDays}
          onFind={findSuggestions}
          onOpponentFilter={setSuggestionOpponent}
          onSchedule={scheduleSuggestion}
        />
      )}

      {identityPromptOpen && (
        <IdentityPrompt
          value={pendingIdentityValue}
          onValue={setPendingIdentityValue}
          onCancel={() => setIdentityPromptOpen(false)}
          onContinue={continueWithIdentity}
        />
      )}

      {open && (
        <MatchModal
          group={group}
          roster={roster}
          editing={!!editing}
          first={first}
          second={second}
          draft={draft}
          note={note}
          onFirst={setFirst}
          onSecond={setSecond}
          onDraft={setDraft}
          onClose={() => setOpen(false)}
          onSubmit={save}
        />
      )}
    </main>
  );
}
