import { asserts } from '@kamaalio/kamaal';

import { BASE_CURRENCY, CURRENCIES, type Currency } from '../constants.js';

export class ExchangeRateRecord {
  readonly date: Date;
  readonly base: string;
  private _rates: Partial<Record<Currency, number>>;

  constructor({ date, base, rates }: { date: Date; base: string; rates: Partial<Record<Currency, number>> }) {
    this.date = date;
    this.base = base;
    this._rates = rates;
  }

  get rates(): Partial<Record<Currency, number>> {
    return this._rates;
  }

  get ratesAreEmpty(): boolean {
    return Object.keys(this.rates).length === 0;
  }

  get documentKey(): string {
    return `${this.base}-${this.dateString}`;
  }

  get dateString(): string {
    return this.date.toISOString().split('T')[0];
  }

  setRates(rates: Partial<Record<Currency, number>>): void {
    this._rates = rates;
  }

  addRate(currency: Currency, value: number): void {
    this.setRates({ ...this.rates, [currency]: value });
  }

  getRate(currency: Currency): number | undefined {
    return this.rates[currency];
  }

  toDocumentObject() {
    return {
      date: this.dateString,
      base: this.base,
      rates: this.rates,
    };
  }

  calculateRates(): ExchangeRateRecord[] {
    const ratesCurrencies = Object.keys(this.rates);
    const calculatedRates: ExchangeRateRecord[] = [];
    for (const newBaseCurrency of CURRENCIES) {
      if (newBaseCurrency === BASE_CURRENCY) {
        continue;
      }

      if (!ratesCurrencies.includes(newBaseCurrency)) {
        continue;
      }

      const newBaseCurrencyRate = this.getRate(newBaseCurrency);
      asserts.invariant(newBaseCurrencyRate != null);

      const newExchangeRate = new ExchangeRateRecord({
        date: this.date,
        base: newBaseCurrency,
        rates: { EUR: 1 / newBaseCurrencyRate },
      });
      for (const currency of CURRENCIES) {
        if (!ratesCurrencies.includes(currency) || currency === newBaseCurrency) {
          continue;
        }

        const currencyRate = this.getRate(currency);
        asserts.invariant(currencyRate != null);

        newExchangeRate.addRate(currency, currencyRate / newBaseCurrencyRate);
      }

      calculatedRates.push(newExchangeRate);
    }

    return calculatedRates;
  }
}
