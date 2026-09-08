const state = { files: {}, result: null, audio: '', running: false, lastRequest: null };
const $ = (selector) => document.querySelector(selector);
const agentLabels = {
  'Technical Agent': 'Technical Agent', technicalAgent: 'Technical Agent',
  'HR & Culture Agent': 'HR & Culture Agent', hrAgent: 'HR & Culture Agent',
  'Skeptic Agent': 'Skeptic Agent', skepticAgent: 'Skeptic Agent',
  'Hiring Manager Agent': 'Hiring Manager Agent', hiringManagerAgent: 'Hiring Manager Agent'
};
const safeText = (value) => String(value ?? '');
function setText(node, value) { node.textContent = safeText(value); return node; }
function setStatus(message, error = false) { const node = $('#status'); node.classList.toggle('toast-error', error); setText(node, message); }
function setRunning(running) { state.running = running; $('#evaluate').disabled = running; $('#evaluate').textContent = running ? 'Evaluating…' : 'Evaluate Candidate'; }
function setStep(step, status = 'active') { document.querySelectorAll('#steps li').forEach((item, index) => { item.className = index < step - 1 ? 'done' : index === step - 1 ? status : ''; }); }
function resetSteps() { document.querySelectorAll('#steps li').forEach((item) => { item.className = ''; }); }

function validateFile(file) { if (!file) return 'No file selected.'; const pdfByName = /\.pdf$/i.test(file.name); if (file.type !== 'application/pdf' && !pdfByName) return 'Only PDF files are supported.'; if (file.size > 10 * 1024 * 1024) return 'Each PDF must be 10 MB or smaller.'; return null; }
function selectFile(zone, file) { if (state.running || !file) return; const error = validateFile(file); if (error) { setStatus(error, true); return; } const key = zone.dataset.input; state.files[key] = file; const status = zone.querySelector('.upload-status'); const label = key === 'resumeFile' ? 'Resume' : key === 'transcriptFile' ? 'Transcript' : 'Job Description'; setText(status, `${label} uploaded successfully ✓ — ${file.name}`); zone.classList.add('selected'); setStatus('Document ready. Upload the remaining PDFs to continue.'); }
function bindDropzones() { document.querySelectorAll('.dropzone').forEach((zone) => { const input = document.getElementById(zone.dataset.input); const openPicker = () => { if (!state.running) input.click(); }; zone.addEventListener('click', openPicker); zone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } }); ['dragenter', 'dragover'].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); if (!state.running) zone.classList.add('drag'); })); ['dragleave', 'drop'].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove('drag'); })); zone.addEventListener('drop', (event) => selectFile(zone, event.dataTransfer?.files?.[0])); input.addEventListener('change', () => { selectFile(zone, input.files?.[0]); input.value = ''; }); }); }

function normalizeAgent(agent) { return { ...agent, agent: agentLabels[agent.agent] || agent.agent || 'Agent' }; }
function renderAgentSkeletons() { const root = $('#agents'); root.replaceChildren(); Object.values(agentLabels).filter((v, i, a) => a.indexOf(v) === i).forEach((name) => { const card = document.createElement('article'); card.className = 'opinion-card'; card.setAttribute('role', 'status'); card.append(setText(document.createElement('h3'), name)); const spinner = document.createElement('div'); spinner.className = 'spinner'; spinner.style.margin = '20px 0'; card.append(spinner, setText(document.createElement('p'), 'Analyzing source evidence…')); root.append(card); }); }
function renderAgents(agents) { const root = $('#agents'); root.replaceChildren(); agents.map(normalizeAgent).forEach((agent) => { const card = document.createElement('article'); card.className = 'opinion-card'; card.append(setText(document.createElement('h3'), agent.agent)); card.append(setText(document.createElement('span'), `Score ${agent.score ?? 'N/A'} · Confidence ${agent.confidence ?? 0}%`)); const bar = document.createElement('div'); bar.className = 'score-bar-wrap'; const fill = document.createElement('div'); fill.className = 'score-bar'; fill.style.width = `${Math.max(0, Math.min(100, Number(agent.score) || 0))}%`; bar.append(fill); card.append(bar); if (agent.stance) card.append(setText(document.createElement('p'), agent.stance)); if (agent.error) card.append(setText(document.createElement('p'), `Fallback: ${agent.error.message || 'Agent unavailable'}`)); (agent.evidence || []).forEach((item) => { const quote = document.createElement('blockquote'); quote.className = 'quote'; setText(quote, `“${item.quote || item.fact || 'Insufficient evidence in source documents'}” — ${item.source || 'Source document'}`); card.append(quote); }); root.append(card); }); }

