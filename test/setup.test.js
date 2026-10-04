import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, beforeEach, test } from 'node:test';
import { PasteError } from '../src/paste.js';
import { runSetup } from '../src/setup.js';
import { startServer } from './helpers.js';

const TOKEN = '123456:secret-token';
let home;
let servers;

// A fake terminal: each time setup prints a prompt ending in ": ", the next answer is typed.
function terminal(answers) {
  const input = new PassThrough();
  let printed = '';
  const output = new Writable({
    write(chunk, _encoding, done) {
      printed += chunk;
      if (/: $/.test(chunk.toString()) && answers.length > 0) {
        const answer = answers.shift();
        setImmediate(() => input.write(`${answer}\n`));
      }
      done();
    },
  });
  return { input, output, printed: () => printed };
}

function privateMessage(updateId, id, firstName) {
  return { update_id: updateId, message: { from: { id, first_name: firstName }, chat: { id, type: 'private' }, text: '/start' } };
}

beforeEach(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tgvoice-'));
  process.env.TGVOICE_HOME = home;

  const gemini = await startServer(({ headers }) =>
    headers['x-goog-api-key'] === 'good-key' ? { json: {} } : { status: 400, json: { error: { message: 'API key not valid' } } },
  );
  const telegram = await startServer(({ path: url, body }) => {
    if (url === `/bot${TOKEN}/getMe`) return { json: { ok: true, result: { username: 'office_mac_bot' } } };
    if (url === `/bot${TOKEN}/getUpdates` && body.offset === undefined) {
      return { json: { ok: true, result: [privateMessage(1, 999, 'Stranger'), privateMessage(2, 111, 'Pele')] } };
    }
    if (url === `/bot${TOKEN}/sendMessage`) {
      // Telegram refuses to message someone who has never opened the bot.
      if (body.chat_id === 222) return { status: 403, json: { ok: false, error_code: 403, description: 'Forbidden: bot can\'t initiate conversation with a user' } };
      return { json: { ok: true, result: { chat: { id: body.chat_id, first_name: 'Pele', last_name: 'Plv' } } } };
    }
    return { json: { ok: true, result: [] } };
  });
  servers = { gemini, telegram };
  process.env.TGVOICE_GEMINI_API = gemini.url;
  process.env.TGVOICE_TELEGRAM_API = telegram.url;
});

afterEach(async () => {
  await servers.gemini.close();
  await servers.telegram.close();
  fs.rmSync(home, { recursive: true });
  delete process.env.TGVOICE_HOME;
  delete process.env.TGVOICE_GEMINI_API;
  delete process.env.TGVOICE_TELEGRAM_API;
});

test('validates the key, pairs with the person who confirms, and saves a private config', async () => {
  const term = terminal(['bad-key', 'good-key', TOKEN, 'n', 'y']);
  // The paste lands in the prompt that is waiting, followed by the user pressing Enter.
  const paste = async (text) => term.input.write(`${text}\n`);

  const config = await runSetup({ input: term.input, output: term.output, paste });

  assert.partialDeepStrictEqual(config, {
    geminiApiKey: 'good-key',
    botToken: TOKEN,
    botUsername: 'office_mac_bot',
    ownerId: 111,
    ownerName: 'Pele',
  });
  const file = path.join(home, 'config.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), config);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);

  assert.match(term.printed(), /❌ Gemini 400: API key not valid/);
  assert.match(term.printed(), /✅ paste ໃຊ້ໄດ້/);
  assert.match(term.printed(), /Bot token: 1234…ken\n/);
  assert.ok(!term.printed().includes('good-key') && !term.printed().includes(TOKEN), 'secrets are never printed');
  const requests = servers.telegram.requests;
  assert.partialDeepStrictEqual(requests.find((r) => r.path.endsWith('/sendMessage')).body, { chat_id: 111 });
  assert.ok(requests.some((r) => r.path.endsWith('/getUpdates') && r.body.offset === 3), 'pairing update is confirmed');
});

test('explains the missing permission and lets the user skip the paste test', async () => {
  const term = terminal(['good-key', TOKEN, 'n', 'y', 's']);
  let opened = 0;
  const paste = async () => {
    throw new PasteError('ຍັງບໍ່ໄດ້ເປີດສິດ Accessibility', true);
  };

  const config = await runSetup({ input: term.input, output: term.output, paste, openSettings: () => opened++ });

  assert.equal(config.ownerId, 111);
  assert.equal(opened, 1);
  assert.match(term.printed(), /❌ ຍັງບໍ່ໄດ້ເປີດສິດ Accessibility/);
  assert.match(term.printed(), /⚠️ ຂ້າມ/);
});

test('keeps the existing key, token and pairing when Enter is pressed', async () => {
  fs.writeFileSync(
    path.join(home, 'config.json'),
    JSON.stringify({ geminiApiKey: 'good-key', botToken: TOKEN, ownerId: 111, ownerName: 'Pele' }),
  );
  const term = terminal(['', '']);
  const paste = async (text) => term.input.write(`${text}\n`);

  const config = await runSetup({ input: term.input, output: term.output, paste });

  assert.equal(config.ownerId, 111);
  assert.match(term.printed(), /ຈັບຄູ່ກັບ Pele ຢູ່ແລ້ວ/);
  assert.ok(!servers.telegram.requests.some((r) => r.path.endsWith('/getUpdates')));
});

test('values given up front skip every question except the paste test', async () => {
  const term = terminal([]);
  const paste = async (text) => term.input.write(`${text}\n`);
  const preset = { geminiApiKey: 'good-key', botToken: TOKEN, ownerId: 111 };

  const config = await runSetup({ input: term.input, output: term.output, paste, preset });

  assert.partialDeepStrictEqual(config, { geminiApiKey: 'good-key', botToken: TOKEN, ownerId: 111, ownerName: 'Pele Plv' });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')), config);
  assert.ok(!servers.telegram.requests.some((r) => r.path.endsWith('/getUpdates')), 'no pairing poll');
  assert.ok(!term.printed().includes('good-key') && !term.printed().includes(TOKEN), 'secrets are never printed');
  assert.match(term.printed(), /✅ ຈັບຄູ່ກັບ Pele Plv ແລ້ວ/);
});

test('an owner who has not opened the bot yet is still paired and told to press Start', async () => {
  const term = terminal([]);
  const paste = async (text) => term.input.write(`${text}\n`);

  const config = await runSetup({
    input: term.input,
    output: term.output,
    paste,
    preset: { geminiApiKey: 'good-key', botToken: TOKEN, ownerId: 222 },
  });

  assert.partialDeepStrictEqual(config, { ownerId: 222, ownerName: 'Telegram ID 222' });
  assert.match(term.printed(), /t\.me\/office_mac_bot ແລ້ວກົດ Start/);
});

test('a rejected value given up front falls back to asking', async () => {
  const term = terminal(['good-key']);
  const paste = async (text) => term.input.write(`${text}\n`);

  const config = await runSetup({
    input: term.input,
    output: term.output,
    paste,
    preset: { geminiApiKey: 'expired-key-0123456789', botToken: TOKEN, ownerId: 111 },
  });

  assert.equal(config.geminiApiKey, 'good-key');
  assert.match(term.printed(), /API key: expi…789\n {2}❌ Gemini 400: API key not valid/);
});

test('a language given up front is saved with the rest', async () => {
  const term = terminal([]);
  const paste = async (text) => term.input.write(`${text}\n`);

  await runSetup({
    input: term.input,
    output: term.output,
    paste,
    preset: { geminiApiKey: 'good-key', botToken: TOKEN, ownerId: 111, translate: true },
  });

  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')).translate, true);
});
