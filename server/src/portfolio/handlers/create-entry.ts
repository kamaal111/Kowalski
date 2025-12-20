import type { HonoContext } from '@/api/contexts.js';
import type { CreateEntryPayload } from '../schemas/payloads.js';
import { STATUS_CODES } from '@/constants/http.js';

function createEntry(c: HonoContext<string, { out: { body: CreateEntryPayload } }>) {
  const now = new Date().toISOString();

  return c.json(
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      stock: {
        symbol: 'AAPL',
        exchange: 'NMS',
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        exchange_dispatch: 'NASDAQ',
      },
      amount: 10,
      purchase_price: { currency: 'USD', value: 150.5 },
      transaction_type: 'buy' as const,
      transaction_date: now,
      created_at: now,
      updated_at: now,
    },
    STATUS_CODES.CREATED,
  );
}

export default createEntry;
