export const VNSTOCK_FINANCIALS_DESCRIPTION = `
Key financial ratios and metrics for Vietnamese companies including P/E ratio, ROE, ROA, EPS, profit margins, and more.

## When to Use

- User asks about financial ratios, valuation multiples, or profitability metrics
- Questions like "What is VCB's P/E ratio?" or "How profitable is Hoa Phat?"
- Analyzing company financial health and performance indicators
- Comparing valuation metrics (P/E, P/B, EV/EBITDA)
- Assessing profitability (ROE, ROA, profit margins, ROIC)
- Evaluating leverage and financial stability (debt ratios, current ratio)

## When NOT to Use

- Detailed balance sheet items (use get_vnstock_balance_sheet)
- Detailed income statement items (use get_vnstock_income_statement)
- Stock price data (use get_vnstock_price or get_vnstock_history)
- Company description or business overview (use get_vnstock_company)

## Usage Notes

- Returns computed ratios and metrics (not raw financial statements)
- Includes profitability ratios: ROE, ROA, profit margins (gross, operating, net)
- Includes valuation ratios: P/E, P/B, EV/EBITDA (if available)
- Includes efficiency ratios: asset turnover, inventory turnover
- Results are cached for performance
- Ideal for quick financial health assessment and peer comparison
`.trim();

export const VNSTOCK_BALANCE_SHEET_DESCRIPTION = `
Balance sheet data for Vietnamese companies showing assets, liabilities, and shareholders' equity.

## When to Use

- User asks about assets, liabilities, equity, or balance sheet items
- Questions like "What are VCB's total assets?" or "How much debt does HPG have?"
- Analyzing company financial position and capital structure
- Evaluating liquidity (current assets, cash, working capital)
- Assessing leverage (total debt, debt-to-equity)
- Understanding asset composition (fixed assets, intangibles, investments)

## When NOT to Use

- Income/revenue/profit questions (use get_vnstock_income_statement)
- Financial ratios (use get_vnstock_financials for computed metrics)
- Stock valuation based on earnings (use get_vnstock_income_statement and get_vnstock_financials)

## Usage Notes

- Standard balance sheet structure: Assets = Liabilities + Equity
- Includes current and non-current classifications
- Useful for analyzing financial structure and stability
- Results are cached for performance
- Combine with income statement for comprehensive financial analysis
- Common Vietnamese company examples: VCB (bank balance sheet), HPG (manufacturing assets)
`.trim();

export const VNSTOCK_INCOME_STATEMENT_DESCRIPTION = `
Income statement data for Vietnamese companies showing revenue, expenses, profits, and margins.

## When to Use

- User asks about revenue, profit, earnings, sales, or income statement items
- Questions like "What is VNM's revenue?" or "How much profit did FPT make?"
- Analyzing company profitability and operational performance
- Evaluating revenue growth trends
- Understanding cost structure (COGS, operating expenses, interest, taxes)
- Calculating profit margins (gross, operating, net)

## When NOT to Use

- Balance sheet items like assets or debt (use get_vnstock_balance_sheet)
- Pre-computed financial ratios (use get_vnstock_financials)
- Cash flow analysis (if available in separate tools)

## Usage Notes

- Standard income statement structure: Revenue → Expenses → Profit
- Includes gross profit, operating profit (EBIT), and net profit
- Shows cost breakdowns: COGS, operating expenses, interest, taxes
- Results are cached for performance
- Useful for profitability analysis and margin trends
- Combine with balance sheet for ROE, ROA calculations
- Common queries: revenue growth, profit margins, earnings performance
`.trim();
