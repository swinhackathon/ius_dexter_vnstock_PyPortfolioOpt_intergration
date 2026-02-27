import type { RiskBand, RiskProfile } from './types.js';

const VALID_RISK_BANDS: ReadonlySet<string> = new Set([
  'conservative',
  'moderate',
  'aggressive',
  'unknown',
]);

const QUERY_KEYWORDS: Record<Exclude<RiskBand, 'unknown'>, string[]> = {
  conservative: [
    'an toan',
    'an toàn',
    'it rui ro',
    'ít rủi ro',
    'bao toan',
    'bảo toàn',
    'low risk',
    'conservative',
  ],
  moderate: [
    'can bang',
    'cân bằng',
    'vua',
    'vừa',
    'balanced',
    'moderate',
  ],
  aggressive: [
    'rui ro cao',
    'rủi ro cao',
    'mao hiem',
    'mạo hiểm',
    'high risk',
    'aggressive',
  ],
};

export type RiskResolutionSource = 'payload' | 'query' | 'default';

export interface RiskResolution {
  profile: RiskProfile;
  source: RiskResolutionSource;
}

function normalizeRiskBand(value: string | undefined): RiskBand | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!VALID_RISK_BANDS.has(normalized)) {
    return null;
  }
  return normalized as RiskBand;
}

function inferRiskBandFromQuery(query: string): RiskBand | null {
  const lowerQuery = query.toLowerCase();
  for (const [band, keywords] of Object.entries(QUERY_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      return band as RiskBand;
    }
  }
  return null;
}

export function resolveRiskProfile(input: RiskProfile, query: string): RiskResolution {
  const payloadBand = normalizeRiskBand(input.risk_band);
  if (payloadBand && payloadBand !== 'unknown') {
    return {
      profile: {
        ...input,
        risk_band: payloadBand,
      },
      source: 'payload',
    };
  }

  const queryBand = inferRiskBandFromQuery(query);
  if (queryBand) {
    return {
      profile: {
        ...input,
        risk_band: queryBand,
      },
      source: 'query',
    };
  }

  return {
    profile: {
      ...input,
      risk_band: 'moderate',
    },
    source: 'default',
  };
}

