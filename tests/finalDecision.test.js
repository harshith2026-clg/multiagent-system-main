import { describe, expect, it } from 'vitest';
import { fallbackDecision } from '../src/decision/finalDecision.js';

describe('fallbackDecision', () => {
  it('returns Conditional when at least one agent produced a usable score', () => {
    const result = fallbackDecision([{ score: 70 }, { score: null }], 'judge unavailable');
    expect(result.recommendation).toBe('Conditional');
    expect(result.diagnostic).toBe('judge unavailable');
  });

  it('does not fabricate a recommendation when every agent failed', () => {
    const result = fallbackDecision([{ score: null }, { score: null }], 'judge unavailable');
    expect(result.recommendation).toBe('Unable to complete evaluation');
    expect(result.confidence).toBe(0);
  });
});
