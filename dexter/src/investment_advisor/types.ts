import { z } from 'zod';

export const RISK_BANDS = ['conservative', 'moderate', 'aggressive', 'unknown'] as const;

export const RiskBandSchema = z.enum(RISK_BANDS);

export type RiskBand = z.infer<typeof RiskBandSchema>;

export interface RiskProfile {
  risk_band: RiskBand;
  horizon_months: number;
  liquidity_need: string;
}

export interface AdvisoryConstraints {
  education_only: boolean;
  suitability_required: boolean;
}

export interface AdvisoryContextSnapshot {
  net_cashflow: number;
  runway_months: number;
  anomaly_flags: string[];
}

export interface StockAdvisoryRequest {
  user_id: string;
  query: string;
  risk_profile: RiskProfile;
  constraints: AdvisoryConstraints;
  context_snapshot: AdvisoryContextSnapshot;
}

export const RiskProfileInputSchema = z
  .object({
    risk_band: RiskBandSchema.optional(),
    horizon_months: z.number().int().nonnegative().optional(),
    liquidity_need: z.string().optional(),
  })
  .optional();

export const AdvisoryConstraintsSchema = z
  .object({
    education_only: z.boolean().default(true),
    suitability_required: z.boolean().default(true),
  })
  .default({
    education_only: true,
    suitability_required: true,
  });

export const AdvisoryContextSnapshotSchema = z
  .object({
    net_cashflow: z.number().default(0),
    runway_months: z.number().default(0),
    anomaly_flags: z.array(z.string()).default([]),
  })
  .default({
    net_cashflow: 0,
    runway_months: 0,
    anomaly_flags: [],
  });

export const StockAdvisoryRequestSchema = z
  .object({
    user_id: z.string().trim().min(1),
    query: z.string().trim().min(1),
    risk_profile: RiskProfileInputSchema,
    constraints: AdvisoryConstraintsSchema.optional(),
    context_snapshot: AdvisoryContextSnapshotSchema.optional(),
  })
  .transform((payload): StockAdvisoryRequest => ({
    user_id: payload.user_id,
    query: payload.query,
    risk_profile: {
      risk_band: payload.risk_profile?.risk_band ?? 'unknown',
      horizon_months: payload.risk_profile?.horizon_months ?? 0,
      liquidity_need: payload.risk_profile?.liquidity_need ?? '',
    },
    constraints: payload.constraints ?? {
      education_only: true,
      suitability_required: true,
    },
    context_snapshot: payload.context_snapshot ?? {
      net_cashflow: 0,
      runway_months: 0,
      anomaly_flags: [],
    },
  }));

export const SuitabilityCheckSchema = z.object({
  status: z.enum(['pass', 'warn', 'deny']),
  reasons: z.array(z.string()),
});

export interface StockAdvisoryResponse {
  summary: string;
  alternatives: string[];
  suitability_check: z.infer<typeof SuitabilityCheckSchema>;
  citations: string[];
  confidence: number;
  warnings: string[];
  trace_ref: string;
  audit_trail?: AdvisoryAuditTrail;
  market_snapshot?: Record<string, unknown>;
  portfolio_constraints?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

export const AdvisoryAuditCallSchema = z.object({
  tool: z.string(),
  status: z.enum(['ok', 'cache_hit', 'fallback', 'error']),
  endpoint: z.string().optional(),
  symbol: z.string().optional(),
  detail: z.string().optional(),
});

export const AdvisoryAuditTrailSchema = z.object({
  pipeline: z.array(z.string()),
  calls: z.array(AdvisoryAuditCallSchema),
});

export interface AdvisoryAuditCall {
  tool: string;
  status: z.infer<typeof AdvisoryAuditCallSchema>['status'];
  endpoint?: string;
  symbol?: string;
  detail?: string;
}

export interface AdvisoryAuditTrail {
  pipeline: string[];
  calls: AdvisoryAuditCall[];
}

export const StockAdvisoryResponseSchema = z
  .object({
    summary: z.string(),
    alternatives: z.array(z.string()),
    suitability_check: SuitabilityCheckSchema,
    citations: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string()),
    trace_ref: z.string(),
    audit_trail: AdvisoryAuditTrailSchema.optional(),
    market_snapshot: z.record(z.string(), z.unknown()).optional(),
    portfolio_constraints: z.record(z.string(), z.unknown()).optional(),
    constraints: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export interface AdvisoryHeaders {
  traceId: string;
  requestId: string;
  idempotencyKey: string;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface SymbolFeatures {
  symbol: string;
  mean_return: number;
  volatility: number;
  momentum: number;
  drawdown: number;
}

export interface FeatureSet {
  bySymbol: Record<string, SymbolFeatures>;
  returns: Record<string, number[]>;
}

export interface AdvisoryComputationMetadata {
  provider: string;
  fallbackUsed: boolean;
  degraded: boolean;
}
