import { openAPIRouterFactory } from '../../api/open-api.ts';
import collect from '../handlers/collect.ts';

const forexApi = openAPIRouterFactory();

forexApi.post('/collect', collect);

export default forexApi;
