import type { TypedResponse } from 'hono';

import { STATUS_CODES } from '@/constants/http';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import { mapPortfolioEntryToResponse } from '../mappers/entry-response';
import { addPreferredCurrencyPurchasePrices } from '../services/preferred-currency-purchase-price';
import bulkCreatePortfolioEntries from '../services/bulk-create-entries';
import type { BulkCreateEntriesPayload } from '../schemas/payloads';
import type { BulkCreateEntriesResponse } from '../schemas/responses';

async function bulkCreateEntries(
  c: HonoContext<string, { out: { json: BulkCreateEntriesPayload } }>,
): Promise<TypedResponse<BulkCreateEntriesResponse, typeof STATUS_CODES.CREATED>> {
  const payload = c.req.valid('json');
  const { createdEntries, skippedCount } = await bulkCreatePortfolioEntries(c, payload);
  const preferredCurrencyPurchasePrices = await addPreferredCurrencyPurchasePrices(
    c,
    createdEntries.map(entry => entry.transaction),
  );
  const response = createdEntries.map((createdEntry, index) => {
    const preferredCurrencyPurchasePrice =
      preferredCurrencyPurchasePrices[index]?.preferredCurrencyPurchasePrice ?? null;

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
