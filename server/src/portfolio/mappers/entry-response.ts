import { dateOnlyStringToISO8601String } from '@/utils/dates';
import type { HonoContext } from '@/api/contexts';
import { toISO8601String } from '@/utils/strings';
import {
  CreateEntryResponseSchema,
  ResolvedEntryResponseSchema,
  type CreateEntryResponse,
  type ResolvedEntryResponse,
} from '../schemas/responses';
import { assertToFloat } from '@/utils/numbers';
import { parseSyntheticTickerId } from '@/utils/tickers';
import type { PersistedPortfolioEntry } from '../repositories/list-entries';
import type { ResolvedPortfolioEntry } from '../services/resolve-splits';
import { InvalidTickerId } from '../exceptions';

interface PortfolioEntryResponseInput<TTransactionType extends string> {
  id: string;
  stock: CreateEntryResponse['stock'];
  amount: string | number;
  purchasePrice: string | number;
  purchasePriceCurrency: string;
  preferredCurrencyPurchasePrice: CreateEntryResponse['preferred_currency_purchase_price'];
  transactionType: TTransactionType;
  transactionDate: string;
  createdAt: Date;
  updatedAt: Date;
}

type CreateEntryResponseInput = PortfolioEntryResponseInput<CreateEntryResponse['transaction_type']>;
type ResolvedEntryResponseInput = PortfolioEntryResponseInput<ResolvedEntryResponse['transaction_type']>;

export function mapPortfolioEntryToResponse(input: CreateEntryResponseInput): CreateEntryResponse {
  return CreateEntryResponseSchema.parse({
    id: input.id,
    stock: input.stock,
    amount: assertToFloat(input.amount),
    purchase_price: {
      currency: input.purchasePriceCurrency,
      value: assertToFloat(input.purchasePrice),
    },
    preferred_currency_purchase_price: input.preferredCurrencyPurchasePrice,
    transaction_type: input.transactionType,
    transaction_date: dateOnlyStringToISO8601String(input.transactionDate),
    created_at: toISO8601String(input.createdAt),
    updated_at: toISO8601String(input.updatedAt),
  });
}

export function mapResolvedPortfolioEntryInputToResponse(input: ResolvedEntryResponseInput): ResolvedEntryResponse {
  return ResolvedEntryResponseSchema.parse({
    id: input.id,
    stock: input.stock,
    amount: assertToFloat(input.amount),
    purchase_price: {
      currency: input.purchasePriceCurrency,
      value: assertToFloat(input.purchasePrice),
    },
    preferred_currency_purchase_price: input.preferredCurrencyPurchasePrice,
    transaction_type: input.transactionType,
    transaction_date: dateOnlyStringToISO8601String(input.transactionDate),
    created_at: toISO8601String(input.createdAt),
    updated_at: toISO8601String(input.updatedAt),
  });
}

export function mapPersistedPortfolioEntryToResponse({
  c,
  entry,
  preferredCurrencyPurchasePrice,
}: {
  c: HonoContext;
  entry: PersistedPortfolioEntry;
  preferredCurrencyPurchasePrice: CreateEntryResponse['preferred_currency_purchase_price'];
}): CreateEntryResponse {
  const parsedTickerId = parseRequiredSyntheticTickerId(c, entry.tickerId);

  return mapPortfolioEntryToResponse({
    id: entry.id,
    stock: {
      symbol: entry.stockSymbol,
      exchange: parsedTickerId.exchange,
      name: entry.stockName,
      isin: entry.stockIsin,
      sector: entry.stockSector,
      industry: entry.stockIndustry,
      exchange_dispatch: entry.stockExchangeDispatch,
    },
    amount: entry.amount,
    purchasePrice: entry.purchasePrice,
    purchasePriceCurrency: entry.purchasePriceCurrency,
    preferredCurrencyPurchasePrice,
    transactionType: entry.transactionType,
    transactionDate: entry.transactionDate,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

export function mapResolvedPortfolioEntryToResponse({
  c,
  entry,
  preferredCurrencyPurchasePrice,
}: {
  c: HonoContext;
  entry: ResolvedPortfolioEntry;
  preferredCurrencyPurchasePrice: ResolvedEntryResponse['preferred_currency_purchase_price'];
}): ResolvedEntryResponse {
  const parsedTickerId = parseRequiredSyntheticTickerId(c, entry.tickerId);

  return mapResolvedPortfolioEntryInputToResponse({
    id: entry.id,
    stock: {
      symbol: entry.stockSymbol,
      exchange: parsedTickerId.exchange,
      name: entry.stockName,
      isin: entry.stockIsin,
      sector: entry.stockSector,
      industry: entry.stockIndustry,
      exchange_dispatch: entry.stockExchangeDispatch,
    },
    amount: entry.amount,
    purchasePrice: entry.purchasePrice,
    purchasePriceCurrency: entry.purchasePriceCurrency,
    preferredCurrencyPurchasePrice,
    transactionType: entry.transactionType,
    transactionDate: entry.transactionDate,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

function parseRequiredSyntheticTickerId(c: HonoContext, tickerId: string) {
  const parsedTickerId = parseSyntheticTickerId(tickerId);
  if (parsedTickerId == null) {
    throw new InvalidTickerId(c, tickerId);
  }

  return parsedTickerId;
}
