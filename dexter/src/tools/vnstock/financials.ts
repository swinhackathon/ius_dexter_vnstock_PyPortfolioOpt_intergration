import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callVnstockApi } from './api.js';
import { formatToolResult } from '../types.js';

export const getVnstockFinancials = new DynamicStructuredTool({
  name: 'get_vnstock_financials',
  description:
    'Get key financial ratios and metrics for a Vietnamese company (P/E, ROE, ROA, EPS, profit margins, etc.)',
  schema: z.object({
    ticker: z
      .string()
      .describe(
        "Vietnamese stock ticker symbol (e.g., 'VCB' for Vietcombank, 'HPG' for Hoa Phat)"
      ),
  }),
  func: async (input) => {
    try {
      const { data, url } = await callVnstockApi(
        `/financials/${input.ticker}`,
        {},
        { cacheable: true } // Financial ratios can be cached
      );
      return formatToolResult(data, [url]);
    } catch (error) {
      throw new Error(
        `Failed to fetch financial ratios for ${input.ticker}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export const getVnstockBalanceSheet = new DynamicStructuredTool({
  name: 'get_vnstock_balance_sheet',
  description:
    'Get balance sheet data for a Vietnamese company (assets, liabilities, equity, etc.)',
  schema: z.object({
    ticker: z
      .string()
      .describe(
        "Vietnamese stock ticker symbol (e.g., 'VCB', 'ACB', 'MBB' for banks)"
      ),
  }),
  func: async (input) => {
    try {
      const { data, url } = await callVnstockApi(
        `/balance_sheet/${input.ticker}`,
        {},
        { cacheable: true } // Balance sheet data can be cached
      );
      return formatToolResult(data, [url]);
    } catch (error) {
      throw new Error(
        `Failed to fetch balance sheet for ${input.ticker}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export const getVnstockIncomeStatement = new DynamicStructuredTool({
  name: 'get_vnstock_income_statement',
  description:
    'Get income statement data for a Vietnamese company (revenue, profit, expenses, margins, etc.)',
  schema: z.object({
    ticker: z
      .string()
      .describe(
        "Vietnamese stock ticker symbol (e.g., 'VNM' for Vinamilk, 'SAB' for Sabeco)"
      ),
  }),
  func: async (input) => {
    try {
      const { data, url } = await callVnstockApi(
        `/income_statement/${input.ticker}`,
        {},
        { cacheable: true } // Income statement data can be cached
      );
      return formatToolResult(data, [url]);
    } catch (error) {
      throw new Error(
        `Failed to fetch income statement for ${input.ticker}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});
