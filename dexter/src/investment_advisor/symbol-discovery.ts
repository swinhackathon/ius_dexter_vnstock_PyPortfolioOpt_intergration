import { setTimeout as sleep } from 'node:timers/promises';
import type { InvestmentAdvisorConfig } from './config.js';
import type { AdvisoryAuditCall } from './types.js';

export interface SymbolCandidate {
  symbol: string;
  context: string;
  citation: string;
}

export interface SymbolDiscoveryResult {
  candidates: SymbolCandidate[];
  warnings: string[];
  citations: string[];
  audit?: AdvisoryAuditCall[];
}

export interface SymbolDiscoveryProvider {
  name: string;
  discoverSymbols(input: { deadlineAt: number; limitPerExchange: number }): Promise<SymbolDiscoveryResult>;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function extractSymbolFromRow(row: Record<string, unknown>): string | null {
  const candidates = [
    row.symbol,
    row.ticker,
    row.code,
    row.stock_code,
    row.stockCode,
    row.ma,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim().toUpperCase();
    if (/^[A-Z]{2,6}$/.test(normalized)) {
      return normalized;
    }
  }
  return null;
}

function rowContext(row: Record<string, unknown>): string {
  const values = Object.values(row)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));
  return normalizeText(values.join(' | '));
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

interface VnstockSymbolDiscoveryProviderOptions {
  baseUrl: string;
  requestTimeoutMs: number;
  maxRetries: number;
}

