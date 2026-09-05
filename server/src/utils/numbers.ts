import assert from 'node:assert/strict';

import { isNumber } from './type-guards.ts';

export function assertToFloat<T extends string | number>(num: T): number {
  const value = isNumber(num) ? num : Number.parseFloat(`${num}`);
  assert(!Number.isNaN(value));

  return value;
}
