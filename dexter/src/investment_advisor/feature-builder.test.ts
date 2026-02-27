import { describe, expect, test } from 'bun:test';
import { buildFeatureSet } from './feature-builder.js';

function syntheticSeries(startPrice: number, steps: number, drift: number): { date: string; close: number }[] {
  const points: { date: string; close: number }[] = [];
  let price = startPrice;
  for (let day = 0; day < steps; day += 1) {
    price *= 1 + drift;
    points.push({
      date: new Date(Date.UTC(2025, 0, day + 1)).toISOString().slice(0, 10),
      close: Number(price.toFixed(4)),
    });
  }
  return points;
}

describe('buildFeatureSet', () => {
  test('computes expected feature metrics from price history', () => {
    const features = buildFeatureSet({
      AAA: syntheticSeries(100, 40, 0.002),
      BBB: syntheticSeries(90, 40, -0.001),
    });

    expect(features.bySymbol.AAA).toBeDefined();
    expect(features.bySymbol.BBB).toBeDefined();
    expect(features.bySymbol.AAA.mean_return).toBeGreaterThan(features.bySymbol.BBB.mean_return);
    expect(features.bySymbol.BBB.momentum).toBeLessThan(0);
    expect(features.bySymbol.BBB.drawdown).toBeLessThanOrEqual(0);
  });

  test('skips symbols with insufficient data points', () => {
    const features = buildFeatureSet({
      SHORT: [
        { date: '2025-01-01', close: 10 },
        { date: '2025-01-02', close: 11 },
      ],
    });

    expect(Object.keys(features.bySymbol)).toHaveLength(0);
  });
});

