import { authRelations } from './better-auth.ts';
import { forexRelations } from './forex.ts';
import { portfolioRelations } from './portfolio.ts';
import { preferencesRelations } from './preferences.ts';
import { stocksRelations } from './stocks.ts';

export * from './better-auth.ts';
export * from './stocks.ts';
export * from './portfolio.ts';
export * from './forex.ts';
export * from './preferences.ts';

export const appRelations = {
  ...authRelations,
  ...stocksRelations,
  ...portfolioRelations,
  ...forexRelations,
  ...preferencesRelations,
};
