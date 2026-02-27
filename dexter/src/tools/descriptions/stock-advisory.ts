export const STOCK_ADVISORY_DESCRIPTION = `
Education-focused portfolio allocation tool for stock selection and weight splitting. Internally resolves risk profile, loads market data with retries/cache fallback, computes risk features, runs allocation optimization, and applies suitability checks. Returns deterministic structured data so the main /ask model can generate the final narrative.

## When to Use

- User asks to allocate a stock portfolio ("phan bo danh muc", "allocation", "weight split")
- User asks which stocks to include and how much each should weigh
- User asks for risk-band-adjusted stock basket suggestions
- User asks for diversified portfolio guidance with suitability warnings

## When NOT to Use

- Pure single-stock analysis without allocation needs (use vnstock tools or financial_search)
- Direct order execution requests (buy/sell now) without education intent
- Non-investment or non-financial questions

## Usage Notes

- Pass the user's full request in \`query\`
- Provide \`risk_band\` only if explicitly known; otherwise keep \`unknown\`
- The tool can infer symbols from query intent using live market universe data when tickers are omitted
- Returns structured advisory output including summary, alternatives, suitability_check, confidence, warnings, trace_ref, and audit_trail
- After calling this tool, avoid extra vnstock tool calls unless the user explicitly asks for raw fundamentals not present in advisory output
`.trim();
