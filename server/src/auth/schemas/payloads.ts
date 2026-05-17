import * as z from 'zod';

import { CurrencyShape } from '@/forex/constants';

export type UpdatePreferencesPayload = z.infer<typeof UpdatePreferencesPayloadSchema>;

export const UpdatePreferencesPayloadSchema = z
  .object({
    preferred_currency: CurrencyShape,
  })
  .openapi('UpdatePreferencesPayload', {
    title: 'Update Preferences Payload',
    description: 'Payload to update user preferences',
  });
