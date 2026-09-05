import { z } from 'zod';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const JsonRecordSchema = z.record(z.string(), z.unknown());

/** Parses `text` as JSON and returns it only if it decodes to a plain object; otherwise returns `null`. */
export function parseJsonRecord(text: string) {
  try {
    const result = JsonRecordSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
