interface RefreshState {
  promise: Promise<void> | null;
  completedAt: Date | null;
  startedAt: Date | null;
}

export type RefreshStatus = (typeof HOLDINGS_REFRESH_STATUSES)[keyof typeof HOLDINGS_REFRESH_STATUSES];
export type RunOnceResult = (typeof RUN_ONCE_RESULTS)[keyof typeof RUN_ONCE_RESULTS];

export const HOLDINGS_REFRESH_STATUSES = {
  IDLE: 'idle',
  REFRESHING: 'refreshing',
  COMPLETED: 'completed',
} as const;

export const RUN_ONCE_RESULTS = {
  STARTED: 'started',
  REUSED: 'reused',
  COMPLETED: 'completed',
} as const;

const states = new Map<string, RefreshState>();

export function getHoldingsRefreshStatus(key: string): RefreshStatus {
  const state = states.get(key);
  if (state == null) {
    return HOLDINGS_REFRESH_STATUSES.IDLE;
  }

  if (state.promise != null) {
    return HOLDINGS_REFRESH_STATUSES.REFRESHING;
  }

  if (state.completedAt != null) {
    return HOLDINGS_REFRESH_STATUSES.COMPLETED;
  }

  return HOLDINGS_REFRESH_STATUSES.IDLE;
}

export function runHoldingsRefreshOnce(key: string, task: () => Promise<void>): RunOnceResult {
  const existingState = states.get(key);
  if (existingState?.promise != null) {
    return RUN_ONCE_RESULTS.REUSED;
  }

  if (existingState?.completedAt != null) {
    return RUN_ONCE_RESULTS.COMPLETED;
  }

  const state: RefreshState = {
    promise: null,
    completedAt: null,
    startedAt: new Date(),
  };
  state.promise = task().finally(() => {
    state.promise = null;
    state.completedAt = new Date();
  });
  states.set(key, state);

  return RUN_ONCE_RESULTS.STARTED;
}

export function clearExpiredHoldingsRefreshStates(currentUtcDate: string) {
  for (const key of states.keys()) {
    if (!key.endsWith(`:${currentUtcDate}`)) {
      states.delete(key);
    }
  }
}

export function resetHoldingsRefreshCoordinatorForTests() {
  states.clear();
}
