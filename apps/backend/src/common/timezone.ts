/** Operational timezone for "local day" windows (Brazil). */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo';

/**
 * Start of calendar day in APP_TIMEZONE, as a UTC Date.
 * Uses Intl parts to avoid depending on host TZ.
 */
export function startOfLocalDay(reference: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  // Noon UTC probe then adjust: find UTC instant that is 00:00 in APP_TIMEZONE
  // Binary-search free approach: format offset via comparing local YMD.
  // Build candidate as UTC midnight of that YMD then shift by timezone offset.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const localParts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utcGuess);
  const hour = Number(localParts.find((p) => p.type === 'hour')?.value ?? 12);
  const minute = Number(
    localParts.find((p) => p.type === 'minute')?.value ?? 0,
  );
  // utcGuess is local (hour:minute); we want local 00:00 → subtract those minutes from utcGuess
  const start = new Date(utcGuess.getTime() - (hour * 60 + minute) * 60_000);
  // Verify day didn't drift
  const verify = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(start);
  const expected = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (verify === expected) return start;
  // Fallback: add/sub one hour if boundary glitch
  const adjusted = new Date(start.getTime() + 60 * 60_000);
  const verify2 = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(adjusted);
  return verify2 === expected ? adjusted : start;
}

export function nextLocalDay(reference: Date = new Date()): Date {
  const start = startOfLocalDay(reference);
  return new Date(start.getTime() + 24 * 60 * 60_000);
}
