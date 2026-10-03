import os from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { formatHistory, summarizeEntry } from './history.js';

// A voice message older than this was sent while the Mac was not listening.
// Pasting it now would drop text into whatever the user is doing at the moment.
const STALE_AFTER_SEC = 60;
const POLL_TIMEOUT_SEC = 50;
const POLL_RETRY_MS = 3000;
const LOG_COMMAND_ENTRIES = 10;

export function createBot({ config, telegram, transcribe, paste, history, saveConfig, log = console.log }) {
  const computer = os.hostname().replace(/\.local$/, '');

  async function reply(message, text) {
    try {
      await telegram.sendMessage(message.chat.id, text, message.message_id);
    } catch (err) {
      log(`ຕອບໃນ Telegram ບໍ່ໄດ້: ${err.message}`);
    }
  }

  function record(media, entry) {
    log(summarizeEntry(history.append({ seconds: media.duration, ...entry })));
  }

  function helpText() {
    return [
      `🎤 ພ້ອມຮັບສຽງສຳລັບຄອມ "${computer}"`,
      '',
      'ສົ່ງ voice message ມາ ແລ້ວຂໍ້ຄວາມຈະຖືກ paste ໃສ່ບ່ອນທີ່ cursor ຢູ່ໃນຄອມ.',
      '',
      `ໂໝດຕອນນີ້: ${config.translate ? 'ແປເປັນອັງກິດ' : 'ພາສາລາວ'}`,
      '/lo - ພາສາລາວ',
      '/en - ແປເປັນອັງກິດ',
      `/log - ${LOG_COMMAND_ENTRIES} ລາຍການລ່າສຸດ`,
    ].join('\n');
  }

  async function setTranslate(message, translate) {
    config.translate = translate;
    saveConfig(config);
    await reply(message, translate ? '🔄 ໂໝດ: ແປເປັນອັງກິດ' : '🔄 ໂໝດ: ພາສາລາວ');
  }

  async function handleText(message) {
    const command = message.text.trim().split(/\s+/)[0].split('@')[0].toLowerCase();
    if (command === '/en') return setTranslate(message, true);
    if (command === '/lo') return setTranslate(message, false);
    if (command === '/log') return reply(message, formatHistory(history.read(LOG_COMMAND_ENTRIES)));
    return reply(message, helpText());
  }

  async function handleVoice(message, media, receivedAt) {
    const ageSec = receivedAt - message.date;
    if (ageSec > STALE_AFTER_SEC) {
      const minutes = Math.max(1, Math.round(ageSec / 60));
      record(media, { status: 'skipped', error: `ສົ່ງມາ ${minutes} ນາທີກ່ອນ` });
      await reply(message, `⏭ ຂ້າມສຽງນີ້ ເພາະມັນຖືກສົ່ງມາ ${minutes} ນາທີກ່ອນ ຕອນຄອມບໍ່ໄດ້ຮັບຢູ່.`);
      return;
    }

    telegram.sendChatAction(message.chat.id, 'typing').catch(() => {});

    let text;
    let attempts;
    try {
      const audio = await telegram.downloadFile(media.file_id);
      ({ text, attempts } = await transcribe({
        apiKey: config.geminiApiKey,
        model: config.model,
        audio,
        mimeType: media.mime_type ?? 'audio/ogg',
        translate: config.translate,
      }));
    } catch (err) {
      record(media, { status: 'failed', attempts: err.attempts ?? 1, error: err.message });
      const retried = err.attempts === 2 ? ' (ລອງ 2 ເທື່ອແລ້ວ)' : '';
      await reply(message, `❌ ແປງສຽງບໍ່ໄດ້${retried}\n${err.message}`);
      return;
    }

    if (!text) {
      record(media, { status: 'empty', attempts, error: 'ບໍ່ໄດ້ຍິນສຽງເວົ້າ' });
      await reply(message, '⚠️ ບໍ່ໄດ້ຍິນສຽງເວົ້າ ລອງອັດໃໝ່.');
      return;
    }

    try {
      await paste(text);
    } catch (err) {
      if (err.copied) {
        record(media, { status: 'copied', attempts, text, error: err.message });
        await reply(
          message,
          `📋 ${text}\n\n⚠️ paste ອັດຕະໂນມັດບໍ່ໄດ້: ${err.message}\nຂໍ້ຄວາມຢູ່ໃນ clipboard ຂອງຄອມແລ້ວ ກົດ Cmd+V ເອງໄດ້.`,
        );
      } else {
        record(media, { status: 'failed', attempts, error: err.message });
        await reply(message, `❌ paste ບໍ່ໄດ້: ${err.message}\n\n${text}`);
      }
      return;
    }

    record(media, { status: 'ok', attempts, text });
    await reply(message, `✅ ${text}`);
  }

  // Only the paired owner may drive this Mac; everyone else is ignored without a reply.
  async function handleMessage(message, receivedAt = Math.floor(Date.now() / 1000)) {
    if (message.from?.id !== config.ownerId) {
      log(`ບໍ່ຮັບຂໍ້ຄວາມຈາກຄົນທີ່ບໍ່ໄດ້ຈັບຄູ່ (id ${message.from?.id})`);
      return;
    }
    const media = message.voice ?? message.audio;
    if (media) return handleVoice(message, media, receivedAt);
    if (message.text) return handleText(message);
    return reply(message, 'ຮັບໄດ້ສະເພາະ voice message.');
  }

  async function run({ signal } = {}) {
    let offset;
    let offline = false;
    while (!signal?.aborted) {
      let updates;
      try {
        updates = await telegram.getUpdates(offset, POLL_TIMEOUT_SEC);
      } catch (err) {
        // 401: the token was revoked. 409: another tgvoice is already polling this bot.
        if (err.code === 401 || err.code === 409) throw err;
        if (!offline) log(`${err.message} - ຈະລອງຕໍ່ໃໝ່ເລື້ອຍໆ`);
        offline = true;
        await sleep(POLL_RETRY_MS);
        continue;
      }
      if (offline) log('ຕໍ່ Telegram ໄດ້ຄືນແລ້ວ');
      offline = false;

      const receivedAt = Math.floor(Date.now() / 1000);
      for (const update of updates) {
        offset = update.update_id + 1;
        if (!update.message) continue;
        try {
          await handleMessage(update.message, receivedAt);
        } catch (err) {
          log(`ຜິດພາດທີ່ບໍ່ຄາດຄິດ: ${err.message}`);
        }
      }
    }
  }

  return { handleMessage, run };
}
