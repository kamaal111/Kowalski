import { dateOnlyStringToISO8601String } from '@/utils/dates';
import { toISO8601String } from '@/utils/strings';
import {
  CreateEntryResponseSchema,
  ResolvedEntryResponseSchema,
  type CreateEntryResponse,
  type ResolvedEntryResponse,
} from '../schemas/responses';
import { assertToFloat } from '@/utils/numbers';
import type { PersistedPortfolioEntry } from '../repositories/list-entries';
import type { ResolvedPortfolioEntry } from '../services/resolve-splits';

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
  entry,
  preferredCurrencyPurchasePrice,
}: {
  entry: PersistedPortfolioEntry;
  preferredCurrencyPurchasePrice: CreateEntryResponse['preferred_currency_purchase_price'];
}): CreateEntryResponse {
  return mapPortfolioEntryToResponse({
    id: entry.id,
    stock: {
      symbol: entry.stockSymbol,
      exchange: getExchangeFromTickerId(entry.tickerId),
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
  entry,
  preferredCurrencyPurchasePrice,
}: {
  entry: ResolvedPortfolioEntry;
  preferredCurrencyPurchasePrice: ResolvedEntryResponse['preferred_currency_purchase_price'];
}): ResolvedEntryResponse {
  return mapResolvedPortfolioEntryInputToResponse({
    id: entry.id,
    stock: {
      symbol: entry.stockSymbol,
      exchange: getExchangeFromTickerId(entry.tickerId),
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

function getExchangeFromTickerId(tickerId: string) {
  const [, exchange] = tickerId.split(':');

  return exchange?.length ? exchange : 'UNKNOWN';
}
