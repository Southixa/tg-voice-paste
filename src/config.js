import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULTS = { model: 'gemini-2.5-flash', translate: false };

export function homeDir() {
  return process.env.TGVOICE_HOME || path.join(os.homedir(), '.tgvoice');
}

export function configPath() {
  return path.join(homeDir(), 'config.json');
}

export function loadConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configPath(), 'utf8')) };
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULTS };
    throw new Error(`ອ່ານ ${configPath()} ບໍ່ໄດ້: ${err.message}`);
  }
}

// The file holds the Gemini key and the bot token, so only the owner may read it.
export function saveConfig(config) {
  fs.mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function isConfigured(config) {
  return Boolean(config.geminiApiKey && config.botToken && config.ownerId);
}
