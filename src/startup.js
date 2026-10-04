import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { homeDir } from './config.js';

// At login, launchd opens a script in Terminal and the script runs tgvoice there. Running inside
// Terminal, instead of as a background job, means the Accessibility permission already granted
// to Terminal during setup still applies, and the window shows that tgvoice is running.
const LABEL = 'com.tgvoice.startup';

function agentPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

function commandPath() {
  return path.join(homeDir(), 'tgvoice.command');
}

function shellQuote(text) {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function xmlEscape(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function isStartupEnabled() {
  return fs.existsSync(agentPath());
}

// `binDir` is where npm put the `tgvoice` command. It goes first on PATH because a window opened
// at login does not always load the shell profile that normally puts npm's commands there.
export function enableStartup({ binDir }) {
  fs.mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    commandPath(),
    [
      '#!/bin/zsh',
      '# Opened in Terminal at login. Turn it off with: tgvoice config --startup off',
      `export PATH=${shellQuote(binDir)}:"$PATH"`,
      'exec tgvoice',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );

  fs.mkdirSync(path.dirname(agentPath()), { recursive: true });
  fs.writeFileSync(
    agentPath(),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-a</string>
    <string>Terminal</string>
    <string>${xmlEscape(commandPath())}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
`,
  );
}

export function disableStartup() {
  fs.rmSync(agentPath(), { force: true });
  fs.rmSync(commandPath(), { force: true });
}
