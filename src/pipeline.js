import technicalAgent from './agents/technicalAgent.js';
import hrAgent from './agents/hrAgent.js';
import skepticAgent from './agents/skepticAgent.js';
import hiringManagerAgent from './agents/hiringManagerAgent.js';
import { fallbackAgent } from './agents/agentBase.js';
import { runDebate } from './debate/debate.js';
import { synthesizeFinalDecision, fallbackDecision } from './decision/finalDecision.js';

const wrap = (name, fn, profile) => fn(profile).catch(error => fallbackAgent(name, error));

export async function runPipeline(profile, { onProgress = () => {} } = {}) {
  onProgress({ step: 1, status: 'complete' });
  onProgress({ step: 2, status: 'running' });

  // Independent agents run in parallel. A failed/timed-out agent becomes a
  // structured fallback so the pipeline can always advance to debate/finalization.
  const agents = await Promise.all([
    wrap('technicalAgent', technicalAgent, profile),
    wrap('hrAgent', hrAgent, profile),
    wrap('skepticAgent', skepticAgent, profile),
    wrap('hiringManagerAgent', hiringManagerAgent, profile)
  ]);

  onProgress({ step: 2, status: 'complete', agents });
  onProgress({ step: 3, status: 'running' });

  let debate;
  try {
    debate = await runDebate(profile, agents);
  } catch (error) {
    debate = {
      transcript: [],
      agreedPoints: [],
      disagreedPoints: [{ point: 'Debate unavailable', agents: [], evidence: [] }],
      shiftedStances: [],
      unresolvedStances: agents.map(a => ({
        agent: a.agent,
        stance: a.stance || 'Unavailable',
        evidence: a.evidence || []
      })),
      error: error.message
    };
  }

  onProgress({ step: 3, status: 'complete' });
  onProgress({ step: 4, status: 'running' });

  let finalDecision;
  try {
    finalDecision = await synthesizeFinalDecision(profile, agents, debate);
  } catch (error) {
    finalDecision = fallbackDecision(agents, error.message);
  }

  onProgress({ step: 4, status: 'complete' });
  return {
    profile: { skills: profile.skills, experience: profile.experience },
    agents,
    debate,
    finalDecision,
    diagnostics: {
      failedAgents: agents.filter(a => a.error).map(a => a.agent),
      debateFallback: Boolean(debate.error),
      finalDecisionFallback: Boolean(finalDecision.diagnostic)
    }
  };
}
