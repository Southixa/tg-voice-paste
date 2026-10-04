import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/tgvoice.js', import.meta.url));
const CONFIGURED = { geminiApiKey: 'gemini-key', botToken: '1:this-mac', ownerId: 111 };
let home;

// HOME points at a temporary folder, so nothing here touches the real ~/.tgvoice or LaunchAgents.
function tgvoice(...args) {
  const env = { ...process.env, HOME: home };
  delete env.TGVOICE_HOME;
  return spawnSync('node', [CLI, ...args], { env, input: '', encoding: 'utf8' });
}

const configFile = () => path.join(home, '.tgvoice', 'config.json');
const commandFile = () => path.join(home, '.tgvoice', 'tgvoice.command');
const agentFile = () => path.join(home, 'Library', 'LaunchAgents', 'com.tgvoice.startup.plist');
const savedConfig = () => JSON.parse(fs.readFileSync(configFile(), 'utf8'));

function writeConfig(config) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(config));
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tgvoice-'));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true });
});

test("template prints a single install command carrying this Mac's key and owner", () => {
  writeConfig(CONFIGURED);

  const { stdout, stderr, status } = tgvoice('template');

  assert.equal(status, 0);
  assert.equal(
    stdout,
    "npm install -g https://github.com/Southixa/tg-voice-paste/tarball/main && tgvoice setup --gemini-key 'gemini-key' --bot-token '<BOT_TOKEN>' --owner 111 && tgvoice\n",
  );
  assert.ok(!stdout.includes('this-mac'), "another Mac needs its own bot, so this Mac's token is left out");
  assert.match(stderr, /<BOT_TOKEN>/);
});

test('template fills in a bot token passed as an argument', () => {
  writeConfig(CONFIGURED);

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

test('setup rejects a bad language or startup value before asking anything', () => {
  for (const args of [['--language', 'fr'], ['--startup', 'yes']]) {
    const { stdout, stderr, status } = tgvoice('setup', ...args);

    assert.equal(status, 1);
    assert.equal(stdout, '');
    assert.match(stderr, new RegExp(args[0]));
  }
});

test('an unknown option is an error, not a silent start', () => {
  const { stderr, status } = tgvoice('--gemini-kee', 'x');

  assert.equal(status, 1);
  assert.match(stderr, /gemini-kee/);
});

test('config shows Lao and no startup by default', () => {
  const { stdout, status } = tgvoice('config');

  assert.equal(status, 0);
  assert.match(stdout, /language: lo /);
  assert.match(stdout, /startup: {2}off /);
});

test('config --language switches the saved mode and keeps the rest', () => {
  writeConfig(CONFIGURED);

  assert.equal(tgvoice('config', '--language', 'en').status, 0);
  assert.partialDeepStrictEqual(savedConfig(), { ...CONFIGURED, translate: true });
  assert.match(tgvoice('config').stdout, /language: en /);

  tgvoice('config', '--language', 'lo');
  assert.equal(savedConfig().translate, false);
});

test('config --startup on installs the login files and off removes them', () => {
  assert.equal(tgvoice('config', '--startup', 'on').status, 0);

  assert.equal(spawnSync('plutil', ['-lint', agentFile()]).status, 0, 'launchd can parse the agent');
  const agent = fs.readFileSync(agentFile(), 'utf8');
  assert.ok(agent.includes(`<string>${commandFile()}</string>`), 'the agent opens the command file');
  assert.ok(agent.includes('<string>Terminal</string>'));
  assert.equal(fs.statSync(commandFile()).mode & 0o777, 0o755);
  assert.match(fs.readFileSync(commandFile(), 'utf8'), /^export PATH='.*\/bin':"\$PATH"\nexec tgvoice$/m);
  assert.match(tgvoice('config').stdout, /startup: {2}on /);

  assert.equal(tgvoice('config', '--startup', 'off').status, 0);
  assert.ok(!fs.existsSync(agentFile()) && !fs.existsSync(commandFile()));
  assert.match(tgvoice('config').stdout, /startup: {2}off /);
});

test('turning startup off when it was never on is not an error', () => {
  assert.equal(tgvoice('config', '--startup', 'off').status, 0);
});
