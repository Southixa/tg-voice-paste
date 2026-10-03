import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { loadConfig, saveConfig, configPath } from './config.js';
import { checkApiKey } from './gemini.js';
import { pasteAtCursor } from './paste.js';
import { createTelegram } from './telegram.js';

const PAIRING_POLL_SEC = 30;
const PASTE_PROBE = 'tgvoice-ok';
const ACCESSIBILITY_PANE = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';

function mask(secret) {
  return secret.length > 12 ? `${secret.slice(0, 4)}…${secret.slice(-3)}` : '…';
}

function openAccessibilitySettings() {
  spawn('open', [ACCESSIBILITY_PANE], { stdio: 'ignore' }).on('error', () => {});
}

export async function runSetup({
  input = process.stdin,
  output = process.stdout,
  paste = pasteAtCursor,
  openSettings = openAccessibilitySettings,
} = {}) {
  const config = loadConfig();
  // In a real terminal readline echoes each typed character itself, so muting what it writes
  // keeps a pasted key or token off the screen and out of screenshots.
  let muted = false;
  const screen = new Writable({
    write(chunk, encoding, done) {
      if (!muted) output.write(chunk, encoding);
      done();
    },
  });
  const rl = readline.createInterface({ input, output: screen, terminal: Boolean(input.isTTY && output.isTTY) });
  const say = (line = '') => output.write(`${line}\n`);

  async function askSecret(prompt) {
    output.write(prompt);
    muted = true;
    let answer = '';
    try {
      answer = (await rl.question('')).trim();
      return answer;
    } finally {
      muted = false;
      say(answer && mask(answer));
    }
  }

  // Without this, Ctrl+C only closes the prompt and a pending Telegram poll keeps the process alive.
  rl.on('SIGINT', () => {
    say('\nຍົກເລີກ.');
    process.exit(130);
  });

  // Asks until `validate` accepts the answer. Enter keeps the current value when there is one.
  async function askUntilValid(label, current, validate) {
    for (;;) {
      const hint = current ? ` [Enter = ໃຊ້ໂຕເກົ່າ ${mask(current)}]` : '';
      const answer = (await askSecret(`${label}${hint}: `)) || current;
      if (!answer) continue;
      try {
        return { value: answer, result: await validate(answer) };
      } catch (err) {
        say(`  ❌ ${err.message}`);
      }
    }
  }

  async function waitForOwner(telegram) {
    let offset;
    for (;;) {
      const updates = await telegram.getUpdates(offset, PAIRING_POLL_SEC);
      for (const update of updates) {
        offset = update.update_id + 1;
        const { from, chat } = update.message ?? {};
        if (!from || from.is_bot || chat.type !== 'private') continue;
        const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
        const handle = from.username ? ` (@${from.username})` : '';
        const answer = await rl.question(`  ພົບ ${name}${handle}. ແມ່ນເຈົ້າບໍ່? (y/n): `);
        if (/^y/i.test(answer.trim())) {
          await telegram.getUpdates(offset, 0);
          return { id: from.id, name, chatId: chat.id };
        }
      }
    }
  }

  // Pastes a probe word into this very prompt, which also makes macOS show its permission dialogs
  // now, while the user is at the keyboard, instead of on the first real voice message.
  async function testPaste() {
    for (;;) {
      say(`  ຖ້າ paste ໃຊ້ໄດ້ ຄຳວ່າ ${PASTE_PROBE} ຈະຂຶ້ນຢູ່ແຖວລຸ່ມເອງ. ເຫັນແລ້ວກົດ Enter.`);
      const abort = new AbortController();
      const typed = rl.question('  > ', { signal: abort.signal }).catch(() => null);
      let retryPrompt = '  ບໍ່ເຫັນຄຳນັ້ນ. ກົດ Enter ເພື່ອລອງໃໝ່ (ຫຼືພິມ s ເພື່ອຂ້າມ): ';
      try {
        await paste(PASTE_PROBE);
        if ((await typed)?.includes(PASTE_PROBE)) return true;
      } catch (err) {
        abort.abort();
        await typed;
        say(`\n  ❌ ${err.message}`);
        say('  ເປີດ System Settings > Privacy & Security > Accessibility ແລ້ວເປີດສິດໃຫ້ແອັບ Terminal ນີ້.');
        openSettings();
        retryPrompt = '  ເປີດແລ້ວກົດ Enter ເພື່ອລອງໃໝ່ (ຫຼືພິມ s ເພື່ອຂ້າມ): ';
      }
      if (/^s/i.test((await rl.question(retryPrompt)).trim())) return false;
    }
  }

  try {
    say('\n1/4  Gemini API key  (https://aistudio.google.com/apikey)');
    const gemini = await askUntilValid('  API key', config.geminiApiKey, (key) => checkApiKey(key, config.model));
    config.geminiApiKey = gemini.value;
    say(`  ✅ ໃຊ້ໄດ້ກັບ ${config.model}`);

    say('\n2/4  Telegram bot token  (ສ້າງ bot ໃໝ່ໃນ @BotFather ດ້ວຍຄຳສັ່ງ /newbot)');
    const bot = await askUntilValid('  Bot token', config.botToken, (token) => createTelegram(token).getMe());
    const tokenChanged = bot.value !== config.botToken;
    config.botToken = bot.value;
    config.botUsername = bot.result.username;
    say(`  ✅ @${config.botUsername}`);

    const telegram = createTelegram(config.botToken);
    say('\n3/4  ຈັບຄູ່ກັບບັນຊີ Telegram ຂອງເຈົ້າ');
    if (config.ownerId && !tokenChanged) {
      say(`  ✅ ຈັບຄູ່ກັບ ${config.ownerName} ຢູ່ແລ້ວ`);
    } else {
      say(`  ເປີດ https://t.me/${config.botUsername} ໃນ Telegram ແລ້ວກົດ Start. ກຳລັງລໍ...`);
      const owner = await waitForOwner(telegram);
      config.ownerId = owner.id;
      config.ownerName = owner.name;
      await telegram.sendMessage(owner.chatId, '✅ ຈັບຄູ່ແລ້ວ. ສົ່ງ voice message ມາໄດ້ເລີຍ.');
      say(`  ✅ ຈັບຄູ່ກັບ ${owner.name} ແລ້ວ. ຄົນອື່ນສັ່ງ bot ນີ້ບໍ່ໄດ້.`);
    }
    saveConfig(config);

    say('\n4/4  ທົດສອບ paste');
    say(
      (await testPaste())
        ? '  ✅ paste ໃຊ້ໄດ້'
        : '  ⚠️ ຂ້າມ. ຂໍ້ຄວາມຈະຢູ່ໃນ clipboard ໃຫ້ກົດ Cmd+V ເອງ ຈົນກວ່າຈະເປີດສິດ.',
    );

    say(`\nບັນທຶກການຕັ້ງຄ່າໄວ້ທີ່ ${configPath()}`);
    return config;
  } finally {
    rl.close();
  }
}