function scoreFor(agents, keys) { const agent = agents.map(normalizeAgent).find((a) => keys.includes(a.agent)); return Number(agent?.score) || 0; }
function renderKpis(result) {
  const decision = result.finalDecision || {};
  const match = Math.max(0, Math.min(100, Number(decision.matchPercent) || 0));
  const items = [
    ['Agreed points', result.debate?.agreedPoints?.length ?? 0, 'Strong alignment'],
    ['Disagreed points', result.debate?.disagreedPoints?.length ?? 0, 'Key concerns'],
    ['Shifted stances', result.debate?.shiftedStances?.length ?? 0, 'Nuanced views'],
    ['Unresolved items', result.debate?.unresolvedStances?.length ?? 0, 'Requires review']
  ];
  const root = $('#kpis');
  root.replaceChildren();
  items.forEach(([label, value, sub]) => {
    const card = document.createElement('article');
    card.className = 'kpi';
    const labelNode = document.createElement('div');
    labelNode.className = 'kpi-label';
    setText(labelNode, label);
    const valueNode = document.createElement('div');
    valueNode.className = 'kpi-value';
    setText(valueNode, value);
    const subNode = document.createElement('div');
    subNode.className = 'kpi-sub';
    setText(subNode, sub);
    card.append(labelNode, valueNode, subNode);
    root.append(card);
  });
  setText($('#fitScore'), match || 'N/A');
  setText($('#fitRecommendation'), decision.recommendation || 'Evaluation complete');
  $('#fitMeter').style.width = match + '%';
}
function renderRings(agents) {
  const root = $('#rings');
  root.replaceChildren();
  const values = [
    ['MOVE', 'Technical Depth', scoreFor(agents, ['Technical Agent'])],
    ['EXERCISE', 'HR Alignment', scoreFor(agents, ['HR & Culture Agent'])],
    ['STAND', 'Skeptic Verification', scoreFor(agents, ['Skeptic Agent'])]
  ];
  values.forEach(([ringName, label, value]) => {
    const ring = document.createElement('div');
    ring.className = 'ring';
    ring.style.setProperty('--p', `${Math.max(0, Math.min(100, value)) * 3.6}deg`);
    const inner = document.createElement('div');

    const ringTitle = document.createElement('div');
    ringTitle.className = 'ring-label';
    setText(ringTitle, ringName);
    inner.append(ringTitle);

    const val = document.createElement('div');
    val.className = 'ring-value';
    setText(val, `${value}%`);
    inner.append(val);

    const caption = document.createElement('div');
    caption.className = 'ring-label';
    setText(caption, label);
    inner.append(caption);

    ring.append(inner);
    root.append(ring);
  });
}
function renderBars(agents) { const root = $('#agentBars'); root.replaceChildren(); agents.map(normalizeAgent).forEach((agent) => { const item = document.createElement('div'); item.className = 'bar-item'; const value = Number(agent.score) || 0; const valueLabel = document.createElement('span'); valueLabel.className = 'bar-value'; setText(valueLabel, `${value}%`); const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = `${Math.max(4, value)}%`; bar.tabIndex = 0; bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', `${agent.agent} score ${value}%`); const label = document.createElement('span'); label.className = 'bar-label'; setText(label, agent.agent.replace(' Agent', '')); item.append(valueLabel, bar, label); root.append(item); }); }
function renderMatrix(debate = {}) {
  const root = $('#matrix');
  root.replaceChildren();
  const groups = [
    ['Agreed Points', debate.agreedPoints || [], 'alignment'],
    ['Disagreed Points', debate.disagreedPoints || [], 'difference'],
    ['Shifted Stances', debate.shiftedStances || [], 'shift'],
    ['Unresolved Stances', debate.unresolvedStances || [], 'unresolved']
  ];
  groups.forEach(([title, entries, kind]) => {
    const block = document.createElement('section');
    block.className = 'matrix-block matrix-' + kind;
    const heading = document.createElement('div');
    heading.className = 'matrix-heading';
    heading.append(setText(document.createElement('h3'), title));
    const count = document.createElement('span');
    setText(count, entries.length);
    heading.append(count);
    block.append(heading);
    if (!entries.length) {
      block.append(setText(document.createElement('p'), kind === 'shift' ? 'No stance changes were recorded.' : 'No explicit points recorded.'));
    } else {
      entries.slice(0, 3).forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'matrix-item';
        if (kind === 'shift') {
          const transition = document.createElement('strong');
          setText(transition, (entry.agent || 'Agent') + ': ' + (entry.from || 'Initial') + ' → ' + (entry.to || 'Refined'));
          item.append(transition);
          if (entry.reason) item.append(setText(document.createElement('p'), entry.reason));
        } else {
          item.append(setText(document.createElement('strong'), entry.point || entry.reason || entry.stance || 'Evidence point'));
          if (entry.agents?.length) item.append(setText(document.createElement('span'), entry.agents.join(' · ')).classList.add('matrix-meta'));
          if (entry.agent && kind === 'unresolved') item.append(setText(document.createElement('span'), entry.agent).classList.add('matrix-meta'));
        }
        const evidence = entry.evidence?.[0];
        if (evidence?.quote || evidence?.fact) {
          const quote = document.createElement('span');
          quote.className = 'matrix-evidence';
          setText(quote, 'Evidence: “' + (evidence.quote || evidence.fact) + '”');
          item.append(quote);
        }
        block.append(item);
      });
    }
    root.append(block);
  });
}
function renderDebate(debate = {}) { const root = $('#debate'); root.replaceChildren(); if (!debate.transcript?.length) { root.append(setText(document.createElement('p'), debate.error ? 'Debate fallback used. The final decision used available evidence.' : 'No debate transcript available.')); return; } debate.transcript.forEach((turn) => { const article = document.createElement('article'); article.className = 'debate-turn'; const speaker = document.createElement('div'); speaker.className = 'speaker'; setText(speaker, `${turn.speaker || 'Agent'}${turn.target ? ` → ${turn.target}` : ''}`); const message = document.createElement('div'); message.className = 'msg'; setText(message, turn.point || turn.stance || turn.message || 'Insufficient evidence in source documents.'); article.append(speaker, message); root.append(article); }); }
function listWithEvidence(title, entries) { const wrap = document.createElement('div'); wrap.append(setText(document.createElement('h3'), title)); const list = document.createElement('ul'); list.className = 'decision-list'; (entries || []).forEach((entry) => { const li = document.createElement('li'); setText(li, entry.claim || entry.point || safeText(entry)); const quote = entry.evidence?.[0]?.quote || entry.quote; if (quote) { const span = document.createElement('span'); span.className = 'decision-quote'; setText(span, `“${quote}”`); li.append(span); } list.append(li); }); if (!list.childElementCount) list.append(setText(document.createElement('li'), 'Insufficient evidence in source documents.')); wrap.append(list); return wrap; }
function renderDecision(decision = {}) {
  const root = $('#decision');
  root.replaceChildren();
  const head = document.createElement('div');
  const recommendation = document.createElement('div');
  recommendation.className = 'recommendation-big';
  setText(recommendation, decision.recommendation || 'Unavailable');
  const confidence = document.createElement('p');
  confidence.className = 'confidence-meter';
  setText(confidence, `Match ${decision.matchPercent ?? 'N/A'}% · Confidence ${decision.confidence ?? 0}%`);
  head.append(recommendation, confidence);
  root.append(head, listWithEvidence('Strengths', decision.strengths), listWithEvidence('Concerns', decision.concerns), listWithEvidence('Unresolved Friction', decision.unresolvedFriction));
  if (decision.rationale) {
    const rationale = document.createElement('div');
    rationale.className = 'rationale-box';
    rationale.append(setText(document.createElement('strong'), 'Decision rationale'), setText(document.createElement('p'), decision.rationale));
    root.append(rationale);
  }
}
function buildAudio(result) { if (result.audioOverview?.script) return result.audioOverview.script; const d = result.finalDecision || {}; const strengths = (d.strengths || []).map((x) => x.claim).filter(Boolean).slice(0, 2).join('. '); const concerns = (d.concerns || []).map((x) => x.claim).filter(Boolean).slice(0, 2).join('. '); return `Recruiter overview. ${d.recommendation || 'Evaluation complete'}. Overall match is ${d.matchPercent ?? 'not available'} percent. ${strengths ? `Key strengths: ${strengths}.` : ''} ${concerns ? `Major concerns: ${concerns}.` : ''} Review the evidence citations and unresolved debate points before making a hiring decision.`; }
function renderEvidenceList(rootSelector, entries = [], kind) {
  const root = $(rootSelector);
  if (!root) return;
  root.replaceChildren();
  if (!entries.length) {
    root.append(setText(document.createElement('p'), 'No explicit evidence recorded.'));
    return;
  }
  entries.slice(0, 4).forEach((entry) => {
    const item = document.createElement('article');
    item.className = 'evidence-item ' + kind;
    const title = document.createElement('strong');
    setText(title, entry.claim || entry.point || entry.reason || entry.stance || 'Evidence point');
    const evidence = document.createElement('p');
    const quote = entry.evidence?.[0]?.quote || entry.quote || entry.evidence?.[0]?.fact;
    setText(evidence, quote ? 'Evidence: “' + quote + '”' : 'Evidence recorded by the evaluation agents.');
    item.append(title, evidence);
    root.append(item);
  });
}
function renderOverview(result) {
  const decision = result.finalDecision || {};
  const agents = result.agents || [];
  const root = $('#overviewMetrics');
  if (!root) return;
  root.replaceChildren();
  const metrics = [
    ['Technical Skills', scoreFor(agents, ['Technical Agent'])],
    ['Technical Depth', scoreFor(agents, ['Technical Agent'])],
    ['Production Mindset', scoreFor(agents, ['Hiring Manager Agent'])],
    ['Communication', scoreFor(agents, ['HR & Culture Agent'])],
    ['Learning Agility', Math.round((scoreFor(agents, ['Technical Agent']) + scoreFor(agents, ['HR & Culture Agent'])) / 2)],
    ['Culture Fit', scoreFor(agents, ['HR & Culture Agent'])]
  ];
  metrics.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'overview-row';
    const head = document.createElement('div');
    setText(head, label);
    const score = document.createElement('b');
    setText(score, (Number(value) || 0) + '/100');
    const bar = document.createElement('div');
    bar.className = 'overview-bar';
    const fill = document.createElement('span');
    fill.style.width = Math.max(0, Math.min(100, Number(value) || 0)) + '%';
    bar.append(fill);
    row.append(head, score, bar);
    root.append(row);
  });
  const radar = $('#radarChart');
  if (radar) {
    const vals = metrics.slice(0, 5).map(([,v]) => Math.max(0, Math.min(100, Number(v) || 0)));
    const points = vals.map((v, i) => {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / vals.length);
      const r = 28 + (v / 100) * 58;
      return (100 + Math.cos(a) * r).toFixed(1) + ',' + (100 + Math.sin(a) * r).toFixed(1);
    }).join(' ');
    radar.innerHTML = '<svg viewBox="0 0 200 200" role="img" aria-label="Candidate profile radar"><polygon class="radar-grid" points="100,20 176,75 147,165 53,165 24,75"></polygon><polygon class="radar-shape" points="' + points + '"></polygon>' + vals.map((v,i) => '<text x="' + (100 + Math.cos(-Math.PI/2+i*Math.PI*2/5)*88).toFixed(1) + '" y="' + (104 + Math.sin(-Math.PI/2+i*Math.PI*2/5)*88).toFixed(1) + '">' + v + '</text>').join('') + '</svg>';
  }
  return decision;
}
function renderConsensusDonut(result) {
  const root = $('#consensusDonut');
  if (!root) return;
  const d = result.debate || {};
  const values = [['Agreed', d.agreedPoints?.length || 0], ['Disagreed', d.disagreedPoints?.length || 0], ['Shifted', d.shiftedStances?.length || 0], ['Unresolved', d.unresolvedStances?.length || 0]];
  const total = values.reduce((sum, [, value]) => sum + value, 0);
  const safeTotal = total || 1;
  const percentages = values.map(([label, value]) => ({ label, value, pct: total ? Math.round(value / safeTotal * 100) : 0 }));
  const radius = 42, circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = ['var(--white)', 'var(--g2)', 'var(--g3)', 'var(--g5)'];
  const arcs = percentages.map((item, index) => {
    const length = item.pct / 100 * circumference, gap = item.pct ? Math.min(3, length * .12) : 0, dash = Math.max(0, length - gap);
    const segment = '<circle class="consensus-segment" cx="60" cy="60" r="' + radius + '" fill="none" stroke="' + colors[index] + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + (circumference - dash) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 60 60)"></circle>';
    offset += length;
    return segment;
  }).join('');
  const legend = percentages.map((item, index) => '<div class="donut-legend"><i style="background:' + colors[index] + '"></i><span>' + item.label + '</span><b>' + item.pct + '%</b></div>').join('');
  root.innerHTML = '<div class="consensus-chart" role="img" aria-label="Consensus distribution"><svg viewBox="0 0 120 120" class="consensus-svg"><circle cx="60" cy="60" r="' + radius + '" fill="none" stroke="var(--line)" stroke-width="12"></circle>' + arcs + '<text x="60" y="57" class="consensus-total">' + total + '</text><text x="60" y="72" class="consensus-caption">POINTS</text></svg></div><div class="donut-legend-list">' + legend + '</div>';
}
function renderResult(result) {
  state.result = result;
  const agents = result.agents || [];
  renderAgents(agents);
  renderKpis(result);
  renderBars(agents);
  renderMatrix(result.debate || {});
  renderDebate(result.debate || {});
  renderDecision(result.finalDecision || {});
  renderOverview(result);
  renderConsensusDonut(result);
  renderEvidenceList('#strengthList', result.finalDecision?.strengths || [], 'strength');
  renderEvidenceList('#concernList', result.finalDecision?.concerns || [], 'concern');
  renderEvidenceList('#frictionList', result.finalDecision?.unresolvedFriction || [], 'friction');
  const match = Math.max(0, Math.min(100, Number(result.finalDecision?.matchPercent) || 0));
  const gauge = $('#fitGauge');
  if (gauge) gauge.style.setProperty('--gauge', match * 3.6 + 'deg');
  if ($('#fitGaugeValue')) setText($('#fitGaugeValue'), match || '—');
  state.audio = buildAudio(result);
  setText($('#audioScript'), state.audio);
  $('#recruiterTab').disabled = false;
  $('#recruiterTab').click();
}

