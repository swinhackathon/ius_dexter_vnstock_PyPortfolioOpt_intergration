import { describe, expect, test } from 'bun:test';
import { GeminiNarrativeRewriter, NoopNarrativeRewriter } from './narrative-rewriter.js';
import { loadInvestmentAdvisorConfig } from './config.js';

const baseResponse = {
  summary: 'Education-focused allocation for moderate risk: AAA 50.0%, BBB 50.0%.',
  alternatives: ['CCC as watchlist alternative'],
  suitability_check: {
    status: 'warn' as const,
    reasons: ['Recommendation-style request detected.'],
  },
  citations: ['mock://source'],
  confidence: 0.8,
  warnings: ['Educational guidance only.'],
  trace_ref: 'trace:req',
};

describe('narrative rewriter', () => {
  test('noop rewriter keeps deterministic narrative', async () => {
    const rewriter = new NoopNarrativeRewriter();
    const result = await rewriter.rewrite({
      query: 'balanced allocation AAA BBB',
      response: baseResponse,
    });
    expect(result.rewritten).toBeFalse();
    expect(result.summary).toBe(baseResponse.summary);
    expect(result.alternatives).toEqual(baseResponse.alternatives);
  });

  test('gemini rewriter falls back safely when key is missing', async () => {
    const previous = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
      const rewriter = new GeminiNarrativeRewriter({
        ...loadInvestmentAdvisorConfig(),
        geminiNlgEnabled: true,
      });
      const result = await rewriter.rewrite({
        query: 'balanced allocation AAA BBB',
        response: baseResponse,
      });
      expect(result.rewritten).toBeFalse();
      expect(result.summary).toBe(baseResponse.summary);
      expect(result.warning).toContain('GOOGLE_API_KEY is missing');
    } finally {
      if (previous !== undefined) {
        process.env.GOOGLE_API_KEY = previous;
      }
    }
  });
});

