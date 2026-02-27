import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { InvestmentAdvisorConfig } from './config.js';
import type { PricePoint, RiskBand } from './types.js';

export interface OptimizationInput {
  riskBand: RiskBand;
  selectedSymbols: string[];
  histories: Record<string, PricePoint[]>;
}

export interface OptimizationResult {
  weights: Record<string, number>;
  method: 'pypfopt' | 'heuristic';
  warnings: string[];
}

export interface AllocationOptimizer {
  optimize(input: OptimizationInput): Promise<OptimizationResult>;
}

function normalizeWeights(
  weights: Record<string, number>,
  selectedSymbols: string[]
): Record<string, number> {
  const cleaned: Record<string, number> = {};
  for (const symbol of selectedSymbols) {
    const value = weights[symbol];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      cleaned[symbol] = value;
    }
  }
  const total = Object.values(cleaned).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    const fallback = 1 / selectedSymbols.length;
    return Object.fromEntries(selectedSymbols.map((symbol) => [symbol, fallback]));
  }
  return Object.fromEntries(
    Object.entries(cleaned).map(([symbol, value]) => [symbol, value / total])
  );
}

interface PythonOptimizerOutput {
  weights?: Record<string, number>;
  method?: string;
  warning?: string;
  error?: string;
  missing_dependency?: boolean;
}

function runPythonOptimizer(
  pythonBin: string,
  timeoutMs: number,
  payload: Record<string, unknown>
): Promise<PythonOptimizerOutput> {
  return new Promise((resolve, reject) => {
    const scriptPath = fileURLToPath(new URL('./python/pypfopt_optimizer.py', import.meta.url));
    const child = spawn(pythonBin, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      reject(new Error('PyPortfolioOpt optimizer timed out'));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code !== 0) {
        const message = stderr.trim() || `optimizer exited with code ${code}`;
        reject(new Error(message));
        return;
      }
      const output = stdout.trim();
      if (!output) {
        reject(new Error('PyPortfolioOpt optimizer returned empty output'));
        return;
      }
      try {
        const parsed = JSON.parse(output) as PythonOptimizerOutput;
        resolve(parsed);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse optimizer output: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        );
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export class PythonPyPortfolioOptOptimizer implements AllocationOptimizer {
  private readonly pythonBin: string;
  private readonly timeoutMs: number;

  constructor(config: InvestmentAdvisorConfig) {
    this.pythonBin = config.pythonBin;
    this.timeoutMs = config.pythonTimeoutMs;
  }

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    const payload = {
      risk_band: input.riskBand,
      price_history: Object.fromEntries(
        input.selectedSymbols.map((symbol) => [symbol, input.histories[symbol] ?? []])
      ),
    };

    const output = await runPythonOptimizer(this.pythonBin, this.timeoutMs, payload);
    if (output.error) {
      throw new Error(output.error);
    }
    if (!output.weights || Object.keys(output.weights).length === 0) {
      throw new Error('Optimizer did not return weights');
    }
    const normalized = normalizeWeights(output.weights, input.selectedSymbols);
    return {
      weights: normalized,
      method: 'pypfopt',
      warnings: output.warning ? [output.warning] : [],
    };
  }
}

