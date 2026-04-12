import type { CreateEntryPayload } from '../schemas/payloads';
import {
  createStockTicker,
  findStockTickersByIds,
  upsertStockTickers,
  updateStockTicker,
} from '../repositories/create-entry';
import { logInfo } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import type { HonoContext } from '@/api/contexts';
import { createSyntheticTickerId, createSyntheticTickerIsin } from '@/utils/tickers';

type ResolvedStockTicker = Awaited<ReturnType<typeof findStockTickersByIds>>[number];
type CreateStockTickerInput = Parameters<typeof upsertStockTickers>[1][number];

async function resolvePortfolioStockTicker(c: HonoContext, payload: CreateEntryPayload) {
  const existingTickers = await findStockTickersByIds(c, [getPortfolioStockTickerId(payload)]);

  return resolvePortfolioStockTickerFromExistingTicker(c, payload, existingTickers.at(0));
}

export async function resolvePortfolioStockTickers(
  c: HonoContext,
  payloads: CreateEntryPayload[],
): Promise<ResolvedStockTicker[]> {
  const tickerIds = Array.from(new Set(payloads.map(getPortfolioStockTickerId)));
  const existingTickers = await findStockTickersByIds(c, tickerIds);
  const existingTickersById = new Map(existingTickers.map(ticker => [ticker.id, ticker]));
  const { desiredTickerInputsById, resolvedTickers } = resolveDesiredStockTickers(payloads, existingTickersById);
  const stockTickerInputsToPersist = getStockTickerInputsToPersist(desiredTickerInputsById, existingTickersById);

  if (stockTickerInputsToPersist.length > 0) {
    await upsertStockTickers(c, stockTickerInputsToPersist);
    logUpdatedStockTickers(c, stockTickerInputsToPersist, existingTickersById);
  }

  return resolvedTickers;
}

async function resolvePortfolioStockTickerFromExistingTicker(
  c: HonoContext,
  payload: CreateEntryPayload,
  existingTicker: ResolvedStockTicker | undefined,
): Promise<ResolvedStockTicker> {
  if (existingTicker == null) {
    return createStockTicker(c, getCreateStockTickerInput(payload));
  }

  if (!stockTickerNeedsUpdate(existingTicker, payload)) {
    return existingTicker;
  }

  const updatedTicker = getUpdatedStockTicker(existingTicker, payload);
  await updateStockTicker(c, existingTicker.id, {
    isin: updatedTicker.isin,
    name: updatedTicker.name,
    sector: updatedTicker.sector,
    industry: updatedTicker.industry,
    exchangeDispatch: updatedTicker.exchangeDispatch,
  });
  logInfo(withRequestLogger(c, { component: 'portfolio' }), {
    event: 'portfolio.ticker.updated',
    ticker_id: existingTicker.id,
    ticker_symbol: payload.stock.symbol,
    outcome: 'success',
  });

  return updatedTicker;
}

