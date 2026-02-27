import { setTimeout as sleep } from 'node:timers/promises';
import type { InvestmentAdvisorConfig } from './config.js';
import type { AdvisoryAuditCall, PricePoint } from './types.js';

export interface FetchHistoryInput {
  symbol: string;
  startDate: string;
  endDate: string;
  deadlineAt: number;
}

export interface ProviderHistoryResult {
  symbol: string;
  prices: PricePoint[];
  source: string;
}

export interface MarketDataProvider {
  name: string;
  fetchHistory(input: FetchHistoryInput): Promise<ProviderHistoryResult>;
}

interface VnstockProviderOptions {
  baseUrl: string;
  maxRetries: number;
  requestTimeoutMs: number;
}

interface CachedHistoryEntry {
  symbol: string;
  prices: PricePoint[];
  source: string;
  cachedAt: number;
}

interface SingleLoadResult {
  symbol: string;
  prices: PricePoint[];
  citation: string;
  warnings: string[];
  fallbackUsed: boolean;
  staleUsed: boolean;
  audit: AdvisoryAuditCall;
}

export interface LoadMarketDataInput {
  symbols: string[];
  lookbackDays: number;
  deadlineAt: number;
}

export interface LoadMarketDataOutput {
  histories: Record<string, PricePoint[]>;
  citations: string[];
  warnings: string[];
  fallbackUsed: boolean;
  degraded: boolean;
  staleSymbols: string[];
  provider: string;
  audit: AdvisoryAuditCall[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseDateValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return null;
}

function parseCloseValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pickField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function normalizeHistoryRows(rawData: unknown): PricePoint[] {
  const rows = Array.isArray(rawData) ? rawData : [];
  const normalized: PricePoint[] = [];

  for (const row of rows) {
    const asObject = asRecord(row);
    if (!asObject) continue;
    const dateValue = pickField(asObject, ['time', 'date', 'datetime', 'trading_date', 'tradingDate', 'Date']);
    const closeValue = pickField(asObject, [
      'close',
      'Close',
      'close_price',
      'closePrice',
      'gia_dong_cua',
      'match_price',
      'price',
    ]);
    const date = parseDateValue(dateValue);
    const close = parseCloseValue(closeValue);
    if (!date || close === null || close <= 0) {
      continue;
    }
    normalized.push({ date, close });
  }

  normalized.sort((left, right) => left.date.localeCompare(right.date));

  const deduped = new Map<string, PricePoint>();
  for (const point of normalized) {
    deduped.set(point.date, point);
  }
  return Array.from(deduped.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

export class VnstockMarketDataProvider implements MarketDataProvider {
  readonly name = 'vnstock';
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly requestTimeoutMs: number;

  constructor(options: VnstockProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.maxRetries = Math.max(0, options.maxRetries);
    this.requestTimeoutMs = Math.max(500, options.requestTimeoutMs);
  }

  async fetchHistory(input: FetchHistoryInput): Promise<ProviderHistoryResult> {
    const symbol = input.symbol.toUpperCase();
    const endpoint = `${this.baseUrl}/history/${encodeURIComponent(symbol)}?start=${encodeURIComponent(input.startDate)}&end=${encodeURIComponent(input.endDate)}`;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const remainingBudget = input.deadlineAt - Date.now();
      if (remainingBudget <= 100) {
        throw new Error(`Timeout budget exhausted while fetching ${symbol}`);
      }
      const timeoutMs = Math.min(remainingBudget, this.requestTimeoutMs);
      try {
        const response = await fetch(endpoint, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          const status = response.status;
          const detail = await response.text().catch(() => response.statusText);
          if (isRetryableStatus(status) && attempt < this.maxRetries) {
            await sleep(Math.min(1_000 * (attempt + 1), 2_500));
            continue;
          }
          throw new Error(`Market data request failed for ${symbol}: ${status} ${detail}`);
        }
        const payload = await response.json();
        const asPayload = asRecord(payload);
        const rows = asPayload && 'data' in asPayload ? asPayload.data : payload;
        const prices = normalizeHistoryRows(rows);
        if (prices.length < 20) {
          throw new Error(`Insufficient history points for ${symbol}`);
        }
        return {
          symbol,
          prices,
          source: endpoint,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= this.maxRetries) {
          break;
        }
        await sleep(Math.min(1_000 * (attempt + 1), 2_500));
      }
    }

    throw lastError ?? new Error(`Failed to fetch market data for ${symbol}`);
  }
}

export interface MarketDataLoaderOptions {
  cacheTtlMs: number;
}

export class CachedMarketDataLoader {
  private readonly provider: MarketDataProvider;
  private readonly cache = new Map<string, CachedHistoryEntry>();
  private readonly cacheTtlMs: number;

  constructor(provider: MarketDataProvider, options: MarketDataLoaderOptions) {
    this.provider = provider;
    this.cacheTtlMs = Math.max(1_000, options.cacheTtlMs);
  }

  private isFresh(entry: CachedHistoryEntry): boolean {
    return Date.now() - entry.cachedAt <= this.cacheTtlMs;
  }

  private async loadSymbol(
    symbol: string,
    startDate: string,
    endDate: string,
    deadlineAt: number
  ): Promise<SingleLoadResult> {
    const key = symbol.toUpperCase();
    const cached = this.cache.get(key);
    if (cached && this.isFresh(cached)) {
      return {
        symbol: key,
        prices: cached.prices,
        citation: cached.source,
        warnings: [],
        fallbackUsed: false,
        staleUsed: false,
        audit: {
          tool: 'get_vnstock_history',
          status: 'cache_hit',
          symbol: key,
          endpoint: cached.source,
          detail: 'Served from fresh in-memory cache.',
        },
      };
    }

    try {
      const result = await this.provider.fetchHistory({
        symbol: key,
        startDate,
        endDate,
        deadlineAt,
      });
      const entry: CachedHistoryEntry = {
        symbol: key,
        prices: result.prices,
        source: result.source,
        cachedAt: Date.now(),
      };
      this.cache.set(key, entry);
      return {
        symbol: key,
        prices: result.prices,
        citation: result.source,
        warnings: [],
        fallbackUsed: false,
        staleUsed: false,
        audit: {
          tool: 'get_vnstock_history',
          status: 'ok',
          symbol: key,
          endpoint: result.source,
        },
      };
    } catch (error) {
      if (cached) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          symbol: key,
          prices: cached.prices,
          citation: cached.source,
          warnings: [
            `Using stale cached data for ${key} because refresh failed (${message}).`,
          ],
          fallbackUsed: true,
          staleUsed: true,
          audit: {
            tool: 'get_vnstock_history',
            status: 'fallback',
            symbol: key,
            endpoint: cached.source,
            detail: `Stale cache used because refresh failed (${message}).`,
          },
        };
      }
      throw error;
    }
  }

