function normalizeTickerPart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, '-');
}

export function createSyntheticTickerId(exchange: string, symbol: string) {
  return `portfolio-stock:${normalizeTickerPart(exchange)}:${normalizeTickerPart(symbol)}`;
}

export function createSyntheticTickerIsin(exchange: string, symbol: string) {
  return `PORTFOLIO-${normalizeTickerPart(exchange)}-${normalizeTickerPart(symbol)}`;
}
