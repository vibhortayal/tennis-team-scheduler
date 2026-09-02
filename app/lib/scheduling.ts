import { Group, groups } from '../teams';
import { Match, Suggestion, teamIds } from './matches';

// September 30, 2026 at 11:59:59 PM in America/Los_Angeles (PDT).
export const SEASON_DEADLINE = '2026-10-01T06:59:59.999Z';
export const DEFAULT_MATCH_DURATION_MINUTES = 120;
export const DEFAULT_SCHEDULING_INCREMENT_MINUTES = 30;

export type AvailabilitySlot = {
  id: string;
  playerId: string;
  startsAt: string;
  endsAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TimeWindow = { startsAt: Date; endsAt: Date };

export const isEligibleForSuggestion = (match: Match) => {
  const status = match.status.trim().toLowerCase();
  return (
    ['unscheduled', 'open', 'unassigned'].includes(status) &&
    teamIds(match, (match.league_group || 'Group B') as Group).length === 2
  );
};

export const mergeAvailabilitySlots = (slots: AvailabilitySlot[]): TimeWindow[] => {
  const sorted = slots
    .map((slot) => ({ startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt) }))
    .filter((slot) => !Number.isNaN(slot.startsAt.valueOf()) && slot.endsAt > slot.startsAt)
    .sort((a, b) => a.startsAt.valueOf() - b.startsAt.valueOf());
  return sorted.reduce<TimeWindow[]>((merged, slot) => {
    const previous = merged[merged.length - 1];
    if (previous && slot.startsAt <= previous.endsAt) {
      previous.endsAt = new Date(Math.max(previous.endsAt.valueOf(), slot.endsAt.valueOf()));
      return merged;
    }
    merged.push({ ...slot });
    return merged;
  }, []);
};

export const intersectTimeWindows = (windowsByPlayer: TimeWindow[][]) => {
  if (!windowsByPlayer.length || windowsByPlayer.some((windows) => !windows.length)) return [];
  let intersections = windowsByPlayer[0].map((window) => ({ ...window }));
  for (const windows of windowsByPlayer.slice(1)) {
    intersections = intersections.flatMap((left) =>
      windows.flatMap((right) => {
        const startsAt = new Date(Math.max(left.startsAt.valueOf(), right.startsAt.valueOf()));
        const endsAt = new Date(Math.min(left.endsAt.valueOf(), right.endsAt.valueOf()));
        return endsAt > startsAt ? [{ startsAt, endsAt }] : [];
      })
    );
  }
  return mergeAvailabilitySlots(
    intersections.map((window, index) => ({
      id: String(index),
      playerId: '',
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
    }))
  );
};

export const generateSuggestedStarts = (
  window: TimeWindow,
  durationMinutes = DEFAULT_MATCH_DURATION_MINUTES,
  incrementMinutes = DEFAULT_SCHEDULING_INCREMENT_MINUTES
) => {
  const starts: Date[] = [];
  const duration = durationMinutes * 60_000;
  for (
    let start = window.startsAt.valueOf();
    start + duration <= window.endsAt.valueOf();
    start += incrementMinutes * 60_000
  ) {
    starts.push(new Date(start));
  }
  return starts;
};

export const subtractTimeWindow = (window: TimeWindow, blocked: TimeWindow): TimeWindow[] => {
  if (blocked.endsAt <= window.startsAt || blocked.startsAt >= window.endsAt) return [window];
  const pieces: TimeWindow[] = [];
  if (window.startsAt < blocked.startsAt)
    pieces.push({ startsAt: window.startsAt, endsAt: blocked.startsAt });
  if (window.endsAt > blocked.endsAt)
    pieces.push({ startsAt: blocked.endsAt, endsAt: window.endsAt });
  return pieces.filter((piece) => piece.endsAt > piece.startsAt);
};

export const playerKeysForTeam = (group: Group, teamId: string) => {
  const team = groups[group].find(([id]) => id === teamId);
  if (!team) return [];
  return team[1].split(',').map((name) => `${group}:${teamId}:${name.trim()}`);
};

export const rankMatchSuggestions = (suggestions: Suggestion[]) =>
  [...suggestions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.score - b.score || a.opponentId.localeCompare(b.opponentId)
  );
