const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'src', 'statusline.js');

// Runs the script as Claude Code does: JSON (or raw text) on stdin, line on stdout.
const run = (input, env = {}) => {
  const baseEnv = { ...process.env };
  delete baseEnv.NO_COLOR;
  const payload = typeof input === 'string' ? input : JSON.stringify(input);
  return spawnSync(process.execPath, [SCRIPT], {
    input: payload,
    encoding: 'utf8',
    env: { ...baseEnv, ...env },
  });
};

const plain = { env: { NO_COLOR: '1' } };
const out = (input) => run(input, plain.env).stdout;

test('shows model name', () => {
  assert.match(out({ model: { display_name: 'Opus 4.6' } }), /\[● Opus 4\.6\]/);
});

test('appends context size when the model name lacks it', () => {
  const data = { model: { display_name: 'Opus' }, context_window: { context_window_size: 1_000_000 } };
  assert.match(out(data), /Opus \(1M context\)/);
});

test('does not duplicate context size when the model name has it', () => {
  const data = { model: { display_name: 'Opus (1M context)' }, context_window: { context_window_size: 1_000_000 } };
  assert.equal(out(data).match(/context/g).length, 1);
});

test('formats 200K context size', () => {
  const data = { model: { display_name: 'Sonnet' }, context_window: { context_window_size: 200_000 } };
  assert.match(out(data), /Sonnet \(200K context\)/);
});

test('shows cost with two decimals', () => {
  assert.match(out({ cost: { total_cost_usd: 1.234 } }), /\[💰 \$1\.23\]/);
});

test('hides cost when zero or missing', () => {
  assert.doesNotMatch(out({ cost: { total_cost_usd: 0 } }), /💰/);
  assert.doesNotMatch(out({}), /💰/);
});

test('renders context bar', () => {
  assert.match(out({ context_window: { used_percentage: 37 } }), /\[████░░░░░░ 37%\]/);
});

test('clamps context percentage to 0-100', () => {
  assert.match(out({ context_window: { used_percentage: 250 } }), /\[██████████ 100%\]/);
  assert.match(out({ context_window: { used_percentage: -5 } }), /\[░░░░░░░░░░ 0%\]/);
});

test('always shows a month/day date', () => {
  assert.match(out({}), /🗓️ [a-z]{3}\/\d{1,2}/);
});

test('falls back to plain text on invalid JSON', () => {
  const res = run('not json', plain.env);
  assert.equal(res.status, 0);
  assert.equal(res.stdout, 'claude');
  assert.equal(res.stderr, '');
});

test('emits ANSI colors by default and none with NO_COLOR', () => {
  const data = { model: { display_name: 'Opus' } };
  assert.match(run(data).stdout, /\x1b\[/);
  assert.doesNotMatch(run(data, plain.env).stdout, /\x1b\[/);
});
