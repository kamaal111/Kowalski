import * as z from 'zod';

import { CurrencySchema } from '../../forex/constants.ts';

export type UpdatePreferencesPayload = z.infer<typeof UpdatePreferencesPayloadSchema>;

export const UpdatePreferencesPayloadSchema = z
  .object({
    preferred_currency: CurrencySchema,
  })
  .meta({
    $id: 'UpdatePreferencesPayload',
    title: 'Update Preferences Payload',
    description: 'Payload to update user preferences',
  });
