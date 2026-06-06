import * as z from 'zod';

const PORTFOLIO_DASHBOARD_PERIODS = ['1w', '1m', '3m', '6m', 'ytd', '1y', '2y', '5y', '10y', 'all'] as const;
const DEFAULT_PORTFOLIO_DASHBOARD_PERIOD = '1y';

export type PortfolioDashboardPeriod = (typeof PORTFOLIO_DASHBOARD_PERIODS)[number];
export type PortfolioDashboardsQuery = z.infer<typeof PortfolioDashboardsQuerySchema>;

const PortfolioDashboardPeriodSchema = z.enum(PORTFOLIO_DASHBOARD_PERIODS).openapi('PortfolioDashboardPeriod', {
  title: 'Portfolio Dashboard Period',
  description: 'Time period used for portfolio dashboard growth data.',
  example: DEFAULT_PORTFOLIO_DASHBOARD_PERIOD,
});

export const PortfolioDashboardsQuerySchema = z
  .object({
    period: PortfolioDashboardPeriodSchema.default(DEFAULT_PORTFOLIO_DASHBOARD_PERIOD).openapi({
      description: 'Dashboard period to return. Defaults to one year when omitted.',
      example: DEFAULT_PORTFOLIO_DASHBOARD_PERIOD,
      default: DEFAULT_PORTFOLIO_DASHBOARD_PERIOD,
    }),
  })
  .openapi('PortfolioDashboardsQuery', {
    title: 'Portfolio Dashboards Query',
    description: 'Query parameters for retrieving portfolio dashboards.',
    example: { period: DEFAULT_PORTFOLIO_DASHBOARD_PERIOD },
  });
