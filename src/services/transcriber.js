import { estimateSentenceMatch, normalizeTranscript } from '../game/scoring.js';

export const MIN_RECORDING_MS = 800;
export const TRANSCRIPTION_TIMEOUT_MS = 12_000;

const DEMO_TRANSCRIPT = "I didn't expect city feel this alive.";

function unrated(reason) {
  return { kind: 'unrated', reason };
}

/**
 * Send a temporary recording to a configured speech endpoint, or use a
 * visibly-marked deterministic development/demo sample when no endpoint is set.
 * Audio URIs and response bodies are never logged or persisted here.
 */
export async function evaluateRecording({
  target,
  audioUri,
  audioSizeBytes,
  durationMs,
  endpoint = process.env.EXPO_PUBLIC_SPEECH_TRANSCRIPTION_URL,
  isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__,
  demoBuild = process.env.EXPO_PUBLIC_DEMO_BUILD === '1',
  timeoutMs = TRANSCRIPTION_TIMEOUT_MS,
  fetchImpl = fetch,
}) {
  if (!audioUri) return unrated('empty_audio');
  if (audioSizeBytes === 0) return unrated('empty_audio');
  if (!Number.isFinite(durationMs) || durationMs < MIN_RECORDING_MS) {
    return unrated('too_short');
  }

  if (!endpoint) {
    if (!isDevelopment && !demoBuild) return unrated('backend_not_configured');
    const match = estimateSentenceMatch(target, DEMO_TRANSCRIPT);
    return {
      kind: 'scored',
      transcript: DEMO_TRANSCRIPT,
      percent: match.percent,
      suggestion: match.suggestion,
      demo: true,
    };
  }
  if (!/^https:\/\//i.test(endpoint)) return unrated('insecure_endpoint');

  let timeout;
  const controller = new AbortController();
  try {
    const audio = new FormData();
    audio.append('audio', { uri: audioUri, name: 'practice.m4a', type: 'audio/mp4' });
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      body: audio,
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return unrated('service_unavailable');

    let payload;
    try {
      payload = await response.json();
    } catch {
      return unrated('invalid_response');
    }
    if (!payload || typeof payload.transcript !== 'string') return unrated('invalid_response');
    if (!normalizeTranscript(payload.transcript)) return unrated('unintelligible');

    const match = estimateSentenceMatch(target, payload.transcript);
    return {
      kind: 'scored',
      transcript: payload.transcript,
      percent: match.percent,
      suggestion: match.suggestion,
      demo: false,
    };
  } catch {
    return unrated(controller.signal.aborted ? 'timeout' : 'network_error');
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
