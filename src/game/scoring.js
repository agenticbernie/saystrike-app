/** Normalize English transcript text without treating punctuation/case as errors. */
export function normalizeTranscript(value) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFKC')
    .replace(/[’‘`]/g, "'")
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function wordDistance(expected, actual) {
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);

  for (let row = 1; row <= expected.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= actual.length; column += 1) {
      const substitutionCost = expected[row - 1] === actual[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost,
      );
    }
    previous = current;
  }

  return previous[actual.length];
}

/** Word-level edit similarity, labelled as an estimate rather than pronunciation scoring. */
export function estimateSentenceMatch(target, transcript) {
  const expectedText = normalizeTranscript(target);
  const actualText = normalizeTranscript(transcript);
  if (!expectedText || !actualText) return null;

  const expected = expectedText.split(' ');
  const actual = actualText.split(' ');
  const distance = wordDistance(expected, actual);
  const denominator = Math.max(expected.length, actual.length);
  const percent = Math.max(0, Math.round((1 - distance / denominator) * 100));
  const recognizedSet = new Set(actual);
  const missingWord = expected.find((word) => !recognizedSet.has(word));

  return {
    percent,
    normalizedTarget: expectedText,
    normalizedTranscript: actualText,
    suggestion: missingWord
      ? `Thử nhấn rõ từ “${missingWord}”, rồi nghe mẫu thêm một lần nhé.`
      : 'Thử chậm lại một nhịp ở cuối câu nhé.',
  };
}
