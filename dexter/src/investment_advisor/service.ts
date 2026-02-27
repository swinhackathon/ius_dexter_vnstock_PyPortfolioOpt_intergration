import { loadInvestmentAdvisorConfig, type InvestmentAdvisorConfig } from './config.js';
import { buildFeatureSet } from './feature-builder.js';
import {
  CachedMarketDataLoader,
  createDefaultMarketDataLoader,
  type LoadMarketDataOutput,
} from './market-data.js';
import {
  PythonPyPortfolioOptOptimizer,
  type AllocationOptimizer,
  type OptimizationResult,
} from './optimizer.js';
import {
  heuristicWeightsFromRanking,
  isExecutionIntent,
  isRecommendationIntent,
  rankAndSelectSymbols,
} from './recommendation-engine.js';
import { composeAdvisoryResponse } from './response-composer.js';
import {
  GeminiNarrativeRewriter,
  type AdvisoryNarrativeRewriter,
} from './narrative-rewriter.js';
import { resolveRiskProfile } from './risk-profile-resolver.js';
import {
  createDefaultSymbolDiscoveryProvider,
  resolveSymbolsFromQuery,
  type SymbolDiscoveryProvider,
} from './symbol-discovery.js';
import type {
  AdvisoryAuditCall,
  AdvisoryComputationMetadata,
  AdvisoryHeaders,
  StockAdvisoryRequest,
  StockAdvisoryResponse,
} from './types.js';

export interface StockAdvisoryServiceDeps {
  config?: InvestmentAdvisorConfig;
  loader?: CachedMarketDataLoader;
  optimizer?: AllocationOptimizer;
  narrativeRewriter?: AdvisoryNarrativeRewriter;
  symbolDiscoveryProvider?: SymbolDiscoveryProvider;
  now?: () => number;
}

export interface StockAdvisoryResult {
  response: StockAdvisoryResponse;
  metadata: AdvisoryComputationMetadata;
}

export interface StockAdvisoryRunOptions {
  onProgress?: (message: string) => void;
  skipNarrativeRewrite?: boolean;
}

function buildTraceRef(headers: AdvisoryHeaders): string {
  return `${headers.traceId}:${headers.requestId}`;
}

function baseSuitabilityReasons(query: string): string[] {
  if (isRecommendationIntent(query)) {
    return [
      'Recommendation-style request detected. Validate suitability with full financial profile before acting.',
    ];
  }
  return [];
}

function createPipelineTrace(args: {
  riskBand: string;
  riskSource: string;
  symbolSource: string;
  resolvedSymbols: string[];
  loadedHistories: number;
  rankedCount: number;
  optimizationMethod: 'pypfopt' | 'heuristic';
  suitabilityStatus: 'pass' | 'warn' | 'deny';
  narrativeStage: 'gemini_rewrite' | 'deterministic_fallback' | 'skipped';
}): string[] {
  return [
    `risk_profile:${args.riskBand} (${args.riskSource})`,
    `symbol_resolution:${args.symbolSource} -> ${args.resolvedSymbols.join(', ') || 'none'}`,
    `market_data:${args.loadedHistories} histories loaded`,
    `feature_builder:${args.rankedCount} symbols ranked`,
    `allocation:${args.optimizationMethod}`,
    `suitability:${args.suitabilityStatus}`,
    `nlg:${args.narrativeStage}`,
  ];
}

function buildDenyResult(
  request: StockAdvisoryRequest,
  headers: AdvisoryHeaders
): StockAdvisoryResult {
  const response = composeAdvisoryResponse({
    traceRef: buildTraceRef(headers),
    riskBand: 'moderate',
    riskSource: 'default',
    weights: {},
    allocationMethod: 'heuristic',
    alternatives: [
      'Ask for a diversified watchlist and rationale instead of execution instructions.',
      'Ask for scenario analysis by risk band (conservative, moderate, aggressive).',
    ],
    suitabilityStatus: 'deny',
    suitabilityReasons: [
      'Direct buy/sell execution request detected. Dexter provides education-only guidance.',
    ],
    citations: [],
    warnings: request.constraints.education_only
      ? ['Execution is not supported.']
      : ['Execution is not supported through this endpoint.'],
    degraded: true,
    fallbackUsed: true,
    features: {},
    educationOnly: request.constraints.education_only,
    auditTrail: {
      pipeline: [
        'risk_profile:moderate (default)',
        'symbol_resolution:skipped',
        'market_data:skipped',
        'feature_builder:skipped',
        'allocation:heuristic',
        'suitability:deny',
        'nlg:deterministic_fallback',
      ],
      calls: [
        {
          tool: 'stock_advisory',
          status: 'fallback',
          detail: 'Execution-intent request denied (education-only policy).',
        },
      ],
    },
  });
  return {
    response,
    metadata: {
      provider: 'none',
      fallbackUsed: true,
      degraded: true,
    },
  };
}

