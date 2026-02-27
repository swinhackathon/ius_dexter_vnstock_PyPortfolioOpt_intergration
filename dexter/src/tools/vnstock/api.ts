import { readCache, writeCache } from '../../utils/cache.js';

const BASE_URL = process.env.VNSTOCK_API_URL || 'http://localhost:8050';

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callVnstockApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  options?: { cacheable?: boolean }
): Promise<{ data: unknown; url: string }> {
  // Check cache first if enabled
  if (options?.cacheable) {
    const cached = readCache(endpoint, params);
    if (cached) {
      return cached;
    }
  }

  // Build URL with query parameters
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  // Retry logic: 3 attempts with exponential backoff
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(
          `VNStock API request failed: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const json = await response.json();
      
      // Extract data from response (FastAPI service returns { ticker, data, timestamp })
      const data = json.data || json;
      const urlString = url.toString();

      // Cache if enabled
      if (options?.cacheable) {
        writeCache(endpoint, params, data, urlString);
      }

      return { data, url: urlString };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on connection refused or abort errors
      if (lastError.message.includes('ECONNREFUSED')) {
        throw new Error(
          'VNStock service is not available. Please ensure the FastAPI service is running on port 8050.'
        );
      }

      // Don't retry on 4xx errors
      if (lastError.message.includes('400') || lastError.message.includes('404')) {
        throw lastError;
      }

      // On last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }

  throw lastError || new Error('Unknown error calling VNStock API');
}
