#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createBot } from '../src/bot.js';
import { isConfigured, loadConfig, saveConfig } from '../src/config.js';
import { transcribe } from '../src/gemini.js';
import { appendHistory, formatHistory, readHistory, trimHistory } from '../src/history.js';
import { pasteAtCursor } from '../src/paste.js';
import { runSetup } from '../src/setup.js';
import { createTelegram } from '../src/telegram.js';

const INSTALL_URL = 'https://github.com/Southixa/tg-voice-paste/tarball/main';

const HELP = `tgvoice - ສົ່ງສຽງເຂົ້າ Telegram bot ແລ້ວຄອມນີ້ແປງເປັນຂໍ້ຄວາມ ແລະ paste ໃສ່ບ່ອນ cursor

  tgvoice                    ເລີ່ມຮັບສຽງ (ຖ້າຍັງບໍ່ໄດ້ຕັ້ງຄ່າ ຈະຖາມກ່ອນ)
  tgvoice setup              ຕັ້ງຄ່າ Gemini API key ແລະ Telegram bot ໃໝ່
      --gemini-key KEY       ໃສ່ຄ່າມາພ້ອມຄຳສັ່ງ ຈະບໍ່ຖາມຂໍ້ນັ້ນອີກ
      --bot-token TOKEN
      --owner TELEGRAM_ID
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

  console.log(`\n🎤 @${config.botUsername} ພ້ອມຮັບສຽງຈາກ ${config.ownerName}. ກົດ Ctrl+C ເພື່ອຢຸດ.\n`);
  try {
    await bot.run();
  } catch (err) {
    if (err.code === 409) throw new Error('bot ນີ້ມີ tgvoice ໂຕອື່ນຮັບຢູ່ແລ້ວ (ໜ້າຕ່າງອື່ນ ຫຼືຄອມອື່ນ). ໜຶ່ງ bot ໃຊ້ໄດ້ກັບຄອມດຽວ.');
    if (err.code === 401) throw new Error('Telegram ປະຕິເສດ bot token. ແລ່ນ `tgvoice setup` ເພື່ອໃສ່ໂຕໃໝ່.');
    throw err;
  }
}

function presetFrom(options) {
  const owner = options.owner;
  if (owner !== undefined && !/^\d+$/.test(owner)) {
    throw new Error('--owner ຕ້ອງເປັນເລກ Telegram ID ເຊັ່ນ 123456789');
  }
  return {
    geminiApiKey: options['gemini-key'],
    botToken: options['bot-token'],
    ownerId: owner === undefined ? undefined : Number(owner),
  };
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
    case 'setup':
      await runSetup({ preset: presetFrom(options) });
      return console.log('\nແລ່ນ `tgvoice` ເພື່ອເລີ່ມຮັບສຽງ.');
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
