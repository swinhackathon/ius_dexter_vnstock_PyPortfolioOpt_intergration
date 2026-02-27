import { describe, expect, test } from 'bun:test';
import {
  StockAdvisoryRequestSchema,
  StockAdvisoryResponseSchema,
} from './types.js';

describe('stock advisory contract schema', () => {
  test('accepts valid advisory request and applies defaults', () => {
    const parsed = StockAdvisoryRequestSchema.parse({
      user_id: 'user-123',
      query: 'suggest moderate portfolio for VCB FPT',
      risk_profile: {
        risk_band: 'moderate',
      },
    });

    expect(parsed.constraints.education_only).toBeTrue();
    expect(parsed.context_snapshot.anomaly_flags).toEqual([]);
  });

  test('rejects invalid request payload', () => {
    const parsed = StockAdvisoryRequestSchema.safeParse({
      query: '',
    });

    expect(parsed.success).toBeFalse();
  });

  test('accepts valid response schema', () => {
    const parsed = StockAdvisoryResponseSchema.parse({
      summary: 'Education-only allocation',
      alternatives: ['Alternative 1'],
      suitability_check: {
        status: 'warn',
        reasons: ['Recommendation-style request'],
      },
      citations: ['https://example.com'],
      confidence: 0.6,
      warnings: ['Educational only'],
      trace_ref: 'trace:request',
    });

    expect(parsed.trace_ref).toBe('trace:request');
  });
});

