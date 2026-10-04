#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createBot } from '../src/bot.js';
import { isConfigured, loadConfig, saveConfig } from '../src/config.js';
import { transcribe } from '../src/gemini.js';
import { appendHistory, formatHistory, readHistory, trimHistory } from '../src/history.js';
import { pasteAtCursor } from '../src/paste.js';
import { runSetup } from '../src/setup.js';
import { disableStartup, enableStartup, isStartupEnabled } from '../src/startup.js';
import { createTelegram } from '../src/telegram.js';

const LANGUAGES = { lo: 'ພາສາລາວ', en: 'ແປເປັນອັງກິດ' };
const INSTALL_URL = 'https://github.com/Southixa/tg-voice-paste/tarball/main';

const HELP = `tgvoice - ສົ່ງສຽງເຂົ້າ Telegram bot ແລ້ວຄອມນີ້ແປງເປັນຂໍ້ຄວາມ ແລະ paste ໃສ່ບ່ອນ cursor

  tgvoice                    ເລີ່ມຮັບສຽງ (ຖ້າຍັງບໍ່ໄດ້ຕັ້ງຄ່າ ຈະຖາມກ່ອນ)
  tgvoice setup              ຕັ້ງຄ່າ Gemini API key ແລະ Telegram bot ໃໝ່
      --gemini-key KEY       ໃສ່ຄ່າມາພ້ອມຄຳສັ່ງ ຈະບໍ່ຖາມຂໍ້ນັ້ນອີກ
      --bot-token TOKEN
      --owner TELEGRAM_ID
      --language lo|en       ຄືກັບ tgvoice config
      --startup on|off
  tgvoice config             ສະແດງການຕັ້ງຄ່າປັດຈຸບັນ
      --language lo|en       lo = ພາສາລາວ (ຄ່າເລີ່ມຕົ້ນ), en = ແປເປັນອັງກິດ
      --startup on|off       on = ເປີດເອງໃນ Terminal ທຸກເທື່ອທີ່ login (ຄ່າເລີ່ມຕົ້ນ off)
  tgvoice template [TOKEN]   ພິມຄຳສັ່ງດຽວສຳລັບຕິດຕັ້ງໃນຄອມອື່ນ ດ້ວຍ key ແລະ ບັນຊີຂອງຄອມນີ້
  tgvoice log [n]            ເບິ່ງ n ລາຍການລ່າສຸດ (ຄ່າເລີ່ມຕົ້ນ 20)
  tgvoice help               ສະແດງຂໍ້ຄວາມນີ້
`;

function log(line) {
  console.log(`[${new Date().toLocaleTimeString('en-GB')}] ${line}`);
}

async function start() {
  let config = loadConfig();
  if (!isConfigured(config)) config = await runSetup();

  process.on('SIGINT', () => {
    console.log('\nຢຸດແລ້ວ.');
    process.exit(0);
  });

  trimHistory();
  const bot = createBot({
    config,
    telegram: createTelegram(config.botToken),
    transcribe,
    paste: pasteAtCursor,
    history: { append: appendHistory, read: readHistory },
    saveConfig,
    log,
  });

  const mode = LANGUAGES[config.translate ? 'en' : 'lo'];
  console.log(`\n🎤 @${config.botUsername} ພ້ອມຮັບສຽງຈາກ ${config.ownerName} (${mode}). ກົດ Ctrl+C ເພື່ອຢຸດ.\n`);
  try {
    await bot.run();
  } catch (err) {
    if (err.code === 409) throw new Error('bot ນີ້ມີ tgvoice ໂຕອື່ນຮັບຢູ່ແລ້ວ (ໜ້າຕ່າງອື່ນ ຫຼືຄອມອື່ນ). ໜຶ່ງ bot ໃຊ້ໄດ້ກັບຄອມດຽວ.');
    if (err.code === 401) throw new Error('Telegram ປະຕິເສດ bot token. ແລ່ນ `tgvoice setup` ເພື່ອໃສ່ໂຕໃໝ່.');
    throw err;
  }
}

function choice(options, name, allowed) {
  const value = options[name];
  if (value !== undefined && !allowed.includes(value)) {
    throw new Error(`--${name} ຕ້ອງເປັນ ${allowed.join(' ຫຼື ')}`);
  }
  return value;
}

