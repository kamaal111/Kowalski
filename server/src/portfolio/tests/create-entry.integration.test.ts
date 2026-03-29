import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';
import { z } from 'zod';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { CreateEntryPayloadSchema } from '../schemas/payloads';
import { CreateEntryResponseSchema } from '../schemas/responses';
import { APP_API_BASE_PATH } from '@/constants/common';
import type { Database } from '@/db';
import { portfolio, portfolioTransaction, stockTicker, user } from '@/db/schema';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';

const CREATE_ENTRY_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/entries`;
const LEGACY_CREATE_ENTRY_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/entry`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Create Portfolio Entry Route', () => {
  integrationTest('creates a portfolio entry for an authenticated request', async ({ app, db, sessionToken }) => {
    const response = await sendCreateEntryRequest(app, {
      payload: createValidCreateEntryPayload(),
      sessionToken,
    });

    const body = await expectSuccessfulCreateEntryResponse(response);
    const persistedState = await getPersistedPortfolioState(db, body.stock.symbol);

    expect(body).toMatchObject({
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
      transaction_type: 'buy',
      transaction_date: '2025-12-20T00:00:00.000Z',
    });
    expect(persistedState.portfolios).toHaveLength(1);
    expect(persistedState.transactions).toHaveLength(1);
    expect(persistedState.tickers).toHaveLength(1);
    expect(persistedState.transactions[0]).toMatchObject({
      id: body.id,
      transactionType: 'buy',
      transactionDate: '2025-12-20',
      amount: '10.0000000000',
      purchasePrice: '150.5000000000',
      purchasePriceCurrency: 'USD',
      portfolioId: persistedState.portfolios[0].id,
      tickerId: persistedState.tickers[0].id,
    });
    expect(persistedState.tickers[0]).toMatchObject({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      exchangeDispatch: 'NASDAQ',
    });
  });

  integrationTest(
    'reuses the default portfolio and stock ticker for repeated creates',
    async ({ app, db, sessionToken }) => {
      await sendCreateEntryRequest(app, {
        payload: createValidCreateEntryPayload(),
        sessionToken,
      });

      const secondResponse = await sendCreateEntryRequest(app, {
        payload: {
          ...createValidCreateEntryPayload(),
          amount: 12,
          purchase_price: {
            currency: 'USD',
            value: 175.25,
          },
        },
        sessionToken,
      });

      await expectSuccessfulCreateEntryResponse(secondResponse);

      const persistedState = await getPersistedPortfolioState(db, 'AAPL');

      expect(persistedState.portfolios).toHaveLength(1);
      expect(persistedState.transactions).toHaveLength(2);
      expect(persistedState.tickers).toHaveLength(1);
    },
  );

  integrationTest('updates the existing stock ticker details when they change', async ({ app, db, sessionToken }) => {
    await sendCreateEntryRequest(app, {
      payload: createValidCreateEntryPayload(),
      sessionToken,
    });

    const updatedPayload = {
      ...createValidCreateEntryPayload(),
      stock: {
        ...createValidCreateEntryPayload().stock,
        name: 'Apple Incorporated',
        sector: 'Information Technology',
        industry: 'Hardware',
        exchange_dispatch: 'NASDAQ Global Select',
      },
    };
    const secondResponse = await sendCreateEntryRequest(app, {
      payload: updatedPayload,
      sessionToken,
    });

    await expectSuccessfulCreateEntryResponse(secondResponse);

    const persistedState = await getPersistedPortfolioState(db, 'AAPL');

    expect(persistedState.tickers).toHaveLength(1);
    expect(persistedState.tickers[0]).toMatchObject({
      name: 'Apple Incorporated',
      sector: 'Information Technology',
      industry: 'Hardware',
      exchangeDispatch: 'NASDAQ Global Select',
    });
  });

  integrationTest('rejects a request without authentication', async ({ app }) => {
    const response = await sendCreateEntryRequest(app, {
      payload: createValidCreateEntryPayload(),
    });

    await expectNotFoundErrorResponse(response);
  });

  integrationTest('rejects a request with a non-positive amount', async ({ app, sessionToken }) => {
    const response = await sendCreateEntryRequest(app, {
      payload: createPayloadWithNonPositiveAmount(),
      sessionToken,
    });

    const body = await expectValidationErrorResponse(response);

    expectValidationIssueForField(body, 'amount');
  });

  integrationTest('no longer serves the legacy singular path', async ({ app, sessionToken }) => {
    const response = await sendCreateEntryRequest(
      app,
      {
        payload: createValidCreateEntryPayload(),
        sessionToken,
      },
      LEGACY_CREATE_ENTRY_PATH,
    );

    await expectNotFoundErrorResponse(response);
  });
});

function createValidCreateEntryPayload() {
  return CreateEntryPayloadSchema.parse({
    stock: {
      symbol: 'AAPL',
      exchange: 'NMS',
      name: 'Apple Inc.',
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

function createPayloadWithNonPositiveAmount() {
  return {
    ...createValidCreateEntryPayload(),
    amount: 0,
  };
}

async function sendCreateEntryRequest(
  app: AppRequestClient,
  options: {
    payload: unknown;
    sessionToken?: string;
  },
  path = CREATE_ENTRY_PATH,
) {
  return app.request(path, {
    method: 'POST',
    headers: createCreateEntryRequestHeaders(options.sessionToken),
    body: JSON.stringify(options.payload),
  });
}

function createCreateEntryRequestHeaders(sessionToken?: string) {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (sessionToken != null) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return headers;
}

async function expectSuccessfulCreateEntryResponse(response: Response) {
  expect(response.status).toBe(201);

  return CreateEntryResponseSchema.parse(await response.json());
}

async function expectNotFoundErrorResponse(response: Response) {
  expect(response.status).toBe(404);

  return ErrorResponseSchema.parse(await response.json());
}

async function expectValidationErrorResponse(response: Response) {
  expect(response.status).toBe(400);

  return ValidationErrorResponseSchema.parse(await response.json());
}

function expectValidationIssueForField(body: z.infer<typeof ValidationErrorResponseSchema>, fieldName: string) {
  const hasMatchingIssue = body.context?.validations.some(issue => issue.path.includes(fieldName)) ?? false;

  expect(hasMatchingIssue).toBe(true);
}

async function getPersistedPortfolioState(db: Database, symbol: string) {
  const currentUser = await db.select({ id: user.id, email: user.email }).from(user).limit(1);
  const userId = currentUser.at(0)?.id;
  if (userId == null) {
    throw new Error('Expected a persisted user');
  }

  const portfolios = await db.select().from(portfolio).where(eq(portfolio.userId, userId));
  const tickers = await db.select().from(stockTicker).where(eq(stockTicker.symbol, symbol));
  const portfolioId = portfolios.at(0)?.id;
  if (portfolioId == null) {
    throw new Error('Expected a persisted portfolio');
  }

  const transactions = await db
    .select()
    .from(portfolioTransaction)
    .where(eq(portfolioTransaction.portfolioId, portfolioId));

  return { portfolios, tickers, transactions };
}
