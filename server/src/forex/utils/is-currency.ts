import { CURRENCY_SET } from '../constants.ts';
import type { Currency } from '../constants.ts';

function isCurrency(value: string): value is Currency {
  return CURRENCY_SET.has(value);
}

export default isCurrency;
