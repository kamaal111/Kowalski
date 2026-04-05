import type { HonoContext } from '../../api/contexts';
import { STATUS_CODES } from '../../constants/http';
import { withRequestLogger } from '@/logging/http';
import { upsertUserPreferredCurrency } from '../repositories/preferences';
import { getSessionWhereSessionIsRequired } from '../utils/session';
import { logInfo } from '@/logging';
import type { SessionResponse } from '../schemas/responses';
import type { UpdatePreferencesPayload } from '../schemas/payloads';

async function preferencesHandler(c: HonoContext<string, { out: { json: UpdatePreferencesPayload } }>) {
  const session = getSessionWhereSessionIsRequired(c);

  const payload = c.req.valid('json');
  const updatedPreferredCurrency = payload.preferred_currency;

  await upsertUserPreferredCurrency(c, {
    userId: session.user.id,
    preferredCurrency: updatedPreferredCurrency,
  });

  const response = {
    ...session,
    user: {
      ...session.user,
      preferred_currency: updatedPreferredCurrency,
    },
  } satisfies SessionResponse;

  logInfo(withRequestLogger(c, { component: 'auth' }), {
    event: 'auth.preferences.updated',
    preference_key: 'preferred_currency',
    preferred_currency: updatedPreferredCurrency,
    user_id: session.user.id,
    outcome: 'success',
  });

  return c.json(response, { status: STATUS_CODES.OK });
}

export default preferencesHandler;
