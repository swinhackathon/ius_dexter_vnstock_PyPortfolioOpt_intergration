import { describe, expect, test } from 'bun:test';
import {
  heuristicWeightsFromRanking,
  isExecutionIntent,
  isRecommendationIntent,
  rankAndSelectSymbols,
} from './recommendation-engine.js';
import type { FeatureSet } from './types.js';

const featureSet: FeatureSet = {
  bySymbol: {
    AAA: { symbol: 'AAA', mean_return: 0.25, volatility: 0.22, momentum: 0.15, drawdown: -0.2 },
    BBB: { symbol: 'BBB', mean_return: 0.18, volatility: 0.12, momentum: 0.08, drawdown: -0.08 },
    CCC: { symbol: 'CCC', mean_return: 0.12, volatility: 0.09, momentum: 0.02, drawdown: -0.05 },
  },
  returns: {},
};

describe('recommendation engine helpers', () => {
  test('detects execution intent', () => {
    expect(isExecutionIntent('buy now and execute this order')).toBeTrue();
    expect(isExecutionIntent('please explain this stock')).toBeFalse();
  });

  test('detects recommendation intent', () => {
    expect(isRecommendationIntent('which stock should i buy')).toBeTrue();
    expect(isRecommendationIntent('summarize earnings')).toBeFalse();
  });

  test('ranks symbols based on risk band', () => {
    const conservative = rankAndSelectSymbols(featureSet, 'conservative', 2);
    const aggressive = rankAndSelectSymbols(featureSet, 'aggressive', 2);

    expect(conservative.ranked[0]?.symbol).toBe('BBB');
    expect(aggressive.ranked[0]?.symbol).toBe('AAA');
  });

  test('creates normalized heuristic weights', () => {
    const ranking = rankAndSelectSymbols(featureSet, 'moderate', 2);
    const weights = heuristicWeightsFromRanking(ranking.ranked, ranking.selected);
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

    expect(total).toBeCloseTo(1, 6);
    expect(Object.keys(weights).length).toBeGreaterThanOrEqual(2);
  });
});
