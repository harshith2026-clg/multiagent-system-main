import { generateJson } from '../llm/llmClient.js';

export async function runDebate(profile, agents) {
  const prompt = `ROUND TWO MULTI-AGENT DEBATE. Source benchmark JD:\n${profile.jdText}\nIndependent outputs:\n${JSON.stringify(agents)}\nReturn JSON {transcript:[{speaker,target,stance,point,evidence:[{source,quote}]}],agreedPoints:[{point,agents,evidence}],disagreedPoints:[{point,agents,evidence}],shiftedStances:[{agent,from,to,reason,evidence}],unresolvedStances:[{agent,stance,evidence}]}. Force at least one direct challenge/agreement/refinement referencing another agent's specific point. Every factual statement needs verbatim source evidence; otherwise state insufficient evidence.`;
  return generateJson(prompt, { timeoutMs: 30000 });
}
