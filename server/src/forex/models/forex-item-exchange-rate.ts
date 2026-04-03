import type { Currency } from '../constants';
import type { ForexItemExchangeRateECBResponse } from '../schemas/collect';
import isCurrency from '../utils/is-currency';

interface XMLTextNode {
  _: string;
}

type ECBResponseValue = string | XMLTextNode | undefined;

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
    const rawValue = getXmlTextValue(response['cb:value']?.at(0));
    if (!rawValue) {
      return null;
    }

    const value = Number(rawValue);
    if (Number.isNaN(value)) {
      return null;
    }

    const base = getXmlTextValue(response['cb:baseCurrency']?.at(0));
    if (!base || !isCurrency(base)) {
      return null;
    }

    const target = getXmlTextValue(response['cb:targetCurrency']?.at(0));
    if (!target || !isCurrency(target)) {
      return null;
    }

    return new ForexItemExchangeRate({ value, base, target });
  }
}

function getXmlTextValue(value: ECBResponseValue) {
  if (typeof value === 'string') {
    return value;
  }

  return value?._;
}

export default ForexItemExchangeRate;