function fallbackMarketDataResponse(reason: string): LoadMarketDataOutput {
  return {
    histories: {},
    citations: [],
    warnings: [reason],
    fallbackUsed: true,
    degraded: true,
    staleSymbols: [],
    provider: 'vnstock',
    audit: [],
  };
}

export class DexterStockAdvisoryService {
  private readonly config: InvestmentAdvisorConfig;
  private readonly loader: CachedMarketDataLoader;
  private readonly optimizer: AllocationOptimizer;
  private readonly narrativeRewriter: AdvisoryNarrativeRewriter;
  private readonly symbolDiscoveryProvider: SymbolDiscoveryProvider;
  private readonly now: () => number;

  constructor(deps: StockAdvisoryServiceDeps = {}) {
    this.config = deps.config ?? loadInvestmentAdvisorConfig();
    this.loader = deps.loader ?? createDefaultMarketDataLoader(this.config);
    this.optimizer = deps.optimizer ?? new PythonPyPortfolioOptOptimizer(this.config);
    this.narrativeRewriter = deps.narrativeRewriter ?? new GeminiNarrativeRewriter(this.config);
    this.symbolDiscoveryProvider =
      deps.symbolDiscoveryProvider ?? createDefaultSymbolDiscoveryProvider(this.config);
    this.now = deps.now ?? Date.now;
  }

