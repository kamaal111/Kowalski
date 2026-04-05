import { eq } from 'drizzle-orm';

import type { HonoContext } from '../../api/contexts';
import { APP_API_BASE_PATH } from '../../constants/common';
import { STATUS_CODES } from '../../constants/http';
import { setRequestRoute, setRequestUserId, withRequestLogger } from '@/logging/http';
import { ROUTE_NAME } from '../constants';
import { getSessionWhereSessionIsRequired } from '../utils/session';
import { user } from '../../db/schema/better-auth';
import { logInfo } from '@/logging';
import preferencesRoute from '../routes/preferences';
import type { SessionResponse } from '../schemas/responses';
import type { UpdatePreferencesPayload } from '../schemas/payloads';

const PREFERENCES_ROUTE_PATH = `${APP_API_BASE_PATH}${ROUTE_NAME}${preferencesRoute.path}` as const;

async function preferencesHandler(c: HonoContext<string, { out: { json: UpdatePreferencesPayload } }>) {
  const session = getSessionWhereSessionIsRequired(c);
  setRequestRoute(c, PREFERENCES_ROUTE_PATH);
  setRequestUserId(c, session.user.id);

  const payload = c.req.valid('json');
  const updatedPreferredCurrency = payload.preferred_currency;

  await c
    .get('db')
    .update(user)
    .set({ preferredCurrency: updatedPreferredCurrency })
    .where(eq(user.id, session.user.id));

  const response = {
    ...session,
    user: {
      ...session.user,
      preferred_currency: updatedPreferredCurrency,
    },
  } satisfies SessionResponse;

  logInfo(withRequestLogger(c, { component: 'auth' }), {
    event: 'auth.preferences.updated',
    user_id: session.user.id,
    outcome: 'success',
  });

  return c.json(response, { status: STATUS_CODES.OK });
}

export default preferencesHandler;
