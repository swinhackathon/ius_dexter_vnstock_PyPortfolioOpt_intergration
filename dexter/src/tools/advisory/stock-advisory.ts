import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type {
  AdvisoryHeaders,
  StockAdvisoryRequest,
  StockAdvisoryResponse
} from '../../investment_advisor/types.js';
import { formatToolResult } from '../types.js';

const StockAdvisoryInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'User advisory query. Include sector, goals, and any known tickers. Example: "Phan bo danh muc ngan hang cho VCB BID CTG MBB".'
    ),
  user_id: z.string().default('ask-user').describe('Logical user id for advisory context tracking.'),
  risk_band: z
    .enum(['conservative', 'moderate', 'aggressive', 'unknown'])
    .default('unknown')
    .describe('Risk profile if known; use unknown when not explicitly provided by user.'),
  horizon_months: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe('Investment horizon in months when the user provides it.'),
  liquidity_need: z
    .string()
    .default('')
    .describe('Liquidity requirement if provided by user (e.g., high, medium, low).'),
  anomaly_flags: z
    .array(z.string())
    .default([])
    .describe('Optional context anomalies from upstream if available.'),
});

export interface StockAdvisoryToolDeps {
  advisoryService?: {
    advise(
      request: StockAdvisoryRequest,
      headers: AdvisoryHeaders,
      options?: { onProgress?: (message: string) => void; skipNarrativeRewrite?: boolean }
    ): Promise<{ response: StockAdvisoryResponse }>;
  };
}

function buildRequest(input: z.infer<typeof StockAdvisoryInputSchema>): StockAdvisoryRequest {
  return {
    user_id: input.user_id,
    query: input.query,
    risk_profile: {
      risk_band: input.risk_band,
      horizon_months: input.horizon_months,
      liquidity_need: input.liquidity_need,
    },
    constraints: {
      education_only: true,
      suitability_required: true,
    },
    context_snapshot: {
      net_cashflow: 0,
      runway_months: 0,
      anomaly_flags: input.anomaly_flags,
    },
  };
}

function buildHeaders(): AdvisoryHeaders {
  return {
    traceId: randomUUID(),
    requestId: randomUUID(),
    idempotencyKey: randomUUID(),
  };
}

function toToolData(response: StockAdvisoryResponse): Record<string, unknown> {
  return {
    summary: response.summary,
    alternatives: response.alternatives,
    suitability_check: response.suitability_check,
    confidence: response.confidence,
    warnings: response.warnings,
    trace_ref: response.trace_ref,
    audit_trail: response.audit_trail ?? { pipeline: [], calls: [] },
    market_snapshot: response.market_snapshot ?? {},
    portfolio_constraints: response.portfolio_constraints ?? {},
  };
}

function formatSubToolName(name: string): string {
  return name.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function emitAuditProgress(
  onProgress: ((msg: string) => void) | undefined,
  response: StockAdvisoryResponse
): void {
  const calls = response.audit_trail?.calls ?? [];
  for (const call of calls) {
    const toolName = formatSubToolName(call.tool);
    const symbolPart = call.symbol ? `(ticker=${call.symbol})` : '';
    const status = call.status.toUpperCase();
    const detail = call.detail ? ` - ${call.detail}` : '';
    onProgress?.(`${toolName}${symbolPart} [${status}]${detail}`);
  }
}

let defaultServicePromise:
  | Promise<{
      advise(
        request: StockAdvisoryRequest,
        headers: AdvisoryHeaders,
        options?: { onProgress?: (message: string) => void; skipNarrativeRewrite?: boolean }
      ): Promise<{ response: StockAdvisoryResponse }>;
    }>
  | null = null;

async function getDefaultAdvisoryService() {
  if (!defaultServicePromise) {
    defaultServicePromise = import('../../investment_advisor/service.js').then((module) =>
      module.createDefaultStockAdvisoryService()
    );
  }
  return defaultServicePromise;
}

export function createStockAdvisoryTool(deps: StockAdvisoryToolDeps = {}): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'stock_advisory',
    description:
      'Generate education-focused portfolio allocation guidance with internal suitability checks and risk-profile resolution. Use this for stock portfolio allocation and weight-splitting requests.',
    schema: StockAdvisoryInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      const advisoryService = deps.advisoryService ?? (await getDefaultAdvisoryService());
      const request = buildRequest(input);
      const { response } = await advisoryService.advise(request, buildHeaders(), {
        onProgress,
        skipNarrativeRewrite: true,
      });
      emitAuditProgress(onProgress, response);
      return formatToolResult(toToolData(response), response.citations);
    },
  });
}

export const stockAdvisoryTool = createStockAdvisoryTool();
