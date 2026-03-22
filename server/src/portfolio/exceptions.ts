import type { HonoContext } from '@/api/contexts.js';
import { APIException } from '@/api/exceptions.js';
import { STATUS_CODES, type StatusCode } from '@/constants/http.js';

const CODE_TO_STATUS = {
  DEFAULT_PORTFOLIO_CREATE_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
  STOCK_TICKER_CREATE_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
  PORTFOLIO_ENTRY_CREATE_FAILED: STATUS_CODES.INTERNAL_SERVER_ERROR,
} satisfies Record<string, StatusCode>;

type PortfolioExceptionCode = keyof typeof CODE_TO_STATUS;

class PortfolioException extends APIException {
  constructor(c: HonoContext, { code, message }: { code: PortfolioExceptionCode; message: string }) {
    super(c, CODE_TO_STATUS[code], { message, code });
  }
}

export class DefaultPortfolioCreateFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, {
      code: 'DEFAULT_PORTFOLIO_CREATE_FAILED',
      message: 'Failed to create default portfolio',
    });
  }
}

export class StockTickerCreateFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, {
      code: 'STOCK_TICKER_CREATE_FAILED',
      message: 'Failed to create stock ticker',
    });
  }
}

export class PortfolioEntryCreateFailed extends PortfolioException {
  constructor(c: HonoContext) {
    super(c, {
      code: 'PORTFOLIO_ENTRY_CREATE_FAILED',
      message: 'Failed to create portfolio entry',
    });
  }
}
