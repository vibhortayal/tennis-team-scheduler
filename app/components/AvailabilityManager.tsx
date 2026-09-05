import { useMemo, useState } from 'react';
import { AvailabilitySlot, SlotKind, SlotMode } from '../lib/scheduling';
import { Match } from '../lib/matches';
import {
  buildAvailabilityMap,
  buildBlockingMap,
  doTimeWindowsOverlap,
  formatDateDisplay,
  fullDayWindow,
  getMatchDates,
  normalizeDate,
  timeWindowFromSlot,
  windowToIso,
  DateString,
  DayAvailability,
  DayBlock,
  PickerType,
} from '../lib/availabilityHelpers';
import { DateParticipantStatus, MultiDateCalendar, DateStateLegend } from './MultiDateCalendar';
import { SelectedDayChips, SelectedDayChipEntry } from './SelectedDayChips';
import { DayModeSelector } from './DayModeSelector';
import { TimeWindowSelector } from './TimeWindowSelector';

export type { AvailabilitySlot } from '../lib/scheduling';

export type SlotSaveInput = {
  kind: SlotKind;
  mode: SlotMode;
  startsAt: string;
  endsAt: string;
};

export type TeamPlayerContext = {
  teamId: string;
  displayName: string;
  players: { key: string; name: string }[];
};

type AvailabilityManagerProps = {
  availabilitySlots: AvailabilitySlot[];
  blockingSlots: AvailabilitySlot[];
  teamMatches: Match[];
  participantStatusMap: Map<DateString, DateParticipantStatus>;
  readOnly?: boolean;
  deadline: string;
  saving: boolean;
  error: string;
  onSaveSlot: (input: SlotSaveInput) => Promise<void>;
  onDeleteSlot: (id: string) => Promise<void>;
  /** When readOnly, describes each selected team + their player keys for the details panel. */
  teamAvailabilityContext?: TeamPlayerContext[];
  /** Full availability records for all players (used in readOnly date-details panel). */
  allAvailability?: AvailabilitySlot[];
};

type PendingConfig = { mode: string; windows: string[] };
type PendingEntry = { date: DateString; mode: string; windows: string[] };

export function AvailabilityManager({
  availabilitySlots,
  blockingSlots,
  teamMatches,
  participantStatusMap,
  readOnly = false,
  deadline,
  saving,
  error,
  onSaveSlot,
  onDeleteSlot,
  teamAvailabilityContext,
  allAvailability,
}: AvailabilityManagerProps) {
  const [activeTab, setActiveTab] = useState<PickerType>('availability');
  const matchDates = useMemo(() => getMatchDates(teamMatches), [teamMatches]);
  const availabilityMap = useMemo(
    () => buildAvailabilityMap(availabilitySlots),
    [availabilitySlots]
  );
  const blockingMap = useMemo(() => buildBlockingMap(blockingSlots), [blockingSlots]);
  const minDate = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => new Date(deadline), [deadline]);

  const submitAvailability = async (entries: PendingEntry[]) => {
    for (const entry of entries) {
      if (entry.mode === 'anytime') {
        const { startsAt, endsAt } = fullDayWindow(entry.date);
        await onSaveSlot({ kind: 'available', mode: 'anytime', startsAt, endsAt });
      } else {
        for (const window of entry.windows) {
          const { startsAt, endsAt } = windowToIso(entry.date, window);
          await onSaveSlot({ kind: 'available', mode: 'time_windows', startsAt, endsAt });
        }
      }
    }
  };

  const submitBlocking = async (entries: PendingEntry[]) => {
    for (const entry of entries) {
      if (entry.mode === 'all_day') {
        const { startsAt, endsAt } = fullDayWindow(entry.date);
        await onSaveSlot({ kind: 'blocked', mode: 'all_day', startsAt, endsAt });
      } else {
        for (const window of entry.windows) {
          const { startsAt, endsAt } = windowToIso(entry.date, window);
          await onSaveSlot({ kind: 'blocked', mode: 'time_windows', startsAt, endsAt });
        }
      }
    }
  };

  return (
    <div className={`availability-manager ${readOnly ? 'read-only' : ''}`}>
      <h3>{readOnly ? 'Team availability' : 'My availability'}</h3>
      <p>
        {readOnly
          ? 'Review availability for the selected matchup teams on the calendar.'
          : 'Pick dates, choose Available or Blocked, then optionally choose a time. Match days are locked automatically.'}
      </p>
      {error && <p className="error-note">{error}</p>}
      {!readOnly && (
        <div className="availability-modes" role="tablist" aria-label="Availability action">
          <button
            type="button"
            className={activeTab === 'availability' ? '' : 'secondary'}
            onClick={() => setActiveTab('availability')}
          >
            Available
          </button>
          <button
            type="button"
            className={activeTab === 'blocking' ? 'block-mode' : 'secondary'}
            onClick={() => setActiveTab('blocking')}
          >
            Blocked
          </button>
        </div>
      )}

      <div className={readOnly || activeTab === 'availability' ? '' : 'hidden'}>
        <PickerSection
          pickerType="availability"
          savedSlots={availabilitySlots}
          availabilityMap={availabilityMap}
          blockingMap={blockingMap}
          matchDates={matchDates}
          participantStatusMap={participantStatusMap}
          readOnly={readOnly}
          minDate={minDate}
          maxDate={maxDate}
          saving={saving}
          onSubmit={submitAvailability}
          onDeleteSlot={onDeleteSlot}
          teamAvailabilityContext={teamAvailabilityContext}
          allAvailability={allAvailability}
        />
      </div>
      <div className={!readOnly && activeTab === 'blocking' ? '' : 'hidden'}>
        <PickerSection
          pickerType="blocking"
          savedSlots={blockingSlots}
          availabilityMap={availabilityMap}
          blockingMap={blockingMap}
          matchDates={matchDates}
          participantStatusMap={participantStatusMap}
          readOnly={readOnly}
          minDate={minDate}
          maxDate={maxDate}
          saving={saving}
          onSubmit={submitBlocking}
          onDeleteSlot={onDeleteSlot}
          teamAvailabilityContext={teamAvailabilityContext}
          allAvailability={allAvailability}
        />
      </div>
    </div>
  );
}

