export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Phoenix', label: 'Arizona Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'America/Adak', label: 'Hawaii-Aleutian Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
] as const;

export const DEFAULT_TIMEZONE = 'America/Chicago';

export function formatInteractionDate(date: string | null | undefined) {
  if (!date) return '—';
  const [year, month, day] = date.slice(0, 10).split('-');
  return year && month && day ? `${month}/${day}/${year}` : date;
}

export function formatInteractionTimestamp(createdAt: string | null | undefined, timezone = DEFAULT_TIMEZONE) {
  if (!createdAt) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(new Date(createdAt));
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: DEFAULT_TIMEZONE,
      timeZoneName: 'short',
    }).format(new Date(createdAt));
  }
}

export function formatInteractionDateTime(date: string | null | undefined, createdAt: string | null | undefined, timezone = DEFAULT_TIMEZONE) {
  const d = formatInteractionDate(date);
  const t = formatInteractionTimestamp(createdAt, timezone);
  return t ? `${d} · ${t}` : d;
}
