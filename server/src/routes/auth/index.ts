import { openAPIRouterFactory } from '../../api/open-api.js';

const authApi = openAPIRouterFactory();

authApi.on(['POST', 'GET'], 'auth/**', c => c.get('auth').handler(c.req.raw));

export default authApi;