export class VnstockSymbolDiscoveryProvider implements SymbolDiscoveryProvider {
  readonly name = 'vnstock_screener';
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: VnstockSymbolDiscoveryProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.requestTimeoutMs = Math.max(1_000, options.requestTimeoutMs);
    this.maxRetries = Math.max(0, options.maxRetries);
  }

  private async fetchExchange(
    exchange: 'HOSE' | 'HNX' | 'UPCOM',
    limitPerExchange: number,
    deadlineAt: number
  ): Promise<{ rows: Record<string, unknown>[]; citation: string }> {
    const url = `${this.baseUrl}/screener?exchange=${exchange}&limit=${limitPerExchange}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const remaining = deadlineAt - Date.now();
      if (remaining <= 100) {
        throw new Error(`Symbol discovery timeout for ${exchange}`);
      }
      const timeoutMs = Math.min(remaining, this.requestTimeoutMs);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) {
          const detail = await response.text().catch(() => response.statusText);
          if (isRetryableStatus(response.status) && attempt < this.maxRetries) {
            await sleep(Math.min(500 * (attempt + 1), 2_000));
            continue;
          }
          throw new Error(`${exchange} screener failed: ${response.status} ${detail}`);
        }
        const payload = await response.json();
        const objectPayload = asRecord(payload);
        const data = objectPayload?.data;
        const rows = Array.isArray(data)
          ? data
              .map((item) => asRecord(item))
              .filter((item): item is Record<string, unknown> => item !== null)
          : [];
        return {
          rows,
          citation: url,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= this.maxRetries) break;
        await sleep(Math.min(500 * (attempt + 1), 2_000));
      }
    }

    throw lastError ?? new Error(`Failed to load screener for ${exchange}`);
  }

  async discoverSymbols(input: { deadlineAt: number; limitPerExchange: number }): Promise<SymbolDiscoveryResult> {
    const warnings: string[] = [];
    const citations: string[] = [];
    const audit: AdvisoryAuditCall[] = [];
    const bySymbol = new Map<string, SymbolCandidate>();

    const exchanges: Array<'HOSE' | 'HNX' | 'UPCOM'> = ['HOSE', 'HNX', 'UPCOM'];
    const results = await Promise.allSettled(
      exchanges.map((exchange) => this.fetchExchange(exchange, input.limitPerExchange, input.deadlineAt))
    );

    for (let index = 0; index < results.length; index += 1) {
      const exchange = exchanges[index];
      const result = results[index];
      if (result.status === 'rejected') {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        warnings.push(`Failed to load ${exchange} screener: ${reason}`);
        audit.push({
          tool: 'get_vnstock_screener',
          status: 'error',
          endpoint: `${this.baseUrl}/screener?exchange=${exchange}&limit=${input.limitPerExchange}`,
          detail: reason,
        });
        continue;
      }
      citations.push(result.value.citation);
      audit.push({
        tool: 'get_vnstock_screener',
        status: 'ok',
        endpoint: result.value.citation,
      });
      for (const row of result.value.rows) {
        const symbol = extractSymbolFromRow(row);
        if (!symbol) continue;
        if (bySymbol.has(symbol)) continue;
        bySymbol.set(symbol, {
          symbol,
          context: rowContext(row),
          citation: result.value.citation,
        });
      }
    }

    return {
      candidates: Array.from(bySymbol.values()),
      warnings,
      citations,
      audit,
    };
  }
}

export interface SymbolResolutionResult {
  symbols: string[];
  warnings: string[];
  citations: string[];
  source: 'query' | 'discovery' | 'fallback';
  audit: AdvisoryAuditCall[];
}

const TOKEN_STOPWORDS = new Set([
  'toi',
  'muon',
  'dau',
  'tu',
  'vao',
  'mot',
  'so',
  'doanh',
  'nghiep',
  'hay',
  'giup',
  'phan',
  'bo',
  'danh',
  'muc',
  'phu',
  'hop',
  'for',
  'with',
  'and',
  'the',
  'into',
  'help',
  'me',
  'please',
  'portfolio',
  'allocation',
  'invest',
  'stocks',
  'stock',
  'suggest',
  'balanced',
  'moderate',
  'aggressive',
  'conservative',
  'nganh',
  'chung',
  'khoan',
  'co',
  'phieu',
  'duoc',
  'khong',
  'nam',
  'nay',
  'cao',
  'thap',
  'rui',
  'ro',
  'trong',
  'nua',
  'giup',
  'hoi',
]);

const SECTOR_PREFERRED_SYMBOLS: Array<{ keywords: string[]; symbols: string[] }> = [
  {
    keywords: ['ngan hang', 'bank', 'banking'],
    symbols: ['VCB', 'BID', 'CTG', 'MBB', 'ACB', 'TCB', 'VPB', 'HDB', 'STB', 'EIB'],
  },
  {
    keywords: ['chung khoan', 'securities', 'brokerage'],
    symbols: ['SSI', 'VCI', 'HCM', 'VND', 'MBS', 'CTS', 'SHS', 'FTS', 'BSI', 'AGR'],
  },
];

function queryTokens(query: string): string[] {
  return normalizeText(query)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TOKEN_STOPWORDS.has(token));
}

function extractSymbolsFromQuery(query: string): string[] {
  const explicit = query.match(/\b[A-Z]{2,6}\b/g) ?? [];
  return Array.from(
    new Set(
      explicit.map((item) => item.trim().toUpperCase()).filter((item) => /^[A-Z]{2,6}$/.test(item))
    )
  );
}

function candidateSymbolHints(query: string): Set<string> {
  const words = query.match(/\b[a-zA-Z]{2,6}\b/g) ?? [];
  return new Set(words.map((word) => word.toUpperCase()));
}

function preferredSymbolsBySector(query: string): string[] {
  const normalized = normalizeText(query);
  for (const rule of SECTOR_PREFERRED_SYMBOLS) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.symbols;
    }
  }
  return [];
}

export async function resolveSymbolsFromQuery(
  query: string,
  config: InvestmentAdvisorConfig,
  provider: SymbolDiscoveryProvider,
  deadlineAt: number
): Promise<SymbolResolutionResult> {
  const explicit = extractSymbolsFromQuery(query);
  if (explicit.length > 0) {
    return {
      symbols: explicit.slice(0, config.maxSymbols),
      warnings: [],
      citations: [],
      source: 'query',
      audit: [],
    };
  }

  const discovered = await provider.discoverSymbols({
    deadlineAt,
    limitPerExchange: Math.max(config.maxSymbols * 20, 60),
  });

  const symbolHints = candidateSymbolHints(query);
  if (symbolHints.size > 0) {
    const hintedSymbols = discovered.candidates
      .map((candidate) => candidate.symbol)
      .filter((symbol) => symbolHints.has(symbol))
      .slice(0, config.maxSymbols);
    if (hintedSymbols.length > 0) {
      return {
        symbols: hintedSymbols,
        warnings: discovered.warnings,
        citations: discovered.citations,
        source: 'discovery',
        audit: discovered.audit ?? [],
      };
    }
  }

  const preferred = preferredSymbolsBySector(query);
  if (preferred.length > 0) {
    const discoveredSet = new Set(discovered.candidates.map((candidate) => candidate.symbol));
    const prioritized = preferred.filter((symbol) => discoveredSet.has(symbol)).slice(0, config.maxSymbols);
    if (prioritized.length > 0) {
      return {
        symbols: prioritized,
        warnings: discovered.warnings,
        citations: discovered.citations,
        source: 'discovery',
        audit: discovered.audit ?? [],
      };
    }
    return {
      symbols: preferred.slice(0, config.maxSymbols),
      warnings: [
        ...discovered.warnings,
        'Using sector-prior ticker universe because discovered sample did not contain enough sector matches.',
      ],
      citations: discovered.citations,
      source: 'fallback',
      audit: discovered.audit ?? [],
    };
  }

  const tokens = queryTokens(query);
  const minScore = tokens.length >= 4 ? 2 : 1;
  const scored = discovered.candidates
    .map((candidate) => {
      const score = tokens.reduce((sum, token) => (candidate.context.includes(token) ? sum + 1 : sum), 0);
      return {
        symbol: candidate.symbol,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);

  const selected = scored
    .filter((item) => item.score >= minScore)
    .slice(0, config.maxSymbols)
    .map((item) => item.symbol);

  if (selected.length > 0) {
    return {
      symbols: selected,
      warnings: discovered.warnings,
      citations: discovered.citations,
      source: 'discovery',
      audit: discovered.audit ?? [],
    };
  }

  if (config.defaultSymbols.length > 0) {
    return {
      symbols: config.defaultSymbols.slice(0, config.maxSymbols),
      warnings: [
        ...discovered.warnings,
        'Symbol discovery found no strong sector match; using configured fallback symbol universe.',
      ],
      citations: discovered.citations,
      source: 'fallback',
      audit: discovered.audit ?? [],
    };
  }

  const broadFallback = discovered.candidates
    .slice(0, config.maxSymbols)
    .map((candidate) => candidate.symbol);
  return {
    symbols: broadFallback,
    warnings: [
      ...discovered.warnings,
      'Symbol discovery had low semantic confidence; using top available symbols from market universe.',
    ],
    citations: discovered.citations,
    source: 'discovery',
    audit: discovered.audit ?? [],
  };
}

export function createDefaultSymbolDiscoveryProvider(
  config: InvestmentAdvisorConfig
): SymbolDiscoveryProvider {
  return new VnstockSymbolDiscoveryProvider({
    baseUrl: config.providerBaseUrl,
    requestTimeoutMs: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
  });
}
