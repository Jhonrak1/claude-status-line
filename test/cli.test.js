const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { THEMES } = require('../src/statusline.js');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

// Fresh temp config dir + project dir per test, so the real ~/.claude is never touched.
const sandbox = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = path.join(root, 'home', '.claude');
  const project = path.join(root, 'project');
  fs.mkdirSync(config, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  const run = (...args) =>
    spawnSync(process.execPath, [CLI, ...args], {
      cwd: project,
      encoding: 'utf8',
      env: { ...process.env, HOME: path.join(root, 'home'), CLAUDE_CONFIG_DIR: config },
    });
  const settingsFile = path.join(config, 'settings.json');
  return {
    run,
    config,
    project,
    settingsFile,
    installDir: path.join(config, 'claude-status-line'),
    writeJson: (file, obj) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(obj, null, 2));
    },
    readJson: (file) => JSON.parse(fs.readFileSync(file, 'utf8')),
    backups: () => fs.readdirSync(config).filter((f) => f.endsWith('.bak')),
  };
};

const OTHER = { type: 'command', command: 'echo other' };

test('install creates script, statusLine and state', (t) => {
  const s = sandbox(t);
  const res = s.run('install');
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(s.installDir, 'statusline.js')));
  const { statusLine } = s.readJson(s.settingsFile);
  assert.equal(statusLine.type, 'command');
  assert.ok(statusLine.command.includes(path.join(s.installDir, 'statusline.js')));
  assert.deepEqual(s.readJson(path.join(s.installDir, 'state.json')), { [s.settingsFile]: { previous: null } });
});

test('install preserves unrelated settings', (t) => {
  const s = sandbox(t);
  s.writeJson(s.settingsFile, { model: 'opus', permissions: { allow: ['Bash(ls)'] } });
  assert.equal(s.run('install').status, 0);
  const settings = s.readJson(s.settingsFile);
  assert.equal(settings.model, 'opus');
  assert.deepEqual(settings.permissions, { allow: ['Bash(ls)'] });
});

test('installed script runs', (t) => {
  const s = sandbox(t);
  s.run('install');
  const res = spawnSync(process.execPath, [path.join(s.installDir, 'statusline.js')], {
    input: '{}',
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.match(res.stdout, /🗓️/);
});

test('reinstall is idempotent and keeps the recorded previous statusLine', (t) => {
  const s = sandbox(t);
  s.writeJson(s.settingsFile, { statusLine: OTHER });
  assert.equal(s.run('install', '--force').status, 0);
  assert.equal(s.run('install').status, 0);
  assert.deepEqual(s.readJson(path.join(s.installDir, 'state.json'))[s.settingsFile], { previous: OTHER });
  assert.equal(s.backups().length, 1);
});

test('refuses to replace another statusLine without --force', (t) => {
  const s = sandbox(t);
  s.writeJson(s.settingsFile, { statusLine: OTHER });
  const res = s.run('install');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /--force/);
  assert.deepEqual(s.readJson(s.settingsFile), { statusLine: OTHER });
  assert.ok(!fs.existsSync(s.installDir));
});

test('--force backs up the old settings and records previous', (t) => {
  const s = sandbox(t);
  s.writeJson(s.settingsFile, { statusLine: OTHER });
  assert.equal(s.run('install', '--force').status, 0);
  const [backup] = s.backups();
  assert.deepEqual(s.readJson(path.join(s.config, backup)), { statusLine: OTHER });
  assert.deepEqual(s.readJson(path.join(s.installDir, 'state.json'))[s.settingsFile], { previous: OTHER });
});

test('uninstall restores the previous statusLine', (t) => {
  const s = sandbox(t);
  s.writeJson(s.settingsFile, { statusLine: OTHER });
  s.run('install', '--force');
  assert.equal(s.run('uninstall').status, 0);
  assert.deepEqual(s.readJson(s.settingsFile), { statusLine: OTHER });
  assert.ok(!fs.existsSync(s.installDir));
});

test('uninstall removes statusLine and our files when there was no previous one', (t) => {
  const s = sandbox(t);
  s.writeJson(s.settingsFile, { model: 'opus' });
  s.run('install');
  assert.equal(s.run('uninstall').status, 0);
  assert.deepEqual(s.readJson(s.settingsFile), { model: 'opus' });
  assert.ok(!fs.existsSync(s.installDir));
});

test('uninstall leaves a statusLine that is not ours', (t) => {
  const s = sandbox(t);
  s.writeJson(s.settingsFile, { statusLine: OTHER });
  const res = s.run('uninstall');
  assert.equal(res.status, 0);
  assert.match(res.stdout, /not ours/);
  assert.deepEqual(s.readJson(s.settingsFile), { statusLine: OTHER });
});

test('uninstall keeps the script while another settings file still uses it', (t) => {
  const s = sandbox(t);
  s.run('install');
  s.run('install', '--project');
  assert.equal(s.run('uninstall', '--project').status, 0);
  assert.ok(fs.existsSync(path.join(s.installDir, 'statusline.js')));
  assert.deepEqual(Object.keys(s.readJson(path.join(s.installDir, 'state.json'))), [s.settingsFile]);
  assert.equal(s.run('uninstall').status, 0);
  assert.ok(!fs.existsSync(s.installDir));
});

test('--dry-run writes nothing', (t) => {
  const s = sandbox(t);
  const res = s.run('install', '--dry-run');
  assert.equal(res.status, 0);
  assert.match(res.stdout, /\[dry-run\]/);
  assert.deepEqual(fs.readdirSync(s.config), []);
});

test('--print copies the script but does not touch settings', (t) => {
  const s = sandbox(t);
  s.writeJson(s.settingsFile, { statusLine: OTHER });
  const res = s.run('install', '--print');
  assert.equal(res.status, 0);
  assert.ok(fs.existsSync(path.join(s.installDir, 'statusline.js')));
  assert.deepEqual(s.readJson(s.settingsFile), { statusLine: OTHER });
  assert.match(res.stdout, /"statusLine"/);
  assert.match(res.stdout, /statusline\.js/);
});

test('--project writes to ./.claude/settings.json and warns', (t) => {
  const s = sandbox(t);
  const res = s.run('install', '--project');
  assert.equal(res.status, 0);
  assert.match(res.stderr, /absolute path/);
  const projectSettings = path.join(s.project, '.claude', 'settings.json');
  assert.ok(s.readJson(projectSettings).statusLine.command.includes('statusline.js'));
  assert.ok(!fs.existsSync(s.settingsFile));
});

test('invalid settings JSON aborts without changes', (t) => {
  const s = sandbox(t);
  fs.writeFileSync(s.settingsFile, '{ not json');
  const res = s.run('install');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Could not parse/);
  assert.equal(fs.readFileSync(s.settingsFile, 'utf8'), '{ not json');
  assert.ok(!fs.existsSync(s.installDir));
});

