import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRecording, MIN_RECORDING_MS } from './transcriber.js';
import { demoChallenge } from '../content/demoChallenge.js';

const validAudio = { audioUri: 'file:///cache/practice.m4a', durationMs: MIN_RECORDING_MS };

test('empty and too-short recordings are unrated before any backend call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error('should not run'); };
  assert.equal((await evaluateRecording({ target: demoChallenge.target, durationMs: 100, fetchImpl })).reason, 'empty_audio');
  assert.equal((await evaluateRecording({ target: demoChallenge.target, ...validAudio, durationMs: 799, fetchImpl })).reason, 'too_short');
  assert.equal((await evaluateRecording({ target: demoChallenge.target, ...validAudio, audioSizeBytes: 0, fetchImpl })).reason, 'empty_audio');
  assert.equal(called, false);
});

test('development fallback is visibly marked as DEMO', async () => {
  const result = await evaluateRecording({
    target: demoChallenge.target,
    ...validAudio,
    endpoint: '',
    isDevelopment: true,
  });
  assert.equal(result.kind, 'scored');
  assert.equal(result.demo, true);
  assert.ok(result.percent > 0 && result.percent < 100);
});

test('production without an endpoint remains unrated', async () => {
  const result = await evaluateRecording({
    target: demoChallenge.target,
    ...validAudio,
    endpoint: '',
    isDevelopment: false,
    demoBuild: false,
  });
  assert.deepEqual(result, { kind: 'unrated', reason: 'backend_not_configured' });
});

test('production can opt into the visibly-marked internal demo build explicitly', async () => {
  const result = await evaluateRecording({
    target: demoChallenge.target,
    ...validAudio,
    endpoint: '',
    isDevelopment: false,
    demoBuild: true,
  });
  assert.equal(result.kind, 'scored');
  assert.equal(result.demo, true);
});

test('configured endpoint transcript is matched and non-success responses are unrated', async () => {
  const result = await evaluateRecording({
    target: demoChallenge.target,
    ...validAudio,
    endpoint: 'https://speech.example.test/transcribe',
    isDevelopment: false,
    fetchImpl: async (_url, request) => {
      assert.equal(request.method, 'POST');
      assert.ok(request.body instanceof FormData);
      return { ok: true, json: async () => ({ transcript: demoChallenge.target }) };
    },
  });
  assert.equal(result.kind, 'scored');
  assert.equal(result.percent, 100);
  assert.equal(result.demo, false);

  const failed = await evaluateRecording({
    target: demoChallenge.target,
    ...validAudio,
    endpoint: 'https://speech.example.test/transcribe',
    isDevelopment: false,
    fetchImpl: async () => ({ ok: false, json: async () => ({ transcript: demoChallenge.target }) }),
  });
  assert.deepEqual(failed, { kind: 'unrated', reason: 'service_unavailable' });
});

test('malformed, blank, and network-failure responses remain unrated', async () => {
  const evaluate = (fetchImpl) => evaluateRecording({
    target: demoChallenge.target,
    ...validAudio,
    endpoint: 'https://speech.example.test/transcribe',
    isDevelopment: false,
    fetchImpl,
  });
  assert.equal((await evaluate(async () => ({ ok: true, json: async () => ({}) }))).reason, 'invalid_response');
  assert.equal((await evaluate(async () => ({ ok: true, json: async () => ({ transcript: '  ' }) }))).reason, 'unintelligible');
  assert.equal((await evaluate(async () => { throw new Error('offline'); })).reason, 'network_error');
  const insecure = await evaluateRecording({ target: demoChallenge.target, ...validAudio, endpoint: 'http://speech.example.test/transcribe', demoBuild: false, isDevelopment: false });
  assert.equal(insecure.reason, 'insecure_endpoint');
});

test('transcription timeouts return an unrated result', async () => {
  const result = await evaluateRecording({
    target: demoChallenge.target,
    ...validAudio,
    endpoint: 'https://speech.example.test/transcribe',
    demoBuild: false,
    isDevelopment: false,
    timeoutMs: 5,
    fetchImpl: async (_url, request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  });
  assert.deepEqual(result, { kind: 'unrated', reason: 'timeout' });
});
