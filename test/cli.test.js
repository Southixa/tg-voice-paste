import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/tgvoice.js', import.meta.url));
let home;

function tgvoice(...args) {
  return spawnSync('node', [CLI, ...args], { env: { ...process.env, TGVOICE_HOME: home }, input: '', encoding: 'utf8' });
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tgvoice-'));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true });
});

test('template prints a single install command carrying this Mac\'s key and owner', () => {
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ geminiApiKey: 'gemini-key', botToken: '1:this-mac', ownerId: 111 }));

  const { stdout, stderr, status } = tgvoice('template');

  assert.equal(status, 0);
  assert.equal(
    stdout,
    "npm install -g https://github.com/Southixa/tg-voice-paste/tarball/main && tgvoice setup --gemini-key 'gemini-key' --bot-token '<BOT_TOKEN>' --owner 111 && tgvoice\n",
  );
  assert.ok(!stdout.includes('this-mac'), 'another Mac needs its own bot, so this Mac\'s token is left out');
  assert.match(stderr, /<BOT_TOKEN>/);
});

test('template fills in a bot token passed as an argument', () => {
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ geminiApiKey: 'gemini-key', botToken: '1:this-mac', ownerId: 111 }));

  assert.match(tgvoice('template', '2:office-mac').stdout, /--bot-token '2:office-mac' /);
});

test('template refuses to run before this Mac is set up', () => {
  const { stdout, stderr, status } = tgvoice('template');

  assert.equal(status, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /tgvoice setup/);
});

test('setup rejects an owner that is not a Telegram id', () => {
  const { stderr, status } = tgvoice('setup', '--owner', '@pele');

  assert.equal(status, 1);
  assert.match(stderr, /--owner/);
});

test('an unknown option is an error, not a silent start', () => {
  const { stderr, status } = tgvoice('--gemini-kee', 'x');

  assert.equal(status, 1);
  assert.match(stderr, /gemini-kee/);
});
