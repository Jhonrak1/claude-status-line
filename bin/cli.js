#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith('--'));
const flags = new Set(args.filter((a) => a.startsWith('--')));
const dryRun = flags.has('--dry-run');
const force = flags.has('--force');
const project = flags.has('--project');
const printOnly = flags.has('--print');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const installDir = path.join(configDir, 'claude-status-line');
const scriptDest = path.join(installDir, 'statusline.js');
const statePath = path.join(installDir, 'state.json');
const scriptSrc = path.join(__dirname, '..', 'src', 'statusline.js');
const settingsPath = project
  ? path.join(process.cwd(), '.claude', 'settings.json')
  : path.join(configDir, 'settings.json');

const log = (msg) => console.log(dryRun ? `[dry-run] ${msg}` : msg);
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const readJson = (file, fallback) => {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    if (fallback === undefined) return undefined;
    fail(`Could not parse ${file}. Fix the JSON and try again; nothing was changed.`);
  }
};

// Write via temp file + rename so a crash or concurrent write can't leave a half-written file.
// Follows symlinks (dotfile managers) and keeps the original permissions.
const writeAtomic = (file, contents) => {
  const exists = fs.existsSync(file);
  const target = exists ? fs.realpathSync(file) : file;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents);
  if (exists) fs.chmodSync(tmp, fs.statSync(target).mode & 0o777);
  fs.renameSync(tmp, target);
};
const writeJson = (file, obj) => writeAtomic(file, JSON.stringify(obj, null, 2) + '\n');

const isOurs = (statusLine) => typeof statusLine?.command === 'string' && statusLine.command.includes(scriptDest);

// Prefer plain `node`; fall back to this Node's absolute path if `node` isn't on the PATH.
const nodeCommand = () => {
  const found = spawnSync('node', ['--version'], { shell: process.platform === 'win32' });
  if (found.status === 0) return 'node';
  console.warn(`Warning: "node" is not on your PATH; using ${process.execPath} instead.`);
  return `"${process.execPath}"`;
};

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const otherOverrides = () =>
  [
    path.join(configDir, 'settings.local.json'),
    path.join(process.cwd(), '.claude', 'settings.json'),
    path.join(process.cwd(), '.claude', 'settings.local.json'),
  ]
    .filter((file) => file !== settingsPath)
    .filter((file) => {
      const sl = readJson(file, undefined)?.statusLine;
      return sl && !isOurs(sl);
    });

// Copy the script and show the snippet to paste; settings.json is never read or written.
const installPrint = () => {
  const command = `${nodeCommand()} "${scriptDest}"`;
  log(`Copying script -> ${scriptDest}`);
  if (!dryRun) {
    fs.mkdirSync(installDir, { recursive: true });
    fs.copyFileSync(scriptSrc, scriptDest);
  }
  console.log(`\nAdd this to ${settingsPath} yourself:\n`);
  console.log(JSON.stringify({ statusLine: { type: 'command', command } }, null, 2));
  console.log('\nThen restart Claude Code. Nothing in your settings was changed.');
};

const install = () => {
  if (printOnly) return installPrint();
  if (project) {
    console.warn(
      'Warning: this writes an absolute path from your machine into the project settings. ' +
        'If that file is committed, teammates will get a broken status line. ' +
        'Consider --print and put it in .claude/settings.local.json instead.'
    );
  }
  const settings = readJson(settingsPath, {});
  const existing = settings.statusLine;
  const state = readJson(statePath, {});

  if (existing && !isOurs(existing) && !force) {
    console.error(`${settingsPath} already has a statusLine:\n${JSON.stringify(existing, null, 2)}\n`);
    fail('Nothing was changed. Re-run with --force to replace it (it will be backed up and restored on uninstall).');
  }

  if (existing && !isOurs(existing)) {
    const backup = `${settingsPath}.${timestamp()}.bak`;
    log(`Backing up ${settingsPath} -> ${backup}`);
    if (!dryRun) fs.copyFileSync(settingsPath, backup);
    state[settingsPath] = { previous: existing };
  } else if (!existing) {
    state[settingsPath] = { previous: null };
  } // else: already ours, keep the recorded previous value

  const command = `${nodeCommand()} "${scriptDest}"`;
  log(`Copying script -> ${scriptDest}`);
  log(`Setting statusLine in ${settingsPath} to: ${command}`);

  if (!dryRun) {
    fs.mkdirSync(installDir, { recursive: true });
    fs.copyFileSync(scriptSrc, scriptDest);
    settings.statusLine = { type: 'command', command };
    writeJson(settingsPath, settings);
    writeJson(statePath, state);
  }

  for (const file of otherOverrides()) {
    console.warn(`Warning: ${file} defines its own statusLine and may override this one.`);
  }
  if (!dryRun) console.log('Done. Restart Claude Code to see it.');
};

const uninstall = () => {
  const state = readJson(statePath, {});
  if (fs.existsSync(settingsPath)) {
    const settings = readJson(settingsPath, {});
    if (isOurs(settings.statusLine)) {
      const previous = state[settingsPath]?.previous ?? null;
      if (previous) settings.statusLine = previous;
      else delete settings.statusLine;
      log(`Updating statusLine in ${settingsPath}${previous ? ' (restoring previous value)' : ' (removing)'}`);
      if (!dryRun) writeJson(settingsPath, settings);
    } else {
      log(`statusLine in ${settingsPath} is not ours; leaving it alone.`);
    }
  }
  delete state[settingsPath];

  if (!dryRun) {
    if (Object.keys(state).length) {
      writeJson(statePath, state);
    } else {
      // No other settings file still uses our script, so remove our files.
      fs.rmSync(installDir, { recursive: true, force: true });
      log(`Removed ${installDir}`);
    }
    console.log('Uninstalled. Restart Claude Code to apply.');
  }
};

const doctor = () => {
  const settings = readJson(settingsPath, undefined);
  const nodeOk = spawnSync('node', ['--version'], { shell: process.platform === 'win32' }).status === 0;
  console.log(`Config dir:       ${configDir}`);
  console.log(`Script installed: ${fs.existsSync(scriptDest) ? 'yes' : 'no'} (${scriptDest})`);
  console.log(`Settings file:    ${settingsPath} ${settings === undefined ? '(unreadable or missing)' : ''}`);
  console.log(`statusLine:       ${settings?.statusLine ? (isOurs(settings.statusLine) ? 'ours' : 'someone else\'s') : 'not set'}`);
  console.log(`"node" on PATH:   ${nodeOk ? 'yes' : 'NO'}`);
  for (const file of otherOverrides()) console.log(`Possible override: ${file}`);
};

const commands = { install, uninstall, doctor };
if (commands[cmd]) {
  commands[cmd]();
} else {
  console.log(`Usage: claude-status-line <install|uninstall|doctor> [--dry-run] [--force] [--project]

  install     Install the script and set statusLine in settings.json
  uninstall   Remove it and restore the previous statusLine, if any
  doctor      Show the current state and anything that might override it

  --dry-run   Show what would change without writing anything
  --force     Replace an existing statusLine (it is backed up first)
  --print     Install only the script and print the settings snippet; settings.json is not touched
  --project   Use ./.claude/settings.json instead of the user-level settings`);
  process.exit(cmd ? 1 : 0);
}