  async loadMany(input: LoadMarketDataInput): Promise<LoadMarketDataOutput> {
    const uniqueSymbols = Array.from(
      new Set(input.symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))
    );
    const endDate = formatDate(new Date());
    const startDate = formatDate(new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1_000));

    const histories: Record<string, PricePoint[]> = {};
    const citations: string[] = [];
    const warnings: string[] = [];
    const staleSymbols: string[] = [];
    const audit: AdvisoryAuditCall[] = [];
    let fallbackUsed = false;

    const results = await Promise.allSettled(
      uniqueSymbols.map((symbol) => this.loadSymbol(symbol, startDate, endDate, input.deadlineAt))
    );

    for (let index = 0; index < results.length; index += 1) {
      const symbol = uniqueSymbols[index];
      const result = results[index];
      if (result.status === 'fulfilled') {
        const loaded = result.value;
        histories[loaded.symbol] = loaded.prices;
        citations.push(loaded.citation);
        warnings.push(...loaded.warnings);
        audit.push(loaded.audit);
        if (loaded.fallbackUsed) {
          fallbackUsed = true;
        }
        if (loaded.staleUsed) {
          staleSymbols.push(loaded.symbol);
        }
      } else {
        fallbackUsed = true;
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        warnings.push(`Failed to load market data for ${symbol}: ${reason}`);
        audit.push({
          tool: 'get_vnstock_history',
          status: 'error',
          symbol,
          detail: reason,
        });
      }
    }

    return {
      histories,
      citations,
      warnings,
      fallbackUsed,
      degraded: warnings.length > 0 || Object.keys(histories).length < uniqueSymbols.length,
      staleSymbols,
      provider: this.provider.name,
      audit,
    };
  }
}

export function createDefaultMarketDataLoader(
  config: InvestmentAdvisorConfig
): CachedMarketDataLoader {
  return new CachedMarketDataLoader(
    new VnstockMarketDataProvider({
      baseUrl: config.providerBaseUrl,
      maxRetries: config.maxRetries,
      requestTimeoutMs: config.requestTimeoutMs,
    }),
    {
      cacheTtlMs: config.cacheTtlMs,
    }
  );
}
