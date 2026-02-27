import { describe, expect, test } from 'bun:test';
import { createStockAdvisoryTool } from './stock-advisory.js';
import type { StockAdvisoryRequest } from '../../investment_advisor/types.js';
import type { AdvisoryHeaders } from '../../investment_advisor/types.js';

class MockAdvisoryService {
  calls = 0;

  async advise(
    _request: StockAdvisoryRequest,
    headers: AdvisoryHeaders,
    _options?: { onProgress?: (message: string) => void; skipNarrativeRewrite?: boolean }
  ) {
    this.calls += 1;
    return {
      response: {
        summary: 'mock advisory',
        alternatives: ['alt'],
        suitability_check: {
          status: 'warn' as const,
          reasons: ['mock reason'],
        },
        citations: ['mock://source'],
        confidence: 0.7,
        warnings: ['mock warning'],
        trace_ref: `${headers.traceId}:${headers.requestId}`,
        audit_trail: {
          pipeline: ['risk_profile:moderate (payload)'],
          calls: [{ tool: 'get_vnstock_history', status: 'ok' as const, symbol: 'VCB' }],
        },
        portfolio_constraints: {
          allocation_weights: {
            VCB: 0.5,
            BID: 0.5,
          },
        },
      },
      metadata: {
        provider: 'mock',
        fallbackUsed: false,
        degraded: false,
      },
    };
  }
}

describe('stock_advisory tool', () => {
  test('returns formatted advisory payload for agent consumption', async () => {
    const mockService = new MockAdvisoryService();
    const tool = createStockAdvisoryTool({
      advisoryService: mockService,
    });

    const resultRaw = await tool.invoke({
      query: 'phan bo danh muc ngan hang',
    });
    const result = JSON.parse(resultRaw as string);

    expect(mockService.calls).toBe(1);
    expect(result.data.summary).toBe('mock advisory');
    expect(result.data.suitability_check.status).toBe('warn');
    expect(result.data.portfolio_constraints.allocation_weights.VCB).toBe(0.5);
    expect(result.sourceUrls).toEqual(['mock://source']);
  });
});
