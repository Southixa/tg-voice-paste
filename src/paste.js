import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

// Key code 9 is the physical V key, so Cmd+V still fires while a Lao keyboard layout is active.
const PASTE_SCRIPT = 'tell application "System Events" to key code 9 using command down';
const CLIPBOARD_SETTLE_MS = 100;

export class PasteError extends Error {
  // `copied` tells the caller whether the text at least reached the clipboard.
  constructor(message, copied) {
    super(message);
    this.name = 'PasteError';
    this.copied = copied;
  }
}

function run(command, args, { input = '', env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr: stderr.trim() }));
    child.stdin.end(input);
  });
}

function explain(stderr) {
  if (/1002|not allowed to send keystrokes/i.test(stderr)) {
    return 'ຍັງບໍ່ໄດ້ເປີດສິດ Accessibility ໃຫ້ແອັບ Terminal ທີ່ແລ່ນ tgvoice';
  }
  if (/-1743|not authori[sz]ed to send apple events/i.test(stderr)) {
    return 'ຍັງບໍ່ໄດ້ອະນຸຍາດໃຫ້ Terminal ຄວບຄຸມ System Events (Automation)';
  }
  return stderr || 'osascript ລົ້ມເຫຼວ';
}

export async function copyToClipboard(text) {
  // pbcopy garbles Lao text unless it runs under a UTF-8 locale.
  const utf8 = { LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' };
  let result;
  try {
    result = await run('pbcopy', [], { input: text, env: utf8 });
  } catch (err) {
    throw new PasteError(`pbcopy: ${err.message}`, false);
  }
  if (result.code !== 0) throw new PasteError(`pbcopy: ${result.stderr}`, false);
}

export async function pasteAtCursor(text) {
  await copyToClipboard(text);
  await sleep(CLIPBOARD_SETTLE_MS);
  let result;
  try {
    result = await run('osascript', ['-e', PASTE_SCRIPT]);
  } catch (err) {
    throw new PasteError(`osascript: ${err.message}`, true);
  }
  if (result.code !== 0) throw new PasteError(explain(result.stderr), true);
}
