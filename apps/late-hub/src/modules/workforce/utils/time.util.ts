import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export function minutesOfDay(hoursMinutes: string): number {
  const parsed = dayjs(hoursMinutes.trim(), ['H:mm', 'HH:mm'], true);
  if (!parsed.isValid()) {
    throw new Error(`Invalid HH:mm time value in configuration: "${hoursMinutes}"`);
  }
  return parsed.hour() * 60 + parsed.minute();
}

/** Parses a "DD-MM-YYYY" configuration value into an ISO yyyy-MM-dd date string. */
export function parseDdMmYyyy(value: string): string {
  const parsed = dayjs(value.trim(), 'DD-MM-YYYY', true);
  if (!parsed.isValid()) {
    throw new Error(`Invalid DD-MM-YYYY date value in configuration: "${value}"`);
  }
  return parsed.format('YYYY-MM-DD');
}

// xlsx (SheetJS) parses date/time cells by constructing `new Date(year, month, day, hours, ...)`
// via the local-timezone Date constructor, so the resulting object's *local* fields reproduce the
// naive spreadsheet value regardless of the server's timezone - never read them via UTC fields,
// which would shift by the server's own UTC offset.
//
// SheetJS's Excel-serial-to-Date conversion also has a floating-point artifact that consistently
// lands every parsed cell ~30 seconds *before* its true intended value (e.g. a 08:42 check-in comes
// back as 08:41:30, a pure date cell as 23:59:30 of the *previous* day). Source timestamps here are
// always whole minutes, so compensating by +30s and rounding to the nearest minute recovers the
// intended value exactly. Round (not floor/ceil) - the sub-second jitter around the drift can land
// a hair either side of the true boundary.
function correctSheetJsDrift(date: Date): Dayjs {
  return dayjs(Math.round((date.getTime() + 30_000) / 60_000) * 60_000);
}

export function timeOfDayMinutes(date: Date): number {
  const corrected = correctSheetJsDrift(date);
  return corrected.hour() * 60 + corrected.minute();
}

export function formatTimeOfDay(date: Date): string {
  return correctSheetJsDrift(date).format('HH:mm');
}

export function isoDate(date: Date): string {
  return correctSheetJsDrift(date).format('YYYY-MM-DD');
}

/** Midnight, local time, on the same calendar day as `date` (after correcting SheetJS's parsing drift). */
export function startOfLocalDay(date: Date): Date {
  return correctSheetJsDrift(date).startOf('day').toDate();
}

/** The next calendar day, local time - safe across month/year rollover and DST. */
export function nextLocalDay(date: Date): Date {
  return dayjs(date).add(1, 'day').toDate();
}
