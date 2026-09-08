import { describe, expect, it, vi, beforeEach } from 'vitest';

const { generateJson } = vi.hoisted(() => ({ generateJson: vi.fn() }));

vi.mock('../src/llm/llmClient.js', () => ({
  generateJson,
  LLMError: class LLMError extends Error {
    constructor(message, code = 'LLM_ERROR') {
      super(message);
      this.code = code;
    }
  }
}));

import { buildPrompt, fallbackAgent, runAgent } from '../src/agents/agentBase.js';

const profile = { resumeText: 'Resume evidence', transcriptText: 'Transcript evidence', jdText: 'Job description' };

describe('agentBase', () => {
  beforeEach(() => generateJson.mockReset());

  it('builds an isolated prompt requiring evidence', () => {
    const prompt = buildPrompt('technicalAgent', 'Assess skills.', profile);
    expect(prompt).toContain('ROUND ONE IS ISOLATED');
    expect(prompt).toContain('verbatim quote evidence');
  });

  it('normalizes numeric strings and clamps invalid ranges', async () => {
    generateJson.mockResolvedValue({ score: '110', confidence: '-5', weight: '2', summary: 'ok', evidence: 'invalid', flags: null, stance: 'positive' });
    const result = await runAgent('hrAgent', 'Assess culture fit.', profile);
    expect(result.agent).toBe('HR & Culture Agent');
    expect(result.score).toBe(100);
    expect(result.confidence).toBe(0);
    expect(result.weight).toBe(1);
    expect(result.evidence).toEqual([]);
  });

  it('retries once after structurally invalid output', async () => {
    generateJson
      .mockResolvedValueOnce({ score: 'bad', confidence: 90 })
      .mockResolvedValueOnce({ score: 80, confidence: 90, summary: 'valid', evidence: [], flags: [], stance: 'positive' });
    const result = await runAgent('technicalAgent', 'Assess skills.', profile);
    expect(generateJson).toHaveBeenCalledTimes(2);
    expect(result.score).toBe(80);
  });

  it('returns an explicit safe fallback after failure', () => {
    const result = fallbackAgent('skepticAgent', Object.assign(new Error('service failed'), { code: 'LLM_TIMEOUT' }));
    expect(result.score).toBeNull();
    expect(result.error.code).toBe('LLM_TIMEOUT');
    expect(result.agent).toBe('Skeptic Agent');
  });
});
