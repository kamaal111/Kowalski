import { REQUEST_ID_HEADER_NAME } from '../constants/common.ts';
import { createMemoryLogDestination, setRootLoggerDestination } from '../logging/index.ts';
import { parseJsonRecord } from './json.ts';

const rawLogs: string[] = [];

export function initializeTestLogs() {
  setRootLoggerDestination(createMemoryLogDestination(rawLogs));
}

export function createTestRequestId() {
  return `test-${crypto.randomUUID()}`;
}

export function withRequestId(headers: HeadersInit = {}, requestId = createTestRequestId()) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set(REQUEST_ID_HEADER_NAME, requestId);

  return { headers: requestHeaders, requestId };
}

export function getLogsForRequestId(requestId: string) {
  return getStructuredLogs().filter(log => log.request_id === requestId);
}

function getStructuredLogs() {
  return rawLogs.flatMap(chunk =>
    chunk
      .split('\n')
      .filter(line => line.trim().length > 0)
      .flatMap(line => {
        const record = parseJsonRecord(line);
        return record == null ? [] : [record];
      }),
  );
}
