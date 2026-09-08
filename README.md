# Multi-Agent Candidate Evaluation System

**Vertical:** HR / Recruitment Tech

A web app where 4 independent AI personas (Technical, HR/Culture, Hiring
Manager, Skeptic) each review a candidate's resume + interview transcript on
their own, then **debate** with each other, and a final **Judge** step weighs
the evidence (not a simple average) to produce a hiring recommendation.

Runs with **zero API key** in a deterministic **Mock Mode** (so it's fully
demoable/gradeable out of the box), and automatically switches to real Claude
API calls the moment you add an `ANTHROPIC_API_KEY`.

---

## 1. Approach & Logic

The pipeline (`src/pipeline.js`) runs in five strict stages:

1. **Candidate Profile Builder** (`src/profile/profileBuilder.js`)
   Reads the raw resume + transcript text once and extracts a single shared
   JSON object: skills claimed, years of experience, education, resume
   claims, transcript highlights, notable projects. Every agent below reads
   from this *same* object — they never re-interpret the source text
   independently, which keeps their disagreements about *judgement*, not
   about *facts*.

2. **4 Independent Agents** (`src/agents/*.js`)
   Each agent is invoked with **its own separate LLM call**
   (`getIndependentOpinion` in `src/agents/agentBase.js`) and receives
   *only* the candidate profile — never another agent's opinion. Each must
   return a JSON opinion with a `score`, `verdict`, `confidence`, and
   **1–3 real quotes copied from the resume/transcript** as mandatory
   evidence (never a fabricated citation):
   - **Technical Agent** — technical skill & depth (architecture,
     trade-offs, specificity vs. buzzwords).
   - **HR / Culture Agent** — communication, teamwork, honesty/self-awareness.
   - **Hiring Manager Agent** — overall role fit & measurable business impact.
   - **Skeptic Agent** — contradictions between resume and transcript,
     exaggeration, vague/generic answers, red flags.

3. **Debate Stage** (`src/debate/debate.js`)
   This is a *real* multi-turn debate, not four opinions shown side by side:
   - The Skeptic's opening concern is broadcast to the other three agents.
   - Each of the other three agents makes a **separate LLM call** that
     directly reads the Skeptic's stated opinion and must respond with an
     explicit `stance` (`agree` / `disagree` / `partially agree`), a
     rebuttal that engages with the *specific* point raised, and an
     `updatedScore` (which may or may not change).
   - The Skeptic then makes one more call, reading all three rebuttals, and
     gives a closing remark — deciding if its concern was resolved,
     partially resolved, or still stands.

