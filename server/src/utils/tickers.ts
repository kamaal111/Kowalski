const SYNTHETIC_TICKER_PREFIX = 'portfolio-stock';
const SYNTHETIC_TICKER_ID_PATTERN = new RegExp(`^${SYNTHETIC_TICKER_PREFIX}:([^:]+):([^:]+)$`);

function normalizeTickerPart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, '-');
}

export function createSyntheticTickerId(exchange: string, symbol: string) {
  return `${SYNTHETIC_TICKER_PREFIX}:${normalizeTickerPart(exchange)}:${normalizeTickerPart(symbol)}`;
}

export function createSyntheticTickerIsin(exchange: string, symbol: string) {
  return `PORTFOLIO-${normalizeTickerPart(exchange)}-${normalizeTickerPart(symbol)}`;
}

export function parseSyntheticTickerId(tickerId: string) {
  const matchedParts = SYNTHETIC_TICKER_ID_PATTERN.exec(tickerId);
  if (matchedParts == null) {
    return null;
  }

  const [, exchange, symbol] = matchedParts;
  return { exchange, symbol };
}
