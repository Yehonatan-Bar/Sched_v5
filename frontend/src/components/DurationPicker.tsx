import { useState, useCallback, useEffect, CSSProperties } from 'react';
import { DurationUnit, DURATION_UNIT_OPTIONS, Schedule, ScheduleRange } from '../types';

interface DurationPickerProps {
  schedule: Schedule | null;
  onChange: (schedule: Schedule | null) => void;
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  },
  row: {
    display: 'flex',
    gap: 'var(--spacing-sm)',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-muted)',
    fontWeight: 500,
    minWidth: '60px',
  },
  unitSelect: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
    flex: 1,
    maxWidth: '150px',
  },
  dateTimeInput: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    flex: 1,
  },
  dateInput: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    flex: 1,
  },
  clearButton: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: 'var(--accent-danger)',
    border: '1px solid var(--accent-danger)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-xs)',
    opacity: 0.8,
    transition: 'opacity var(--transition-fast)',
  },
  datesSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
    marginTop: 'var(--spacing-xs)',
    padding: 'var(--spacing-sm)',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
  },
  dateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
  },
  quickDuration: {
    display: 'flex',
    gap: 'var(--spacing-xs)',
    flexWrap: 'wrap',
    marginTop: 'var(--spacing-xs)',
  },
  quickButton: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-light)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-xs)',
    transition: 'all var(--transition-fast)',
  },
  quickButtonActive: {
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    borderColor: 'var(--accent-primary)',
  },
};

// Helper to format date for datetime-local input
function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

// Helper to format date for date input
function toDateInput(iso: string): string {
  const date = new Date(iso);
  return date.toISOString().slice(0, 10);
}

