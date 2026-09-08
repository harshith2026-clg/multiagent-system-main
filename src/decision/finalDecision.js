import { generateJson } from '../llm/llmClient.js';

export function fallbackDecision(agents, reason) {
  const live = agents.filter(a => a.score != null);
  return {
    recommendation: live.length ? 'Conditional' : 'Unable to complete evaluation',
    matchPercent: null,
    confidence: 0,
    strengths: [],
    concerns: [{ claim: 'Partial agent failure', evidence: [] }],
    unresolvedFriction: ['Insufficient evidence in source documents'],
    diagnostic: reason
  };
}

export async function synthesizeFinalDecision(profile, agents, debate) {
  const prompt = `Evidence-weighted hiring synthesis. Do NOT average scores. Weight severity of Skeptic flags, confidence, JD fit and evidence strength. RESUME/TRANSCRIPT/JD facts only. Agents:${JSON.stringify(agents)} Debate:${JSON.stringify(debate)}. Return JSON {recommendation:"Strong Hire|Conditional|Reject",matchPercent:0-100,confidence:0-100,strengths:[{claim,evidence:[{source,quote}]}],concerns:[{severity,claim,evidence:[{source,quote}]}],unresolvedFriction:[{point,evidence}],rationale:[{claim,evidence}]}. Every conclusion must trace to verbatim evidence.`;
  return generateJson(prompt, { timeoutMs: 30000 });
}
