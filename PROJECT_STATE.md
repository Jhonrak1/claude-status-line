# Project State

_Last updated: 2026-10-24_

## Overview
`claude-status-line` is a zero-dependency Node.js (18+) tool that installs a colorful status line for Claude Code: model and context size, session cost, a 10-block context bar and today's date.

## Structure
- `bin/cli.js` (199 lines): installer CLI with `install`, `uninstall` and `doctor`, plus `--dry-run`, `--force`, `--print`, `--project` and `--theme <name>`.
- `src/statusline.js` (75 lines): the script Claude Code runs; reads session JSON on stdin and prints one colored line. Defines the `THEMES` palettes (`default`, `ocean`, `forest`, `mono`, `light`), exported for the CLI, and takes `--theme <name>`.
- `test/statusline.test.js` (11 tests + 6 theme tests): runs `src/statusline.js` as a subprocess with JSON on stdin; uses the built-in `node:test`. Run with `npm test`.
- `test/cli.test.js` (25 tests): runs `bin/cli.js` in a temp `HOME`/`CLAUDE_CONFIG_DIR`/cwd so the real `~/.claude` is never touched; covers install, uninstall, doctor, `--dry-run`, `--force`, `--print`, `--project`, `--theme` and error cases.
- `README.md`, `LICENSE` (MIT), `package.json` (v1.0.0).

## Status
- v1.0.0 released; install, uninstall and doctor are implemented and documented.
- Color themes (`install --theme <name>`) are implemented and in the README, on `develop` and `main`, and covered by tests (palette applied, unknown theme falls back; installer rejects unknown names and writes the flag).
- Status line script has a simple test layer (model, context size, cost, context bar, date, invalid-JSON fallback, `NO_COLOR`); `bin/cli.js` is covered on `feature/installation-tests` (not yet merged). Known gap: the "`node` not on PATH" branch.
- No CI, no dependencies.

## Git
- Remote: `git@github.com:Jhonrak1/claude-status-line.git`
- Branches: `main` (includes the v1.0.0 release commit), `develop` (has the release, the tests and the color themes) and `feature/statusline-tests` (tests, branched from `main` before the themes).
