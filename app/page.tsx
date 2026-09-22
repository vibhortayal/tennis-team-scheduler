'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Group,
  Identity,
  Team,
  groups,
  IDENTITY_KEY,
  PLAYER_SESSION_MS,
  KHELO_PLAYER_LOGIN_EVENT,
  StoredIdentity,
  isStoredSessionExpired,
  allPlayers,
  viewingIdentity,
  adminIdentity,
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
  isBlockingStatus,
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
import { defaultTeamForGroupTab } from './lib/teamScope';
import { computeStandings, ScoreEntryState, validateScores } from './lib/scoring';
import {
  derivePhase,
  groupStageBlockers,
  isKnockoutMatch,
  matchStage,
  nextKnockoutFixture,
  nextRoundFixtures,
  seedQuarterfinals,
  canReseed,
  hasDecidedDownstream,
  knockoutWinnerId,
  type Phase,
} from './lib/knockout';
import { normalizeDate } from './lib/availabilityHelpers';
import { PlayerPicker } from './components/PlayerPicker';
import { MatchModal } from './components/MatchModal';
import { KHELO_JOIN_URL, KheloPromoModal } from './components/KheloPromo';
import { KheloRedirect } from './components/KheloRedirect';
import { StandingsView } from './components/StandingsTable';
import { fetchKheloStandings, type KheloStandings } from './lib/kheloStandings';
import { Styles } from './components/Styles';
import { DateParticipantStatus } from './components/MultiDateCalendar';
import { AddTeamModal } from './components/AddTeamModal';
import { ManageTeamsModal, WithdrawalResolution } from './components/ManageTeamsModal';
import { getActiveRoster, NewTeamInput, validateNewTeam } from './lib/teamValidation';
import { isAdminConfigured, isAdminSession, setAdminSession, clearAdminSession } from './lib/admin';
import { AdminLogin } from './components/AdminLogin';

