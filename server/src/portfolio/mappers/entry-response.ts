import { dateOnlyStringToISO8601String } from '@/utils/dates';
import { toISO8601String } from '@/utils/strings';
import type { CreateEntryResponse } from '../schemas/responses';
import { assertToFloat } from '@/utils/numbers';

interface PortfolioEntryResponseInput {
  id: string;
  stock: CreateEntryResponse['stock'];
  amount: string | number;
  purchasePrice: string | number;
  purchasePriceCurrency: string;
  preferredCurrencyPurchasePrice: CreateEntryResponse['preferred_currency_purchase_price'];
  transactionType: CreateEntryResponse['transaction_type'];
  transactionDate: string;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPortfolioEntryToResponse(input: PortfolioEntryResponseInput): CreateEntryResponse {
  return {
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
  };
}
