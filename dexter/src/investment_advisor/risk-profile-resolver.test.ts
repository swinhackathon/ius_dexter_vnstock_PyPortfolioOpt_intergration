import { describe, expect, test } from 'bun:test';
import { resolveRiskProfile } from './risk-profile-resolver.js';

describe('resolveRiskProfile', () => {
  test('uses payload risk when valid', () => {
    const result = resolveRiskProfile(
      {
        risk_band: 'aggressive',
        horizon_months: 12,
        liquidity_need: 'medium',
      },
      'I want balanced allocation'
    );

    expect(result.profile.risk_band).toBe('aggressive');
    expect(result.source).toBe('payload');
  });

  test('infers risk from query keywords when payload is unknown', () => {
    const result = resolveRiskProfile(
      {
        risk_band: 'unknown',
        horizon_months: 0,
        liquidity_need: '',
      },
      'toi uu danh muc can bang va low risk'
    );

    expect(result.profile.risk_band).toBe('conservative');
    expect(result.source).toBe('query');
  });

  test('defaults to moderate when no payload or keyword signal exists', () => {
    const result = resolveRiskProfile(
      {
        risk_band: 'unknown',
        horizon_months: 0,
        liquidity_need: '',
      },
      'show me stock market overview'
    );

    expect(result.profile.risk_band).toBe('moderate');
    expect(result.source).toBe('default');
  });
});

