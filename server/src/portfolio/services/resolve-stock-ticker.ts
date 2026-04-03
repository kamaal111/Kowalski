import type { CreateEntryPayload } from '../schemas/payloads';
import { createStockTicker, findStockTickerById, updateStockTicker } from '../repositories/create-entry';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import { createSyntheticTickerId, createSyntheticTickerIsin } from '@/utils/tickers';

async function resolvePortfolioStockTicker(c: HonoContext, payload: CreateEntryPayload) {
  const tickerId = createSyntheticTickerId(payload.stock.exchange, payload.stock.symbol);
  const existingTicker = await findStockTickerById(c, tickerId);
  if (existingTicker != null) {
    if (stockTickerNeedsUpdate(existingTicker, payload)) {
      const updatedTicker = {
        id: existingTicker.id,
        isin: getStockTickerIsinForUpdate(existingTicker.isin, payload),
        name: payload.stock.name,
        sector: payload.stock.sector,
        industry: payload.stock.industry,
        exchangeDispatch: payload.stock.exchange_dispatch,
      };
      await updateStockTicker(c, existingTicker.id, updatedTicker);
      logInfo(withRequestLogger(c, { component: 'portfolio' }), {
        event: 'portfolio.ticker.updated',
        ticker_id: existingTicker.id,
        ticker_symbol: payload.stock.symbol,
        outcome: 'success',
      });

      return updatedTicker;
    }

    return existingTicker;
  }

  return createStockTicker(c, {
    id: tickerId,
    isin: getStockTickerIsinForCreate(payload),
    symbol: payload.stock.symbol,
    name: payload.stock.name,
    sector: payload.stock.sector,
    industry: payload.stock.industry,
    exchangeDispatch: payload.stock.exchange_dispatch,
  });
}

function stockTickerNeedsUpdate(
  existingTicker: Awaited<ReturnType<typeof findStockTickerById>>,
  payload: CreateEntryPayload,
) {
  if (existingTicker == null) {
    return false;
  }

  return (
    existingTicker.isin !== getStockTickerIsinForUpdate(existingTicker.isin, payload) ||
    existingTicker.name !== payload.stock.name ||
    existingTicker.sector !== payload.stock.sector ||
    existingTicker.industry !== payload.stock.industry ||
    existingTicker.exchangeDispatch !== payload.stock.exchange_dispatch
  );
}

function getStockTickerIsinForCreate(payload: CreateEntryPayload) {
  return payload.stock.isin ?? createSyntheticTickerIsin(payload.stock.exchange, payload.stock.symbol);
}

function getStockTickerIsinForUpdate(existingIsin: string, payload: CreateEntryPayload) {
  return payload.stock.isin ?? existingIsin;
}

export default resolvePortfolioStockTicker;
