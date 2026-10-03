import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { checkApiKey, transcribe } from '../src/gemini.js';
import { geminiReply, startServer } from './helpers.js';

const request = { apiKey: 'test-key', model: 'gemini-test', audio: Buffer.from('voice-bytes'), mimeType: 'audio/ogg', translate: false };
const fast = { retryDelayMs: 1 };
let server;

async function serve(...replies) {
  server = await startServer(() => replies.shift());
  process.env.TGVOICE_GEMINI_API = server.url;
}

afterEach(async () => {
  await server?.close();
  delete process.env.TGVOICE_GEMINI_API;
});

test('sends the audio inline with the key in a header and returns the trimmed text', async () => {
  await serve(geminiReply('  ສະບາຍດີ  \n'));

  assert.deepEqual(await transcribe(request, fast), { text: 'ສະບາຍດີ', attempts: 1 });

  const [sent] = server.requests;
  assert.equal(sent.path, '/v1beta/models/gemini-test:generateContent');
  assert.equal(sent.headers['x-goog-api-key'], 'test-key');
  const [prompt, audio] = sent.body.contents[0].parts;
  assert.match(prompt.text, /ພາສາລາວ/);
  assert.deepEqual(audio.inline_data, { mime_type: 'audio/ogg', data: Buffer.from('voice-bytes').toString('base64') });
});

test('uses the English prompt in translate mode', async () => {
  await serve(geminiReply('hello'));

  await transcribe({ ...request, translate: true }, fast);

  assert.match(server.requests[0].body.contents[0].parts[0].text, /translate everything to English/);
});

test('retries once after a server error and reports the second attempt', async () => {
  await serve({ status: 503, json: { error: { message: 'overloaded' } } }, geminiReply('ok'));

  assert.deepEqual(await transcribe(request, fast), { text: 'ok', attempts: 2 });
  assert.equal(server.requests.length, 2);
});

test('gives up after exactly two failed attempts', async () => {
  const overloaded = { status: 503, json: { error: { message: 'overloaded' } } };
  await serve(overloaded, overloaded, geminiReply('never reached'));

  await assert.rejects(transcribe(request, fast), { message: 'Gemini 503: overloaded', attempts: 2 });
  assert.equal(server.requests.length, 2);
});

test('does not retry an error a retry cannot fix', async () => {
  await serve({ status: 400, json: { error: { message: 'API key not valid' } } }, geminiReply('never reached'));

  await assert.rejects(transcribe(request, fast), { message: 'Gemini 400: API key not valid', attempts: 1 });
  assert.equal(server.requests.length, 1);
});

test('treats an unreachable server as retryable and names the reason', async () => {
  // A port that was just released: nothing listens there, so the connection is refused.
  const closed = await startServer(() => ({}));
  await closed.close();
  process.env.TGVOICE_GEMINI_API = closed.url;

  await assert.rejects(transcribe(request, fast), { message: 'ຕໍ່ຫາ Gemini ບໍ່ໄດ້ (ECONNREFUSED)', retryable: true, attempts: 2 });
});

test('returns an empty string when Gemini hears nothing', async () => {
  await serve({ json: { candidates: [] } });

  assert.deepEqual(await transcribe(request, fast), { text: '', attempts: 1 });
});

test('checkApiKey rejects a bad key', async () => {
  await serve({ status: 400, json: { error: { message: 'API key not valid' } } });

  await assert.rejects(checkApiKey('bad', 'gemini-test'), /API key not valid/);
  assert.equal(server.requests[0].path, '/v1beta/models/gemini-test');
});
