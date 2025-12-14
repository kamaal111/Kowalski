import type { HonoContext } from '../../api/contexts.js';

function jwksHandler(c: HonoContext) {
  return c.get('auth').handler(c.req.raw);
}

export default jwksHandler;
