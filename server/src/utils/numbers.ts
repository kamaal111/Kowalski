import assert from 'node:assert/strict';

export function assertToFloat<T extends string | number>(num: T): number {
  const value = typeof num === 'number' ? num : parseFloat(num);
  assert(!Number.isNaN(value));

  return value;
}
