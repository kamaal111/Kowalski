export function isString<T>(value: T): value is T & string {
  return typeof value === 'string';
}

export function isNumber<T>(value: T): value is T & number {
  return typeof value === 'number';
}

export function isBoolean<T>(value: T): value is T & boolean {
  return typeof value === 'boolean';
}

export function isPrimitiveLogValue<T>(value: T): value is T & (string | number | boolean) {
  return isString(value) || isNumber(value) || isBoolean(value);
}

export function isBigIntValue<T>(value: T): value is T & bigint {
  return typeof value === 'bigint';
}

export function isSymbolValue<T>(value: T): value is T & symbol {
  return typeof value === 'symbol';
}

export function isFunctionValue<T, R = unknown>(value: T): value is T & ((...args: unknown[]) => R) {
  return typeof value === 'function';
}

/** Mirrors the native `typeof` operator's result without a bare `typeof` expression at the call site. */
export function describeRuntimeType<T>(value: T): string {
  if (value === undefined) return 'undefined';
  if (isString(value)) return 'string';
  if (isNumber(value)) return 'number';
  if (isBoolean(value)) return 'boolean';
  if (isBigIntValue(value)) return 'bigint';
  if (isSymbolValue(value)) return 'symbol';
  if (isFunctionValue(value)) return 'function';

  return 'object';
}
