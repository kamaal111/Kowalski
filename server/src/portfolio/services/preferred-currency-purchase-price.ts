import { getSessionWhereSessionIsRequired } from '@/auth';
import type { HonoContext } from '@/api/contexts';
import type { CreateEntryResponse } from '../schemas/responses';
import { findLatestExchangeRateSnapshotByBase, type PersistedExchangeRateSnapshot } from '../repositories/list-entries';
import { assertToFloat } from '@/utils/numbers';

interface EntryWithPurchasePrice {
  purchasePrice: string | number;
  purchasePriceCurrency: string;
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
  const needsExchangeRateSnapshot =
    preferredCurrency != null && entries.some(entry => entry.purchasePriceCurrency !== preferredCurrency);
  const exchangeRateSnapshot = needsExchangeRateSnapshot
    ? await findLatestExchangeRateSnapshotByBase(c, preferredCurrency)
    : undefined;

  return entries.map(entry => ({
    entry,
    preferredCurrencyPurchasePrice: convertPurchasePriceToPreferredCurrency({
      entry,
      preferredCurrency,
      exchangeRateSnapshot,
    }),
  }));
}

function convertPurchasePriceToPreferredCurrency<TEntry extends EntryWithPurchasePrice>({
  entry,
  preferredCurrency,
  exchangeRateSnapshot,
}: {
  entry: TEntry;
  preferredCurrency: string | null;
  exchangeRateSnapshot: PersistedExchangeRateSnapshot | undefined;
}): CreateEntryResponse['preferred_currency_purchase_price'] {
  if (preferredCurrency == null) {
    return null;
  }

  const purchasePrice = assertToFloat(entry.purchasePrice);
  if (entry.purchasePriceCurrency === preferredCurrency) {
    return {
      currency: preferredCurrency,
      value: purchasePrice,
    };
  }

  if (exchangeRateSnapshot == null) {
    return null;
  }

  const conversionRate = exchangeRateSnapshot.rates[entry.purchasePriceCurrency];
  if (typeof conversionRate !== 'number' || !Number.isFinite(conversionRate) || conversionRate <= 0) {
    return null;
  }

  return { currency: preferredCurrency, value: purchasePrice / conversionRate };
}
