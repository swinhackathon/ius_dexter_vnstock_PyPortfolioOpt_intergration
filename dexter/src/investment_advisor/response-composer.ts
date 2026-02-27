import type { RiskResolutionSource } from './risk-profile-resolver.js';
import type { AdvisoryAuditTrail, StockAdvisoryResponse, SymbolFeatures } from './types.js';

export interface ComposeResponseInput {
  traceRef: string;
  riskBand: string;
  riskSource: RiskResolutionSource;
  weights: Record<string, number>;
  allocationMethod: 'pypfopt' | 'heuristic';
  alternatives: string[];
  suitabilityStatus: 'pass' | 'warn' | 'deny';
  suitabilityReasons: string[];
  citations: string[];
  warnings: string[];
  degraded: boolean;
  fallbackUsed: boolean;
  features: Record<string, SymbolFeatures>;
  educationOnly: boolean;
  auditTrail?: AdvisoryAuditTrail;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatWeight(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`;
}

function buildSummary(input: ComposeResponseInput): string {
  if (input.suitabilityStatus === 'deny') {
    return 'Dexter cannot provide direct execution instructions. I can help with education-focused portfolio analysis instead.';
  }

  const entries = Object.entries(input.weights).sort((left, right) => right[1] - left[1]);
  if (entries.length === 0) {
    return `No reliable allocation could be generated from current market data; use this as a watchlist discussion only. Risk profile resolved as ${input.riskBand}.`;
  }

  const allocationText = entries.map(([symbol, weight]) => `${symbol} ${formatWeight(weight)}`).join(', ');
  return `Education-focused allocation for ${input.riskBand} risk (${input.riskSource}): ${allocationText}.`;
}

function buildConfidence(input: ComposeResponseInput): number {
  let score = 0.78;
  if (input.degraded) score -= 0.18;
  if (input.fallbackUsed) score -= 0.1;
  if (input.suitabilityStatus === 'warn') score -= 0.06;
  if (input.suitabilityStatus === 'deny') score -= 0.2;
  if (Object.keys(input.weights).length < 2) score -= 0.08;
  return clamp(score, 0.05, 0.95);
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter((item) => item.trim().length > 0)));
}

export function composeAdvisoryResponse(input: ComposeResponseInput): StockAdvisoryResponse {
  const warnings = [...input.warnings];
  if (input.educationOnly) {
    warnings.push('Educational guidance only. This is not investment advice or an execution instruction.');
  }

  const marketSnapshot = Object.fromEntries(
    Object.entries(input.features).map(([symbol, metrics]) => [
      symbol,
      {
        annual_return: metrics.mean_return,
        annual_volatility: metrics.volatility,
        momentum: metrics.momentum,
        max_drawdown: metrics.drawdown,
      },
    ])
  );

  return {
    summary: buildSummary(input),
    alternatives: unique(input.alternatives),
    suitability_check: {
      status: input.suitabilityStatus,
      reasons: unique(input.suitabilityReasons),
    },
    citations: unique(input.citations),
    confidence: buildConfidence(input),
    warnings: unique(warnings),
    trace_ref: input.traceRef,
    audit_trail: input.auditTrail,
    market_snapshot: marketSnapshot,
    portfolio_constraints: {
      risk_band: input.riskBand,
      risk_source: input.riskSource,
      allocation_method: input.allocationMethod,
      allocation_weights: input.weights,
    },
  };
}
