import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createBot } from '../src/bot.js';
import { transcribe } from '../src/gemini.js';
import { PasteError } from '../src/paste.js';
import { createTelegram } from '../src/telegram.js';
import { geminiReply, startServer } from './helpers.js';

const OWNER = 111;
const NOW = 1_800_000_000;

function voiceMessage({ from = OWNER, date = NOW, id = 7 } = {}) {
  return {
    message_id: id,
    date,
    from: { id: from },
    chat: { id: from, type: 'private' },
    voice: { file_id: 'file-1', duration: 4, mime_type: 'audio/ogg' },
  };
}

function textMessage(text) {
  return { message_id: 8, date: NOW, from: { id: OWNER }, chat: { id: OWNER, type: 'private' }, text };
}

// A bot wired to in-memory fakes. Everything it does is recorded on the returned object.
function harness({ transcribeResult = { text: 'ສະບາຍດີ', attempts: 1 }, transcribeError, pasteError } = {}) {
  const state = { replies: [], pasted: [], entries: [], saved: [], transcribeCalls: [] };
  state.config = { geminiApiKey: 'key', model: 'gemini-test', ownerId: OWNER, translate: false };
  state.bot = createBot({
    config: state.config,
    telegram: {
      sendMessage: async (chatId, text, replyTo) => state.replies.push({ chatId, text, replyTo }),
      sendChatAction: async () => {},
      downloadFile: async () => Buffer.from('voice-bytes'),
    },
    transcribe: async (request) => {
      state.transcribeCalls.push(request);
      if (transcribeError) throw transcribeError;
      return transcribeResult;
    },
    paste: async (text) => {
      if (pasteError) throw pasteError;
      state.pasted.push(text);
    },
    history: {
      append: (entry) => {
        const stored = { at: new Date(NOW * 1000).toISOString(), ...entry };
        state.entries.push(stored);
        return stored;
      },
      read: (limit) => state.entries.slice(-limit),
    },
    saveConfig: (config) => state.saved.push({ ...config }),
    log: () => {},
  });
  return state;
}

test('pastes the transcript of an owner voice message and replies with it', async () => {
  const h = harness();

  await h.bot.handleMessage(voiceMessage(), NOW);

  assert.deepEqual(h.pasted, ['ສະບາຍດີ']);
  assert.deepEqual(h.replies, [{ chatId: OWNER, text: '✅ ສະບາຍດີ', replyTo: 7 }]);
  assert.partialDeepStrictEqual(h.entries[0], { status: 'ok', seconds: 4, attempts: 1, text: 'ສະບາຍດີ' });
  assert.partialDeepStrictEqual(h.transcribeCalls[0], { apiKey: 'key', model: 'gemini-test', mimeType: 'audio/ogg', translate: false });
});

test('ignores anyone who is not the paired owner', async () => {
  const h = harness();

  await h.bot.handleMessage(voiceMessage({ from: 999 }), NOW);

  assert.deepEqual([h.pasted, h.replies, h.entries, h.transcribeCalls], [[], [], [], []]);
});

test('skips a voice message that was sent while the Mac was not listening', async () => {
  const h = harness();

  await h.bot.handleMessage(voiceMessage({ date: NOW - 600 }), NOW);

  assert.deepEqual(h.pasted, []);
  assert.equal(h.transcribeCalls.length, 0);
  assert.equal(h.entries[0].status, 'skipped');
  assert.match(h.replies[0].text, /^⏭ .*10 ນາທີ/);
});

test('reports a failed transcription with its reason and pastes nothing', async () => {
  const error = Object.assign(new Error('Gemini 503: overloaded'), { attempts: 2 });
  const h = harness({ transcribeError: error });

  await h.bot.handleMessage(voiceMessage(), NOW);

  assert.deepEqual(h.pasted, []);
  assert.partialDeepStrictEqual(h.entries[0], { status: 'failed', attempts: 2, error: 'Gemini 503: overloaded' });
  assert.equal(h.replies[0].text, '❌ ແປງສຽງບໍ່ໄດ້ (ລອງ 2 ເທື່ອແລ້ວ)\nGemini 503: overloaded');
});

test('says so when no speech was heard', async () => {
  const h = harness({ transcribeResult: { text: '', attempts: 1 } });

  await h.bot.handleMessage(voiceMessage(), NOW);

  assert.deepEqual(h.pasted, []);
  assert.equal(h.entries[0].status, 'empty');
  assert.match(h.replies[0].text, /^⚠️/);
});

