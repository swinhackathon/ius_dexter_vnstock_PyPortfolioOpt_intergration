import { describe, expect, test } from 'bun:test';
import type { InvestmentAdvisorConfig } from './config.js';
import { loadInvestmentAdvisorConfig } from './config.js';
import {
  resolveSymbolsFromQuery,
  type SymbolDiscoveryProvider,
} from './symbol-discovery.js';

class MockSymbolDiscoveryProvider implements SymbolDiscoveryProvider {
  name = 'mock_symbol_discovery';
  async discoverSymbols() {
    return {
      warnings: [],
      citations: ['mock://screener'],
      candidates: [
        { symbol: 'VCB', context: 'ngan hang vietcombank bank finance', citation: 'mock://screener' },
        { symbol: 'BID', context: 'ngan hang bidv commercial bank finance', citation: 'mock://screener' },
        { symbol: 'FPT', context: 'cong nghe technology software', citation: 'mock://screener' },
        { symbol: 'SSI', context: 'chung khoan securities brokerage retail', citation: 'mock://screener' },
        { symbol: 'VCI', context: 'chung khoan securities broker investment', citation: 'mock://screener' },
        { symbol: 'HCM', context: 'chung khoan securities brokerage', citation: 'mock://screener' },
      ],
    };
  }
}

class MockNoBrokerCandidatesProvider implements SymbolDiscoveryProvider {
  name = 'mock_symbol_discovery_no_broker';
  async discoverSymbols() {
    return {
      warnings: [],
      citations: ['mock://screener'],
      candidates: [
        { symbol: 'LBM', context: 'vat lieu xay dung', citation: 'mock://screener' },
        { symbol: 'HVN', context: 'hang khong aviation', citation: 'mock://screener' },
      ],
    };
  }
}

function baseConfig(): InvestmentAdvisorConfig {
  return {
    ...loadInvestmentAdvisorConfig(),
    maxSymbols: 3,
    defaultSymbols: [],
  };
}

describe('resolveSymbolsFromQuery', () => {
  test('uses explicit symbols from query when present', async () => {
    const result = await resolveSymbolsFromQuery(
      'phan bo danh muc cho VCB BID CTG',
      baseConfig(),
      new MockSymbolDiscoveryProvider(),
      Date.now() + 2_000
    );
    expect(result.source).toBe('query');
    expect(result.symbols).toEqual(['VCB', 'BID', 'CTG']);
  });

  test('selects symbols dynamically from discovered context', async () => {
    const result = await resolveSymbolsFromQuery(
      'toi muon dau tu ngan hang',
      baseConfig(),
      new MockSymbolDiscoveryProvider(),
      Date.now() + 2_000
    );
    expect(result.source).toBe('discovery');
    expect(result.symbols).toContain('VCB');
    expect(result.symbols).toContain('BID');
    expect(result.symbols).not.toContain('FPT');
  });

  test('detects ticker hints even when query uses lowercase symbols', async () => {
    const result = await resolveSymbolsFromQuery(
      'phan bo danh muc cho vcb bid',
      baseConfig(),
      new MockSymbolDiscoveryProvider(),
      Date.now() + 2_000
    );
    expect(result.symbols).toEqual(['VCB', 'BID']);
  });

  test('prioritizes preferred sector symbols for securities queries', async () => {
    const result = await resolveSymbolsFromQuery(
      'phan bo danh muc nganh chung khoan',
      baseConfig(),
      new MockSymbolDiscoveryProvider(),
      Date.now() + 2_000
    );
    expect(result.source).toBe('discovery');
    expect(result.symbols).toContain('SSI');
    expect(result.symbols).toContain('VCI');
  });

  test('falls back to sector-prior symbols when screener sample misses sector tickers', async () => {
    const result = await resolveSymbolsFromQuery(
      'phan bo danh muc nganh chung khoan',
      baseConfig(),
      new MockNoBrokerCandidatesProvider(),
      Date.now() + 2_000
    );
    expect(result.source).toBe('fallback');
    expect(result.symbols).toEqual(['SSI', 'VCI', 'HCM']);
  });
});
