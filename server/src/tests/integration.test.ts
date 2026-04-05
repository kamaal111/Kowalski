import { integrationTest } from './fixtures';

integrationTest('should handle 404', async ({ app, expect, getLogsForRequestId, withRequestId }) => {
  const { headers, requestId } = withRequestId();
  const res = await app.request('/api/v1/unknown', { headers });
  expect(res.status).toBe(404);

  const logs = getLogsForRequestId(requestId);

  expect(logs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: 'request.started',
        request_id: requestId,
        method: 'GET',
        route: '/api/v1/unknown',
        url: 'http://localhost/api/v1/unknown',
      }),
      expect.objectContaining({
        event: 'request.completed',
        request_id: requestId,
        route: '/api/v1/unknown',
        status_code: 404,
        outcome: 'failure',
      }),
    ]),
  );
});
