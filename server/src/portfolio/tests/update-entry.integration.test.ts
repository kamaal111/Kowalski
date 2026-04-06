import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';
import type { z } from 'zod';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { PortfolioEntryPathParamsSchema } from '../schemas/params';
import { CreateEntryPayloadSchema } from '../schemas/payloads';
import { CreateEntryResponseSchema } from '../schemas/responses';
import { seedExchangeRate, seedPortfolioEntry } from './helpers';
import { APP_API_BASE_PATH } from '@/constants/common';
import type { Database } from '@/db';
import { portfolioTransaction, stockTicker, userPreferences } from '@/db/schema';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';
import { createTestUserAndSession } from '@/tests/utils';

const UPDATE_ENTRY_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/entries`;
const UPDATE_ENTRY_ROUTE = `${UPDATE_ENTRY_PATH}/:entryId`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Update Portfolio Entry Route', () => {
  integrationTest(
    'updates a portfolio entry for an authenticated request',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const existingEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
          isin: 'US0378331005',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          exchangeDispatch: 'NASDAQ',
        },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150.5 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const payload = CreateEntryPayloadSchema.parse({
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Incorporated',
          isin: 'US0378331005',
          sector: 'Information Technology',
          industry: 'Hardware',
          exchange_dispatch: 'NASDAQ Global Select',
        },
        amount: 12,
        purchase_price: {
          currency: 'USD',
          value: 175.25,
        },
        transaction_type: 'sell',
        transaction_date: '2025-12-21T00:00:00.000Z',
      });
      const request = withRequestId(createUpdateEntryRequestHeaders(sessionToken));
      const response = await sendUpdateEntryRequest(
        app,
        existingEntry.id,
        {
          payload,
        },
        request.headers,
      );
      const logs = getLogsForRequestId(request.requestId);

      const body = await expectSuccessfulUpdateEntryResponse(response);
      const persistedState = await getPersistedTransactionState(db, body.id);
      const persistedTicker = await getPersistedTickerState(db, persistedState.tickerId);

      expect(body).toMatchObject({
        id: existingEntry.id,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Incorporated',
          isin: 'US0378331005',
          sector: 'Information Technology',
          industry: 'Hardware',
          exchange_dispatch: 'NASDAQ Global Select',
        },
        amount: 12,
        purchase_price: { currency: 'USD', value: 175.25 },
        preferred_currency_purchase_price: null,
        transaction_type: 'sell',
        transaction_date: '2025-12-21T00:00:00.000Z',
      });
      expect(persistedState).toMatchObject({
        id: existingEntry.id,
        transactionType: 'sell',
        transactionDate: '2025-12-21',
        amount: '12.0000000000',
        purchasePrice: '175.2500000000',
        purchasePriceCurrency: 'USD',
        tickerId: 'portfolio-stock:NMS:AAPL',
      });
      expect(persistedTicker).toMatchObject({
        id: 'portfolio-stock:NMS:AAPL',
        isin: 'US0378331005',
        name: 'Apple Incorporated',
        sector: 'Information Technology',
        industry: 'Hardware',
        exchangeDispatch: 'NASDAQ Global Select',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.entry.updated',
            request_id: request.requestId,
            component: 'portfolio',
            user_id: userId,
            route: `${UPDATE_ENTRY_PATH}/${existingEntry.id}`,
            entry_id: existingEntry.id,
            ticker_symbol: 'AAPL',
            transaction_type: 'sell',
          }),
          expect.objectContaining({
            event: 'portfolio.ticker.updated',
            request_id: request.requestId,
            component: 'portfolio',
            ticker_symbol: 'AAPL',
          }),
          expect.objectContaining({
            event: 'request.completed',
            request_id: request.requestId,
            route: UPDATE_ENTRY_ROUTE,
            user_id: userId,
          }),
        ]),
      );
    },
  );

  integrationTest(
    'returns preferred_currency_purchase_price when the updated entry can be converted',
    async ({ app, db, sessionToken, userId }) => {
      await db.insert(userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedExchangeRate(db, {
        base: 'EUR',
        date: '2026-03-29',
        rates: { USD: 1.1 },
      });
      const existingEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150.5 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const response = await sendUpdateEntryRequest(app, existingEntry.id, {
        payload: CreateEntryPayloadSchema.parse({
          stock: {
            symbol: 'AAPL',
            exchange: 'NMS',
            name: 'Apple Inc.',
            isin: 'US0378331005',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            exchange_dispatch: 'NASDAQ',
          },
          amount: 12,
          purchase_price: {
            currency: 'USD',
            value: 110,
          },
          transaction_type: 'sell',
          transaction_date: '2025-12-21T00:00:00.000Z',
        }),
        sessionToken,
      });
      const body = await expectSuccessfulUpdateEntryResponse(response);

      expect(body.preferred_currency_purchase_price?.currency).toBe('EUR');
      expect(body.preferred_currency_purchase_price?.value).toBeCloseTo(100);
    },
  );

  integrationTest(
    'updates a portfolio entry to a different stock ticker',
    async ({ app, db, sessionToken, userId }) => {
      const existingEntry = await seedPortfolioEntry(db, {
        userId,
        stock: {
          symbol: 'AAPL',
          exchange: 'NMS',
          name: 'Apple Inc.',
        },
        amount: 10,
        purchasePrice: { currency: 'USD', value: 150.5 },
        transactionType: 'buy',
        transactionDate: '2025-12-20T10:30:00.000Z',
      });

      const response = await sendUpdateEntryRequest(app, existingEntry.id, {
        payload: CreateEntryPayloadSchema.parse({
          stock: {
            symbol: 'MSFT',
            exchange: 'NMS',
            name: 'Microsoft Corporation',
            isin: 'US5949181045',
            sector: 'Technology',
            industry: 'Software - Infrastructure',
            exchange_dispatch: 'NASDAQ',
          },
          amount: 8,
          purchase_price: {
            currency: 'USD',
            value: 302.1,
          },
          transaction_type: 'buy',
          transaction_date: '2025-12-22T00:00:00.000Z',
        }),
        sessionToken,
      });

      const body = await expectSuccessfulUpdateEntryResponse(response);
      const persistedState = await getPersistedTransactionState(db, body.id);
      const persistedTicker = await getPersistedTickerState(db, persistedState.tickerId);

      expect(body.stock.symbol).toBe('MSFT');
      expect(persistedState.tickerId).toBe('portfolio-stock:NMS:MSFT');
      expect(persistedTicker).toMatchObject({
        id: 'portfolio-stock:NMS:MSFT',
        isin: 'US5949181045',
        name: 'Microsoft Corporation',
      });
    },
  );

  integrationTest('rejects a request without authentication', async ({ app }) => {
    const entryId = PortfolioEntryPathParamsSchema.parse({
      entryId: '550e8400-e29b-41d4-a716-446655440000',
    }).entryId;
    const response = await sendUpdateEntryRequest(app, entryId, {
      payload: createValidUpdateEntryPayload(),
    });

    await expectNotFoundErrorResponse(response);
  });

  integrationTest('rejects updating another user portfolio entry', async ({ app, db, sessionToken }) => {
    const otherUser = await createTestUserAndSession(db);
    const otherUsersEntry = await seedPortfolioEntry(db, {
      userId: otherUser.userId,
      stock: {
        symbol: 'AAPL',
        exchange: 'NMS',
        name: 'Apple Inc.',
      },
      amount: 10,
      purchasePrice: { currency: 'USD', value: 150.5 },
      transactionType: 'buy',
      transactionDate: '2025-12-20T10:30:00.000Z',
    });

    const response = await sendUpdateEntryRequest(app, otherUsersEntry.id, {
      payload: createValidUpdateEntryPayload(),
      sessionToken,
    });

    await expectNotFoundErrorResponse(response);
  });

  integrationTest('rejects updating a nonexistent portfolio entry', async ({ app, sessionToken }) => {
    const entryId = PortfolioEntryPathParamsSchema.parse({
      entryId: '550e8400-e29b-41d4-a716-446655440001',
    }).entryId;
    const response = await sendUpdateEntryRequest(app, entryId, {
      payload: createValidUpdateEntryPayload(),
      sessionToken,
    });

    await expectNotFoundErrorResponse(response);
  });

  integrationTest('rejects a request with a non-positive amount', async ({ app, sessionToken }) => {
    const entryId = PortfolioEntryPathParamsSchema.parse({
      entryId: '550e8400-e29b-41d4-a716-446655440000',
    }).entryId;
    const response = await sendUpdateEntryRequest(app, entryId, {
      payload: {
        ...createValidUpdateEntryPayload(),
        amount: 0,
      },
      sessionToken,
    });

    const body = await expectValidationErrorResponse(response);

    expectValidationIssueForField(body, 'amount');
  });
});

function createValidUpdateEntryPayload() {
  return CreateEntryPayloadSchema.parse({
    stock: {
      symbol: 'AAPL',
      exchange: 'NMS',
      name: 'Apple Inc.',
      isin: 'US0378331005',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      exchange_dispatch: 'NASDAQ',
    },
    amount: 10,
    purchase_price: {
      currency: 'USD',
      value: 150.5,
    },
    transaction_type: 'buy',
    transaction_date: '2025-12-20T10:30:00.000Z',
  });
}

async function sendUpdateEntryRequest(
  app: AppRequestClient,
  entryId: string,
  options: {
    payload: z.input<typeof CreateEntryPayloadSchema>;
    sessionToken?: string;
  },
  headers?: Headers,
) {
  return app.request(`${UPDATE_ENTRY_PATH}/${entryId}`, {
    method: 'PUT',
    headers: headers ?? createUpdateEntryRequestHeaders(options.sessionToken),
    body: JSON.stringify(options.payload),
  });
}

function createUpdateEntryRequestHeaders(sessionToken?: string) {
  const headers = new Headers();

  headers.set('Content-Type', 'application/json');

  if (sessionToken != null) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return headers;
}

async function expectSuccessfulUpdateEntryResponse(response: Response) {
  expect(response.status).toBe(200);

  return CreateEntryResponseSchema.parse(await response.json());
}

async function expectValidationErrorResponse(response: Response) {
  expect(response.status).toBe(400);

  return ValidationErrorResponseSchema.parse(await response.json());
}

async function expectNotFoundErrorResponse(response: Response) {
  expect(response.status).toBe(404);

  return ErrorResponseSchema.parse(await response.json());
}

function expectValidationIssueForField(body: z.infer<typeof ValidationErrorResponseSchema>, field: string) {
  expect(body.context?.validations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: [field],
      }),
    ]),
  );
}

async function getPersistedTransactionState(db: Database, entryId: string) {
  const transactions = await db
    .select({
      id: portfolioTransaction.id,
      transactionType: portfolioTransaction.transactionType,
      transactionDate: portfolioTransaction.transactionDate,
      amount: portfolioTransaction.amount,
      purchasePrice: portfolioTransaction.purchasePrice,
      purchasePriceCurrency: portfolioTransaction.purchasePriceCurrency,
      tickerId: portfolioTransaction.tickerId,
    })
    .from(portfolioTransaction)
    .where(eq(portfolioTransaction.id, entryId))
    .limit(1);
  const transaction = transactions.at(0);
  if (transaction == null) {
    throw new Error(`Missing persisted transaction for ${entryId}`);
  }

  return transaction;
}

async function getPersistedTickerState(db: Database, tickerId: string) {
  const tickers = await db
    .select({
      id: stockTicker.id,
      isin: stockTicker.isin,
      name: stockTicker.name,
      sector: stockTicker.sector,
      industry: stockTicker.industry,
      exchangeDispatch: stockTicker.exchangeDispatch,
    })
    .from(stockTicker)
    .where(eq(stockTicker.id, tickerId))
    .limit(1);
  const ticker = tickers.at(0);
  if (ticker == null) {
    throw new Error(`Missing persisted ticker for ${tickerId}`);
  }

  return ticker;
}