test('install warns about a local override', (t) => {
  const s = sandbox(t);
  s.writeJson(path.join(s.config, 'settings.local.json'), { statusLine: OTHER });
  const res = s.run('install');
  assert.equal(res.status, 0);
  assert.match(res.stderr, /settings\.local\.json.*override/);
});

test('doctor reports not set, ours and someone else\'s', (t) => {
  const s = sandbox(t);
  assert.match(s.run('doctor').stdout, /statusLine:\s+not set/);
  s.run('install');
  const ours = s.run('doctor').stdout;
  assert.match(ours, /Script installed: yes/);
  assert.match(ours, /statusLine:\s+ours/);
  s.writeJson(s.settingsFile, { statusLine: OTHER });
  assert.match(s.run('doctor').stdout, /statusLine:\s+someone else's/);
});

test('doctor flags a possible override', (t) => {
  const s = sandbox(t);
  s.writeJson(path.join(s.config, 'settings.local.json'), { statusLine: OTHER });
  assert.match(s.run('doctor').stdout, /Possible override: .*settings\.local\.json/);
});

test('no command prints usage and exits 0; unknown command exits 1', (t) => {
  const s = sandbox(t);
  const none = s.run();
  assert.equal(none.status, 0);
  assert.match(none.stdout, /Usage:/);
  assert.equal(s.run('bogus').status, 1);
});

test('--theme with an unknown name fails and lists the themes', (t) => {
  const s = sandbox(t);
  const res = s.run('install', '--theme', 'neon');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Unknown theme "neon"/);
  for (const name of Object.keys(THEMES)) assert.ok(res.stderr.includes(name));
  assert.ok(!fs.existsSync(s.installDir));
});

for (const name of Object.keys(THEMES)) {
  test(`install --theme ${name} puts the theme in the command`, (t) => {
    const s = sandbox(t);
    assert.equal(s.run('install', '--theme', name).status, 0);
    assert.match(s.readJson(s.settingsFile).statusLine.command, new RegExp(`statusline\\.js" --theme ${name}$`));
  });
}

test('install without --theme leaves the command without a theme flag', (t) => {
  const s = sandbox(t);
  s.run('install');
  assert.doesNotMatch(s.readJson(s.settingsFile).statusLine.command, /--theme/);
});
