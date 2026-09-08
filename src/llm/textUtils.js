/**
 * Small, dependency-free text helpers used by the heuristic "mock LLM"
 * fallbacks so that even without an API key, every agent opinion is still
 * grounded in a real, extracted quote/sentence from the resume or
 * transcript (never a fabricated one).
 */

const SKILL_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang',
  'rust', 'react', 'node', 'node.js', 'express', 'next.js', 'vue', 'angular',
  'django', 'flask', 'spring', 'sql', 'postgresql', 'mysql', 'mongodb',
  'redis', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
  'ci/cd', 'graphql', 'rest api', 'microservices', 'machine learning',
  'deep learning', 'tensorflow', 'pytorch', 'nlp', 'data structures',
  'algorithms', 'system design', 'git', 'agile', 'scrum', 'html', 'css',
];

/**
 * Plain-text resumes/transcripts often hard-wrap a single sentence or
 * bullet across two lines (e.g. an indented bullet continuation). This
 * re-joins such wrapped lines so downstream parsing doesn't truncate mid
 * sentence. A line is treated as a continuation of the previous one when
 * it's indented (and not a new bullet) or starts with a lowercase letter,
 * and the previous line doesn't already look like it ended a sentence.
 */
function mergeWrappedLines(text) {
  const rawLines = text.split(/\r?\n/);
  const mergedLines = [];
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const isIndentedContinuation = /^\s+\S/.test(rawLine) && !/^[-•*]/.test(trimmed);
    const startsLowercase = /^[a-z]/.test(trimmed);
    const prev = mergedLines[mergedLines.length - 1];
    const prevEndsSentence = prev && /[.!?:]$/.test(prev.trim());

    if (mergedLines.length > 0 && !prevEndsSentence && (isIndentedContinuation || startsLowercase)) {
      mergedLines[mergedLines.length - 1] = `${prev} ${trimmed}`;
    } else {
      mergedLines.push(trimmed);
    }
  }
  return mergedLines;
}

function splitSentences(text) {
  // Treat each (wrap-merged) line as its own boundary FIRST - resumes and
  // transcripts are often line-broken without terminal punctuation (e.g.
  // section headers, bullet lists) - otherwise unrelated lines get glued
  // into one giant "sentence" once newlines are collapsed to spaces.
  const mergedLines = mergeWrappedLines(text);
  const sentences = [];
  for (const line of mergedLines) {
    const parts = line.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    sentences.push(...(parts.length ? parts : [line]));
  }
  return sentences;
}

function findSkills(text) {
  const lower = text.toLowerCase();
  return SKILL_KEYWORDS.filter((kw) => lower.includes(kw));
}

/** Strip leading bullet markers and collapse whitespace for clean quoting. */
function cleanSentence(s) {
  return s.replace(/^[-•*]\s*/, '').replace(/\s+/g, ' ').trim();
}

/** Find the first sentence containing a keyword (case-insensitive). */
function findQuoteFor(text, keyword) {
  const sentences = splitSentences(text);
  const match = sentences.find((s) => s.toLowerCase().includes(keyword.toLowerCase()));
  return match ? cleanSentence(match) : null;
}

/** Find sentences containing any of a list of trigger words. */
function findSentencesWithAny(text, triggers) {
  const sentences = splitSentences(text);
  return sentences
    .filter((s) => triggers.some((t) => s.toLowerCase().includes(t.toLowerCase())))
    .map(cleanSentence);
}

/** Extract a rough "years of experience" number, if stated. */
function extractYearsExperience(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*years?/i);
  return match ? parseFloat(match[1]) : null;
}

/** Pull resume bullet-point-like lines (claims), wrap-merged so a bullet
 * that spans two physical lines isn't truncated mid-sentence. */
function extractBulletClaims(text) {
  return mergeWrappedLines(text)
    .filter((l) => /^[-•*]/.test(l) || /^\d+\./.test(l))
    .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter((l) => l.length > 0);
}

/** Pull first-person statements from an interview transcript ("I ..."). */
function extractTranscriptHighlights(text, limit = 12) {
  const sentences = splitSentences(text);
  return sentences
    .filter((s) => /\bI\s|\bI'/.test(s) && s.length > 25)
    .map(cleanSentence)
    .slice(0, limit);
}

module.exports = {
  SKILL_KEYWORDS,
  mergeWrappedLines,
  splitSentences,
  findSkills,
  findQuoteFor,
  findSentencesWithAny,
  extractYearsExperience,
  extractBulletClaims,
  extractTranscriptHighlights,
};