async function evaluate() { if (state.running) return; if (['resumeFile', 'transcriptFile', 'jdFile'].some((key) => !state.files[key])) { setStatus('Upload Resume, Transcript, and Job Description PDFs before evaluation.', true); return; } state.lastRequest = true; $('#progressPanel').hidden = false; $('#recruiter').hidden = true; $('#retry').hidden = true; resetSteps(); setRunning(true); setStep(1); renderAgentSkeletons(); setStatus('Extracting profile and preparing source evidence…'); const formData = new FormData(); Object.entries(state.files).forEach(([key, file]) => formData.append(key, file)); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 180000); const progress = [setTimeout(() => { setStep(2); setStatus('Running four isolated agents in parallel…'); }, 1200), setTimeout(() => { setStep(3); setStatus('Dynamic debate is comparing agreements and disagreements…'); }, 30000), setTimeout(() => { setStep(4); setStatus('Synthesizing the evidence-weighted final decision…'); }, 60000)]; try { const response = await fetch('/api/evaluate', { method: 'POST', body: formData, signal: controller.signal }); const contentType = response.headers.get('content-type') || ''; const data = contentType.includes('application/json') ? await response.json() : { ok: false, error: { message: await response.text() } }; if (!response.ok || !data.ok) throw new Error(data.error?.message || `Request failed with status ${response.status}`); setStep(4, 'done'); renderResult(data); setStatus(data.diagnostics?.failedAgents?.length ? 'Evaluation completed with diagnostic fallbacks. Review the agent cards.' : 'Resume, transcript, and Job Description evaluated successfully. Recruiter report is ready.'); } catch (error) { const message = error.name === 'AbortError' ? 'Evaluation timed out. Check the server/Gemini connection and retry.' : (error.message || 'Network request failed.'); setStatus(`Evaluation failed: ${message}`, true); $('#retry').hidden = false; } finally { clearTimeout(timeout); progress.forEach(clearTimeout); setRunning(false); } }
function switchView(view) { const recruiter = view === 'recruiter'; $('#submissionView').hidden = recruiter; $('#recruiter').hidden = !recruiter || !state.result; $('#submissionTab').classList.toggle('active', !recruiter); $('#recruiterTab').classList.toggle('active', recruiter); $('#submissionTab').setAttribute('aria-selected', String(!recruiter)); $('#recruiterTab').setAttribute('aria-selected', String(recruiter)); }
function setupAudio() { $('#audioPlay').addEventListener('click', () => { if (!state.audio) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(state.audio); utterance.rate = 1; utterance.pitch = 1; window.speechSynthesis.speak(utterance); }); $('#audioPause').addEventListener('click', () => window.speechSynthesis.pause()); $('#audioStop').addEventListener('click', () => window.speechSynthesis.cancel()); }
$('#evaluate').addEventListener('click', evaluate); $('#retry').addEventListener('click', evaluate); $('#submissionTab').addEventListener('click', () => switchView('submission')); $('#recruiterTab').addEventListener('click', () => switchView('recruiter')); $('#backToSubmission').addEventListener('click', () => switchView('submission')); $('#themeToggle').addEventListener('click', () => document.documentElement.classList.toggle('light')); bindDropzones(); setupAudio();
