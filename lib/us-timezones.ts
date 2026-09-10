import {interactionDateLabel,type InteractionDatePrecision} from '@/lib/interaction-dates';

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

export function getGreetingForTimezone(timezone = DEFAULT_TIMEZONE, now = new Date()) {
  let hour = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', timeZone: timezone }).formatToParts(now);
    hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
  } catch {
    const parts = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', timeZone: DEFAULT_TIMEZONE }).formatToParts(now);
    hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
  }
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatInteractionDate(date: string | null | undefined) {
  return interactionDateLabel({date,date_precision:date?'exact':'unknown'});
}

export function formatInteractionTimestamp(createdAt: string | null | undefined, timezone = DEFAULT_TIMEZONE) {
  if (!createdAt) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {hour:'numeric',minute:'2-digit',hour12:true,timeZone:timezone,timeZoneName:'short'}).format(new Date(createdAt));
  } catch {
    return new Intl.DateTimeFormat('en-US', {hour:'numeric',minute:'2-digit',hour12:true,timeZone:DEFAULT_TIMEZONE,timeZoneName:'short'}).format(new Date(createdAt));
  }
}

export function formatInteractionDateTime(date:string|null|undefined,createdAt?:string|null,timezone=DEFAULT_TIMEZONE,datePrecision:InteractionDatePrecision|string|null='exact',dateYear?:number|null,dateMonth?:number|null) {
  const dateLabel=interactionDateLabel({date,date_precision:datePrecision,date_year:dateYear,date_month:dateMonth});
  // created_at is a trustworthy timestamp for activity recorded as it happens in Rebels Recruit.
  // Imported/partial historical records do not have a trustworthy occurrence time, so never invent one.
  const isHistoricalOrPartial=String(datePrecision||'exact')!=='exact' || String(dateLabel).toLowerCase().includes('unknown');
  if(!createdAt||isHistoricalOrPartial)return dateLabel;
  const createdDay=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(createdAt));
  const activityDay=date?String(date).slice(0,10):'';
  if(activityDay!==createdDay)return dateLabel;
  return `${dateLabel} · ${formatInteractionTimestamp(createdAt,timezone)}`;
}
