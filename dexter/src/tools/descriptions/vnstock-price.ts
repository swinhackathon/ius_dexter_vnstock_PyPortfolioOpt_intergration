export const VNSTOCK_HEALTH_DESCRIPTION = `
Health check for the Vietnamese stock market data service.

## When to Use

- Before querying Vietnamese stock data if uncertain about service availability
- Debugging connection issues with Vietnamese stock tools
- Verifying the vnstock service is running

## When NOT to Use

- For regular stock queries (other vnstock tools will handle connection errors)
- As a prerequisite for every Vietnamese stock query (unnecessary overhead)

## Usage Notes

- Returns service status and availability
- Minimal overhead, safe to call anytime
`.trim();

export const VNSTOCK_PRICE_DESCRIPTION = `
Real-time and intraday price data for Vietnamese stocks traded on HOSE, HNX, and UPCOM exchanges.

## When to Use

- User asks for current price, today's price, or latest price of Vietnamese stocks
- Questions like "What is VCB stock price?" or "How much is Vietcombank trading at?"
- Checking real-time market movements for Vietnamese equities
- Vietnamese ticker symbols mentioned (VCB, ACB, HPG, VNM, FPT, VIC, TCB, etc.)

## When NOT to Use

- Historical price data or price trends (use get_vnstock_history instead)
- Company fundamentals or financial statements (use get_vnstock_financials, get_vnstock_balance_sheet, or get_vnstock_income_statement)
- Market indices overall (use get_vnstock_index for VN-Index, HNX-Index, UPCOM-Index)
- Non-Vietnamese stocks (use standard financial tools)

## Usage Notes

- Ticker symbols are case-insensitive but typically uppercase (VCB, ACB, HPG)
- Returns intraday price data including open, high, low, close, volume
- Data is real-time or near real-time depending on exchange feed
- Common Vietnamese tickers: VCB (Vietcombank), ACB (Asia Commercial Bank), HPG (Hoa Phat), 
  VNM (Vinamilk), FPT (FPT Corp), VIC (Vingroup), TCB (Techcombank), MBB (Military Bank)
`.trim();

export const VNSTOCK_HISTORY_DESCRIPTION = `
Historical price data for Vietnamese stocks with customizable date ranges.

## When to Use

- User asks for historical prices, price trends, or past performance
- Questions like "VCB price over the last 6 months" or "HPG price history in 2024"
- Analyzing price movements, trends, or patterns over time
- Comparing historical performance across periods
- Technical analysis requiring historical OHLCV (Open, High, Low, Close, Volume) data

## When NOT to Use

- Current or today's price only (use get_vnstock_price for real-time data)
- Company fundamentals unrelated to price history
- Market-wide analysis (use get_vnstock_index for indices)

## Usage Notes

- Date format: YYYY-MM-DD (e.g., '2024-01-01', '2024-12-31')
- If start/end dates omitted, service returns default historical range
- Results are cached to improve performance for repeated queries
- Useful for period-over-period analysis, technical indicators, charting
- Can span multiple years for long-term trend analysis
`.trim();

export const VNSTOCK_PRICE_BOARD_DESCRIPTION = `
Multi-ticker price board showing real-time prices for multiple Vietnamese stocks simultaneously.

## When to Use

- Comparing prices across multiple Vietnamese stocks at once
- Questions like "Show me prices for VCB, ACB, and TCB" or "Compare Vietnamese bank stocks"
- Creating a watchlist or portfolio view
- Analyzing related stocks simultaneously (e.g., all banks, all tech stocks)
- Quick market snapshot for a sector or group

## When NOT to Use

- Single stock price lookup (use get_vnstock_price for efficiency)
- Historical comparison (use get_vnstock_history for each ticker)
- Detailed analysis of individual stocks (use specific tools for fundamentals)

## Usage Notes

- Accepts array of ticker symbols: ['VCB', 'ACB', 'TCB', 'MBB']
- Efficient for comparing 2-10 stocks simultaneously
- Returns standardized price data for easy comparison
- Ideal for sector analysis: banks (VCB, ACB, TCB, MBB), real estate (VIC, VHM, NVL), 
  steel (HPG, NKG, HSG), consumer goods (VNM, MSN, SAB)
`.trim();
