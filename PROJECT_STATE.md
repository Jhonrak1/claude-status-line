# Project State

_Last updated: 2026-10-16_

## Overview
`claude-status-line` is a zero-dependency Node.js (18+) tool that installs a colorful status line for Claude Code: model and context size, session cost, a 10-block context bar and today's date.

## Structure
- `bin/cli.js` (189 lines): installer CLI with `install`, `uninstall` and `doctor`, plus `--dry-run`, `--force`, `--print` and `--project`.
- `src/statusline.js` (59 lines): the script Claude Code runs; reads session JSON on stdin and prints one colored line.
- `README.md`, `LICENSE` (MIT), `package.json` (v1.0.0).

## Status
- v1.0.0 released; install, uninstall and doctor are implemented and documented.
- No tests, no CI, no dependencies.
- Working tree clean; `main` is in sync with `origin/main`.

## Git
- Remote: `git@github.com:Jhonrak1/claude-status-line.git`
- Branches: `main` (includes the v1.0.0 release commit) and `develop` (same files, but history branches off before the release commit and never merged it).
- History was rewritten on 2026-10-16 to remove an unwanted `Co-Authored-By` trailer from the last commit on both branches (force-pushed).

## Planned
- Color themes: `install --theme <name>` with predefined palettes.
