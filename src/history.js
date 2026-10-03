import fs from 'node:fs';
import path from 'node:path';
import { homeDir } from './config.js';

const MAX_ENTRIES = 1000;
const ICONS = { ok: '✅', copied: '📋', empty: '⚠️', failed: '❌', skipped: '⏭' };

function historyPath() {
  return path.join(homeDir(), 'history.jsonl');
}

function readAll() {
  let raw;
  try {
    raw = fs.readFileSync(historyPath(), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return raw.split('\n').flatMap((line) => {
    try {
      return line ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });
}

export function appendHistory(entry) {
  const stored = { at: new Date().toISOString(), ...entry };
  fs.mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
  fs.appendFileSync(historyPath(), `${JSON.stringify(stored)}\n`, { mode: 0o600 });
  return stored;
}

export function readHistory(limit = 20) {
  return readAll().slice(-limit);
}

export function trimHistory() {
  const entries = readAll();
  if (entries.length <= MAX_ENTRIES) return;
  const kept = entries.slice(-MAX_ENTRIES).map((entry) => JSON.stringify(entry));
  fs.writeFileSync(historyPath(), `${kept.join('\n')}\n`, { mode: 0o600 });
}

export function summarizeEntry(entry) {
  const seconds = entry.seconds ? ` ${entry.seconds}s` : '';
  const retried = entry.attempts === 2 ? ' (ລອງ 2 ເທື່ອ)' : '';
  const detail = entry.text ?? entry.error ?? '';
  return `${ICONS[entry.status] ?? '•'}${seconds}${retried}  ${detail}`.trimEnd();
}

export function formatEntry(entry) {
  const when = new Date(entry.at)
    .toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(',', '');
  return `${when} ${summarizeEntry(entry)}`;
}

export function formatHistory(entries) {
  if (entries.length === 0) return 'ຍັງບໍ່ມີລາຍການ.';
  const counts = {};
  for (const { status } of entries) counts[status] = (counts[status] ?? 0) + 1;
  const summary = Object.entries(counts)
    .map(([status, count]) => `${ICONS[status] ?? '•'} ${count}`)
    .join(' · ');
  return [`${entries.length} ລາຍການລ່າສຸດ: ${summary}`, '', ...entries.map(formatEntry)].join('\n');
}
