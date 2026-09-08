import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/agents/technicalAgent.js', () => ({ default: vi.fn().mockResolvedValue({ agent: 'Technical Agent', score: 80, confidence: 90, evidence: [], stance: 'positive' }) }));
vi.mock('../src/agents/hrAgent.js', () => ({ default: vi.fn().mockRejectedValue(Object.assign(new Error('HR unavailable'), { code: 'LLM_TIMEOUT' })) }));
vi.mock('../src/agents/skepticAgent.js', () => ({ default: vi.fn().mockResolvedValue({ agent: 'Skeptic Agent', score: 70, confidence: 80, evidence: [], stance: 'concerned' }) }));
vi.mock('../src/agents/hiringManagerAgent.js', () => ({ default: vi.fn().mockResolvedValue({ agent: 'Hiring Manager Agent', score: 85, confidence: 88, evidence: [], stance: 'positive' }) }));
vi.mock('../src/debate/debate.js', () => ({ runDebate: vi.fn().mockRejectedValue(new Error('debate unavailable')) }));
vi.mock('../src/decision/finalDecision.js', () => ({
  synthesizeFinalDecision: vi.fn().mockRejectedValue(new Error('decision unavailable')),
  fallbackDecision: vi.fn((agents, reason) => ({ recommendation: 'Conditional', confidence: 0, diagnostic: reason, strengths: [], concerns: [], unresolvedFriction: [] }))
}));

import { runPipeline } from '../src/pipeline.js';

describe('runPipeline resilience', () => {
  it('continues when an individual agent, debate, and synthesis fail', async () => {
    const progress = [];
    const result = await runPipeline({
      resumeText: 'Resume',
      transcriptText: 'Transcript',
      jdText: 'JD',
      skills: ['Python'],
      experience: ['5 years'],
      claims: ['Built services']
    }, { onProgress: event => progress.push(event) });

    expect(result.agents).toHaveLength(4);
    expect(result.agents[1].agent).toBe('HR & Culture Agent');
    expect(result.agents[1].error.code).toBe('LLM_TIMEOUT');
    expect(result.diagnostics.failedAgents).toContain('HR & Culture Agent');
    expect(result.diagnostics.debateFallback).toBe(true);
    expect(result.diagnostics.finalDecisionFallback).toBe(true);
    expect(progress.map(x => x.step)).toEqual([1, 2, 2, 3, 3, 4, 4]);
  });
});
