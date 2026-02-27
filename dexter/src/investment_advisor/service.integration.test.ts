import { describe, expect, test } from 'bun:test';
import { loadInvestmentAdvisorConfig, type InvestmentAdvisorConfig } from './config.js';
import { CachedMarketDataLoader, type FetchHistoryInput, type MarketDataProvider } from './market-data.js';
import type { AllocationOptimizer, OptimizationInput } from './optimizer.js';
import { DexterStockAdvisoryService } from './service.js';
import type {
  AdvisoryNarrativeRewriter,
  NarrativeRewriteInput,
} from './narrative-rewriter.js';
import type { PricePoint } from './types.js';

function series(start: number, days: number, drift: number): PricePoint[] {
  const points: PricePoint[] = [];
  let value = start;
  for (let day = 0; day < days; day += 1) {
    value *= 1 + drift;
    points.push({
      date: new Date(Date.UTC(2025, 0, day + 1)).toISOString().slice(0, 10),
      close: Number(value.toFixed(6)),
    });
  }
  return points;
}

class MockProvider implements MarketDataProvider {
  name = 'mock_provider';
  private readonly shouldFail: boolean;

  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
  }

  async fetchHistory(input: FetchHistoryInput) {
    if (this.shouldFail) {
      throw new Error(`timeout while fetching ${input.symbol}`);
    }
    const profile: Record<string, [number, number]> = {
      AAA: [100, 0.0025],
      BBB: [120, 0.0015],
      CCC: [90, 0.0007],
    };
    const [start, drift] = profile[input.symbol] ?? [80, 0.001];
    return {
      symbol: input.symbol,
      prices: series(start, 80, drift),
      source: `mock://${input.symbol}`,
    };
  }
}

class MockOptimizer implements AllocationOptimizer {
  async optimize(input: OptimizationInput) {
    const equal = 1 / input.selectedSymbols.length;
    return {
      method: 'pypfopt' as const,
      warnings: [],
      weights: Object.fromEntries(input.selectedSymbols.map((symbol) => [symbol, equal])),
    };
  }
}

class CountingNarrativeRewriter implements AdvisoryNarrativeRewriter {
  calls = 0;

  async rewrite(input: NarrativeRewriteInput) {
    this.calls += 1;
    return {
      summary: input.response.summary,
      alternatives: input.response.alternatives,
      rewritten: false,
    };
  }
}

function testConfig(): InvestmentAdvisorConfig {
  return {
    ...loadInvestmentAdvisorConfig(),
    defaultSymbols: ['AAA', 'BBB', 'CCC'],
    maxSymbols: 3,
    timeoutBudgetMs: 5_000,
    geminiNlgEnabled: false,
  };
}

describe('DexterStockAdvisoryService integration', () => {
  test('returns full advisory response with mocked provider', async () => {
    const loader = new CachedMarketDataLoader(new MockProvider(false), { cacheTtlMs: 60_000 });
    const service = new DexterStockAdvisoryService({
      config: testConfig(),
      loader,
      optimizer: new MockOptimizer(),
      now: () => Date.now(),
    });

    const result = await service.advise(
      {
        user_id: 'u1',
        query: 'which stock should i buy among AAA BBB CCC',
        risk_profile: {
          risk_band: 'unknown',
          horizon_months: 24,
          liquidity_need: 'low',
        },
        constraints: {
          education_only: true,
          suitability_required: true,
        },
        context_snapshot: {
          net_cashflow: 0,
          runway_months: 12,
          anomaly_flags: [],
        },
      },
      {
        traceId: 'trace-1',
        requestId: 'req-1',
        idempotencyKey: 'idem-1',
      }
    );

    expect(result.response.suitability_check.status).toBe('warn');
    expect(result.response.summary).toContain('moderate');
    expect(result.response.citations.some((item) => item.startsWith('mock://'))).toBeTrue();
    expect(result.response.audit_trail?.calls.length).toBeGreaterThan(0);
    expect(result.metadata.provider).toBe('mock_provider');
    expect(result.metadata.degraded).toBeFalse();
  });

  test('returns degraded advisory when provider times out', async () => {
    const loader = new CachedMarketDataLoader(new MockProvider(true), { cacheTtlMs: 60_000 });
    const service = new DexterStockAdvisoryService({
      config: testConfig(),
      loader,
      optimizer: new MockOptimizer(),
      now: () => Date.now(),
    });

    const result = await service.advise(
      {
        user_id: 'u2',
        query: 'portfolio allocation for AAA BBB',
        risk_profile: {
          risk_band: 'moderate',
          horizon_months: 12,
          liquidity_need: 'medium',
        },
        constraints: {
          education_only: true,
          suitability_required: true,
        },
        context_snapshot: {
          net_cashflow: 0,
          runway_months: 6,
          anomaly_flags: [],
        },
      },
      {
        traceId: 'trace-2',
        requestId: 'req-2',
        idempotencyKey: 'idem-2',
      }
    );

    expect(result.response.suitability_check.status).toBe('warn');
    expect(result.response.warnings.some((item) => item.includes('Failed to load market data'))).toBeTrue();
    expect(result.response.audit_trail?.calls.some((item) => item.status === 'error')).toBeTrue();
    expect(result.metadata.fallbackUsed).toBeTrue();
    expect(result.metadata.degraded).toBeTrue();
  });

  test('skips internal Gemini narrative rewrite when requested by caller', async () => {
    const loader = new CachedMarketDataLoader(new MockProvider(false), { cacheTtlMs: 60_000 });
    const rewriter = new CountingNarrativeRewriter();
    const service = new DexterStockAdvisoryService({
      config: testConfig(),
      loader,
      optimizer: new MockOptimizer(),
      narrativeRewriter: rewriter,
      now: () => Date.now(),
    });

    const result = await service.advise(
      {
        user_id: 'u3',
        query: 'allocation for AAA BBB',
        risk_profile: {
          risk_band: 'moderate',
          horizon_months: 12,
          liquidity_need: 'medium',
        },
        constraints: {
          education_only: true,
          suitability_required: true,
        },
        context_snapshot: {
          net_cashflow: 0,
          runway_months: 6,
          anomaly_flags: [],
        },
      },
      {
        traceId: 'trace-3',
        requestId: 'req-3',
        idempotencyKey: 'idem-3',
      },
      {
        skipNarrativeRewrite: true,
      }
    );

    expect(rewriter.calls).toBe(0);
    expect(result.response.audit_trail?.calls.some((item) => item.tool === 'gemini_nlg')).toBeFalse();
  });
});