function presetFrom(options) {
  const owner = options.owner;
  if (owner !== undefined && !/^\d+$/.test(owner)) {
    throw new Error('--owner ຕ້ອງເປັນເລກ Telegram ID ເຊັ່ນ 123456789');
  }
  const language = choice(options, 'language', Object.keys(LANGUAGES));
  return {
    geminiApiKey: options['gemini-key'],
    botToken: options['bot-token'],
    ownerId: owner === undefined ? undefined : Number(owner),
    translate: language === undefined ? undefined : language === 'en',
  };
}

function applyStartup(startup) {
  if (startup === 'on') {
    enableStartup({ binDir: path.dirname(process.argv[1]) });
    console.log('✅ startup: on - tgvoice ຈະເປີດເອງໃນ Terminal ທຸກເທື່ອທີ່ login');
  }
  if (startup === 'off') {
    disableStartup();
    console.log('✅ startup: off - ຕ້ອງພິມ tgvoice ເອງເພື່ອເລີ່ມ');
  }
}

function configure(options) {
  const language = choice(options, 'language', Object.keys(LANGUAGES));
  const startup = choice(options, 'startup', ['on', 'off']);
  const config = loadConfig();

  if (language) {
    config.translate = language === 'en';
    saveConfig(config);
    console.log(`✅ language: ${language} - ${LANGUAGES[language]}`);
    console.log(`   ຖ້າ tgvoice ກຳລັງແລ່ນຢູ່ ໃຫ້ປິດແລ້ວເປີດໃໝ່ ຫຼືພິມ /${language} ໃນ bot.`);
  }
  applyStartup(startup);
  if (language || startup) return;

  const current = config.translate ? 'en' : 'lo';
  console.log(`language: ${current}  (${LANGUAGES[current]})`);
  console.log(`startup:  ${isStartupEnabled() ? 'on   (ເປີດເອງຕອນ login)' : 'off  (ຕ້ອງພິມ tgvoice ເອງ)'}`);
  console.log('\nປ່ຽນ: tgvoice config --language lo|en --startup on|off');
}

// The command goes to stdout on its own, so `tgvoice template | pbcopy` copies exactly it.
function showTemplate(botToken = '<BOT_TOKEN>') {
  const config = loadConfig();
  if (!isConfigured(config)) throw new Error('ຄອມນີ້ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ. ແລ່ນ `tgvoice setup` ກ່ອນ.');
  console.error('ຄຳສັ່ງລຸ່ມນີ້ມີ Gemini API key ຂອງເຈົ້າ ຢ່າແບ່ງໃຫ້ຄົນອື່ນ.');
  if (botToken === '<BOT_TOKEN>') console.error('ປ່ຽນ <BOT_TOKEN> ເປັນ token ຂອງ bot ໃໝ່ສຳລັບຄອມທີ່ຈະຕິດຕັ້ງ.');
  console.error('');
  console.log(
    `npm install -g ${INSTALL_URL} && tgvoice setup --gemini-key '${config.geminiApiKey}' --bot-token '${botToken}' --owner ${config.ownerId} && tgvoice`,
  );
}

function showLog(count) {
  const limit = Number.parseInt(count, 10);
  console.log(formatHistory(readHistory(Number.isInteger(limit) && limit > 0 ? limit : 20)));
}

function version() {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
}

async function main(argv) {
  const { values: options, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'gemini-key': { type: 'string' },
      'bot-token': { type: 'string' },
      owner: { type: 'string' },
      language: { type: 'string' },
      startup: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  const [command = 'start', ...args] = positionals;

  if (options.version) return console.log(version());
  if (options.help || command === 'help') return console.log(HELP);

  switch (command) {
    case 'start':
      return start();
    case 'setup': {
      // Both are checked before the first question, so a typo fails at once and not after setup.
      const preset = presetFrom(options);
      const startup = choice(options, 'startup', ['on', 'off']);
      await runSetup({ preset });
      applyStartup(startup);
      return console.log('\nແລ່ນ `tgvoice` ເພື່ອເລີ່ມຮັບສຽງ.');
    }
    case 'config':
      return configure(options);
    case 'template':
      return showTemplate(args[0]);
    case 'log':
      return showLog(args[0]);
    default:
      console.log(HELP);
      process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
