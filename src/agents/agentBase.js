import { generateJson, LLMError } from '../llm/llmClient.js';

export const persona = {
  technicalAgent: 'Technical Agent',
  hrAgent: 'HR & Culture Agent',
  skepticAgent: 'Skeptic Agent',
  hiringManagerAgent: 'Hiring Manager Agent'
};

export function buildPrompt(name, instructions, profile) {
  return `You are ${persona[name]}. ROUND ONE IS ISOLATED. You receive ONLY source documents below; do not assume other agents' views. Job Description is the benchmark. Never invent evidence. Every score/claim MUST include verbatim quote evidence from RESUME, TRANSCRIPT, or JD. If evidence is absent say exactly "Insufficient evidence in source documents".

Return ONLY a complete JSON object with this exact shape:
{"agent":"${persona[name]}","score":0,"confidence":0,"weight":0,"summary":"...","evidence":[{"claim":"...","source":"RESUME|TRANSCRIPT|JD","quote":"verbatim quote"}],"flags":[{"severity":"low|medium|high|critical","claim":"...","evidence":{"source":"...","quote":"..."}}],"stance":"..."}

Rules: score and confidence MUST be numbers from 0 to 100. Do not omit any top-level field. The agent field MUST be exactly "${persona[name]}".
INSTRUCTIONS: ${instructions}
RESUME:
${profile.resumeText}
TRANSCRIPT:
${profile.transcriptText}
JOB DESCRIPTION:
${profile.jdText}`;
}

function normalizeAgentOutput(name, output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new LLMError('Agent returned an empty or invalid JSON object.', 'INVALID_AGENT_OUTPUT');
  }
  const score = Number(output.score);
  const confidence = Number(output.confidence);
  if (!Number.isFinite(score) || !Number.isFinite(confidence)) {
    throw new LLMError('Agent response omitted a numeric score or confidence.', 'INVALID_AGENT_OUTPUT');
  }
  return {
    ...output,
    agent: persona[name],
    score: Math.max(0, Math.min(100, Math.round(score))),
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    weight: Math.max(0, Math.min(1, Number(output.weight) || 0)),
    summary: String(output.summary || ''),
    evidence: Array.isArray(output.evidence) ? output.evidence : [],
    flags: Array.isArray(output.flags) ? output.flags : [],
    stance: String(output.stance || '')
  };
}

export async function runAgent(name, instructions, profile) {
  const prompt = buildPrompt(name, instructions, profile);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const output = await generateJson(
        attempt === 0 ? prompt : prompt + '\n\nVALIDATION RETRY: Your previous response was incomplete. Return the full required JSON object with numeric score and confidence now.'
      );
      return normalizeAgentOutput(name, output);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function fallbackAgent(name, error) {
  return {
    agent: persona[name],
    score: null,
    confidence: 0,
    weight: 0,
    summary: 'Agent analysis was unavailable; no candidate conclusion was inferred.',
    evidence: [],
    flags: [{ severity: 'high', claim: 'Agent evaluation unavailable', evidence: { source: 'system', quote: 'Agent request failed. No candidate evidence was fabricated.' } }],
    stance: 'Insufficient evidence in source documents',
    error: { code: error.code || 'AGENT_FAILURE', message: error.message }
  };
}