function stockTickerNeedsUpdate(existingTicker: ResolvedStockTicker, payload: CreateEntryPayload) {
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

function getPortfolioStockTickerId(payload: CreateEntryPayload) {
  return createSyntheticTickerId(payload.stock.exchange, payload.stock.symbol);
}

function getCreateStockTickerInput(payload: CreateEntryPayload) {
  return {
    id: getPortfolioStockTickerId(payload),
    isin: getStockTickerIsinForCreate(payload),
    symbol: payload.stock.symbol,
    name: payload.stock.name,
    sector: payload.stock.sector,
    industry: payload.stock.industry,
    exchangeDispatch: payload.stock.exchange_dispatch,
  };
}

function resolveDesiredStockTickers(
  payloads: CreateEntryPayload[],
  existingTickersById: Map<string, ResolvedStockTicker>,
): {
  desiredTickerInputsById: Map<string, CreateStockTickerInput>;
  resolvedTickers: ResolvedStockTicker[];
} {
  const desiredTickerInputsById = new Map<string, CreateStockTickerInput>();
  const resolvedTickers: ResolvedStockTicker[] = [];

  for (const payload of payloads) {
    const tickerId = getPortfolioStockTickerId(payload);
    const currentDesiredTickerInput = desiredTickerInputsById.get(tickerId);
    const desiredTickerInput =
      currentDesiredTickerInput != null
        ? getDesiredStockTickerInputFromResolvedTickerInput(currentDesiredTickerInput, payload)
        : getDesiredStockTickerInputFromExistingTicker(existingTickersById.get(tickerId), payload);

    desiredTickerInputsById.set(tickerId, desiredTickerInput);
    resolvedTickers.push(getResolvedStockTickerFromInput(desiredTickerInput));
  }

  return { desiredTickerInputsById, resolvedTickers };
}

function getStockTickerInputsToPersist(
  desiredTickerInputsById: Map<string, CreateStockTickerInput>,
  existingTickersById: Map<string, ResolvedStockTicker>,
): CreateStockTickerInput[] {
  const stockTickerInputsToPersist: CreateStockTickerInput[] = [];
  for (const desiredTickerInput of desiredTickerInputsById.values()) {
    const existingTicker = existingTickersById.get(desiredTickerInput.id);
    if (existingTicker == null || !stockTickerMatches(desiredTickerInput, existingTicker)) {
      stockTickerInputsToPersist.push(desiredTickerInput);
    }
  }

  return stockTickerInputsToPersist;
}

function getUpdatedStockTicker(existingTicker: ResolvedStockTicker, payload: CreateEntryPayload): ResolvedStockTicker {
  return {
    id: existingTicker.id,
    isin: getStockTickerIsinForUpdate(existingTicker.isin, payload),
    name: payload.stock.name,
    sector: payload.stock.sector,
    industry: payload.stock.industry,
    exchangeDispatch: payload.stock.exchange_dispatch,
  };
}

function getStockTickerIsinForUpdate(existingIsin: string, payload: CreateEntryPayload) {
  return payload.stock.isin ?? existingIsin;
}

function getDesiredStockTickerInputFromExistingTicker(
  existingTicker: ResolvedStockTicker | undefined,
  payload: CreateEntryPayload,
): CreateStockTickerInput {
  if (existingTicker == null) {
    return getCreateStockTickerInput(payload);
  }

  return getCreateStockTickerInputFromResolvedStockTicker(
    getDesiredResolvedStockTicker(existingTicker, payload),
    payload,
  );
}

function getDesiredStockTickerInputFromResolvedTickerInput(
  currentTickerInput: CreateStockTickerInput,
  payload: CreateEntryPayload,
): CreateStockTickerInput {
  return getCreateStockTickerInputFromResolvedStockTicker(
    getDesiredResolvedStockTicker(getResolvedStockTickerFromInput(currentTickerInput), payload),
    payload,
  );
}

function getDesiredResolvedStockTicker(existingTicker: ResolvedStockTicker, payload: CreateEntryPayload) {
  if (!stockTickerNeedsUpdate(existingTicker, payload)) {
    return existingTicker;
  }

  return getUpdatedStockTicker(existingTicker, payload);
}

function getCreateStockTickerInputFromResolvedStockTicker(
  resolvedTicker: ResolvedStockTicker,
  payload: CreateEntryPayload,
): CreateStockTickerInput {
  return {
    id: resolvedTicker.id,
    isin: resolvedTicker.isin,
    symbol: payload.stock.symbol,
    name: resolvedTicker.name,
    sector: resolvedTicker.sector,
    industry: resolvedTicker.industry,
    exchangeDispatch: resolvedTicker.exchangeDispatch,
  };
}

function getResolvedStockTickerFromInput(input: CreateStockTickerInput): ResolvedStockTicker {
  return {
    id: input.id,
    isin: input.isin,
    name: input.name,
    sector: getNullableStockTickerField(input.sector),
    industry: getNullableStockTickerField(input.industry),
    exchangeDispatch: getNullableStockTickerField(input.exchangeDispatch),
  };
}

function stockTickerMatches(input: CreateStockTickerInput, existingTicker: ResolvedStockTicker) {
  return (
    input.isin === existingTicker.isin &&
    input.name === existingTicker.name &&
    getNullableStockTickerField(input.sector) === existingTicker.sector &&
    getNullableStockTickerField(input.industry) === existingTicker.industry &&
    getNullableStockTickerField(input.exchangeDispatch) === existingTicker.exchangeDispatch
  );
}

function getNullableStockTickerField(value: string | null | undefined) {
  return value ?? null;
}

function logUpdatedStockTickers(
  c: HonoContext,
  stockTickerInputsToPersist: CreateStockTickerInput[],
  existingTickersById: Map<string, ResolvedStockTicker>,
) {
  for (const stockTickerInput of stockTickerInputsToPersist) {
    if (!existingTickersById.has(stockTickerInput.id)) {
      continue;
    }

    logInfo(withRequestLogger(c, { component: 'portfolio' }), {
      event: 'portfolio.ticker.updated',
      ticker_id: stockTickerInput.id,
      ticker_symbol: stockTickerInput.symbol,
      outcome: 'success',
    });
  }
}

export default resolvePortfolioStockTicker;
