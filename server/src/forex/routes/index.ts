import { openAPIRouterFactory } from '../../api/open-api.js';
import collect from '../handlers/collect.js';

const forexApi = openAPIRouterFactory();

forexApi.post('/collect', collect);

export default forexApi;
