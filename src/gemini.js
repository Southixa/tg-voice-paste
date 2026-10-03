import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_API = 'https://generativelanguage.googleapis.com';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ERROR_LENGTH = 300;

const PROMPTS = {
  lao: `ແປງສຽງນີ້ເປັນ text.
- ເນັ້ນພາສາລາວເປັນຫຼັກ
- ຖ້າມີຄຳອັງກິດ ໃຫ້ຂຽນເປັນພາສາອັງກິດ
- ຕອບເປັນ text ເທົ່ານັ້ນ, ບໍ່ຕ້ອງອະທິບາຍ`,
  english: `Transcribe this audio and translate everything to English.
- Output must be in English only
- Just output the text, no explanation`,
};

export class GeminiError extends Error {
  constructor(message, retryable) {
    super(message);
    this.name = 'GeminiError';
    this.retryable = retryable;
  }
}

function apiBase() {
  return process.env.TGVOICE_GEMINI_API || DEFAULT_API;
}

async function send(path, apiKey, init) {
  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new GeminiError(`ຕໍ່ຫາ Gemini ບໍ່ໄດ້ (${err.cause?.code ?? err.name})`, true);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = (body.error?.message ?? response.statusText).split('\n')[0].slice(0, MAX_ERROR_LENGTH);
    const retryable = response.status === 429 || response.status >= 500;
    throw new GeminiError(`Gemini ${response.status}: ${reason}`, retryable);
  }
  return body;
}

async function requestTranscript({ apiKey, model, audio, mimeType, translate }) {
  const body = await send(`/v1beta/models/${model}:generateContent`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: translate ? PROMPTS.english : PROMPTS.lao },
            { inline_data: { mime_type: mimeType, data: audio.toString('base64') } },
          ],
        },
      ],
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? '').join('').trim();
}

// One retry at most: a failed transcription is tried a second time and then given up on.
// Errors that cannot succeed on a retry (bad key, unknown model) fail on the first attempt.
export async function transcribe(request, { retryDelayMs = 1500 } = {}) {
  try {
    return { text: await requestTranscript(request), attempts: 1 };
  } catch (err) {
    if (!err.retryable) {
      err.attempts = 1;
      throw err;
    }
  }
  await sleep(retryDelayMs);
  try {
    return { text: await requestTranscript(request), attempts: 2 };
  } catch (err) {
    err.attempts = 2;
    throw err;
  }
}

export async function checkApiKey(apiKey, model) {
  await send(`/v1beta/models/${model}`, apiKey, { method: 'GET' });
}
