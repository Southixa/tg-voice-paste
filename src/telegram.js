const DEFAULT_API = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const TEXT_LIMIT = 4000;

export class TelegramError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TelegramError';
    this.code = code;
  }
}

function apiBase() {
  return process.env.TGVOICE_TELEGRAM_API || DEFAULT_API;
}

export function createTelegram(token) {
  // The token is part of every URL, so it must never reach an error message or a log line.
  const scrub = (text) => String(text).split(token).join('<token>');

  async function request(url, init, timeoutMs) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new TelegramError(scrub(`ຕໍ່ຫາ Telegram ບໍ່ໄດ້ (${err.cause?.code ?? err.name})`), 0);
    }
  }

  async function call(method, params = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const response = await request(
      `${apiBase()}/bot${token}/${method}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) },
      timeoutMs,
    );
    const body = await response.json().catch(() => ({}));
    if (!body.ok) {
      throw new TelegramError(scrub(body.description ?? `HTTP ${response.status}`), body.error_code ?? response.status);
    }
    return body.result;
  }

  return {
    getMe: () => call('getMe'),

    getUpdates: (offset, timeoutSec) =>
      call('getUpdates', { offset, timeout: timeoutSec, allowed_updates: ['message'] }, (timeoutSec + 15) * 1000),

    sendMessage: (chatId, text, replyToMessageId) =>
      call('sendMessage', {
        chat_id: chatId,
        text: text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT)}…` : text,
        reply_parameters: replyToMessageId
          ? { message_id: replyToMessageId, allow_sending_without_reply: true }
          : undefined,
      }),

    sendChatAction: (chatId, action) => call('sendChatAction', { chat_id: chatId, action }),

    async downloadFile(fileId) {
      const file = await call('getFile', { file_id: fileId });
      const response = await request(`${apiBase()}/file/bot${token}/${file.file_path}`, {}, DOWNLOAD_TIMEOUT_MS);
      if (!response.ok) throw new TelegramError(`ດາວໂຫຼດສຽງບໍ່ໄດ້ (HTTP ${response.status})`, response.status);
      return Buffer.from(await response.arrayBuffer());
    },
  };
}
