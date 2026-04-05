import * as z from 'zod';

const CURRENCY_CODE_LENGTH = 3;

export type UpdatePreferencesPayload = z.infer<typeof UpdatePreferencesPayloadSchema>;

export const UpdatePreferencesPayloadSchema = z
  .object({
    preferred_currency: z.string().length(CURRENCY_CODE_LENGTH).toUpperCase().openapi({
      description: 'ISO 4217 currency code the user prefers for new transactions',
      example: 'USD',
    }),
  })
  .openapi('UpdatePreferencesPayload', {
    title: 'Update Preferences Payload',
    description: 'Payload to update user preferences',
  });
