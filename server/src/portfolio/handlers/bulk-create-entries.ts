import type { BulkCreateEntriesRouteResponse } from '../routes/bulk-create-entries.ts';

import { STATUS_CODES } from '../../constants/http.ts';
import { logError, logInfo } from '../../logging/index.ts';
import { withRequestLogger } from '../../logging/http.ts';
import type { HonoContext } from '../../api/contexts.ts';
import { mapPortfolioEntryToResponse } from '../mappers/entry-response.ts';
import { addPreferredCurrencyPurchasePrices } from '../services/preferred-currency-purchase-price.ts';
import bulkCreatePortfolioEntries from '../services/bulk-create-entries.ts';
import { PreferredCurrencyPurchasePriceResolutionFailed } from '../exceptions.ts';
import type { BulkCreateEntriesPayload } from '../schemas/payloads.ts';

async function bulkCreateEntries(
  c: HonoContext<string, { out: { json: BulkCreateEntriesPayload } }>,
): Promise<BulkCreateEntriesRouteResponse> {
  const payload = c.req.valid('json');
  const { createdEntries, skippedCount } = await bulkCreatePortfolioEntries(c, payload);
  const preferredCurrencyPurchasePrices = await addPreferredCurrencyPurchasePrices(
    c,
    createdEntries.map(entry => entry.transaction),
  );
  const response = createdEntries.map((createdEntry, index) => {
    const preferredCurrencyPurchasePrice = preferredCurrencyPurchasePrices[index]?.preferredCurrencyPurchasePrice;
    if (preferredCurrencyPurchasePrice == null) {
      const error = new PreferredCurrencyPurchasePriceResolutionFailed(c);
      logError(
        withRequestLogger(c, { component: 'portfolio' }),
        {
          event: 'portfolio.entries.bulk_create.preferred_currency_purchase_price_resolution_failed',
          entry_id: createdEntry.transaction.id,
          missing_index: index,
          created_count: createdEntries.length,
          resolved_count: preferredCurrencyPurchasePrices.length,
          outcome: 'failure',
        },
        error,
        'Bulk create produced an entry without a preferred currency purchase price',
      );

      throw error;
    }

    return mapPortfolioEntryToResponse({
      id: createdEntry.transaction.id,
      stock: createdEntry.stock,
      amount: createdEntry.transaction.amount,
      purchasePrice: createdEntry.transaction.purchasePrice,
      purchasePriceCurrency: createdEntry.transaction.purchasePriceCurrency,
      preferredCurrencyPurchasePrice,
      transactionType: createdEntry.transaction.transactionType,
      transactionDate: createdEntry.transaction.transactionDate,
      createdAt: createdEntry.transaction.createdAt,
      updatedAt: createdEntry.transaction.updatedAt,
    });
  });

  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.entries.bulk_created',
    created_count: response.length,
    skipped_count: skippedCount,
    total_count: payload.entries.length,
    outcome: 'success',
  });

  return c.json(response, STATUS_CODES.CREATED);
}

export default bulkCreateEntries;
