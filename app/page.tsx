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
  teamDisplay,
} from './teams';
import {
  Match,
  Draft,
  Suggestion,
  blank,
  dateText,
  fremontNow,
  matchDateTime,
  currentDateInFremont,
  addDays,
  teamIds,
  existingFixture,
  matchesForTeam,
  restGapAroundDate,
} from './lib/matches';
import { api, supabaseKey as key, headers } from './lib/supabase';
import { Matchup, Section } from './components/MatchCard';
import { PlayerPicker } from './components/PlayerPicker';
import { IdentityPrompt, MatchModal } from './components/MatchModal';
import { SmartScheduling } from './components/SmartScheduling';
import { Styles } from './components/Styles';

type View = 'dashboard' | 'scheduling';

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

    const response = await fetch(
      `${api}?select=*&order=match_date.asc,match_time.asc`,
      { headers },
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
    try {
      const saved = window.localStorage.getItem(IDENTITY_KEY);

      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as Identity;

      const savedIdentity = parsed.viewing
        ? viewingIdentity
        : allPlayers.find(
            player =>
              player.name === parsed.name &&
              player.teamId === parsed.teamId &&
              player.group === parsed.group,
          );

      if (savedIdentity) {
        setIdentity(savedIdentity);
      }
    } catch {
      setIdentity(viewingIdentity);
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
      setSuggestionTeam(nextIdentity.teamId);
    } else {
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
        match =>
          (match.league_group || 'Group B') === group &&
          (filter === 'All' || match.status === filter) &&
          (!team || teamIds(match, group).includes(team)),
      ),
    [matches, group, filter, team],
  );

  const opponentOptions = useMemo(
    () => Array.from(new Set(suggestions.map(item => item.opponentId))),
    [suggestions],
  );

  const visibleSuggestions = useMemo(() => {
    const filtered = suggestionOpponent
      ? suggestions.filter(item => item.opponentId === suggestionOpponent)
      : Object.values(
          suggestions.reduce<Record<string, Suggestion>>((best, item) => {
            if (
              !best[item.opponentId] ||
              item.date < best[item.opponentId].date
            ) {
              best[item.opponentId] = item;
            }

            return best;
          }, {}),
        );

    return filtered.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.opponentId.localeCompare(b.opponentId),
    );
  }, [suggestions, suggestionOpponent]);

  const nowInFremont = fremontNow();

  const overdue = scoped.filter(
    match =>
      match.status === 'Scheduled' &&
      matchDateTime(match) < nowInFremont,
  );

  const upcoming = scoped.filter(
    match =>
      match.status === 'Scheduled' &&
      matchDateTime(match) >= nowInFremont,
  );

  const completed = scoped.filter(match => match.status === 'Completed');
  const cancelled = scoped.filter(match => match.status === 'Cancelled');

  const upcomingAll = matches
    .filter(
      match =>
        match.status === 'Scheduled' &&
        matchDateTime(match) >= nowInFremont,
    )
    .sort((a, b) => matchDateTime(a).localeCompare(matchDateTime(b)));

  const nextMatchDate = upcomingAll[0]?.match_date || '';

  const nextMatches = upcomingAll.filter(
    match => match.match_date === nextMatchDate,
  );

  /**
   * UI-only eligibility check. It intentionally uses the match's own
   * persisted group, not the currently selected dashboard group.
   */
  const canUpdateMatch = (match: Match) => {
    const matchGroup = (match.league_group || 'Group B') as Group;

    return (
      !identity.viewing &&
      Boolean(identity.teamId) &&
      teamIds(match, matchGroup).includes(identity.teamId)
    );
  };

  const begin = (match?: Match) => {
    if (match && !canUpdateMatch(match)) {
      setNote('Only players on this match can update it.');
      return;
    }

    setEditing(match || null);

    if (match) {
      const matchGroup = (match.league_group || 'Group B') as Group;
      const matchRoster = groups[matchGroup];
      const ids = teamIds(match, matchGroup);

      /**
       * Do not call setGroup(matchGroup) here. The dashboard already scopes
       * displayed matches by `group`, and changing the dashboard filter while
       * opening an edit dialog would be an unexpected side effect.
       */
      setDraft({ ...match, league_group: matchGroup });
      setFirst(ids[0] || matchRoster[0][0]);
      setSecond(ids[1] || matchRoster[1][0]);
    } else {
      setDraft(blank(group));
      setFirst(identity.teamId || roster[0][0]);
      setSecond(
        roster.find(([id]) => id !== identity.teamId)?.[0] ||
          roster[0][0],
      );
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
    const selected = allPlayers.find(
      player => identityValue(player) === pendingIdentityValue,
    );

    if (!selected) {
      return;
    }

    chooseIdentity(selected);
    setIdentityPromptOpen(false);
    setPendingIdentityValue('');
    setEditing(null);
    setFirst(selected.teamId);

    setSecond(
      groups[selected.group].find(([id]) => id !== selected.teamId)?.[0] ||
        selected.teamId,
    );

    setDraft(blank(selected.group));
    setOpen(true);
    setNote('');
  };

  const findSuggestions = () => {
    if (identity.viewing || !suggestionTeam) {
      setSuggestionNote(
        'Select who you are from the top-right menu first.',
      );
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
          !existingFixture(
            matches,
            scheduleGroup,
            suggestionTeam,
            opponentId,
          ),
      );

    const candidates: Suggestion[] = [];

    for (const opponentId of possibleOpponents) {
      const yourMatches = matchesForTeam(
        matches,
        scheduleGroup,
        suggestionTeam,
      );

      const opponentMatches = matchesForTeam(
        matches,
        scheduleGroup,
        opponentId,
      );

      for (let offset = 1; offset <= 30; offset += 1) {
        const date = addDays(today, offset);

        const youHaveMatch = yourMatches.some(
          match => match.match_date === date,
        );

        const opponentHasMatch = opponentMatches.some(
          match => match.match_date === date,
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
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.opponentId.localeCompare(b.opponentId),
    );

    setSuggestions(ranked);
    setSuggestionOpponent('');

    setSuggestionNote(
      ranked.length
        ? 'Found suggested matches, sorted by date. Rest days count completed matches and scheduled upcoming matches.'
        : 'No suitable matches found in the next 30 days. Rest days count completed matches and scheduled upcoming matches.',
    );
  };

  const scheduleSuggestion = (suggestion: Suggestion) => {
    if (
      existingFixture(
        matches,
        scheduleGroup,
        suggestionTeam,
        suggestion.opponentId,
      )
    ) {
      setSuggestionNote(
        'That matchup is already scheduled or completed, so it cannot be suggested.',
      );

      setSuggestions(current =>
        current.filter(item => item.opponentId !== suggestion.opponentId),
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

  const save = async (event: FormEvent) => {
    event.preventDefault();

    /**
     * Defense in depth for the UI flow: a match cannot be updated after
     * identity changes or if an edit is invoked outside the normal button.
     */
    if (editing && !canUpdateMatch(editing)) {
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

    if (draft.status === 'Completed' && !draft.result?.trim()) {
      setNote('Enter a result before completing the match.');
      return;
    }

    if (
      draft.status === 'Cancelled' &&
      !draft.cancellation_reason?.trim()
    ) {
      setNote('Enter a cancellation reason.');
      return;
    }

    const matchGroup = editing
      ? ((editing.league_group || 'Group B') as Group)
      : group;

    const conflict = matches.find(
      match =>
        match.id !== editing?.id &&
        (match.league_group || 'Group B') === matchGroup &&
        match.match_date === draft.match_date &&
        match.status !== 'Cancelled' &&
        teamIds(match, matchGroup).some(
          id => id === first || id === second,
        ),
    );

    if (conflict) {
      setNote(
        'One of these teams already has an active match on that date.',
      );
      return;
    }

    const body = {
      ...draft,
      league_group: matchGroup,
      matchup: `Team #${first} vs Team #${second}`,
    };

    const response = await fetch(
      editing ? `${api}?id=eq.${editing.id}` : api,
      {
        method: editing ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(body),
      },
    );

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
          className={view === 'scheduling' ? 'active' : ''}
          onClick={() => setView('scheduling')}
        >
          Smart Scheduling
        </button>
      </div>

      {note && <p className="notice">{note}</p>}

      {view === 'dashboard' ? (
        <>
          {nextMatches.length > 0 ? (
            <section className="hero next-matches">
              <div className="wide-hero">
                <div className="eyebrow">
                  NEXT MATCH · {dateText(nextMatchDate)}
                </div>

                <div className="grid">
                  {nextMatches.map(match => {
                    const matchGroup = (
                      match.league_group || 'Group B'
                    ) as Group;

                    return (
                      <article className="card" key={match.id}>
                        <small>
                          {matchGroup.toUpperCase()} ·{' '}
                          {match.match_time.slice(0, 5)}
                        </small>

                        <Matchup match={match} group={matchGroup} />

                        <p>{match.court}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
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
            {(['Group A', 'Group B'] as Group[]).map(nextGroup => (
              <button
                className={group === nextGroup ? 'active' : ''}
                onClick={() => setGroup(nextGroup)}
                key={nextGroup}
              >
                {nextGroup} · {groups[nextGroup].length} teams
              </button>
            ))}
          </div>

          <button className="group-schedule" onClick={startScheduling}>
            Schedule match
          </button>

          <div className="filters">
            {['All', 'Scheduled', 'Completed', 'Cancelled'].map(
              status => (
                <button
                  className={filter === status ? 'active' : ''}
                  onClick={() => setFilter(status)}
                  key={status}
                >
                  {status}
                </button>
              ),
            )}

            <select
              value={team}
              onChange={event => setTeam(event.target.value)}
            >
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
                These scheduled match times have passed in Fremont. Update
                each match as completed with a result, or cancel it with a
                reason.
              </p>

              <div className="grid">
                {overdue.map(match => {
                  const canUpdate = canUpdateMatch(match);

                  return (
                    <article
                      className="card overdue-card"
                      key={match.id}
                    >
                      <div className="overdue-badge">
                        UPDATE REQUIRED
                      </div>

                      <small>
                        {dateText(match.match_date)} ·{' '}
                        {match.match_time.slice(0, 5)} ·{' '}
                        <b>Scheduled</b>
                      </small>

                      <Matchup match={match} group={group} />

                      <p>{match.court}</p>

                      <button
                        onClick={() => begin(match)}
                        disabled={!canUpdate}
                        title={
                          canUpdate
                            ? 'Update match details'
                            : 'Only players on this match can update it'
                        }
                        aria-label={
                          canUpdate
                            ? 'Update match details'
                            : 'Only players on this match can update it'
                        }
                      >
                        Update match details
                      </button>

                      {!canUpdate && (
                        <p className="permission-note">
                          Only players on this match can update it.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <Section
            title="Upcoming matches"
            list={upcoming}
            edit={begin}
            empty="No upcoming matches."
            group={group}
            selectedTeamId={identity.viewing ? null : identity.teamId}
          />

          <Section
            title="Recent results"
            list={completed}
            edit={begin}
            empty="No completed matches."
            group={group}
            selectedTeamId={identity.viewing ? null : identity.teamId}
          />

          <Section
            title="Cancelled matches"
            list={cancelled}
            edit={begin}
            empty="No cancelled matches."
            group={group}
            selectedTeamId={identity.viewing ? null : identity.teamId}
          />
        </>
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
