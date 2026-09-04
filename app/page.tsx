'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Group,
  Identity,
  Team,
  groups,
  IDENTITY_KEY,
  allPlayers,
  viewingIdentity,
  identityValue,
  TeamRecord,
  initialStaticTeams,
  updateTeamRegistry,
  getActivePlayers,
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
  canUpdateMatch,
  existingFixture,
  matchesForTeam,
  pendingOpponentsForTeam,
  restGapAroundDate,
} from './lib/matches';
import { api, availabilityApi, teamsApi, supabaseKey as key, headers } from './lib/supabase';
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
import { normalizeDate } from './lib/availabilityHelpers';
import { Dashboard } from './components/Dashboard';
import { PlayerPicker } from './components/PlayerPicker';
import { IdentityPrompt, MatchModal } from './components/MatchModal';
import { SmartScheduling } from './components/SmartScheduling';
import { StandingsView } from './components/StandingsTable';
import { Styles } from './components/Styles';
import { DateParticipantStatus } from './components/MultiDateCalendar';
import { AddTeamModal } from './components/AddTeamModal';
import { getActiveRoster, NewTeamInput, validateNewTeam } from './lib/teamValidation';

type View = 'dashboard' | 'scheduling' | 'standings';

export default function Page() {
  const [view, setView] = useState<View>('dashboard');
  const [group, setGroup] = useState<Group>('Group A');
  const [scheduleGroup, setScheduleGroup] = useState<Group>('Group A');
  const [standingsGroup, setStandingsGroup] = useState<Group>('Group A');
  const [matches, setMatches] = useState<Match[]>([]);
  const [allTeams, setAllTeams] = useState<TeamRecord[]>([...initialStaticTeams]);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
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
  const [yourGapDays, setYourGapDays] = useState(1);
  const [opponentGapDays, setOpponentGapDays] = useState(1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionNote, setSuggestionNote] = useState('');
  const [suggestionOpponent, setSuggestionOpponent] = useState('');
  const [availabilityOpponents, setAvailabilityOpponents] = useState<string[]>([]);
  const [identity, setIdentity] = useState<Identity>(viewingIdentity);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [allAvailability, setAllAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const activeRosterA = useMemo(() => getActiveRoster(allTeams, 'Group A'), [allTeams]);
  const activeRosterB = useMemo(() => getActiveRoster(allTeams, 'Group B'), [allTeams]);
  const activeRosters: Record<Group, readonly Team[]> = useMemo(
    () => ({
      'Group A': activeRosterA,
      'Group B': activeRosterB,
    }),
    [activeRosterA, activeRosterB]
  );
  const activePlayers = useMemo(() => getActivePlayers(allTeams), [allTeams]);

  const roster = activeRosters[group] || groups[group];
  const scheduleRoster = activeRosters[scheduleGroup] || groups[scheduleGroup];
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

  const loadTeams = useCallback(async () => {
    if (!teamsApi || !key) {
      updateTeamRegistry(initialStaticTeams);
      return;
    }

    try {
      const response = await fetch(`${teamsApi}?select=*&order=created_at.asc`, { headers });
      if (!response.ok) {
        updateTeamRegistry(initialStaticTeams);
        return;
      }
      const rows = (await response.json()) as Array<{
        id: string;
        team_number: string;
        player1_name: string;
        player2_name: string;
        player_names: string;
        league_group: Group;
        status: 'active' | 'withdrawn';
        created_at?: string;
      }>;
      if (Array.isArray(rows) && rows.length > 0) {
        const parsed: TeamRecord[] = rows.map((r) => ({
          id: r.id,
          teamId: r.team_number,
          player1: r.player1_name,
          player2: r.player2_name,
          playerNames: r.player_names,
          group: r.league_group,
          status: r.status,
          createdAt: r.created_at,
        }));
        // Merge with static defaults if any are missing
        const teamIdSet = new Set(parsed.map((t) => t.teamId));
        const combined = [...parsed];
        for (const st of initialStaticTeams) {
          if (!teamIdSet.has(st.teamId)) {
            combined.push(st);
          }
        }
        setAllTeams(combined);
        updateTeamRegistry(combined);
      } else {
        setAllTeams([...initialStaticTeams]);
        updateTeamRegistry(initialStaticTeams);
      }
    } catch {
      updateTeamRegistry(initialStaticTeams);
    }
  }, []);

  const saveNewTeam = async (input: NewTeamInput): Promise<{ ok: boolean; error?: string }> => {
    const validation = validateNewTeam(input, allTeams);
    if (validation.ok === false) {
      return { ok: false, error: validation.error };
    }

    const { teamNumber, player1, player2, playerNames, group: teamGroup, status } = validation.data;

    let createdRecord: TeamRecord = {
      teamId: teamNumber,
      player1,
      player2,
      playerNames,
      group: teamGroup,
      status,
    };

    if (teamsApi && key) {
      try {
        const response = await fetch(teamsApi, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            team_number: teamNumber,
            player1_name: player1,
            player2_name: player2,
            player_names: playerNames,
            league_group: teamGroup,
            status,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          let msg = `Could not save team to Supabase: ${errText || response.statusText}`;
          if (errText.includes('dashboard_teams') && errText.includes('does not exist')) {
            msg =
              'Could not save team because the Supabase dashboard_teams migration (005) has not been applied yet.';
          }
          return { ok: false, error: msg };
        }

        const data = await response.json();
        if (Array.isArray(data) && data[0]) {
          createdRecord = {
            id: data[0].id,
            teamId: data[0].team_number,
            player1: data[0].player1_name,
            player2: data[0].player2_name,
            playerNames: data[0].player_names,
            group: data[0].league_group,
            status: data[0].status,
            createdAt: data[0].created_at,
          };
        }
      } catch (err) {
        return {
          ok: false,
          error: `Persistence error: ${err instanceof Error ? err.message : 'Network error.'}`,
        };
      }
    }

    setAllTeams((prev) => {
      const updated = [...prev, createdRecord];
      updateTeamRegistry(updated);
      return updated;
    });

    setNote(`Team #${teamNumber} (${playerNames}) added successfully to ${teamGroup}.`);
    return { ok: true };
  };

  useEffect(() => {
    load();
    loadTeams();
  }, [loadTeams]);

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
    setAvailabilityOpponents([]);
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
      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || `Request failed with status ${response.status}.`);
      }
      await loadAvailability(identity);
    } catch (error) {
      let message = 'Could not save your update.';
      if (
        error instanceof Error &&
        error.message.includes('column player_availability.kind does not exist')
      ) {
        message =
          'Could not save your update because the Supabase availability migration has not been applied.';
      }
      setAvailabilityError(message);
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
      const gRoster = activeRosters[group];
      if (gRoster && gRoster.length >= 2) {
        setFirst(gRoster[0][0]);
        setSecond(gRoster[1][0]);
      }
      setDraft(blank(group));
    }
  }, [group, open, activeRosters]);

  const scoped = useMemo(
    () =>
      matches.filter(
        (match) =>
          (match.league_group || 'Group B') === group &&
          (filter === 'All' || match.status === filter) &&
          (!team || teamIds(match, group, roster).includes(team))
      ),
    [matches, group, filter, team, roster]
  );

  const standingsA = useMemo(
    () => computeStandings(matches, 'Group A', activeRosterA),
    [matches, activeRosterA]
  );
  const standingsB = useMemo(
    () => computeStandings(matches, 'Group B', activeRosterB),
    [matches, activeRosterB]
  );
  const pendingOpponentIds = useMemo(
    () => pendingOpponentsForTeam(matches, scheduleGroup, suggestionTeam, scheduleRoster),
    [matches, scheduleGroup, suggestionTeam, scheduleRoster]
  );
  const opponentMissingNames = pendingOpponentIds.flatMap((opponentId) => {
    const team = scheduleRoster.find(([id]) => id === opponentId);
    if (!team) return [];
    return team[1]
      .split(',')
      .map((name) => name.trim())
      .filter(
        (name) =>
          !allAvailability.some(
            (slot) => slot.playerId === `${scheduleGroup}:${opponentId}:${name}`
          )
      );
  });
  const participantStatusMap = (() => {
    const participantTeams = [suggestionTeam, ...availabilityOpponents].filter(Boolean);
    const participants = participantTeams.flatMap((teamId) => {
      const team = scheduleRoster.find(([id]) => id === teamId);
      return team
        ? team[1].split(',').map((name) => ({
            key: `${scheduleGroup}:${teamId}:${name.trim()}`,
            name: name.trim(),
          }))
        : [];
    });
    const dates = new Set<string>();
    allAvailability.forEach((slot) => {
      if (participants.some((participant) => participant.key === slot.playerId)) {
        dates.add(normalizeDate(slot.startsAt));
      }
    });
    const map = new Map<string, DateParticipantStatus>();
    dates.forEach((date) => {
      const status: DateParticipantStatus = { available: [], blocked: [], missing: [] };
      participants.forEach((participant) => {
        const slots = allAvailability.filter(
          (slot) => slot.playerId === participant.key && normalizeDate(slot.startsAt) === date
        );
        const hasAvailable = slots.some((slot) => (slot.kind ?? 'available') === 'available');
        const hasBlocked = slots.some((slot) => (slot.kind ?? 'available') === 'blocked');
        if (hasAvailable) status.available.push(participant.name);
        if (hasBlocked) status.blocked.push(participant.name);
        if (!hasAvailable && !hasBlocked) status.missing.push(participant.name);
      });
      map.set(date, status);
    });
    return map;
  })();

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

  const begin = (match?: Match) => {
    if (match && !canUpdateMatch(match, identity)) {
      setNote('Only players on this match can update it.');
      return;
    }

    setEditing(match || null);

    if (match) {
      const matchGroup = (match.league_group || 'Group B') as Group;
      const matchRoster = activeRosters[matchGroup] || groups[matchGroup];
      const ids = teamIds(match, matchGroup);

      setDraft({ ...match, league_group: matchGroup });
      setFirst(ids[0] || matchRoster[0]?.[0] || '');
      setSecond(ids[1] || matchRoster[1]?.[0] || '');
    } else {
      setDraft(blank(group));
      setFirst(identity.teamId || roster[0]?.[0] || '');
      setSecond(roster.find(([id]) => id !== identity.teamId)?.[0] || roster[0]?.[0] || '');
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

    const groupRoster = activeRosters[selected.group] || groups[selected.group];
    setSecond(groupRoster.find(([id]) => id !== selected.teamId)?.[0] || selected.teamId);

    setDraft(blank(selected.group));
    setOpen(true);
    setNote('');
  };

  const buildSuggestionMatchContext = (teamHistory: Match[], teamId: string, date: string) => {
    const previous = teamHistory
      .filter((match) => match.match_date < date)
      .sort((a, b) => b.match_date.localeCompare(a.match_date))[0];
    const next = teamHistory
      .filter((match) => match.match_date > date)
      .sort((a, b) => a.match_date.localeCompare(b.match_date))[0];
    const toContext = (match?: Match) => {
      if (!match) return undefined;
      return {
        date: match.match_date,
        time: match.match_time,
        opponentId: teamIds(match, scheduleGroup).find((id) => id !== teamId),
      };
    };
    return { previous: toContext(previous), next: toContext(next) };
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

    const possibleOpponents: string[] = scheduleRoster
      .map((t) => t[0])
      .filter((id) => id !== suggestionTeam)
      .filter((opponentId) => !existingFixture(matches, scheduleGroup, suggestionTeam, opponentId));
    const teamMatches = new Map<string, Match[]>(
      scheduleRoster.map((t) => [t[0], matchesForTeam(matches, scheduleGroup, t[0])])
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
      const participantNames = scheduleRoster
        .find(([id]) => id === suggestionTeam)?.[1]
        .split(',')
        .concat(scheduleRoster.find(([id]) => id === opponentId)?.[1].split(',') || [])
        .map((name) => name.trim());
      const playersWithAvailability = participants.filter(
        (player) => (slotMap.get(player) || []).length
      ).length;
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
        const hasExplicitBlock = participants.some((player) =>
          (slotMap.get(player) || []).some(
            (slot) =>
              (slot.kind ?? 'available') === 'blocked' && normalizeDate(slot.startsAt) === date
          )
        );
        if (hasExplicitBlock) {
          return;
        }
        const hasMatchOnDate =
          yourMatches.some((match) => match.match_date === date) ||
          opponentMatches.some((match) => match.match_date === date);
        if (hasMatchOnDate) {
          return;
        }

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
        const yourContexts = buildSuggestionMatchContext(yourMatches, suggestionTeam, date);
        const opponentContexts = buildSuggestionMatchContext(opponentMatches, opponentId, date);

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
          playersWithAvailability,
          totalPlayers: participants.length,
          yourPreviousGame: yourContexts.previous,
          yourNextGame: yourContexts.next,
          opponentPreviousGame: opponentContexts.previous,
          opponentNextGame: opponentContexts.next,
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

    const conflict =
      draft.status === 'Cancelled'
        ? undefined
        : matches.find(
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

        <div className="header-actions">
          <button className="group-schedule" onClick={startScheduling}>
            Schedule match
          </button>
          <button type="button" className="add-team-btn" onClick={() => setAddTeamOpen(true)}>
            + Add Team
          </button>
        </div>

        <PlayerPicker identity={identity} onChange={chooseIdentity} players={activePlayers} />
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
          overdue={overdue}
          upcoming={upcoming}
          completed={completed}
          cancelled={cancelled}
          group={group}
          filter={filter}
          team={team}
          identity={identity}
          roster={roster}
          rosters={activeRosters}
          onGroupChange={setGroup}
          onFilterChange={setFilter}
          onTeamChange={setTeam}
          onEdit={begin}
          onAddTeam={() => setAddTeamOpen(true)}
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
          participantStatusMap={participantStatusMap}
          availabilitySaving={availabilitySaving}
          availabilityError={availabilityError}
          onSaveSlot={saveSlot}
          onDeleteSlot={deleteSlot}
          partnerName={partnerName}
          partnerReady={partnerReady}
          pendingMatchCount={pendingOpponentIds.length}
          pendingOpponentIds={pendingOpponentIds}
          opponentMissingNames={opponentMissingNames}
          availabilityOpponents={availabilityOpponents}
          allAvailability={allAvailability}
          onAvailabilityOpponentToggle={(opponentId) =>
            setAvailabilityOpponents((current) =>
              current.includes(opponentId)
                ? current.filter((id) => id !== opponentId)
                : [...current, opponentId]
            )
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

      <AddTeamModal
        isOpen={addTeamOpen}
        defaultGroup={group}
        existingTeams={allTeams}
        onClose={() => setAddTeamOpen(false)}
        onSave={saveNewTeam}
      />
    </main>
  );
}
