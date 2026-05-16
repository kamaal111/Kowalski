import type { HonoContext } from '@/api/contexts';
import { APIException } from '@/api/exceptions';
import { STATUS_CODES, type StatusCode } from '@/constants/http';

type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const ERROR_CODES = {
  DEFAULT_PORTFOLIO_CREATE_FAILED: 'DEFAULT_PORTFOLIO_CREATE_FAILED',
  STOCK_TICKER_CREATE_FAILED: 'STOCK_TICKER_CREATE_FAILED',
  PORTFOLIO_ENTRY_CREATE_FAILED: 'PORTFOLIO_ENTRY_CREATE_FAILED',
  PORTFOLIO_ENTRY_UPDATE_FAILED: 'PORTFOLIO_ENTRY_UPDATE_FAILED',
  STOCK_PRICE_FETCH_FAILED: 'STOCK_PRICE_FETCH_FAILED',
  EXCHANGE_RATE_RESOLUTION_FAILED: 'EXCHANGE_RATE_RESOLUTION_FAILED',
  INVALID_TICKER_ID: 'INVALID_TICKER_ID',
} as const;

const CODE_TO_STATUS: Record<ErrorCode, StatusCode> = {
  DEFAULT_PORTFOLIO_CREATE_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
  STOCK_TICKER_CREATE_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
  PORTFOLIO_ENTRY_CREATE_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
  PORTFOLIO_ENTRY_UPDATE_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
  STOCK_PRICE_FETCH_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
  EXCHANGE_RATE_RESOLUTION_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
  INVALID_TICKER_ID: STATUS_CODES.INTERNAL_SERVER_ERROR,
};

const CODE_TO_MESSAGE: Record<ErrorCode, string> = {
  DEFAULT_PORTFOLIO_CREATE_FAILED: 'Failed to create default portfolio',
  STOCK_TICKER_CREATE_FAILED: 'Failed to create stock ticker',
  PORTFOLIO_ENTRY_CREATE_FAILED: 'Failed to create portfolio entry',
  PORTFOLIO_ENTRY_UPDATE_FAILED: 'Failed to update portfolio entry',
  STOCK_PRICE_FETCH_FAILED: 'Failed to resolve current stock prices',
  EXCHANGE_RATE_RESOLUTION_FAILED: 'Failed to resolve foreign exchange rates',
  INVALID_TICKER_ID: 'Encountered invalid persisted ticker data',
};

class PortfolioException extends APIException {
  constructor(c: HonoContext, { code, context }: { code: ErrorCode; context?: unknown }) {
    super(c, CODE_TO_STATUS[code], { message: CODE_TO_MESSAGE[code], code, context });
  }
}

export class DefaultPortfolioCreateFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, { code: ERROR_CODES.DEFAULT_PORTFOLIO_CREATE_FAILED });
  }
}

export class StockTickerCreateFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, { code: ERROR_CODES.STOCK_TICKER_CREATE_FAILED });
  }
}

export class PortfolioEntryCreateFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, { code: ERROR_CODES.PORTFOLIO_ENTRY_CREATE_FAILED });
  }
}

export class PortfolioEntryUpdateFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, { code: ERROR_CODES.PORTFOLIO_ENTRY_UPDATE_FAILED });
  }
}

export class StockPriceFetchFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, { code: ERROR_CODES.STOCK_PRICE_FETCH_FAILED });
  }
}

export class ExchangeRateResolutionFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, { code: ERROR_CODES.EXCHANGE_RATE_RESOLUTION_FAILED });
  }
}

export class InvalidTickerId extends PortfolioException {
  constructor(c: HonoContext, tickerId: string) {
    super(c, { code: ERROR_CODES.INVALID_TICKER_ID, context: { ticker_id: tickerId } });
  }
}
