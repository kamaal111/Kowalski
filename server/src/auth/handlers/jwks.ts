import type { HonoContext } from '../../api/contexts';

function jwksHandler(c: HonoContext) {
  return c.get('auth').handler(c.req.raw);
}

export default jwksHandler;
