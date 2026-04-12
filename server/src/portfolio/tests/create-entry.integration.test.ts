import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';
import type { z } from 'zod';

import { PORTFOLIO_ROUTE_NAME } from '..';
import { CreateEntryPayloadSchema } from '../schemas/payloads';
import { CreateEntryResponseSchema } from '../schemas/responses';
import { seedExchangeRate } from './helpers';
import { APP_API_BASE_PATH } from '@/constants/common';
import type { Database } from '@/db';
import { portfolio, portfolioTransaction, stockTicker, user, userPreferences } from '@/db/schema';
import { ErrorResponseSchema, ValidationErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';

const CREATE_ENTRY_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/entries`;
const LEGACY_CREATE_ENTRY_PATH = `${APP_API_BASE_PATH}${PORTFOLIO_ROUTE_NAME}/entry`;

interface AppRequestClient {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
}

describe('Create Portfolio Entry Route', () => {
  integrationTest(
    'creates a portfolio entry for an authenticated request',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      const request = withRequestId(createCreateEntryRequestHeaders(sessionToken));
      const response = await sendCreateEntryRequest(
        app,
        {
          payload: createValidCreateEntryPayload(),
        },
        CREATE_ENTRY_PATH,
        request.headers,
      );
      const logs = getLogsForRequestId(request.requestId);

      const body = await expectSuccessfulCreateEntryResponse(response);
      const persistedState = await getPersistedPortfolioState(db, body.stock.symbol);

      expect(body).toMatchObject({
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
        purchase_price: { currency: 'USD', value: 150.5 },
        preferred_currency_purchase_price: null,
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
        isin: 'US0378331005',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        exchangeDispatch: 'NASDAQ',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.default_portfolio.created',
            request_id: request.requestId,
            component: 'portfolio',
          }),
          expect.objectContaining({
            event: 'portfolio.entry.created',
            request_id: request.requestId,
            component: 'portfolio',
            user_id: userId,
            route: CREATE_ENTRY_PATH,
            ticker_symbol: 'AAPL',
            transaction_type: 'buy',
          }),
          expect.objectContaining({
            event: 'request.completed',
            request_id: request.requestId,
            route: CREATE_ENTRY_PATH,
            user_id: userId,
          }),
        ]),
      );
    },
  );

  integrationTest(
    'returns preferred_currency_purchase_price when the created entry can be converted',
    async ({ app, db, sessionToken, userId }) => {
      await db.insert(userPreferences).values({ userId, preferredCurrency: 'EUR' });
      await seedExchangeRate(db, {
        base: 'EUR',
        date: '2026-03-29',
        rates: { USD: 1.1 },
      });

      const response = await sendCreateEntryRequest(app, {
        payload: {
          ...createValidCreateEntryPayload(),
          purchase_price: {
            currency: 'USD',
            value: 110,
          },
        },
        sessionToken,
      });
      const body = await expectSuccessfulCreateEntryResponse(response);

      expect(body.preferred_currency_purchase_price?.currency).toBe('EUR');
      expect(body.preferred_currency_purchase_price?.value).toBeCloseTo(100);
    },
  );

  integrationTest(
    'returns an internal server error when creating an entry needs FX data that is missing',
    async ({ app, db, sessionToken, userId, getLogsForRequestId, withRequestId }) => {
      await db.insert(userPreferences).values({ userId, preferredCurrency: 'EUR' });

      const request = withRequestId(createCreateEntryRequestHeaders(sessionToken));
      const response = await sendCreateEntryRequest(
        app,
        {
          payload: {
            ...createValidCreateEntryPayload(),
            purchase_price: {
              currency: 'USD',
              value: 110,
            },
          },
        },
        CREATE_ENTRY_PATH,
        request.headers,
      );
      const body = await expectInternalServerErrorResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        message: 'Failed to resolve foreign exchange rates',
        code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.error',
            request_id: request.requestId,
            route: CREATE_ENTRY_PATH,
            status_code: 500,
            error_code: 'EXCHANGE_RATE_RESOLUTION_FAILED',
          }),
        ]),
      );
    },
  );

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

  integrationTest(
    'updates the existing stock ticker details when they change',
    async ({ app, db, sessionToken, getLogsForRequestId, withRequestId }) => {
      await sendCreateEntryRequest(app, {
        payload: createPayloadWithNullIsin(),
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
      const request = withRequestId(createCreateEntryRequestHeaders(sessionToken));
      const secondResponse = await sendCreateEntryRequest(
        app,
        { payload: updatedPayload },
        CREATE_ENTRY_PATH,
        request.headers,
      );
      const logs = getLogsForRequestId(request.requestId);

      await expectSuccessfulCreateEntryResponse(secondResponse);

      const persistedState = await getPersistedPortfolioState(db, 'AAPL');

      expect(persistedState.tickers).toHaveLength(1);
      expect(persistedState.tickers[0]).toMatchObject({
        isin: 'US0378331005',
        name: 'Apple Incorporated',
        sector: 'Information Technology',
        industry: 'Hardware',
        exchangeDispatch: 'NASDAQ Global Select',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'portfolio.ticker.updated',
            request_id: request.requestId,
            component: 'portfolio',
            ticker_symbol: 'AAPL',
          }),
        ]),
      );
    },
  );

  integrationTest('accepts create-entry payloads when stock isin is omitted', async ({ app, sessionToken, expect }) => {
    const payload = createPayloadWithoutIsin();
    const response = await sendCreateEntryRequest(app, {
      payload,
      sessionToken,
    });

    expect(response.status).toBe(201);
    const body = await expectSuccessfulCreateEntryResponse(response);

    expect(body.stock.isin).toBe('PORTFOLIO-NMS-LBTYA');
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

function createPayloadWithNullIsin() {
  return {
    ...createValidCreateEntryPayload(),
    stock: {
      ...createValidCreateEntryPayload().stock,
      isin: null,
    },
  };
}

function createPayloadWithoutIsin() {
  const payloadWithIsin = createValidCreateEntryPayload();
  const { isin: _isin, ...stockWithoutIsin } = payloadWithIsin.stock;

  return {
    ...payloadWithIsin,
    stock: {
      ...stockWithoutIsin,
      symbol: 'LBTYA',
      name: 'Liberty Global Ltd.',
      sector: 'Communication Services',
      industry: 'Telecom Services',
    },
  };
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
  headers?: Headers,
) {
  return app.request(path, {
    method: 'POST',
    headers: headers ?? createCreateEntryRequestHeaders(options.sessionToken),
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

async function expectInternalServerErrorResponse(response: Response) {
  expect(response.status).toBe(500);

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
