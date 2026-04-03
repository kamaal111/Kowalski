import { toISO8601String } from './strings';

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnlyStringAsUTC(dateOnlyString: string): Date {
  if (!ISO_DATE_ONLY_PATTERN.test(dateOnlyString)) {
    throw new Error(`Invalid date-only string: ${dateOnlyString}`);
  }

  const [year, month, day] = dateOnlyString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.getTime()) || toISO8601String(date).slice(0, 10) != dateOnlyString) {
    throw new Error(`Invalid date-only string: ${dateOnlyString}`);
  }

  return date;
}

export function dateOnlyStringToISO8601String(dateOnlyString: string): string {
  return toISO8601String(parseDateOnlyStringAsUTC(dateOnlyString));
}
