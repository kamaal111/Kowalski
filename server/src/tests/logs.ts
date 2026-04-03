import { REQUEST_ID_HEADER_NAME } from '@/constants/common';
import { createMemoryLogDestination, setRootLoggerDestination } from '@/logging';

const rawLogs: string[] = [];

interface StructuredLog {
  event?: string;
  request_id?: string;
  route?: string;
  path?: string;
  url?: string;
  method?: string;
  status_code?: number;
  duration_ms?: number;
  outcome?: string;
  user_id?: string;
  error_code?: string;
  error_name?: string;
  result_count?: number;
  stored_count?: number;
  transaction_type?: string;
  cache_status?: string;
  validation_issue_count?: number;
  validation_issue_paths?: string[];
  [key: string]: unknown;
}

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

function getStructuredLogs(): StructuredLog[] {
  return rawLogs.flatMap(chunk =>
    chunk
      .split('\n')
      .filter(line => line.trim().length > 0)
      .flatMap(parseStructuredLog),
  );
}

function parseStructuredLog(line: string): StructuredLog[] {
  try {
    const parsed: unknown = JSON.parse(line);
    return isStructuredLog(parsed) ? [parsed] : [];
  } catch {
    return [];
  }
}

function isStructuredLog(value: unknown): value is StructuredLog {
  return value != null && typeof value === 'object';
}
