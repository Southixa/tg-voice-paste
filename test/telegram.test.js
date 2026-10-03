import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createTelegram } from '../src/telegram.js';
import { startServer } from './helpers.js';

const TOKEN = '123456:secret-token';
let server;

afterEach(async () => {
  await server?.close();
  server = undefined;
  delete process.env.TGVOICE_TELEGRAM_API;
});

test('surfaces Telegram errors with their code', async () => {
  server = await startServer(() => ({ status: 409, json: { ok: false, error_code: 409, description: 'Conflict: terminated by other getUpdates request' } }));
  process.env.TGVOICE_TELEGRAM_API = server.url;

  await assert.rejects(createTelegram(TOKEN).getUpdates(undefined, 0), { code: 409, message: /Conflict/ });
});

test('never leaks the token into an error message', async () => {
  server = await startServer(() => ({ status: 404, json: { ok: false, error_code: 404, description: `Not Found: /bot${TOKEN}/getMe` } }));
  process.env.TGVOICE_TELEGRAM_API = server.url;

  await assert.rejects(createTelegram(TOKEN).getMe(), (err) => {
    assert.equal(err.message, 'Not Found: /bot<token>/getMe');
    return true;
  });
});

test('reports an unreachable server without the token', async () => {
  process.env.TGVOICE_TELEGRAM_API = 'http://127.0.0.1:1';

  await assert.rejects(createTelegram(TOKEN).getMe(), (err) => {
    assert.equal(err.code, 0);
    assert.ok(!err.message.includes(TOKEN));
    return true;
  });
});

test('truncates a reply that is longer than Telegram accepts', async () => {
  server = await startServer(() => ({ json: { ok: true, result: {} } }));
  process.env.TGVOICE_TELEGRAM_API = server.url;

  await createTelegram(TOKEN).sendMessage(1, 'ກ'.repeat(5000));

  assert.equal(server.requests[0].body.text.length, 4001);
});