test('falls back to the clipboard when the paste keystroke is not permitted', async () => {
  const h = harness({ pasteError: new PasteError('ຍັງບໍ່ໄດ້ເປີດສິດ Accessibility', true) });

  await h.bot.handleMessage(voiceMessage(), NOW);

  assert.partialDeepStrictEqual(h.entries[0], { status: 'copied', text: 'ສະບາຍດີ' });
  assert.match(h.replies[0].text, /^📋 ສະບາຍດີ\n\n⚠️ .*Accessibility.*\n.*Cmd\+V/);
});

test('reports a failure, with the text, when even the clipboard copy failed', async () => {
  const h = harness({ pasteError: new PasteError('pbcopy: boom', false) });

  await h.bot.handleMessage(voiceMessage(), NOW);

  assert.equal(h.entries[0].status, 'failed');
  assert.equal(h.replies[0].text, '❌ paste ບໍ່ໄດ້: pbcopy: boom\n\nສະບາຍດີ');
});

test('/en and /lo switch translate mode and persist it', async () => {
  const h = harness();

  await h.bot.handleMessage(textMessage('/en'), NOW);
  await h.bot.handleMessage(voiceMessage(), NOW);
  await h.bot.handleMessage(textMessage('/lo'), NOW);

  assert.deepEqual(h.saved.map((config) => config.translate), [true, false]);
  assert.equal(h.transcribeCalls[0].translate, true);
  assert.equal(h.config.translate, false);
});

test('/log replies with a summary of recent entries', async () => {
  const h = harness();
  await h.bot.handleMessage(voiceMessage(), NOW);
  await h.bot.handleMessage(voiceMessage({ date: NOW - 600 }), NOW);

  await h.bot.handleMessage(textMessage('/log'), NOW);

  const summary = h.replies.at(-1).text;
  assert.match(summary, /^2 ລາຍການລ່າສຸດ: ✅ 1 · ⏭ 1\n/);
  assert.match(summary, /✅ 4s {2}ສະບາຍດີ/);
});

test('any other text gets the help message', async () => {
  const h = harness();

  await h.bot.handleMessage(textMessage('/start'), NOW);

  assert.match(h.replies[0].text, /^🎤 ພ້ອມຮັບສຽງ/);
});

// Real Telegram and Gemini clients against local servers: poll, download, transcribe with one
// retry, paste, reply.
test('end to end over HTTP', async (t) => {
  const token = '123456:test-token';
  const stop = new AbortController();
  const sent = [];
  const update = { update_id: 50, message: { ...voiceMessage(), date: Math.floor(Date.now() / 1000) } };

  const telegramServer = await startServer(({ path, body }) => {
    if (path === `/bot${token}/getUpdates`) {
      if (body.offset === undefined) return { json: { ok: true, result: [update] } };
      stop.abort();
      return { json: { ok: true, result: [] } };
    }
    if (path === `/bot${token}/getFile`) return { json: { ok: true, result: { file_path: 'voice/file_1.oga' } } };
    if (path === `/file/bot${token}/voice/file_1.oga`) return { bytes: Buffer.from('voice-bytes') };
    if (path === `/bot${token}/sendMessage`) sent.push(body);
    return { json: { ok: true, result: true } };
  });
  const geminiReplies = [{ status: 503, json: { error: { message: 'overloaded' } } }, geminiReply('ສະບາຍດີ')];
  const geminiServer = await startServer(() => geminiReplies.shift());
  process.env.TGVOICE_TELEGRAM_API = telegramServer.url;
  process.env.TGVOICE_GEMINI_API = geminiServer.url;
  t.after(async () => {
    delete process.env.TGVOICE_TELEGRAM_API;
    delete process.env.TGVOICE_GEMINI_API;
    await telegramServer.close();
    await geminiServer.close();
  });

  const pasted = [];
  const entries = [];
  const bot = createBot({
    config: { geminiApiKey: 'key', model: 'gemini-test', ownerId: OWNER, translate: false },
    telegram: createTelegram(token),
    transcribe: (request) => transcribe(request, { retryDelayMs: 1 }),
    paste: async (text) => pasted.push(text),
    history: { append: (entry) => (entries.push(entry), { at: new Date().toISOString(), ...entry }), read: () => entries },
    saveConfig: () => {},
    log: () => {},
  });

  await bot.run({ signal: stop.signal });

  assert.deepEqual(pasted, ['ສະບາຍດີ']);
  assert.partialDeepStrictEqual(entries[0], { status: 'ok', attempts: 2, text: 'ສະບາຍດີ' });
  assert.partialDeepStrictEqual(sent[0], { chat_id: OWNER, text: '✅ ສະບາຍດີ', reply_parameters: { message_id: 7 } });
  assert.equal(geminiServer.requests[1].body.contents[0].parts[1].inline_data.data, Buffer.from('voice-bytes').toString('base64'));
  assert.equal(telegramServer.requests.at(-1).body.offset, 51);
});