// Helper to convert local datetime to ISO
function fromDateTimeLocal(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

// Helper to convert date to ISO (with time set to start/end of day)
function fromDateInput(dateStr: string, endOfDay: boolean = false): string {
  const date = new Date(dateStr);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

// Infer duration unit from existing schedule
function inferDurationUnit(schedule: ScheduleRange): DurationUnit {
  const start = new Date(schedule.start_iso);
  const end = new Date(schedule.end_iso);
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  const diffHours = diffMinutes / 60;
  const diffDays = diffHours / 24;
  const diffWeeks = diffDays / 7;

  if (diffMinutes < 60) return 'minutes';
  if (diffHours < 24) return 'hours';
  if (diffDays < 7) return 'days';
  if (diffWeeks < 4) return 'weeks';
  return 'months';
}

// Check if time component is needed for the unit
function needsTime(unit: DurationUnit): boolean {
  return unit === 'minutes' || unit === 'hours';
}

export default function DurationPicker({ schedule, onChange }: DurationPickerProps) {
  // Determine initial unit from existing schedule or default to days
  const initialUnit = schedule && schedule.mode === 'range'
    ? inferDurationUnit(schedule)
    : 'days';

  const [selectedUnit, setSelectedUnit] = useState<DurationUnit>(initialUnit);
  const [hasSchedule, setHasSchedule] = useState(schedule !== null);

  // Local state for inputs
  const [localStart, setLocalStart] = useState<string>(() => {
    if (schedule && schedule.mode === 'range') {
      return needsTime(initialUnit)
        ? toDateTimeLocal(schedule.start_iso)
        : toDateInput(schedule.start_iso);
    }
    return '';
  });

  const [localEnd, setLocalEnd] = useState<string>(() => {
    if (schedule && schedule.mode === 'range') {
      return needsTime(initialUnit)
        ? toDateTimeLocal(schedule.end_iso)
        : toDateInput(schedule.end_iso);
    }
    return '';
  });

  // Sync local state when schedule prop changes
  useEffect(() => {
    if (schedule && schedule.mode === 'range') {
      const unit = inferDurationUnit(schedule);
      setSelectedUnit(unit);
      setHasSchedule(true);
      if (needsTime(unit)) {
        setLocalStart(toDateTimeLocal(schedule.start_iso));
        setLocalEnd(toDateTimeLocal(schedule.end_iso));
      } else {
        setLocalStart(toDateInput(schedule.start_iso));
        setLocalEnd(toDateInput(schedule.end_iso));
      }
    } else if (schedule === null) {
      setHasSchedule(false);
    }
  }, [schedule]);

  const handleUnitChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value as DurationUnit;
    setSelectedUnit(newUnit);

    // Convert existing dates to new format if they exist
    if (localStart) {
      if (needsTime(newUnit) && !localStart.includes('T')) {
        // Converting from date to datetime
        setLocalStart(localStart + 'T09:00');
      } else if (!needsTime(newUnit) && localStart.includes('T')) {
        // Converting from datetime to date
        setLocalStart(localStart.slice(0, 10));
      }
    }

    if (localEnd) {
      if (needsTime(newUnit) && !localEnd.includes('T')) {
        setLocalEnd(localEnd + 'T17:00');
      } else if (!needsTime(newUnit) && localEnd.includes('T')) {
        setLocalEnd(localEnd.slice(0, 10));
      }
    }
  }, [localStart, localEnd]);

  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalStart(e.target.value);
    setHasSchedule(true);
  }, []);

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalEnd(e.target.value);
    setHasSchedule(true);
  }, []);

  // Commit changes on blur
  const handleBlur = useCallback(() => {
    if (localStart && localEnd) {
      const startIso = needsTime(selectedUnit)
        ? fromDateTimeLocal(localStart)
        : fromDateInput(localStart, false);
      const endIso = needsTime(selectedUnit)
        ? fromDateTimeLocal(localEnd)
        : fromDateInput(localEnd, true);

      const newSchedule: ScheduleRange = {
        mode: 'range',
        start_iso: startIso,
        end_iso: endIso,
      };
      onChange(newSchedule);
    }
  }, [localStart, localEnd, selectedUnit, onChange]);

  const handleClear = useCallback(() => {
    setLocalStart('');
    setLocalEnd('');
    setHasSchedule(false);
    onChange(null);
  }, [onChange]);

  // Quick duration buttons
  const handleQuickDuration = useCallback((duration: number) => {
    const now = new Date();
    let end = new Date();

    switch (selectedUnit) {
      case 'minutes':
        end.setMinutes(now.getMinutes() + duration);
        setLocalStart(toDateTimeLocal(now.toISOString()));
        setLocalEnd(toDateTimeLocal(end.toISOString()));
        break;
      case 'hours':
        end.setHours(now.getHours() + duration);
        setLocalStart(toDateTimeLocal(now.toISOString()));
        setLocalEnd(toDateTimeLocal(end.toISOString()));
        break;
      case 'days':
        end.setDate(now.getDate() + duration);
        setLocalStart(toDateInput(now.toISOString()));
        setLocalEnd(toDateInput(end.toISOString()));
        break;
      case 'weeks':
        end.setDate(now.getDate() + duration * 7);
        setLocalStart(toDateInput(now.toISOString()));
        setLocalEnd(toDateInput(end.toISOString()));
        break;
      case 'months':
        end.setMonth(now.getMonth() + duration);
        setLocalStart(toDateInput(now.toISOString()));
        setLocalEnd(toDateInput(end.toISOString()));
        break;
    }
    setHasSchedule(true);

    // Trigger save
    setTimeout(() => {
      const startIso = needsTime(selectedUnit)
        ? now.toISOString()
        : fromDateInput(toDateInput(now.toISOString()), false);
      const endIso = needsTime(selectedUnit)
        ? end.toISOString()
        : fromDateInput(toDateInput(end.toISOString()), true);

      onChange({
        mode: 'range',
        start_iso: startIso,
        end_iso: endIso,
      });
    }, 0);
  }, [selectedUnit, onChange]);

  // Quick duration options based on unit
  const getQuickOptions = (): { label: string; value: number }[] => {
    switch (selectedUnit) {
      case 'minutes':
        return [
          { label: '15 דקות', value: 15 },
          { label: '30 דקות', value: 30 },
          { label: '45 דקות', value: 45 },
        ];
      case 'hours':
        return [
          { label: 'שעה', value: 1 },
          { label: '2 שעות', value: 2 },
          { label: '4 שעות', value: 4 },
          { label: '8 שעות', value: 8 },
        ];
      case 'days':
        return [
          { label: 'יום', value: 1 },
          { label: '2 ימים', value: 2 },
          { label: '3 ימים', value: 3 },
          { label: '5 ימים', value: 5 },
        ];
      case 'weeks':
        return [
          { label: 'שבוע', value: 1 },
          { label: '2 שבועות', value: 2 },
          { label: '3 שבועות', value: 3 },
          { label: '4 שבועות', value: 4 },
        ];
      case 'months':
        return [
          { label: 'חודש', value: 1 },
          { label: '2 חודשים', value: 2 },
          { label: '3 חודשים', value: 3 },
          { label: '6 חודשים', value: 6 },
        ];
    }
  };

  const inputType = needsTime(selectedUnit) ? 'datetime-local' : 'date';
  const quickOptions = getQuickOptions();

  return (
    <div style={styles.container}>
      {/* Unit selection */}
      <div style={styles.row}>
        <span style={styles.label}>יחידה:</span>
        <select
          value={selectedUnit}
          onChange={handleUnitChange}
          style={styles.unitSelect}
        >
          {DURATION_UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hasSchedule && (
          <button style={styles.clearButton} onClick={handleClear}>
            נקה
          </button>
        )}
      </div>

      {/* Quick duration buttons */}
      <div style={styles.quickDuration}>
        {quickOptions.map((opt) => (
          <button
            key={opt.value}
            style={styles.quickButton}
            onClick={() => handleQuickDuration(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Start/End date inputs */}
      <div style={styles.datesSection}>
        <div style={styles.dateRow}>
          <span style={styles.label}>התחלה:</span>
          <input
            type={inputType}
            value={localStart}
            onChange={handleStartChange}
            onBlur={handleBlur}
            style={styles.dateTimeInput}
          />
        </div>
        <div style={styles.dateRow}>
          <span style={styles.label}>סיום:</span>
          <input
            type={inputType}
            value={localEnd}
            onChange={handleEndChange}
            onBlur={handleBlur}
            style={styles.dateTimeInput}
          />
        </div>
      </div>
    </div>
  );
}
