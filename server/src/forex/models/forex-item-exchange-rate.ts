import type { Currency } from '../constants.js';
import type { ForexItemExchangeRateECBResponse } from '../schemas/collect.js';
import isCurrency from '../utils/is-currency.js';

class ForexItemExchangeRate {
  readonly value: number;
  readonly base: Currency;
  readonly target: Currency;

  constructor({ value, base, target }: { value: number; base: Currency; target: Currency }) {
    this.value = value;
    this.base = base;
    this.target = target;
  }

  static fromECBResponse(response: ForexItemExchangeRateECBResponse): ForexItemExchangeRate | null {
    const rawValue = response['cb:value']?.at(0)?._;
    if (!rawValue) {
      return null;
    }

    const value = Number(rawValue);
    if (Number.isNaN(value)) {
      return null;
    }

    const base = response['cb:baseCurrency']?.at(0)?._;
    if (!base || !isCurrency(base)) {
      return null;
    }

    const target = response['cb:targetCurrency']?.at(0);
    if (!target || !isCurrency(target)) {
      return null;
    }

    return new ForexItemExchangeRate({ value, base, target });
  }
}

export default ForexItemExchangeRate;
