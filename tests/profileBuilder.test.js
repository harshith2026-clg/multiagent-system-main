import { describe, expect, it } from 'vitest';
import { buildProfile } from '../src/profile/profileBuilder.js';

describe('buildProfile', () => {
  const input = {
    resumeText: 'Senior Python engineer with 5 years of experience. Built services using Python, AWS, Docker and SQL.',
    transcriptText: 'I led backend delivery and worked closely with product and design.',
    jdText: 'Backend engineer with Python and cloud experience.'
  };

  it('normalizes source documents and extracts profile fields', () => {
    const profile = buildProfile(input);
    expect(profile.resumeText).toContain('Python engineer');
    expect(profile.skills).toEqual(expect.arrayContaining(['Python', 'AWS', 'Docker', 'SQL']));
    expect(profile.experience).toHaveLength(1);
    expect(profile.claims.length).toBeGreaterThan(0);
  });

  it('rejects missing readable source text', () => {
    expect(() => buildProfile({ ...input, transcriptText: '   ' }))
      .toThrow('Resume, transcript, and Job Description must contain readable text.');
  });

  it('removes control characters without changing the source meaning', () => {
    const profile = buildProfile({ ...input, resumeText: 'Python\u0000 engineer with 5 years of experience. Docker.' });
    expect(profile.resumeText).not.toContain('\u0000');
  });
});
