import type z from 'zod';

/** Reads a Zod object schema's own field map so callers can compose it into another schema. */
export function fieldsOf<T extends z.ZodObject>(schema: T): T['shape'] {
  return schema['shape'];
}
