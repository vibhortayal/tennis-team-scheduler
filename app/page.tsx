'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
  teamIds,
  matchIncludesTeam,
  canUpdateMatch,
  existingFixture,
  matchesForTeam,
  restGapAroundDate,
} from './lib/matches';
import { api, availabilityApi, supabaseKey as key, headers } from './lib/supabase';
import {
  AvailabilitySlot,
  DEFAULT_MATCH_DURATION_MINUTES,
  SEASON_DEADLINE,
  effectiveWindowsForPlayer,
  generateSuggestedStarts,
  intersectTimeWindows,
  isEligibleForSuggestion,
  playerKeysForTeam,
  rankMatchSuggestions,
} from './lib/scheduling';
import { SlotSaveInput } from './components/AvailabilityManager';
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
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [allAvailability, setAllAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const roster = groups[group];
  const scheduleRoster = groups[scheduleGroup];
  const partnerName =
    scheduleRoster
      .find(([id]) => id === suggestionTeam)?.[1]
      .split(',')
      .map((name) => name.trim())
      .find((name) => name !== identity.name) || 'Your partner';
  const partnerReady = allAvailability.some(
    (slot) =>
      (slot.kind ?? 'available') === 'available' &&
      slot.playerId === `${scheduleGroup}:${suggestionTeam}:${partnerName}`
  );
  const availabilitySlots = useMemo(
    () => availability.filter((slot) => (slot.kind ?? 'available') === 'available'),
    [availability]
  );
  const blockingSlots = useMemo(
    () => availability.filter((slot) => (slot.kind ?? 'available') === 'blocked'),
    [availability]
  );
  const teamMatches = useMemo(
    () => matchesForTeam(matches, scheduleGroup, suggestionTeam),
    [matches, scheduleGroup, suggestionTeam]
  );

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

  const loadAvailability = useCallback(async (player: Identity) => {
    if (player.viewing || !availabilityApi || !key) {
      setAvailability([]);
      setAllAvailability([]);
      return;
    }
    try {
      const playerKey = encodeURIComponent(identityValue(player));
      const playerKeys = groups[player.group].flatMap(([teamId]) =>
        playerKeysForTeam(player.group, teamId)
      );
      const rosterFilter = playerKeys
        .map((playerKey) => `player_key.eq.${encodeURIComponent(playerKey)}`)
        .join(',');
      const response = await fetch(
        `${availabilityApi}?or=(${rosterFilter})&select=*&order=starts_at.asc`,
        { headers }
      );
      if (!response.ok) throw new Error('Could not load availability.');
      const rows = (await response.json()) as Array<{
        id: string;
        player_key: string;
        starts_at: string;
        ends_at: string;
        kind?: 'available' | 'blocked';
        mode?: 'anytime' | 'time_windows' | 'all_day';
        created_at?: string;
        updated_at?: string;
      }>;
      const parsed = rows.map((row) => ({
        id: row.id,
        playerId: row.player_key,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        kind: row.kind ?? 'available',
        mode: row.mode ?? 'time_windows',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      setAllAvailability(parsed);
      setAvailability(parsed.filter((slot) => slot.playerId === decodeURIComponent(playerKey)));
      setAvailabilityError('');
    } catch {
      setAvailabilityError('Could not load your availability.');
    }
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
      loadAvailability(savedIdentity);

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
  }, [loadAvailability]);

  const chooseIdentity = (nextIdentity: Identity) => {
    setIdentity(nextIdentity);
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(nextIdentity));

    setSuggestions([]);
    setSuggestionNote('');
    setSuggestionOpponent('');
    loadAvailability(nextIdentity);

    if (!nextIdentity.viewing) {
      setView('scheduling');
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

  const saveSlot = async (input: SlotSaveInput, id?: string) => {
    if (identity.viewing || !availabilityApi || !key) return;
    setAvailabilitySaving(true);
    setAvailabilityError('');
    try {
      const body = {
        player_key: identityValue(identity),
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        kind: input.kind,
        mode: input.mode,
      };
      const response = await fetch(id ? `${availabilityApi}?id=eq.${id}` : availabilityApi, {
        method: id ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Could not save.');
      await loadAvailability(identity);
    } catch {
      setAvailabilityError('Could not save your update.');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const deleteSlot = async (id: string) => {
    if (!availabilityApi || !key) return;
    setAvailabilitySaving(true);
    try {
      const response = await fetch(`${availabilityApi}?id=eq.${id}`, { method: 'DELETE', headers });
      if (!response.ok) throw new Error('Could not remove that entry.');
      await loadAvailability(identity);
    } catch {
      setAvailabilityError('Could not remove that entry.');
    } finally {
      setAvailabilitySaving(false);
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

  const { overdue, upcoming, completed, cancelled } = useMemo(() => {
    const scheduled = scoped.filter((match) => match.status === 'Scheduled');

    return {
      overdue: scheduled.filter((match) => matchDateTime(match) < nowInFremont),
      upcoming: scheduled.filter((match) => match.match_date >= todayInFremont),
      completed: scoped.filter((match) => match.status === 'Completed'),
      cancelled: scoped.filter((match) => match.status === 'Cancelled'),
    };
  }, [nowInFremont, scoped, todayInFremont]);

  const upcomingAll = useMemo(
    () =>
      matches
        .filter((match) => match.status === 'Scheduled' && match.match_date >= todayInFremont)
        .sort((a, b) => matchDateTime(a).localeCompare(matchDateTime(b))),
    [matches, todayInFremont]
  );

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

    if (!availabilitySlots.length) {
      setSuggestionNote('Add your availability to unlock match suggestions before September 30.');
      setSuggestions([]);
      return;
    }

    const today = new Date();
    const deadline = new Date(SEASON_DEADLINE);
    const slotMap = new Map<string, AvailabilitySlot[]>();
    allAvailability.forEach((slot) =>
      slotMap.set(slot.playerId, [...(slotMap.get(slot.playerId) || []), slot])
    );

    const possibleOpponents = scheduleRoster
      .map(([id]) => id)
      .filter((id) => id !== suggestionTeam)
      .filter((opponentId) => !existingFixture(matches, scheduleGroup, suggestionTeam, opponentId));
    const teamMatches = new Map(
      scheduleRoster.map(([id]) => [id, matchesForTeam(matches, scheduleGroup, id)])
    );
    const yourMatches = teamMatches.get(suggestionTeam) || [];

    const candidates: Suggestion[] = [];

    for (const opponentId of possibleOpponents) {
      const opponentMatches = teamMatches.get(opponentId) || [];

      const participants = [
        ...playerKeysForTeam(scheduleGroup, suggestionTeam),
        ...playerKeysForTeam(scheduleGroup, opponentId),
      ];
      const windows = intersectTimeWindows(
        participants
          .filter((player) => (slotMap.get(player) || []).length > 0)
          .map((player) => effectiveWindowsForPlayer(slotMap.get(player) || []))
      );
      const participantNames = groups[scheduleGroup]
        .find(([id]) => id === suggestionTeam)?.[1]
        .split(',')
        .concat(groups[scheduleGroup].find(([id]) => id === opponentId)?.[1].split(',') || [])
        .map((name) => name.trim());
      const missingPlayers = participants
        .map((player, index) => ({ player, name: participantNames[index] }))
        .filter(({ player }) => !(slotMap.get(player) || []).length)
        .map(({ name }) => name);
      const starts = windows
        .flatMap((window) => generateSuggestedStarts(window, DEFAULT_MATCH_DURATION_MINUTES))
        .filter(
          (start) =>
            start > today &&
            new Date(start.valueOf() + DEFAULT_MATCH_DURATION_MINUTES * 60000) <= deadline
        )
        .slice(0, 4);
      const fixture: Match = {
        id: `suggested-${suggestionTeam}-${opponentId}`,
        matchup: `Team #${suggestionTeam} vs Team #${opponentId}`,
        match_date: '',
        match_time: '',
        court: '',
        status: 'unscheduled',
        league_group: scheduleGroup,
      };
      if (!isEligibleForSuggestion(fixture)) continue;
      starts.forEach((start) => {
        const date = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(start);

        const hasScheduledConflict = [...yourMatches, ...opponentMatches].some((match) => {
          if (match.match_date !== date || match.status.toLowerCase() !== 'scheduled') return false;
          const matchStart = new Date(matchDateTime(match));
          const matchEnd = new Date(matchStart.valueOf() + DEFAULT_MATCH_DURATION_MINUTES * 60000);
          return (
            start < matchEnd &&
            start.valueOf() + DEFAULT_MATCH_DURATION_MINUTES * 60000 > matchStart.valueOf()
          );
        });

        if (hasScheduledConflict) {
          return;
        }

        const yourGap = restGapAroundDate(yourMatches, date);
        const opponentGap = restGapAroundDate(opponentMatches, date);

        if (yourGap < yourGapDays || opponentGap < opponentGapDays) {
          return;
        }

        candidates.push({
          opponentId,
          date,
          startsAt: start.toISOString(),
          endsAt: new Date(start.valueOf() + DEFAULT_MATCH_DURATION_MINUTES * 60000).toISOString(),
          alternateCount: Math.max(0, starts.length - 1),
          missingPlayers,
          allPlayersReady: missingPlayers.length === 0,
          yourGap,
          opponentGap,
          score: yourGap + opponentGap,
        });
      });
    }

    const ranked = rankMatchSuggestions(candidates);

    setSuggestions(ranked);
    setSuggestionOpponent('');

    setSuggestionNote(
      ranked.length
        ? `We found ${ranked.length} suggested match times before September 30.`
        : 'No shared time is available yet. Add more time windows before September 30 to improve your options.'
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
      match_time: suggestion.startsAt
        ? new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/Los_Angeles',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(new Date(suggestion.startsAt))
        : '19:00',
      court: 'Court 2',
      league_group: scheduleGroup,
    });

    setOpen(true);
    setNote('');
  };

  const copyReminder = async () => {
    const partner =
      groups[scheduleGroup]
        .find(([id]) => id === suggestionTeam)?.[1]
        .split(',')
        .map((name) => name.trim())
        .find((name) => name !== identity.name) || 'your partner';
    await navigator.clipboard?.writeText(
      `Hi ${partner} - I added my availability for our remaining league matches. Please add a few times you can play before September 30 so the scheduler can find overlaps with our opponents.`
    );
    setSuggestionNote(`Reminder copied for ${partner}.`);
  };

  const copyMissingReminder = async (names: string[]) => {
    await navigator.clipboard?.writeText(
      `Hi ${names.join(' and ')} - please add a few times you can play before September 30 so we can find a match time that works for everyone.`
    );
    setSuggestionNote(`Reminder copied for ${names.join(' and ')}.`);
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
          availabilitySlots={availabilitySlots}
          blockingSlots={blockingSlots}
          teamMatches={teamMatches}
          availabilitySaving={availabilitySaving}
          availabilityError={availabilityError}
          onSaveSlot={saveSlot}
          onDeleteSlot={deleteSlot}
          copyReminder={copyReminder}
          copyMissingReminder={copyMissingReminder}
          partnerName={partnerName}
          partnerReady={partnerReady}
          remainingMatchCount={
            matches.filter(
              (match) =>
                (match.league_group || 'Group B') === scheduleGroup &&
                matchIncludesTeam(match.matchup, suggestionTeam) &&
                !['Completed', 'Cancelled'].includes(match.status)
            ).length
          }
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
