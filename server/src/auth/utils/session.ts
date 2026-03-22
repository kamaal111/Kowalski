import assert from 'node:assert/strict';

import type { HonoContext } from '@/api/contexts';

export function getSessionWhereSessionIsRequired(c: HonoContext) {
  const session = c.get('session');
  assert(session != null);

  return session;
}
