import { CURRENCY_SET } from '../constants';
import type { Currency } from '../constants';

function isCurrency(value: string): value is Currency {
  return CURRENCY_SET.has(value);
}

export default isCurrency;
