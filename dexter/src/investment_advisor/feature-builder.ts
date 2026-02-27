import type { FeatureSet, PricePoint, SymbolFeatures } from './types.js';

const TRADING_DAYS_PER_YEAR = 252;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let index = 1; index < prices.length; index += 1) {
    const previous = prices[index - 1];
    const current = prices[index];
    if (previous > 0 && current > 0) {
      returns.push(current / previous - 1);
    }
  }
  return returns;
}

function maxDrawdown(prices: number[]): number {
  if (prices.length === 0) return 0;
  let peak = prices[0];
  let worst = 0;
  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    const drawdown = price / peak - 1;
    if (drawdown < worst) {
      worst = drawdown;
    }
  }
  return worst;
}

function computeMomentum(prices: number[]): number {
  if (prices.length < 2) return 0;
  const window = prices.length > 21 ? 21 : prices.length - 1;
  const anchorIndex = Math.max(0, prices.length - 1 - window);
  const anchor = prices[anchorIndex];
  const latest = prices[prices.length - 1];
  if (anchor <= 0 || latest <= 0) return 0;
  return latest / anchor - 1;
}

function sortByDate(points: PricePoint[]): PricePoint[] {
  return [...points].sort((left, right) => left.date.localeCompare(right.date));
}

export function buildFeatureSet(histories: Record<string, PricePoint[]>): FeatureSet {
  const bySymbol: Record<string, SymbolFeatures> = {};
  const returns: Record<string, number[]> = {};

  for (const [symbol, points] of Object.entries(histories)) {
    const sorted = sortByDate(points);
    const closes = sorted.map((point) => point.close).filter((price) => Number.isFinite(price) && price > 0);
    if (closes.length < 3) {
      continue;
    }

    const dailyReturns = computeReturns(closes);
    if (dailyReturns.length === 0) {
      continue;
    }

    const annualReturn = mean(dailyReturns) * TRADING_DAYS_PER_YEAR;
    const annualVolatility = standardDeviation(dailyReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    const momentum = computeMomentum(closes);
    const drawdown = maxDrawdown(closes);

    bySymbol[symbol] = {
      symbol,
      mean_return: annualReturn,
      volatility: annualVolatility,
      momentum,
      drawdown,
    };
    returns[symbol] = dailyReturns;
  }

  return { bySymbol, returns };
}

