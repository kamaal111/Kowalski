import ForexItemExchangeRate from './forex-item-exchange-rate';
import type { ForexItemECPResponse } from '../schemas/collect';

class ForexItem {
  readonly rate: ForexItemExchangeRate;
  readonly date: Date;

  constructor({ rate, date }: { rate: ForexItemExchangeRate; date: Date }) {
    this.rate = rate;
    this.date = date;
  }

  static fromECBResponse(response: ForexItemECPResponse): ForexItem | null {
    const rawDate = response['dc:date']?.at(0);
    if (!rawDate) {
      return null;
    }

    const date = new Date(rawDate);
    const dateTime = date.getTime();
    if (dateTime === 0 || Number.isNaN(dateTime)) {
      return null;
    }

    const rawRate = response['cb:statistics']?.at(0)?.['cb:exchangeRate']?.at(0);
    if (!rawRate) {
      return null;
    }

    const rate = ForexItemExchangeRate.fromECBResponse(rawRate);
    if (!rate) {
      return null;
    }

    return new ForexItem({ rate, date });
  }
}

export default ForexItem;
