import { openAPIRouterFactory } from '../../api/open-api';
import collect from '../handlers/collect';

const forexApi = openAPIRouterFactory();

forexApi.post('/collect', collect);

export default forexApi;