function PickerSection({
  pickerType,
  savedSlots,
  availabilityMap,
  blockingMap,
  matchDates,
  participantStatusMap,
  readOnly,
  minDate,
  maxDate,
  saving,
  onSubmit,
  onDeleteSlot,
  teamAvailabilityContext,
  allAvailability,
}: {
  pickerType: PickerType;
  savedSlots: AvailabilitySlot[];
  availabilityMap: Map<DateString, DayAvailability>;
  blockingMap: Map<DateString, DayBlock>;
  matchDates: DateString[];
  participantStatusMap: Map<DateString, DateParticipantStatus>;
  readOnly: boolean;
  minDate: Date;
  maxDate: Date;
  saving: boolean;
  onSubmit: (entries: PendingEntry[]) => Promise<void>;
  onDeleteSlot: (id: string) => Promise<void>;
  teamAvailabilityContext?: TeamPlayerContext[];
  allAvailability?: AvailabilitySlot[];
}) {
  const [pendingDates, setPendingDates] = useState<DateString[]>([]);
  const [configs, setConfigs] = useState<Record<DateString, PendingConfig>>({});
  const [localError, setLocalError] = useState('');
  const [selectedDetailDate, setSelectedDetailDate] = useState<DateString | null>(null);

  // Per-player status for the selected date in readOnly mode
  const dateDetails = useMemo(() => {
    if (!readOnly || !selectedDetailDate || !teamAvailabilityContext || !allAvailability)
      return null;
    return teamAvailabilityContext.map((team) => ({
      teamId: team.teamId,
      displayName: team.displayName,
      players: team.players.map((player) => {
        const playerSlots = allAvailability.filter(
          (slot) =>
            slot.playerId === player.key && normalizeDate(slot.startsAt) === selectedDetailDate
        );
        const hasAvailable = playerSlots.some((s) => (s.kind ?? 'available') === 'available');
        const hasBlocked = playerSlots.some((s) => (s.kind ?? 'available') === 'blocked');
        const status: 'available' | 'blocked' | 'no-response' = hasBlocked
          ? 'blocked'
          : hasAvailable
            ? 'available'
            : 'no-response';
        return { name: player.name, status };
      }),
    }));
  }, [readOnly, selectedDetailDate, teamAvailabilityContext, allAvailability]);

  const formattedDetailDate = useMemo(() => {
    if (!selectedDetailDate) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${selectedDetailDate}T12:00:00`));
  }, [selectedDetailDate]);

  const defaultMode = pickerType === 'availability' ? 'anytime' : 'all_day';
  const modeOptions =
    pickerType === 'availability'
      ? [
          { value: 'anytime', label: 'Anytime' },
          { value: 'time_windows', label: 'Choose time' },
        ]
      : [
          { value: 'all_day', label: 'All day' },
          { value: 'time_windows', label: 'Choose time' },
        ];

  const toggleDate = (date: DateString) => {
    if (readOnly) {
      // In readOnly mode, clicks drive the date-details panel, not pending edits.
      setSelectedDetailDate((prev) => (prev === date ? null : date));
      return;
    }
    setLocalError('');
    if (pendingDates.includes(date)) {
      setPendingDates((current) => current.filter((d) => d !== date));
      setConfigs((current) => {
        const next = { ...current };
        delete next[date];
        return next;
      });
      return;
    }
    setPendingDates((current) => [...current, date].sort());
    setConfigs((current) => ({
      ...current,
      [date]: current[date] || { mode: defaultMode, windows: [] },
    }));
  };

  const removePendingDate = (date: DateString) => {
    setPendingDates((current) => current.filter((d) => d !== date));
    setConfigs((current) => {
      const next = { ...current };
      delete next[date];
      return next;
    });
  };

  const updateConfig = (date: DateString, config: PendingConfig) =>
    setConfigs((current) => ({ ...current, [date]: config }));

  // Validate a pending entry against the OTHER picker's already-saved state for that date.
  // Overlapping windows between available/blocked are never allowed; all-day states dominate.
  const validateEntry = (date: DateString, mode: string, windows: string[]): string | undefined => {
    if (pickerType === 'availability') {
      const blocked = blockingMap.get(date);
      if (!blocked) return undefined;
      if (blocked.mode === 'all_day' || mode === 'anytime')
        return `${formatDateDisplay(date)} already has a conflicting blocked entry.`;
      if (
        blocked.timeWindows &&
        windows.some((w) => blocked.timeWindows!.some((bw) => doTimeWindowsOverlap(w, bw)))
      )
        return `${formatDateDisplay(date)}: that time overlaps a blocked window.`;
      return undefined;
    }
    const available = availabilityMap.get(date);
    if (!available) return undefined;
    if (available.mode === 'anytime' || mode === 'all_day')
      return `${formatDateDisplay(date)} already has a conflicting availability entry.`;
    if (
      available.timeWindows &&
      windows.some((w) => available.timeWindows!.some((aw) => doTimeWindowsOverlap(w, aw)))
    )
      return `${formatDateDisplay(date)}: that time overlaps an availability window.`;
    return undefined;
  };

  const save = async () => {
    if (!pendingDates.length) {
      setLocalError('Choose at least one date first.');
      return;
    }
    for (const date of pendingDates) {
      const config = configs[date];
      if (config.mode === 'time_windows' && !config.windows.length) {
        setLocalError(`Choose at least one time window for ${formatDateDisplay(date)}.`);
        return;
      }
      const conflict = validateEntry(date, config.mode, config.windows);
      if (conflict) {
        setLocalError(conflict);
        return;
      }
    }
    setLocalError('');
    await onSubmit(
      pendingDates.map((date) => ({
        date,
        mode: configs[date].mode,
        windows: configs[date].windows,
      }))
    );
    setPendingDates([]);
    setConfigs({});
  };

  const savedByDate = useMemo(() => {
    const map = new Map<DateString, AvailabilitySlot[]>();
    savedSlots.forEach((slot) => {
      const date = normalizeDate(slot.startsAt);
      map.set(date, [...(map.get(date) || []), slot]);
    });
    return map;
  }, [savedSlots]);

  const chipEntries: SelectedDayChipEntry[] = Array.from(savedByDate.entries()).map(
    ([date, slots]) => {
      const allDaySlot = slots.find((slot) => (slot.mode ?? 'time_windows') === defaultMode);
      const modeLabel = allDaySlot
        ? pickerType === 'availability'
          ? 'Available anytime'
          : 'Blocked all day'
        : 'Specific time window(s)';
      const timeWindows = allDaySlot ? undefined : slots.map(timeWindowFromSlot);
      return {
        date,
        modeLabel,
        timeWindows,
        onRemove: () => {
          slots.forEach((slot) => {
            onDeleteSlot(slot.id);
          });
        },
        onEdit: () => {
          slots.forEach((slot) => {
            onDeleteSlot(slot.id);
          });
          setPendingDates((current) =>
            current.includes(date) ? current : [...current, date].sort()
          );
          setConfigs((current) => ({
            ...current,
            [date]: allDaySlot
              ? { mode: defaultMode, windows: [] }
              : { mode: 'time_windows', windows: slots.map(timeWindowFromSlot) },
          }));
        },
      };
    }
  );

  return (
    <div className="picker-section">
      <MultiDateCalendar
        selectedDates={readOnly && selectedDetailDate ? [selectedDetailDate] : pendingDates}
        onDateToggle={toggleDate}
        availabilityMap={availabilityMap}
        blockingMap={blockingMap}
        matchDates={matchDates}
        participantStatusMap={participantStatusMap}
        readOnly={readOnly}
        pickerType={pickerType}
        minDate={minDate}
        maxDate={maxDate}
      />
      <DateStateLegend pickerType={pickerType} />

      {/* Read-only date details panel */}
      {readOnly && (
        <div className="availability-date-details" aria-live="polite">
          {!teamAvailabilityContext?.length ? (
            <p className="availability-date-details-hint">
              Select opponent teams above to compare availability.
            </p>
          ) : !selectedDetailDate ? (
            <p className="availability-date-details-hint">
              Click a date on the calendar to see player availability details.
            </p>
          ) : (
            <div className="availability-date-details-content">
              <h4 id="avail-detail-heading" className="availability-date-details-heading">
                Availability for {formattedDetailDate}
              </h4>
              {dateDetails?.map((team) => (
                <div key={team.teamId} className="avail-detail-team">
                  <div className="avail-detail-team-name">{team.displayName}</div>
                  <ul className="avail-detail-players">
                    {team.players.map((player) => (
                      <li
                        key={player.name}
                        className={`avail-detail-player avail-status-${player.status}`}
                      >
                        <span className="avail-player-name">{player.name}</span>
                        <span className="avail-player-status">
                          {player.status === 'available'
                            ? '✓ Available'
                            : player.status === 'blocked'
                              ? '✗ Blocked'
                              : '— No response'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!readOnly && pendingDates.length > 0 && (
        <div className="pending-day-editors">
          {pendingDates.map((date) => (
            <div className="pending-day-editor" key={date}>
              <div className="pending-day-editor-header">
                <b>{formatDateDisplay(date)}</b>
                <button type="button" className="secondary" onClick={() => removePendingDate(date)}>
                  Remove
                </button>
              </div>
              <DayModeSelector
                name={`${pickerType}-mode-${date}`}
                value={configs[date]?.mode ?? defaultMode}
                options={modeOptions}
                onChange={(mode) =>
                  updateConfig(date, { mode, windows: configs[date]?.windows ?? [] })
                }
              />
              {configs[date]?.mode === 'time_windows' && (
                <TimeWindowSelector
                  date={date}
                  selected={configs[date]?.windows ?? []}
                  onChange={(windows) => updateConfig(date, { mode: 'time_windows', windows })}
                />
              )}
            </div>
          ))}
          {localError && <p className="error-note">{localError}</p>}
          <div className="assistant-actions">
            <span />
            <button type="button" disabled={saving} onClick={save}>
              {pickerType === 'availability' ? 'Save availability' : 'Save blocked dates'}
            </button>
          </div>
        </div>
      )}
      {!readOnly && !pendingDates.length && localError && (
        <p className="error-note">{localError}</p>
      )}

      {!readOnly && (
        <>
          <h4>
            {pickerType === 'availability' ? 'Your saved availability' : 'Your blocked dates'}
          </h4>
          {chipEntries.length ? (
            <SelectedDayChips entries={chipEntries} />
          ) : (
            <p className="availability-note">
              {pickerType === 'availability'
                ? 'No availability saved yet.'
                : 'No blocked dates saved yet.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
