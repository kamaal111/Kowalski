import latestRoute from './latest.ts';
import { openAPIRouterFactory } from '../../api/open-api.ts';
import latestHandler from '../handlers/latest.ts';

const forexCompatApi = openAPIRouterFactory();

forexCompatApi.openapi(latestRoute, latestHandler);

export default forexCompatApi;
