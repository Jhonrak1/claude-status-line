#!/usr/bin/env node
const NO_COLOR = 'NO_COLOR' in process.env;
const RESET = NO_COLOR ? '' : '\x1b[0m';
// Section with foreground (fg) and background (bg) 256-color codes.
const section = (fg, bg, text) => (NO_COLOR ? `[${text}]` : `\x1b[38;5;${fg};48;5;${bg}m ${text} ${RESET}`);

// 256-color codes: fg for all text, bg per section, dot for the model indicator.
const THEMES = {
  default: { fg: 255, dot: 82, model: 24, cost: 22, bar: 54, date: 130 },
  ocean: { fg: 255, dot: 123, model: 25, cost: 30, bar: 61, date: 67 },
  forest: { fg: 255, dot: 154, model: 22, cost: 28, bar: 64, date: 94 },
  mono: { fg: 252, dot: 255, model: 236, cost: 238, bar: 240, date: 242 },
  light: { fg: 16, dot: 28, model: 153, cost: 157, bar: 183, date: 223 },
};

const themeArg = process.argv.indexOf('--theme');
const theme = THEMES[themeArg > -1 ? process.argv[themeArg + 1] : 'default'] || THEMES.default;

const formatSize = (n) => {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

const render = (data) => {
  const parts = [];

  // 1. Colored dot + model name with context size
  const model = data?.model?.display_name;
  if (model) {
    const size = data?.context_window?.context_window_size;
    const hasSize = /context/i.test(model);
    const label = typeof size === 'number' && !hasSize ? `${model} (${formatSize(size)} context)` : model;
    const dot = NO_COLOR ? '●' : `\x1b[38;5;${theme.dot}m●\x1b[38;5;${theme.fg}m`;
    parts.push(section(theme.fg, theme.model, `${dot} ${label}`));
  }

  // 2. Money icon + session cost (hidden when zero/missing, e.g. subscription plans)
  const cost = data?.cost?.total_cost_usd;
  if (typeof cost === 'number' && cost > 0) {
    parts.push(section(theme.fg, theme.cost, `💰 $${cost.toFixed(2)}`));
  }

  // 3. 10-block context usage bar
  const pct = data?.context_window?.used_percentage;
  if (typeof pct === 'number') {
    const clamped = Math.max(0, Math.min(100, pct));
    const filled = Math.round(clamped / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    parts.push(section(theme.fg, theme.bar, `${bar} ${Math.round(clamped)}%`));
  }

  // 4. Today's date, e.g. oct/14
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  parts.push(section(theme.fg, theme.date, `🗓️ ${month}/${now.getDate()}`));

  return parts.join(' ');
};

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    // Never print a stack trace into the user's prompt; fall back to plain text.
    try {
      process.stdout.write(render(JSON.parse(input)));
    } catch {
      process.stdout.write('claude');
    }
  });
}

module.exports = { THEMES };
