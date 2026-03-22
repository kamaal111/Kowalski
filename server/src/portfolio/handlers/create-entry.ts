import type { HonoContext } from '@/api/contexts';
import type { CreateEntryPayload } from '../schemas/payloads';
import { STATUS_CODES } from '@/constants/http';
import { toISO8601String } from '@/utils/strings';
import { CreateEntryResponseSchema } from '../schemas/responses';
import createPortfolioEntry from '../services/create-entry';
import { getSessionWhereSessionIsRequired } from '@/auth';

async function createEntry(c: HonoContext<string, { out: { json: CreateEntryPayload } }>) {
  const session = getSessionWhereSessionIsRequired(c);

  const payload = c.req.valid('json');
  const createdEntry = await createPortfolioEntry(c, session.user.id, payload);

  const response = CreateEntryResponseSchema.parse({
    id: createdEntry.id,
    stock: payload.stock,
    amount: Number(createdEntry.amount),
    purchase_price: {
      currency: createdEntry.purchasePriceCurrency,
      value: Number(createdEntry.purchasePrice),
    },
    transaction_type: createdEntry.transactionType,
    transaction_date: getTransactionDateForResponse(createdEntry.transactionDate),
    created_at: toISO8601String(createdEntry.createdAt),
    updated_at: toISO8601String(createdEntry.updatedAt),
  });

  return c.json(response, STATUS_CODES.CREATED);
}

function getTransactionDateForResponse(transactionDate: string) {
  const [year, month, day] = transactionDate.split('-').map(Number);

  return toISO8601String(new Date(Date.UTC(year, month - 1, day)));
}

export default createEntry;
