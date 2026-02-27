import { z } from 'zod';
import { callLlm } from '../model/llm.js';
import type { InvestmentAdvisorConfig } from './config.js';
import type { StockAdvisoryResponse } from './types.js';

export interface NarrativeRewriteInput {
  query: string;
  response: StockAdvisoryResponse;
}

export interface NarrativeRewriteResult {
  summary: string;
  alternatives: string[];
  rewritten: boolean;
  warning?: string;
}

export interface AdvisoryNarrativeRewriter {
  rewrite(input: NarrativeRewriteInput): Promise<NarrativeRewriteResult>;
}

const NarrativeOutputSchema = z.object({
  summary: z.string().min(1).max(700),
  alternatives: z.array(z.string().min(1).max(260)).min(1).max(5),
});

const NLG_SYSTEM_PROMPT = [
  'You are an editorial layer for an investment education API.',
  'Rewrite ONLY summary and alternatives to be clearer and more natural.',
  'Do not change any numbers, symbols, percentages, risk band meaning, suitability status, warnings, citations, confidence, or constraints.',
  'Do not add trade execution instructions.',
  'Output valid JSON matching the schema.',
].join('\n');

export class NoopNarrativeRewriter implements AdvisoryNarrativeRewriter {
  async rewrite(input: NarrativeRewriteInput): Promise<NarrativeRewriteResult> {
    return {
      summary: input.response.summary,
      alternatives: input.response.alternatives,
      rewritten: false,
    };
  }
}

function uniqueAlternatives(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export class GeminiNarrativeRewriter implements AdvisoryNarrativeRewriter {
  private readonly enabled: boolean;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: InvestmentAdvisorConfig) {
    this.enabled = config.geminiNlgEnabled;
    this.model = config.geminiNlgModel;
    this.timeoutMs = config.geminiNlgTimeoutMs;
  }

  async rewrite(input: NarrativeRewriteInput): Promise<NarrativeRewriteResult> {
    if (!this.enabled) {
      return {
        summary: input.response.summary,
        alternatives: input.response.alternatives,
        rewritten: false,
      };
    }

    if (!process.env.GOOGLE_API_KEY) {
      return {
        summary: input.response.summary,
        alternatives: input.response.alternatives,
        rewritten: false,
        warning: 'Gemini NLG skipped: GOOGLE_API_KEY is missing.',
      };
    }

    const llmPrompt = JSON.stringify(
      {
        query: input.query,
        summary: input.response.summary,
        alternatives: input.response.alternatives,
        suitability_check: input.response.suitability_check,
        warnings: input.response.warnings,
        confidence: input.response.confidence,
      },
      null,
      2
    );

    try {
      const signal = AbortSignal.timeout(this.timeoutMs);
      const { response } = await callLlm(llmPrompt, {
        model: this.model,
        systemPrompt: NLG_SYSTEM_PROMPT,
        outputSchema: NarrativeOutputSchema,
        signal,
      });

      const parsed = NarrativeOutputSchema.safeParse(response);
      if (!parsed.success) {
        return {
          summary: input.response.summary,
          alternatives: input.response.alternatives,
          rewritten: false,
          warning: `Gemini NLG fallback: invalid structured output (${parsed.error.issues[0]?.message ?? 'unknown error'}).`,
        };
      }

      return {
        summary: parsed.data.summary,
        alternatives: uniqueAlternatives(parsed.data.alternatives),
        rewritten: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        summary: input.response.summary,
        alternatives: input.response.alternatives,
        rewritten: false,
        warning: `Gemini NLG fallback: ${message}`,
      };
    }
  }
}

