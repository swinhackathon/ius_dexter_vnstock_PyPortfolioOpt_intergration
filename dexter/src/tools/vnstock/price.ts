import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callVnstockApi } from './api.js';
import { formatToolResult } from '../types.js';

export const getVnstockHealth = new DynamicStructuredTool({
  name: 'get_vnstock_health',
  description: 'Check if the Vietnamese stock market data service is available and healthy',
  schema: z.object({}),
  func: async () => {
    try {
      const { data, url } = await callVnstockApi('/health', {});
      return formatToolResult(data, [url]);
    } catch (error) {
      throw new Error(
        `VNStock health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export const getVnstockPrice = new DynamicStructuredTool({
  name: 'get_vnstock_price',
  description: 'Get real-time intraday price data for a Vietnamese stock ticker',
  schema: z.object({
    ticker: z
      .string()
      .describe(
        "Vietnamese stock ticker symbol (e.g., 'VCB' for Vietcombank, 'ACB' for Asia Commercial Bank, 'HPG' for Hoa Phat Group, 'VNM' for Vinamilk)"
      ),
  }),
  func: async (input) => {
    try {
      const { data, url } = await callVnstockApi(`/price/${input.ticker}`, {});
      return formatToolResult(data, [url]);
    } catch (error) {
      throw new Error(
        `Failed to fetch price for ${input.ticker}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export const getVnstockHistory = new DynamicStructuredTool({
  name: 'get_vnstock_history',
  description: 'Get historical price data for a Vietnamese stock with optional date range',
  schema: z.object({
    ticker: z
      .string()
      .describe("Vietnamese stock ticker symbol (e.g., 'VCB', 'ACB', 'HPG')"),
    start: z
      .string()
      .optional()
      .describe(
        "Start date in YYYY-MM-DD format (e.g., '2024-01-01'). If not provided, defaults to service's default range"
      ),
    end: z
      .string()
      .optional()
      .describe(
        "End date in YYYY-MM-DD format (e.g., '2024-12-31'). If not provided, defaults to current date"
      ),
  }),
  func: async (input) => {
    try {
      const params: Record<string, string | undefined> = {};
      if (input.start) params.start = input.start;
      if (input.end) params.end = input.end;

      const { data, url } = await callVnstockApi(
        `/history/${input.ticker}`,
        params,
        { cacheable: true } // Historical data can be cached
      );
      return formatToolResult(data, [url]);
    } catch (error) {
      throw new Error(
        `Failed to fetch history for ${input.ticker}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export const getVnstockPriceBoard = new DynamicStructuredTool({
  name: 'get_vnstock_price_board',
  description:
    'Get real-time price board for multiple Vietnamese stocks at once. Useful for comparing multiple tickers simultaneously',
  schema: z.object({
    tickers: z
      .array(z.string())
      .describe(
        "Array of Vietnamese stock ticker symbols (e.g., ['VCB', 'ACB', 'TCB'] for comparing banks)"
      ),
  }),
  func: async (input) => {
    try {
      const tickersParam = input.tickers.join(',');
      const { data, url } = await callVnstockApi('/board', {
        tickers: tickersParam,
      });
      return formatToolResult(data, [url]);
    } catch (error) {
      throw new Error(
        `Failed to fetch price board for ${input.tickers.join(', ')}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});
