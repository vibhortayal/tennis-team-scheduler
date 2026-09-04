import { useMemo, useState } from 'react';
import { AvailabilitySlot, SlotKind, SlotMode } from '../lib/scheduling';
import { Match } from '../lib/matches';
import { Group, teamDisplay } from '../teams';
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

type AvailabilityManagerProps = {
  availabilitySlots: AvailabilitySlot[];
  blockingSlots: AvailabilitySlot[];
  teamMatches: Match[];
  participantStatusMap: Map<DateString, DateParticipantStatus>;
  participantKeys?: string[];
  readOnly?: boolean;
  deadline: string;
  saving: boolean;
  error: string;
  onSaveSlot: (input: SlotSaveInput) => Promise<void>;
  onDeleteSlot: (id: string) => Promise<void>;
};

type PendingConfig = { mode: string; windows: string[] };
type PendingEntry = { date: DateString; mode: string; windows: string[] };

export function AvailabilityManager({
  availabilitySlots,
  blockingSlots,
  teamMatches,
  participantStatusMap,
  participantKeys = [],
  readOnly = false,
  deadline,
  saving,
  error,
  onSaveSlot,
  onDeleteSlot,
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
      <h3>{readOnly ? 'Team availability' : 'Availability & blocking'}</h3>
      <p>
        {readOnly
          ? 'Review availability for the selected matchup teams on the calendar.'
          : 'Pick dates on the calendar, choose &quot;anytime&quot; or specific time windows, then save. Match days are locked automatically and the two calendars stay in sync with each other.'}
      </p>
      {error && <p className="error-note">{error}</p>}
      {!readOnly && (
        <div className="availability-modes" role="tablist" aria-label="Availability action">
          <button
            type="button"
            className={activeTab === 'availability' ? '' : 'secondary'}
            onClick={() => setActiveTab('availability')}
          >
            Available dates
          </button>
          <button
            type="button"
            className={activeTab === 'blocking' ? 'block-mode' : 'secondary'}
            onClick={() => setActiveTab('blocking')}
          >
            Blocked dates
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
          participantKeys={participantKeys}
          readOnly={readOnly}
          minDate={minDate}
          maxDate={maxDate}
          saving={saving}
          onSubmit={submitAvailability}
          onDeleteSlot={onDeleteSlot}
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
  participantKeys,
  readOnly,
  minDate,
  maxDate,
  saving,
  onSubmit,
  onDeleteSlot,
}: {
  pickerType: PickerType;
  savedSlots: AvailabilitySlot[];
  availabilityMap: Map<DateString, DayAvailability>;
  blockingMap: Map<DateString, DayBlock>;
  matchDates: DateString[];
  participantStatusMap: Map<DateString, DateParticipantStatus>;
  participantKeys: string[];
  readOnly: boolean;
  minDate: Date;
  maxDate: Date;
  saving: boolean;
  onSubmit: (entries: PendingEntry[]) => Promise<void>;
  onDeleteSlot: (id: string) => Promise<void>;
}) {
  const [pendingDates, setPendingDates] = useState<DateString[]>([]);
  const [configs, setConfigs] = useState<Record<DateString, PendingConfig>>({});
  const [localError, setLocalError] = useState('');
  const [inspectedDate, setInspectedDate] = useState<DateString | null>(null);

  const defaultMode = pickerType === 'availability' ? 'anytime' : 'all_day';
  const modeOptions =
    pickerType === 'availability'
      ? [
          { value: 'anytime', label: 'Available anytime' },
          { value: 'time_windows', label: 'Specific time window(s)' },
        ]
      : [
          { value: 'all_day', label: 'Blocked all day' },
          { value: 'time_windows', label: 'Specific time window(s)' },
        ];

  const toggleDate = (date: DateString) => {
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
  const participants = useMemo(
    () =>
      participantKeys.map((playerKey) => {
        const [group, teamId, name] = playerKey.split(':');
        return {
          playerKey,
          name: name ?? playerKey,
          teamLabel: group && teamId ? teamDisplay(group as Group, teamId) : 'Unknown team',
        };
      }),
    [participantKeys]
  );
  const inspectedDateDetails = useMemo(() => {
    if (!inspectedDate) return null;
    const slots = savedByDate.get(inspectedDate) || [];
    const status = {
      available: [] as Array<{ name: string; teamLabel: string }>,
      blocked: [] as Array<{ name: string; teamLabel: string }>,
      missing: [] as Array<{ name: string; teamLabel: string }>,
    };
    participants.forEach((participant) => {
      const playerSlots = slots.filter((slot) => slot.playerId === participant.playerKey);
      const hasAvailable = playerSlots.some((slot) => (slot.kind ?? 'available') === 'available');
      const hasBlocked = playerSlots.some((slot) => (slot.kind ?? 'available') === 'blocked');
      if (hasAvailable) status.available.push(participant);
      if (hasBlocked) status.blocked.push(participant);
      if (!hasAvailable && !hasBlocked) status.missing.push(participant);
    });
    return status;
  }, [inspectedDate, participants, savedByDate]);

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
        selectedDates={pendingDates}
        onDateToggle={toggleDate}
        availabilityMap={availabilityMap}
        blockingMap={blockingMap}
        matchDates={matchDates}
        participantStatusMap={participantStatusMap}
        onDateInspect={readOnly ? setInspectedDate : undefined}
        readOnly={readOnly}
        pickerType={pickerType}
        minDate={minDate}
        maxDate={maxDate}
      />
      <DateStateLegend pickerType={pickerType} />

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
              {pickerType === 'availability' ? 'Save availability' : 'Save blocked times'}
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
      {readOnly && inspectedDate && inspectedDateDetails && (
        <div className="modal" onClick={() => setInspectedDate(null)}>
          <div
            className="modal-card availability-day-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="availability-day-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="availability-day-heading">{formatDateDisplay(inspectedDate)}</h2>
            <p>Availability snapshot for the selected matchup teams on this date.</p>
            <OverviewStatusList
              title="Available"
              entries={inspectedDateDetails.available}
              emptyText="No players are marked available on this date."
            />
            <OverviewStatusList
              title="Blocked"
              entries={inspectedDateDetails.blocked}
              emptyText="No players have blocked this date."
            />
            <OverviewStatusList
              title="No update"
              entries={inspectedDateDetails.missing}
              emptyText="Everyone selected has posted an update for this date."
            />
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setInspectedDate(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewStatusList({
  title,
  entries,
  emptyText,
}: {
  title: string;
  entries: Array<{ name: string; teamLabel: string }>;
  emptyText: string;
}) {
  return (
    <div className="overview-status-group">
      <h4>{title}</h4>
      {entries.length ? (
        <ul className="overview-status-list">
          {entries.map((entry) => (
            <li key={`${title}-${entry.teamLabel}-${entry.name}`}>
              <b>{entry.name}</b>
              <span>{entry.teamLabel}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="availability-note">{emptyText}</p>
      )}
    </div>
  );
}