  async advise(
    request: StockAdvisoryRequest,
    headers: AdvisoryHeaders,
    options?: StockAdvisoryRunOptions
  ): Promise<StockAdvisoryResult> {
    const onProgress = options?.onProgress;
    const skipNarrativeRewrite = options?.skipNarrativeRewrite ?? false;
    onProgress?.('Resolving suitability and risk profile...');
    if (isExecutionIntent(request.query)) {
      return buildDenyResult(request, headers);
    }

    const riskResolution = resolveRiskProfile(request.risk_profile, request.query);
    const deadlineAt = this.now() + this.config.timeoutBudgetMs;
    onProgress?.('Resolving symbols from query and market universe...');
    const symbolResolution = await resolveSymbolsFromQuery(
      request.query,
      this.config,
      this.symbolDiscoveryProvider,
      deadlineAt
    );
    const symbols = symbolResolution.symbols;

    let marketData: LoadMarketDataOutput;
    if (symbols.length === 0) {
      marketData = fallbackMarketDataResponse(
        'No symbols could be resolved from query and discovered market universe.'
      );
    } else {
      onProgress?.(`Loading market history for ${symbols.join(', ')}...`);
      try {
        marketData = await this.loader.loadMany({
          symbols,
          lookbackDays: this.config.lookbackDays,
          deadlineAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        marketData = fallbackMarketDataResponse(`Market data loader error: ${message}`);
      }
    }

    onProgress?.('Building risk and momentum features...');
    const features = buildFeatureSet(marketData.histories);
    const ranking = rankAndSelectSymbols(features, riskResolution.profile.risk_band, 4);
    const selectedSymbols = ranking.selected.filter((symbol) => symbol in marketData.histories);

    let optimization: OptimizationResult = {
      method: 'heuristic',
      weights: heuristicWeightsFromRanking(ranking.ranked, selectedSymbols),
      warnings: [],
    };

    if (selectedSymbols.length >= 2) {
      onProgress?.('Running portfolio optimizer...');
      try {
        optimization = await this.optimizer.optimize({
          riskBand: riskResolution.profile.risk_band,
          selectedSymbols,
          histories: marketData.histories,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        optimization = {
          method: 'heuristic',
          weights: heuristicWeightsFromRanking(ranking.ranked, selectedSymbols),
          warnings: [`Optimizer fallback to heuristic weights: ${message}`],
        };
      }
    } else if (selectedSymbols.length === 1) {
      optimization = {
        method: 'heuristic',
        weights: { [selectedSymbols[0]]: 1 },
        warnings: ['Only one valid symbol had sufficient market data.'],
      };
    } else {
      optimization = {
        method: 'heuristic',
        weights: {},
        warnings: ['No symbols had sufficient market data for allocation.'],
      };
    }

    const recommendationIntent = isRecommendationIntent(request.query);
    const suitabilityStatus = recommendationIntent ? 'warn' : 'pass';
    const suitabilityReasons = [
      ...baseSuitabilityReasons(request.query),
      ...(request.context_snapshot.anomaly_flags.length > 0
        ? [`Context anomaly flags present: ${request.context_snapshot.anomaly_flags.join(', ')}.`]
        : []),
    ];

    const alternatives = ranking.alternatives.length > 0
      ? ranking.alternatives
      : ['Insufficient alternatives from data; use broader symbol universe and rerun advisory.'];

    const citations = [
      ...marketData.citations,
      ...symbolResolution.citations,
      ...(optimization.method === 'pypfopt'
        ? ['https://github.com/PyPortfolio/PyPortfolioOpt']
        : []),
    ];
    const auditCalls: AdvisoryAuditCall[] = [
      ...symbolResolution.audit,
      ...marketData.audit,
      {
        tool: 'stock_optimizer',
        status: optimization.method === 'pypfopt' ? 'ok' : 'fallback',
        detail:
          optimization.method === 'pypfopt'
            ? 'PyPortfolioOpt optimization completed.'
            : optimization.warnings[0] ?? 'Heuristic allocation was used.',
      },
    ];

    const deterministic = composeAdvisoryResponse({
      traceRef: buildTraceRef(headers),
      riskBand: riskResolution.profile.risk_band,
      riskSource: riskResolution.source,
      weights: optimization.weights,
      allocationMethod: optimization.method,
      alternatives,
      suitabilityStatus,
      suitabilityReasons,
      citations,
      warnings: [...symbolResolution.warnings, ...marketData.warnings, ...optimization.warnings],
      degraded: marketData.degraded || optimization.method !== 'pypfopt',
      fallbackUsed: marketData.fallbackUsed || optimization.method !== 'pypfopt',
      features: features.bySymbol,
      educationOnly: request.constraints.education_only,
      auditTrail: {
        pipeline: createPipelineTrace({
          riskBand: riskResolution.profile.risk_band,
          riskSource: riskResolution.source,
          symbolSource: symbolResolution.source,
          resolvedSymbols: symbols,
          loadedHistories: Object.keys(marketData.histories).length,
          rankedCount: ranking.ranked.length,
          optimizationMethod: optimization.method,
          suitabilityStatus,
          narrativeStage: skipNarrativeRewrite ? 'skipped' : 'deterministic_fallback',
        }),
        calls: auditCalls,
      },
    });

    const rewritten = skipNarrativeRewrite
      ? {
          summary: deterministic.summary,
          alternatives: deterministic.alternatives,
          rewritten: false,
          warning: undefined,
        }
      : await this.narrativeRewriter.rewrite({
          query: request.query,
          response: deterministic,
        });
    if (!skipNarrativeRewrite) {
      onProgress?.(
        rewritten.rewritten
          ? 'Applying Gemini NLG rewrite...'
          : 'Using deterministic narrative fallback...'
      );
    }
    const nlgAuditCall: AdvisoryAuditCall | null = skipNarrativeRewrite
      ? null
      : {
          tool: 'gemini_nlg',
          status: rewritten.rewritten ? 'ok' : 'fallback',
          detail: rewritten.rewritten
            ? 'Summary and alternatives were rewritten by Gemini.'
            : rewritten.warning ?? 'Deterministic summary retained.',
        };
    const auditTrail = {
      pipeline: createPipelineTrace({
        riskBand: riskResolution.profile.risk_band,
        riskSource: riskResolution.source,
        symbolSource: symbolResolution.source,
        resolvedSymbols: symbols,
        loadedHistories: Object.keys(marketData.histories).length,
        rankedCount: ranking.ranked.length,
        optimizationMethod: optimization.method,
        suitabilityStatus,
        narrativeStage: skipNarrativeRewrite
          ? 'skipped'
          : rewritten.rewritten
            ? 'gemini_rewrite'
            : 'deterministic_fallback',
      }),
      calls: [
        ...auditCalls,
        ...(nlgAuditCall ? [nlgAuditCall] : []),
      ],
    };
    const response: StockAdvisoryResponse = {
      ...deterministic,
      summary: rewritten.summary,
      alternatives: rewritten.alternatives.length > 0 ? rewritten.alternatives : deterministic.alternatives,
      warnings: rewritten.warning
        ? Array.from(new Set([...deterministic.warnings, rewritten.warning]))
        : deterministic.warnings,
      audit_trail: auditTrail,
    };

    return {
      response,
      metadata: {
        provider: marketData.provider,
        fallbackUsed: marketData.fallbackUsed || optimization.method !== 'pypfopt',
        degraded: marketData.degraded || optimization.method !== 'pypfopt',
      },
    };
  }
}

export function createDefaultStockAdvisoryService(): DexterStockAdvisoryService {
  return new DexterStockAdvisoryService();
}
