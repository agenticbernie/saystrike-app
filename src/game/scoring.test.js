import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateSentenceMatch, normalizeTranscript } from './scoring.js';

test('normalizes capitalization, smart apostrophes, punctuation, and spacing', () => {
  assert.equal(normalizeTranscript("  I DIDN’T, expect the city!  "), "i didn't expect the city");
});

test('word matching ignores punctuation and casing', () => {
  assert.equal(estimateSentenceMatch('Hello, city!', 'HELLO CITY.')?.percent, 100);
});

test('word matching estimates insertions and deletions', () => {
  const result = estimateSentenceMatch('we walk home', 'we walk');
  assert.equal(result?.percent, 67);
  assert.match(result?.suggestion ?? '', /nhấn rõ từ/);
});

test('empty or invalid transcripts cannot receive a score', () => {
  assert.equal(estimateSentenceMatch('hello', ''), null);
  assert.equal(estimateSentenceMatch('', 'hello'), null);
  assert.equal(estimateSentenceMatch('hello', null), null);
});
