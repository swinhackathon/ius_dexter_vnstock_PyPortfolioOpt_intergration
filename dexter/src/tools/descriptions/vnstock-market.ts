export const VNSTOCK_COMPANY_DESCRIPTION = `
Company profile and overview information for Vietnamese companies including company name, industry sector, business description, and corporate details.

## When to Use

- User asks about what a company does, its business, or corporate information
- Questions like "What does VIC do?" or "Tell me about FPT Corporation"
- Understanding company background, industry classification, or sector
- Getting high-level company overview before deeper financial analysis
- Identifying company's main business activities and products/services

## When NOT to Use

- Financial data, ratios, or performance metrics (use get_vnstock_financials)
- Stock price or market data (use get_vnstock_price)
- Financial statements (use get_vnstock_balance_sheet or get_vnstock_income_statement)

## Usage Notes

- Returns company profile including name, industry, business description
- Results are cached (company profiles don't change frequently)
- Useful as context before financial analysis
- Helps identify what sector or industry a ticker represents
- Examples: VIC is Vingroup (conglomerate), FPT is FPT Corp (technology), VNM is Vinamilk (consumer goods)
`.trim();

export const VNSTOCK_INDEX_DESCRIPTION = `
Current values and data for Vietnamese stock market indices including VN-Index (HOSE), HNX-Index (HNX), and UPCOM-Index.

## When to Use

- User asks about Vietnamese market indices or overall market performance
- Questions like "What is VN-Index today?" or "How is Vietnamese stock market performing?"
- Getting market-wide view or benchmark performance
- Understanding overall market trends and movements
- Comparing individual stocks to market indices
- Questions mentioning "Vietnam stock market", "HOSE index", "market today"

## When NOT to Use

- Individual stock prices (use get_vnstock_price)
- Specific company analysis (use other vnstock tools) 
- International indices or non-Vietnamese markets (use standard financial tools)

## Usage Notes

- **IMPORTANT**: Direct VN-Index data has limitations in vnstock library
- As an alternative, use blue-chip stocks (VCB, VIC, HPG) as market proxies
- For detailed market analysis, consider using get_vnstock_screener to see top stocks on HOSE
- VN-Index: Main index for Ho Chi Minh Stock Exchange (HOSE) - largest Vietnamese exchange
- HNX-Index: Index for Hanoi Stock Exchange (HNX) - second largest
- UPCOM-Index: Index for Unlisted Public Company Market
- Consider using browser tool to fetch real-time VN-Index from cafef.vn or vietstock.vn if needed
`.trim();

export const VNSTOCK_GOLD_DESCRIPTION = `
Current gold prices in Vietnam including SJC gold, PNJ gold, and other precious metals pricing.

## When to Use

- User asks about gold prices in Vietnam
- Questions like "What is gold price today?" or "How much is SJC gold?"
- Precious metals pricing in Vietnamese market
- Comparing gold prices across different brands/types
- Understanding Vietnamese gold market (distinct from international spot prices)

## When NOT to Use

- International gold spot prices (use standard commodity tools)
- Stock-related queries (use other vnstock or financial tools)
- Other commodities besides gold

## Usage Notes

- SJC gold: State-owned brand, widely recognized in Vietnam
- PNJ gold: Private jewelry company, popular brand
- Vietnamese gold prices often differ from international spot due to local market dynamics
- Prices typically in VND (Vietnamese Dong) per unit
- Gold is a common investment vehicle in Vietnam alongside stocks
- Real-time or near real-time pricing
`.trim();

export const VNSTOCK_SCREENER_DESCRIPTION = `
Stock screening and filtering tool for Vietnamese stocks by exchange. Returns lists of stocks with key metrics for market overview and discovery.

## When to Use

- User asks to see all stocks on a specific exchange
- Questions like "Show me HOSE stocks" or "What are the largest companies in Vietnam?"
- Getting market overview or discovering stocks in specific exchanges
- Finding stocks to analyze when no specific ticker mentioned
- Broad market scans or sector analysis starting points
- Questions about "Vietnamese blue chips" or "top Vietnamese stocks"

## When NOT to Use

- Specific ticker already identified (use targeted tools directly)
- Detailed analysis of known companies
- Price or fundamental data for specific stocks (use other vnstock tools)

## Usage Notes

- HOSE (Ho Chi Minh Stock Exchange): Largest exchange, blue-chip companies, ~400 stocks
- HNX (Hanoi Stock Exchange): Mid-cap companies, ~350 stocks
- UPCOM (Unlisted Public Company Market): Smaller companies, less liquid
- Default limit is 20 stocks; increase for comprehensive scans
- Returns key metrics for quick comparison and filtering
- Useful starting point for market exploration and stock discovery
- Blue-chip Vietnamese stocks typically trade on HOSE (VCB, VIC, HPG, VNM, etc.)
`.trim();
