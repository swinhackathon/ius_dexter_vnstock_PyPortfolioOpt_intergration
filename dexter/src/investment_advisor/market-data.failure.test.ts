import { describe, expect, test } from 'bun:test';
import { CachedMarketDataLoader, type FetchHistoryInput, type MarketDataProvider } from './market-data.js';
import type { PricePoint } from './types.js';

class ToggleProvider implements MarketDataProvider {
  name = 'toggle_provider';
  shouldFail = false;

  async fetchHistory(input: FetchHistoryInput) {
    if (this.shouldFail) {
      throw new Error(`provider timeout: ${input.symbol}`);
    }
    const points: PricePoint[] = [];
    let price = 100;
    for (let day = 0; day < 60; day += 1) {
      price *= 1.001;
      points.push({
        date: new Date(Date.UTC(2025, 0, day + 1)).toISOString().slice(0, 10),
        close: Number(price.toFixed(4)),
      });
    }
    return {
      symbol: input.symbol,
      prices: points,
      source: `toggle://${input.symbol}`,
    };
  }
}

describe('CachedMarketDataLoader failure paths', () => {
  test('uses stale cache when refresh fails', async () => {
    const provider = new ToggleProvider();
    const loader = new CachedMarketDataLoader(provider, { cacheTtlMs: 1_000 });

    const first = await loader.loadMany({
      symbols: ['AAA'],
      lookbackDays: 90,
      deadlineAt: Date.now() + 3_000,
    });
    expect(first.histories.AAA).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    provider.shouldFail = true;

    const second = await loader.loadMany({
      symbols: ['AAA'],
      lookbackDays: 90,
      deadlineAt: Date.now() + 3_000,
    });

    expect(second.histories.AAA).toBeDefined();
    expect(second.fallbackUsed).toBeTrue();
    expect(second.staleSymbols).toContain('AAA');
    expect(second.warnings.some((item) => item.includes('stale cached data'))).toBeTrue();
  });

  test('degrades when provider fails with no cache', async () => {
    const provider = new ToggleProvider();
    provider.shouldFail = true;
    const loader = new CachedMarketDataLoader(provider, { cacheTtlMs: 60_000 });

    const result = await loader.loadMany({
      symbols: ['BBB'],
      lookbackDays: 90,
      deadlineAt: Date.now() + 3_000,
    });

    expect(Object.keys(result.histories)).toHaveLength(0);
    expect(result.degraded).toBeTrue();
    expect(result.fallbackUsed).toBeTrue();
    expect(result.warnings.some((item) => item.includes('Failed to load market data'))).toBeTrue();
  });
});
