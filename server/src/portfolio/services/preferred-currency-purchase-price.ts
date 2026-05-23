import { getSessionWhereSessionIsRequired } from '@/auth';
import type { HonoContext } from '@/api/contexts';
import type { Currency } from '@/forex/constants';
import type { CreateEntryResponse } from '../schemas/responses';
import { findLatestExchangeRateSnapshotByBase, type PersistedExchangeRateSnapshot } from '../repositories/list-entries';
import { ExchangeRateResolutionFailed } from '../exceptions';
import { assertToFloat } from '@/utils/numbers';

interface EntryWithPurchasePrice {
  purchasePrice: string | number;
  purchasePriceCurrency: Currency;
}

export interface EntryWithPreferredCurrencyPurchasePrice<TEntry> {
  entry: TEntry;
  preferredCurrencyPurchasePrice: CreateEntryResponse['preferred_currency_purchase_price'];
}

export async function addPreferredCurrencyPurchasePrices<TEntry extends EntryWithPurchasePrice>(
  c: HonoContext,
  entries: TEntry[],
): Promise<EntryWithPreferredCurrencyPurchasePrice<TEntry>[]> {
  const session = getSessionWhereSessionIsRequired(c);
  const preferredCurrency = session.user.preferred_currency;
  const exchangeRateSnapshot = await resolveExchangeRateSnapshotForPreferredCurrency(c, preferredCurrency, entries);

  return entries.map(entry => ({
    entry,
    preferredCurrencyPurchasePrice: convertPurchasePriceToPreferredCurrency({
      c,
      entry,
      preferredCurrency,
      exchangeRateSnapshot,
    }),
  }));
}

function convertPurchasePriceToPreferredCurrency<TEntry extends EntryWithPurchasePrice>({
  c,
  entry,
  preferredCurrency,
  exchangeRateSnapshot,
}: {
  c: HonoContext;
  entry: TEntry;
  preferredCurrency: Currency;
  exchangeRateSnapshot: PersistedExchangeRateSnapshot | undefined;
}): CreateEntryResponse['preferred_currency_purchase_price'] {
  const purchasePrice = assertToFloat(entry.purchasePrice);
  if (entry.purchasePriceCurrency === preferredCurrency) {
    return {
      currency: preferredCurrency,
      value: purchasePrice,
    };
  }

  if (exchangeRateSnapshot == null) {
    throw new ExchangeRateResolutionFailed(c);
  }

  const conversionRate = exchangeRateSnapshot.rates[entry.purchasePriceCurrency];
  if (typeof conversionRate !== 'number' || !Number.isFinite(conversionRate) || conversionRate <= 0) {
    throw new ExchangeRateResolutionFailed(c);
  }

  return { currency: preferredCurrency, value: purchasePrice / conversionRate };
}

async function resolveExchangeRateSnapshotForPreferredCurrency<TEntry extends EntryWithPurchasePrice>(
  c: HonoContext,
  preferredCurrency: Currency,
  entries: TEntry[],
) {
  for (const entry of entries) {
    if (entry.purchasePriceCurrency === preferredCurrency) {
      continue;
    }

    const exchangeRateSnapshot = await findLatestExchangeRateSnapshotByBase(c, preferredCurrency);
    if (exchangeRateSnapshot == null) {
      throw new ExchangeRateResolutionFailed(c);
    }

    return exchangeRateSnapshot;
  }

  return undefined;
}
