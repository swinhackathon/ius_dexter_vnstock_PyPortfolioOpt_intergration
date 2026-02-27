export interface InvestmentAdvisorConfig {
  providerBaseUrl: string;
  cacheTtlMs: number;
  lookbackDays: number;
  requestTimeoutMs: number;
  timeoutBudgetMs: number;
  maxRetries: number;
  maxSymbols: number;
  defaultSymbols: string[];
  pythonBin: string;
  pythonTimeoutMs: number;
  geminiNlgEnabled: boolean;
  geminiNlgModel: string;
  geminiNlgTimeoutMs: number;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.toLowerCase() === 'true';
}

function parseSymbols(raw: string | undefined): string[] {
  if (!raw) return [];
  const symbols = raw
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length >= 2 && item.length <= 6);
  return symbols.length > 0 ? Array.from(new Set(symbols)) : [];
}

export function loadInvestmentAdvisorConfig(): InvestmentAdvisorConfig {
  return {
    providerBaseUrl: process.env.VNSTOCK_API_URL || 'http://localhost:8050',
    cacheTtlMs: readNumber('DEXTER_ADVISORY_CACHE_TTL_MS', 300_000),
    lookbackDays: readNumber('DEXTER_ADVISORY_LOOKBACK_DAYS', 180),
    requestTimeoutMs: readNumber('DEXTER_ADVISORY_PROVIDER_TIMEOUT_MS', 5_000),
    timeoutBudgetMs: readNumber('DEXTER_ADVISORY_TIMEOUT_BUDGET_MS', 12_000),
    maxRetries: readNumber('DEXTER_ADVISORY_PROVIDER_RETRIES', 2),
    maxSymbols: readNumber('DEXTER_ADVISORY_MAX_SYMBOLS', 6),
    defaultSymbols: parseSymbols(process.env.DEXTER_ADVISORY_DEFAULT_SYMBOLS),
    pythonBin: process.env.DEXTER_ADVISORY_PYTHON_BIN || 'python',
    pythonTimeoutMs: readNumber('DEXTER_ADVISORY_PYTHON_TIMEOUT_MS', 5_000),
    geminiNlgEnabled: readBoolean(
      'DEXTER_ADVISORY_GEMINI_NLG_ENABLED',
      Boolean(process.env.GOOGLE_API_KEY)
    ),
    geminiNlgModel: process.env.DEXTER_ADVISORY_GEMINI_NLG_MODEL || 'gemini-2.5-flash',
    geminiNlgTimeoutMs: readNumber('DEXTER_ADVISORY_GEMINI_NLG_TIMEOUT_MS', 4_000),
  };
}