export default function Page() {
  const [group, setGroup] = useState<Group>('Group A');
  const [scheduleGroup, setScheduleGroup] = useState<Group>('Group A');
  const [standingsGroup, setStandingsGroup] = useState<Group>('Group A');
  // Standings-only mode: standings come live from the KheloHQ tables.
  const [kheloStandings, setKheloStandings] = useState<KheloStandings | null>(null);
  const [kheloError, setKheloError] = useState<string | null>(null);
  const [kheloLoading, setKheloLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allTeams, setAllTeams] = useState<TeamRecord[]>([...initialStaticTeams]);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [manageTeamsOpen, setManageTeamsOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [team, setTeam] = useState('');
  // Pending identity-driven team default. Applied by login/restore and preserved
  // across a group-tab switch triggered by the same login; cleared on manual change.
  const identityTeamDefaultRef = useRef<string | null>(null);
  // Mid-session expiry timer for player logins (5 min from login).
  const sessionTimerRef = useRef<number | null>(null);
  // Latest chooseIdentity, so the expiry timer never calls a stale closure.
  const chooseIdentityRef = useRef<(next: Identity) => void>(() => {});

  const clearSessionTimer = useCallback(() => {
    if (sessionTimerRef.current !== null) {
      window.clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  }, []);

  // Logs the current player out when their 5-minute session ends. Viewers get
  // no timer; admin is session-scoped and never persisted.
  const scheduleSessionExpiry = useCallback(
    (loggedInAt: number) => {
      clearSessionTimer();
      const remaining = PLAYER_SESSION_MS - (Date.now() - loggedInAt);
      sessionTimerRef.current = window.setTimeout(
        () => {
          sessionTimerRef.current = null;
          chooseIdentityRef.current(viewingIdentity);
        },
        Math.max(0, remaining)
      );
    },
    [clearSessionTimer]
  );

  // Drop any pending expiry timer on unmount.
  useEffect(
    () => () => {
      if (sessionTimerRef.current !== null) {
        window.clearTimeout(sessionTimerRef.current);
      }
    },
    []
  );
  const prevGroupRef = useRef<Group>(group);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [draft, setDraft] = useState<Draft>(blank('Group A'));
  const [editing, setEditing] = useState<Match | null>(null);
  const [open, setOpen] = useState(false);
  const [kheloPromoOpen, setKheloPromoOpen] = useState(false);
  const kheloPromoShownRef = useRef(false);
  const [note, setNote] = useState('');
  const [suggestionTeam, setSuggestionTeam] = useState('');
  const [yourGapDays, setYourGapDays] = useState(1);
  const [opponentGapDays, setOpponentGapDays] = useState(1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionNote, setSuggestionNote] = useState('');
  const [suggestionOpponent, setSuggestionOpponent] = useState('');
  const [availabilityOpponents, setAvailabilityOpponents] = useState<string[]>([]);
  const [identity, setIdentity] = useState<Identity>(viewingIdentity);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  // Header nudge: always shown to everyone (players, viewers, admins) —
  // it is never hidden, even when the stay-on-old-site bypass was taken.
  const showKheloBanner = true;
  const isAdmin = identity.admin === true;
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

  const updateTeamStatus = async (
    teamId: string,
    newStatus: 'active' | 'withdrawn',
    resolution?: WithdrawalResolution
  ): Promise<{ ok: boolean; error?: string }> => {
    if (teamsApi && key) {
      try {
        const response = await fetch(`${teamsApi}?team_number=eq.${encodeURIComponent(teamId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: newStatus }),
        });
        if (!response.ok) {
          const errText = await response.text();
          return {
            ok: false,
            error: `Could not update team status: ${errText || response.statusText}`,
          };
        }

        if (newStatus === 'withdrawn' && resolution && api) {
          const teamMatches = matches.filter((m) => m.matchup.includes(`Team #${teamId}`));

          for (const m of teamMatches) {
            const isCompleted =
              m.status === 'Completed' || m.status === 'Retired' || m.status === 'Walkover';
            let patchBody: Record<string, unknown> = {};

            if (resolution === 'walkover_all_opponents') {
              const ids = teamIds(
                m,
                m.league_group || 'Group B',
                groups[m.league_group || 'Group B']
              );
              const opponentId = ids.find((id) => id !== teamId) || '';

              if (isCompleted) {
                patchBody = {
                  standings_override: {
                    reason: 'team_withdrawal',
                    winnerTeamId: opponentId,
                    loserTeamId: teamId,
                    score: { set1: { teamA: 6, teamB: 0 }, set2: { teamA: 6, teamB: 0 } },
                  },
                };
              } else {
                patchBody = {
                  status: 'Walkover',
                  cancellation_reason: 'team_withdrawal',
                  standings_override: {
                    reason: 'team_withdrawal',
                    winnerTeamId: opponentId,
                    loserTeamId: teamId,
                    score: { set1: { teamA: 6, teamB: 0 }, set2: { teamA: 6, teamB: 0 } },
                  },
                  result: '6-0, 6-0',
                };
              }
            } else if (resolution === 'void_tournament_records') {
              if (isCompleted) {
                patchBody = { excluded_from_standings: true };
              } else {
                patchBody = {
                  status: 'Cancelled',
                  cancellation_reason: 'team_removed_from_tournament',
                  excluded_from_standings: true,
                };
              }
            }

            if (Object.keys(patchBody).length > 0) {
              await fetch(`${api}?id=eq.${m.id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(patchBody),
              });
            }
          }
        }
      } catch (err) {
        return {
          ok: false,
          error: `Network error: ${err instanceof Error ? err.message : 'Unknown error.'}`,
        };
      }
    }

    setAllTeams((prev) => {
      const updated = prev.map((t) => (t.teamId === teamId ? { ...t, status: newStatus } : t));
      updateTeamRegistry(updated);
      return updated;
    });

    await load(); // Reload matches to get updated overrides

    const label = newStatus === 'withdrawn' ? 'withdrawn from' : 'reactivated in';
    setNote(`Team #${teamId} has been ${label} the league.`);
    return { ok: true };
  };

  const moveTeamGroup = async (
    teamId: string,
    newGroup: Group
  ): Promise<{ ok: boolean; error?: string }> => {
    if (teamsApi && key && api) {
      try {
        const teamMatches = matches.filter(
          (m) => m.matchup.includes(`Team #${teamId}`) && !isBlockingStatus(m.status)
        );

        const response = await fetch(`${teamsApi}?team_number=eq.${encodeURIComponent(teamId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ league_group: newGroup }),
        });
        if (!response.ok) {
          const errText = await response.text();
          return { ok: false, error: `Could not move team: ${errText || response.statusText}` };
        }

        // Cancel all unplayed matches
        for (const m of teamMatches) {
          await fetch(`${api}?id=eq.${m.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: 'Cancelled',
              cancellation_reason: 'team_moved_groups',
              excluded_from_standings: true,
            }),
          });
        }
      } catch (err) {
        return {
          ok: false,
          error: `Network error: ${err instanceof Error ? err.message : 'Unknown error.'}`,
        };
      }
    }

    setAllTeams((prev) => {
      const updated = prev.map((t) => (t.teamId === teamId ? { ...t, group: newGroup } : t));
      updateTeamRegistry(updated);
      return updated;
    });

    await load();
    setNote(`Team #${teamId} has been moved to ${newGroup}.`);
    return { ok: true };
  };

  useEffect(() => {
    load();
    loadTeams();
  }, [loadTeams]);

  // Standings-only mode: live standings from the KheloHQ tables.
  useEffect(() => {
    let cancelled = false;
    fetchKheloStandings()
      .then((result) => {
        if (!cancelled) setKheloStandings(result);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setKheloError(error instanceof Error ? error.message : 'Failed to load standings.');
      })
      .finally(() => {
        if (!cancelled) setKheloLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAvailability = useCallback(async (player: Identity) => {
    if (player.viewing || player.admin || !availabilityApi || !key) {
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
      // An admin session survives reloads via sessionStorage; it is never
      // written to localStorage alongside player identities.
      if (isAdminSession() && isAdminConfigured()) {
        setIdentity(adminIdentity);
        return;
      }

      const saved = window.localStorage.getItem(IDENTITY_KEY);

      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as StoredIdentity;

      // Player sessions expire 5 min after login. Legacy rows written before
      // the expiry existed have no timestamp and are treated as expired.
      if (isStoredSessionExpired(parsed)) {
        try {
          window.localStorage.removeItem(IDENTITY_KEY);
        } catch {
          // Storage unavailable — identity simply isn't restored.
        }
        return;
      }

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

      // Read-only mode: player sign-in is disabled, so a stored player
      // identity is never restored. The admin session is handled above.
      if (!savedIdentity.viewing) {
        try {
          window.localStorage.removeItem(IDENTITY_KEY);
        } catch {
          // Storage unavailable — identity simply isn't restored.
        }
        return;
      }

      setIdentity(savedIdentity);
      loadAvailability(savedIdentity);

      // Default the team-scope dropdown to the restored identity's team.
      const restoredTeam = savedIdentity.viewing ? '' : savedIdentity.teamId;
      identityTeamDefaultRef.current = restoredTeam;
      setTeam(restoredTeam);

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

      // Restored player session: expire mid-session at the 5-minute mark.
      if (typeof parsed.loggedInAt === 'number') {
        scheduleSessionExpiry(parsed.loggedInAt);
      }
    } catch {
      setIdentity(viewingIdentity);
      setGroup('Group A');
      setScheduleGroup('Group A');
      setStandingsGroup('Group A');
      setSuggestionTeam('');
    }
  }, [loadAvailability, scheduleSessionExpiry]);

  // One-time KheloHQ promo popup for signed-in players (not viewers, not admin).
  useEffect(() => {
    if (identity.viewing || identity.admin || kheloPromoShownRef.current) {
      return;
    }
    kheloPromoShownRef.current = true;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem('khelo-promo-dismissed') === '1';
    } catch {
      dismissed = false;
    }
    if (dismissed) {
      return;
    }
    const timer = window.setTimeout(() => setKheloPromoOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [identity]);

  const dismissKheloPromo = () => {
    setKheloPromoOpen(false);
    try {
      window.localStorage.setItem('khelo-promo-dismissed', '1');
    } catch {
      // Storage unavailable — popup simply shows again next visit.
    }
  };

  const chooseIdentity = (nextIdentity: Identity) => {
    setIdentity(nextIdentity);
    clearSessionTimer();

    // The admin identity is session-scoped only: never persisted to
    // localStorage, no player availability, and it keeps the current view.
    if (nextIdentity.admin) {
      setAdminLoginOpen(false);
      setNote('Tournament admin unlocked. Switch identity to return to a player view.');
      return;
    }

    clearAdminSession();

    if (!nextIdentity.viewing) {
      // Player login: timestamp the session (5-minute expiry), schedule the
      // mid-session logout, and fire the KheloHQ interstitial.
      const loggedInAt = Date.now();
      const stored: StoredIdentity = { ...nextIdentity, loggedInAt };
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(stored));
      scheduleSessionExpiry(loggedInAt);
      window.dispatchEvent(new Event(KHELO_PLAYER_LOGIN_EVENT));
    } else {
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(nextIdentity));
    }

    // Default the team-scope dropdown to the new identity's team.
    const defaultTeam = nextIdentity.viewing ? '' : nextIdentity.teamId;
    identityTeamDefaultRef.current = defaultTeam;
    setTeam(defaultTeam);

    setSuggestions([]);
    setSuggestionNote('');
    setSuggestionOpponent('');
    setAvailabilityOpponents([]);
    loadAvailability(nextIdentity);

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
  // Keep the expiry timer pointed at the latest chooseIdentity (ref writes
  // belong in effects, not during render).
  useEffect(() => {
    chooseIdentityRef.current = chooseIdentity;
  });

  const openAdminLogin = () => {
    setAdminLoginOpen(true);
  };

  const cancelAdminLogin = () => {
    setAdminLoginOpen(false);
  };

  const confirmAdminLogin = () => {
    setAdminSession();
    chooseIdentity(adminIdentity);
  };

  const handleTeamChange = (value: string) => {
    // A manual dropdown choice overrides the identity default until the
    // identity changes or the group tab switches.
    identityTeamDefaultRef.current = null;
    setTeam(value);
  };

  const saveSlot = async (input: SlotSaveInput, id?: string) => {
    if (identity.viewing || identity.admin || !availabilityApi || !key) return;
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
    const groupChanged = prevGroupRef.current !== group;
    prevGroupRef.current = group;

    if (identityTeamDefaultRef.current !== null) {
      // Preserve an identity-driven default applied by login/restore when the
      // group tab switched as part of the same update.
      setTeam(identityTeamDefaultRef.current);
      identityTeamDefaultRef.current = null;
    } else if (groupChanged) {
      // Returning to the identity's own group tab reselects the identity's
      // team; any other group tab resets the scope to all teams.
      setTeam(defaultTeamForGroupTab(identity, group));
    }

    if (!open) {
      const gRoster = activeRosters[group];
      if (gRoster && gRoster.length >= 2) {
        setFirst(gRoster[0][0]);
        setSecond(gRoster[1][0]);
      }
      setDraft(blank(group));
    }
  }, [group, identity, open, activeRosters]);

  const scoped = useMemo(
    () =>
      matches.filter(
        (match) =>
          matchStage(match) === 'group' &&
          (match.league_group || 'Group B') === group &&
          (filter === 'All' || match.status === filter) &&
          (!team || teamIds(match, group, roster).includes(team))
      ),
    [matches, group, filter, team, roster]
  );

  // Tournament phase and knockout fixtures. The dashboard's group lists stay
  // group-stage-only; knockout matches are rendered via the bracket.
  const phase: Phase = useMemo(() => derivePhase(matches), [matches]);
  const knockoutMatches = useMemo(() => matches.filter(isKnockoutMatch), [matches]);

  // Cross-group roster for the knockout fixture editor (players are locked to
  // the bracket pairing; the admin can adjust teams).
  const knockoutRoster = useMemo(() => {
    const combined: Team[] = [];
    (['Group A', 'Group B'] as Group[]).forEach((g) => {
      (activeRosters[g] || groups[g]).forEach((entry) => {
        if (!combined.some(([id]) => id === entry[0])) combined.push(entry);
      });
    });
    return combined;
  }, [activeRosters]);

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

    // Once the bracket is live, players can no longer create or touch
    // group-stage matches; the admin can still correct them.
    if (!identity.admin && phase !== 'group') {
      const targetStage = match ? matchStage(match) : 'group';
      if (targetStage === 'group') {
        setNote('The group stage is locked — the knockout bracket is live.');
        return;
      }
    }

    // A feeder result that already decided a downstream fixture is bracket
    // history: update the downstream match first, then come back here.
    if (match && isKnockoutMatch(match) && hasDecidedDownstream(matches, match.knockout_slot)) {
      setNote('This result already feeds a decided match — update that match first.');
      return;
    }

    setEditing(match || null);

    if (match) {
      const matchGroup = (match.league_group || 'Group B') as Group;
      const matchRoster = activeRosters[matchGroup] || groups[matchGroup];
      const ids = teamIds(match, matchGroup);

      // An unscheduled fixture opens in "Scheduled" mode so the player can
      // pick a date, time, and court straight away.
      const draftStatus = match.status === 'unscheduled' ? 'Scheduled' : match.status;
      setDraft({ ...match, league_group: matchGroup, status: draftStatus });
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

  // Read-only mode: only the admin can reach this (the button is hidden for
  // everyone else), so there is no viewer identity-prompt path anymore.
  const startScheduling = () => {
    // In the knockout phase the header button opens the player's next
    // bracket fixture instead of a blank group-stage form.
    if (!identity.admin && phase !== 'group' && identity.teamId) {
      const next = nextKnockoutFixture(matches, identity.teamId);
      if (next) {
        begin(next);
        return;
      }
      setNote('Your tournament has ended — follow the bracket below.');
      return;
    }

    begin();
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
      const playersWithAvailability = participants.filter((player) =>
        (slotMap.get(player) || []).some((slot) => (slot.kind ?? 'available') === 'available')
      );
      const windows =
        playersWithAvailability.length === 0
          ? []
          : intersectTimeWindows(
              playersWithAvailability.map((player) =>
                effectiveWindowsForPlayer(slotMap.get(player) || [])
              )
            );
      const participantNames = scheduleRoster
        .find(([id]) => id === suggestionTeam)?.[1]
        .split(',')
        .concat(scheduleRoster.find(([id]) => id === opponentId)?.[1].split(',') || [])
        .map((name) => name.trim());
      const playersWithAvailabilityCount = participants.filter(
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
          playersWithAvailability: playersWithAvailabilityCount,
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

  /**
   * Creates (or refreshes) the next knockout fixtures whose feeders are
   * decided. Undecided downstream fixtures get their pairing refreshed when
   * a feeder result is corrected; decided downstream fixtures are history
   * and are never touched. Returns false if any fixture write failed.
   */
  const syncKnockoutBracket = async (): Promise<boolean> => {
    if (!api || !key) return false;
    try {
      const res = await fetch(`${api}?select=*`, { headers });
      if (!res.ok) return false;
      const fresh: Match[] = await res.json();
      const fixtures = nextRoundFixtures(fresh);
      for (const fixture of fixtures) {
        const existing = fresh.find((m) => m.knockout_slot === fixture.slot);
        const matchup = `Team #${fixture.firstId} vs Team #${fixture.secondId}`;
        if (!existing) {
          const created = await fetch(api, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              matchup,
              status: 'unscheduled',
              stage: fixture.stage,
              knockout_slot: fixture.slot,
              excluded_from_standings: true,
            }),
          });
          if (!created.ok) return false;
        } else if (knockoutWinnerId(existing) === null && existing.matchup !== matchup) {
          const updated = await fetch(`${api}?id=eq.${existing.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ matchup }),
          });
          if (!updated.ok) return false;
        }
      }
      await load();
      return true;
    } catch {
      // Best-effort: the match itself was already saved.
      return false;
    }
  };

  /** Admin: end the group stage and create the four quarterfinal fixtures. */
  const seedKnockouts = async () => {
    if (!api || !key) {
      setNote('Missing Supabase public environment settings.');
      return;
    }
    const blockers = groupStageBlockers(matches);
    if (blockers.length > 0) {
      setNote(
        `Resolve ${blockers.length} group match${blockers.length === 1 ? '' : 'es'} before ending the group stage.`
      );
      return;
    }
    if (derivePhase(matches) !== 'group') {
      setNote('The knockout bracket is already live.');
      return;
    }
    let seeds: ReturnType<typeof seedQuarterfinals>;
    try {
      seeds = seedQuarterfinals(standingsA, standingsB);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not seed the bracket.');
      return;
    }
    for (const seed of seeds) {
      if (matches.some((m) => m.knockout_slot === seed.slot)) continue;
      const response = await fetch(api, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          matchup: `Team #${seed.firstId} vs Team #${seed.secondId}`,
          status: 'unscheduled',
          stage: seed.stage,
          knockout_slot: seed.slot,
          excluded_from_standings: true,
        }),
      });
      if (!response.ok) {
        setNote('Could not seed the bracket — the database may need migration 007.');
        return;
      }
    }
    await load();
    setNote('Group stage ended. The quarterfinals are live.');
  };

  /** Admin: re-seed the quarterfinals after a standings correction. */
  const reseedKnockouts = async () => {
    if (!api || !key) {
      setNote('Missing Supabase public environment settings.');
      return;
    }
    if (!canReseed(matches)) {
      setNote('Re-seeding is blocked: a quarterfinal has already been decided.');
      return;
    }
    let seeds: ReturnType<typeof seedQuarterfinals>;
    try {
      seeds = seedQuarterfinals(standingsA, standingsB);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not re-seed the bracket.');
      return;
    }
    for (const seed of seeds) {
      const existing = matches.find((m) => m.knockout_slot === seed.slot);
      const matchup = `Team #${seed.firstId} vs Team #${seed.secondId}`;
      if (!existing) {
        const response = await fetch(api, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            matchup,
            status: 'unscheduled',
            stage: seed.stage,
            knockout_slot: seed.slot,
            excluded_from_standings: true,
          }),
        });
        if (!response.ok) {
          setNote('Could not re-seed the bracket — the database may need migration 007.');
          return;
        }
      } else if (existing.matchup !== matchup) {
        await fetch(`${api}?id=eq.${existing.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ matchup }),
        });
      }
    }
    await load();
    const synced = await syncKnockoutBracket();
    setNote(
      synced
        ? 'Quarterfinals re-seeded.'
        : 'Quarterfinals re-seeded, but a bracket fixture could not be updated.'
    );
  };

  /** Admin: resolve an unfinished group match as a walkover. */
  const resolveStragglerWalkover = async (match: Match, winnerId: string) => {
    if (!api || !key) {
      setNote('Missing Supabase public environment settings.');
      return;
    }
    const ids = teamIds(match, (match.league_group || 'Group B') as Group);
    const loserId = ids.find((id) => id !== winnerId) ?? '';
    try {
      const response = await fetch(`${api}?id=eq.${match.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'Completed',
          result: '6-0, 6-0',
          standings_override: {
            reason: 'walkover',
            winnerTeamId: winnerId,
            loserTeamId: loserId,
            score: {
              set1: { teamA: 6, teamB: 0 },
              set2: { teamA: 6, teamB: 0 },
            },
          },
        }),
      });
      if (!response.ok) throw new Error('walkover failed');
    } catch {
      setNote('Could not record the walkover.');
      return;
    }
    await load();
    setNote(`Walkover recorded for Team #${winnerId}.`);
  };

  /** Admin: void an unfinished group match so it no longer blocks the group stage. */
  const resolveStragglerVoid = async (match: Match) => {
    if (!api || !key) {
      setNote('Missing Supabase public environment settings.');
      return;
    }
    try {
      const response = await fetch(`${api}?id=eq.${match.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'Cancelled',
          cancellation_reason: 'Voided by the tournament admin',
          excluded_from_standings: true,
        }),
      });
      if (!response.ok) throw new Error('void failed');
    } catch {
      setNote('Could not void the match.');
      return;
    }
    await load();
    setNote('Match voided and excluded from the standings.');
  };

  const save = async (event: FormEvent, scores: ScoreEntryState) => {
    event.preventDefault();
    if (editing && !canUpdateMatch(editing, identity)) {
      setNote('Only players on this match can update it.');
      setOpen(false);
      return;
    }

    // Phase guards (mirror begin() so a crafted submit can't bypass them).
    if (editing) {
      const editingStage = matchStage(editing);
      if (editingStage === 'group' && phase !== 'group' && !identity.admin) {
        setNote('The group stage is locked — the knockout bracket is live.');
        setOpen(false);
        return;
      }
      if (isKnockoutMatch(editing) && hasDecidedDownstream(matches, editing.knockout_slot)) {
        setNote('This result already feeds a decided match — update that match first.');
        setOpen(false);
        return;
      }
    } else if (!identity.admin && phase !== 'group') {
      setNote('The group stage is locked — the knockout bracket is live.');
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
    const stage = (draft.stage as string) || (editing ? matchStage(editing) : 'group');
    const isKnockout = stage !== 'group';

    // The team-conflict check only applies to group-stage scheduling; a team
    // has a single path through the knockout bracket.
    const conflict =
      !isKnockout && draft.status !== 'Cancelled'
        ? matches.find(
            (match) =>
              match.id !== editing?.id &&
              matchStage(match) === 'group' &&
              (match.league_group || 'Group B') === matchGroup &&
              match.match_date === draft.match_date &&
              match.status !== 'Cancelled' &&
              teamIds(match, matchGroup).some((id) => id === first || id === second)
          )
        : undefined;

    if (conflict) {
      setNote('One of these teams already has an active match on that date.');
      return;
    }

    // A bracket slot holds at most one fixture.
    const slot = (draft.knockout_slot as string | null) || editing?.knockout_slot || null;
    if (
      isKnockout &&
      slot &&
      matches.some((m) => m.knockout_slot === slot && m.id !== editing?.id)
    ) {
      setNote(`Bracket slot ${slot} already has a match.`);
      return;
    }

    const body = {
      ...draft,
      stage,
      knockout_slot: slot,
      // Knockout matches never count toward group standings.
      excluded_from_standings: isKnockout ? true : Boolean(draft.excluded_from_standings),
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
    // A decided knockout result may unlock the next bracket fixture.
    if (isKnockout) {
      const synced = await syncKnockoutBracket();
      if (!synced) {
        setNote('Match saved, but the next bracket fixture could not be created.');
      }
    }
  };

  // Stage of the match currently in the editor (drives team locking and the
  // cross-group roster for knockout fixtures).
  const modalStage = open ? matchStage(draft) : 'group';

  return (
    <main>
      <Styles />
      <KheloRedirect />

      <header className="top">
        <div>
          <b>🎾 Innovation Tennis Open</b>
        </div>

        <div className="header-actions">
          {isAdmin && (
            <button className="group-schedule" onClick={startScheduling}>
              Schedule match
            </button>
          )}
        </div>

        <PlayerPicker
          identity={identity}
          onChange={chooseIdentity}
          players={activePlayers}
          adminConfigured={isAdminConfigured()}
          onAdminSelect={openAdminLogin}
        />
      </header>

      {showKheloBanner && (
        <section className="khelo-moved" aria-label="Tournament moved to KheloHQ">
          <div className="khelo-moved-text">
            <h2>This tournament has moved to KheloHQ</h2>
            <p>
              This scheduler is now read-only. To update scores, check standings, or
              schedule/reschedule matches, go to{' '}
              <a href={KHELO_JOIN_URL} target="_blank" rel="noopener noreferrer">
                KheloHQ
              </a>
              .
            </p>
          </div>
          <a
            className="khelo-moved-cta"
            href={KHELO_JOIN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join KheloHQ <span aria-hidden="true">→</span>
          </a>
        </section>
      )}

      {/* Standings-only mode: the tournament runs on KheloHQ. The tab bar and
          all other views (Match Dashboard, Smart Scheduling, Manage) are
          removed; only live KheloHQ standings are shown. */}

      {note && <p className="notice">{note}</p>}

      {kheloLoading ? (
        <p className="empty">Loading standings…</p>
      ) : kheloError ? (
        <p className="notice" role="alert">
          Could not load standings: {kheloError}
        </p>
      ) : (
        <StandingsView
          standingsA={kheloStandings?.standingsA ?? []}
          standingsB={kheloStandings?.standingsB ?? []}
          standingsGroup={standingsGroup}
          onGroupChange={setStandingsGroup}
          selectedTeamId={identity.viewing ? null : identity.teamId}
          qualifyingPositions={1}
        />
      )}

      {kheloPromoOpen && <KheloPromoModal onDismiss={dismissKheloPromo} />}

      {adminLoginOpen && <AdminLogin onCancel={cancelAdminLogin} onSuccess={confirmAdminLogin} />}

      {open && (
        <MatchModal
          group={group}
          roster={modalStage !== 'group' ? knockoutRoster : roster}
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
          lockTeams={modalStage !== 'group' && !isAdmin}
          isAdmin={isAdmin}
        />
      )}

      <AddTeamModal
        isOpen={addTeamOpen}
        defaultGroup={group}
        existingTeams={allTeams}
        onClose={() => setAddTeamOpen(false)}
        onSave={saveNewTeam}
      />

      <ManageTeamsModal
        isOpen={manageTeamsOpen}
        allTeams={allTeams}
        allMatches={matches}
        onClose={() => setManageTeamsOpen(false)}
        onToggle={updateTeamStatus}
        onMoveTeam={moveTeamGroup}
      />
    </main>
  );
}
