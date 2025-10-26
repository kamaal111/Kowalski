export function typedLowercased<T extends string>(string: T): Lowercase<T> {
  return string.toLowerCase() as Lowercase<T>;
}

export function toISO8601String(date: Date): string {
  return date.toISOString();
}
