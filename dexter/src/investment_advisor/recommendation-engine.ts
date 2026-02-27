import type { FeatureSet, RiskBand, SymbolFeatures } from './types.js';

export interface RankedSymbol {
  symbol: string;
  score: number;
}

export interface RecommendationResult {
  ranked: RankedSymbol[];
  selected: string[];
  alternatives: string[];
}

const EXECUTION_PATTERNS = [
  /\bexecute\b/i,
  /\bplace\s+order\b/i,
  /\bbuy\s+now\b/i,
  /\bsell\s+now\b/i,
  /\ball[-\s]?in\b/i,
  /\bshort\s+now\b/i,
  /\bmua\s+ngay\b/i,
  /\bban\s+ngay\b/i,
  /\bbán\s+ngay\b/i,
];

const RECOMMENDATION_PATTERNS = [
  /\brecommend\b/i,
  /\bwhich\s+stock\b/i,
  /\bshould\s+i\s+buy\b/i,
  /\ballocation\b/i,
  /\bportfolio\b/i,
  /\bchoose\b/i,
  /\bnen\s+mua\b/i,
  /\bnên\s+mua\b/i,
  /\bgợi ý\b/i,
  /\bgoi y\b/i,
];

function scoreSymbol(metrics: SymbolFeatures, riskBand: RiskBand): number {
  const drawdownPenalty = Math.abs(metrics.drawdown);
  if (riskBand === 'conservative') {
    return (
      0.2 * metrics.mean_return +
      0.15 * metrics.momentum -
      0.4 * metrics.volatility -
      0.25 * drawdownPenalty
    );
  }
  if (riskBand === 'aggressive') {
    return (
      0.55 * metrics.mean_return +
      0.35 * metrics.momentum -
      0.05 * metrics.volatility -
      0.05 * drawdownPenalty
    );
  }
  return (
    0.45 * metrics.mean_return +
    0.25 * metrics.momentum -
    0.2 * metrics.volatility -
    0.1 * drawdownPenalty
  );
}

export function isExecutionIntent(query: string): boolean {
  return EXECUTION_PATTERNS.some((pattern) => pattern.test(query));
}

export function isRecommendationIntent(query: string): boolean {
  return RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(query));
}

export function rankAndSelectSymbols(
  features: FeatureSet,
  riskBand: RiskBand,
  maxSelected: number
): RecommendationResult {
  const ranked = Object.values(features.bySymbol)
    .map((metrics) => ({
      symbol: metrics.symbol,
      score: scoreSymbol(metrics, riskBand),
    }))
    .sort((left, right) => right.score - left.score);

  const selected = ranked.slice(0, Math.max(2, maxSelected)).map((item) => item.symbol);
  const alternatives = ranked
    .slice(Math.max(0, selected.length), Math.max(0, selected.length + 3))
    .map((item) => `${item.symbol}: lower composite score, keep as watchlist alternative.`);

  return { ranked, selected, alternatives };
}

export function heuristicWeightsFromRanking(
  ranked: RankedSymbol[],
  selected: string[]
): Record<string, number> {
  const selectedSet = new Set(selected);
  const selectedRanks = ranked.filter((item) => selectedSet.has(item.symbol));
  if (selectedRanks.length === 0) {
    return {};
  }
  const shiftedScores = selectedRanks.map((item) => Math.max(item.score, 0) + 1e-6);
  const total = shiftedScores.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    const equal = 1 / selectedRanks.length;
    return Object.fromEntries(selectedRanks.map((item) => [item.symbol, equal]));
  }

  const weights: Record<string, number> = {};
  selectedRanks.forEach((item, index) => {
    weights[item.symbol] = shiftedScores[index] / total;
  });
  return weights;
}

