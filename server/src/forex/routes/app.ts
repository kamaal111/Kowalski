import { openAPIRouterFactory } from '@/api/open-api';
import latestHandler from '../handlers/latest';
import latestRoute from './latest';

const forexCompatApi = openAPIRouterFactory();

forexCompatApi.openapi(latestRoute, latestHandler);

export default forexCompatApi;