4. **Final Decision — NOT an average** (`src/decision/finalDecision.js`)
   A separate "Judge" persona reviews the initial opinions *and* the full
   debate transcript *and* the post-debate scores, then reasons in prose
   about how much weight each piece of evidence deserves. Concretely (mock
   mode implements this explicitly, and the live-mode system prompt
   instructs the LLM the same way):
   - Technical (35%) + Hiring Manager (35%) + HR/Culture (30%) form a
     "business-fit" composite.
   - The Skeptic's **post-debate** score acts as a cap/veto: if a credible
     concern was *not* resolved in the debate, the composite score is
     capped (e.g. an otherwise-90 business-fit score cannot become a
     "Strong Hire" if there's an unresolved integrity concern) — this is
     the "reasoning step," explicitly not `(a+b+c+d)/4`.

5. **Final Report**
   Assembles: `finalRecommendation`, `confidenceLevel`, `strengths`,
   `concerns`, and `unresolvedDisagreements` (things the debate did not
   fully settle), plus the full profile, all 4 initial opinions, and the
   full debate transcript for transparency.

## 2. How the Solution Works

- **Backend:** Node.js + Express (`server.js`). One endpoint,
  `POST /api/evaluate`, accepts either JSON (`resumeText`,
  `transcriptText`, `roleHint`) or multipart file uploads
  (`resumeFile`, `transcriptFile` as plain `.txt`), runs the full pipeline,
  and returns the assembled report as JSON.
- **Frontend:** Plain HTML/CSS/JS single page (`public/`). Paste or load a
  sample resume + transcript, click **Run Multi-Agent Evaluation**, and the
  UI renders the candidate profile, the 4 independent opinion cards (with
  quotes and score bars), the debate timeline, and the final decision panel
  side by side.
- **LLM client** (`src/llm/llmClient.js`): wraps the Google Gemini API.
  If `ANTHROPIC_API_KEY` is unset (or `FORCE_MOCK_MODE=true`), every call
  transparently uses a deterministic heuristic fallback instead — so the
  *exact same code path and JSON contract* is exercised whether or not a
  key is configured. If a live call throws for any reason (bad key, rate
  limit, network), it also gracefully falls back to the heuristic instead
  of crashing the demo.
- **Bonus — Voice debate:** the "🔊 Play Debate" button in the UI uses the
  browser's built-in `SpeechSynthesis` API to read the debate transcript
  aloud, giving each persona a distinct pitch/rate so it's recognizable
  by ear.

## 3. Running It

```bash
npm install
npm start
# open http://localhost:3000
```

By default this runs in **Mock Mode** — click "Load Sample Resume +
Transcript" and then "Run Multi-Agent Evaluation" to see the whole pipeline
end to end with zero configuration.

To use real Gemini API calls:

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

## 4. Sample Data

`sample_data/sample_resume.txt` and `sample_data/sample_transcript.txt`
contain a realistic candidate (Aditya Rao, Backend Engineer) with a
deliberate discrepancy: the resume says "Managed a team of 4 engineers,"
but in the transcript the candidate clarifies "Honestly, I didn't formally
manage anyone... it was really technical leadership, not people
management." This is designed so the **Skeptic Agent** flags it
independently, the debate stage produces genuine back-and-forth about how
serious the discrepancy is, and the final Judge has to explicitly decide
how much that unresolved nuance should weigh against otherwise strong
technical and business-impact evidence.

You can also paste in your own resume/transcript text, or upload `.txt`
files via the API directly.

## 5. Assumptions Made

- Resume and transcript are provided as **plain text** (copy-pasted or
  `.txt`). Parsing PDF/DOCX resumes is out of scope for this challenge
  submission — a production version would add a document-parsing step
  ahead of the Candidate Profile Builder.
- "Debate" is modeled as a structured, evidence-grounded exchange where the
  Skeptic's concerns are the focal point (since contradictions/red flags
  are the most decision-relevant disagreements to resolve), rather than an
  unstructured free-for-all between all 4 agents — this keeps the debate
  reasoning traceable and reproducible.
- Mock Mode heuristics are intentionally simple (keyword/sentence
  matching) — their purpose is to prove the *architecture* (independent
  calls → debate → non-averaging judge) works correctly end-to-end without
  requiring API spend; real qualitative judgement is expected to come from
  the live LLM calls when an API key is configured.
- Scoring scales (0–100) and the specific persona weights (35/35/30 +
  Skeptic veto) are a reasonable, explicit business rule chosen for this
  challenge, not a scientifically validated hiring formula.

## 6. Project Structure

```
hr-multiagent-system/
├── server.js                     # Express app & API routes
├── src/
│   ├── pipeline.js                # Orchestrates all 5 stages
│   ├── llm/
│   │   ├── llmClient.js           # Anthropic API wrapper + mock-mode fallback
│   │   └── textUtils.js           # Heuristic text-extraction helpers
│   ├── profile/profileBuilder.js  # Stage 1
│   ├── agents/
│   │   ├── agentBase.js           # Shared independent-opinion / debate-turn helpers
│   │   ├── technicalAgent.js      # Stage 2
│   │   ├── hrAgent.js             # Stage 2
│   │   ├── hiringManagerAgent.js  # Stage 2
│   │   └── skepticAgent.js        # Stage 2
│   ├── debate/debate.js           # Stage 3
│   └── decision/finalDecision.js  # Stage 4 (non-averaging judge)
├── public/                        # Stage 5 UI (index.html, app.js, style.css)
├── sample_data/                   # Sample resume + transcript
├── .env.example
└── package.json
```

## Reliability update

The evaluation pipeline now uses bounded timeouts for each Gemini call. Individual agents can fall back safely, and debate/final synthesis failures no longer leave the whole request stuck in an evaluating state. The browser also keeps the evaluation state visible through agent, debate, and final-decision phases.

Gemini credentials are loaded from `GEMINI_API_KEY` in `.env`; the real `.env` file is intentionally ignored by Git.

## GitHub Upload Safety
This project ZIP is prepared for GitHub upload. No `.env`, API key, `node_modules`, or other runtime secrets are included.

After cloning or extracting:
1. Copy `.env.example` to `.env`.
2. Add your own `GEMINI_API_KEY` locally.
3. Never commit `.env`.
4. Run `npm install` and then `npm start`.
