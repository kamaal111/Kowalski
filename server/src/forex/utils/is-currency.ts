import { CURRENCIES, type Currency } from '../constants';

function isCurrency(value: string): value is Currency {
  return CURRENCIES.has(value as Currency);
}

export default isCurrency;
