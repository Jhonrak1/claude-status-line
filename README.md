# claude-status-line

A colorful status line for [Claude Code](https://claude.com/claude-code), one background color per section:

```
 ● Opus 4.6 (1M context)   💰 $1.23   ████░░░░░░ 37%   🗓️ oct/14
```

Model and context size · session cost (hidden when zero) · 10-block context bar · today's date.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- [Node.js](https://nodejs.org) 18+ (with `npx`) and `git`

## Install

```sh
npx github:Jhonrak1/claude-status-line install
```

Restart Claude Code. If you already have a status line, the installer shows it and stops; add `--force` to replace it (it is backed up). Prefer to edit settings yourself? Use `--print`.

## Uninstall

```sh
npx github:Jhonrak1/claude-status-line uninstall
```

Removes the status line and restores your previous `statusLine`, if any.

## Options

| Command | |
| --- | --- |
| `install` | Install the script and set `statusLine` |
| `uninstall` | Remove it and restore the previous `statusLine` |
| `doctor` | Show the current state and anything that overrides it |

| Option | |
| --- | --- |
| `--dry-run` | Show what would change, write nothing |
| `--force` | Replace an existing `statusLine` (backed up first) |
| `--print` | Install only the script and print the snippet to paste; settings are not touched |
| `--project` | Use `./.claude/settings.json` (usually committed, so prefer `--print` into `.claude/settings.local.json`) |

## How it works

Claude Code runs the command in your `statusLine` setting and sends it session info (model, context, cost) as JSON on stdin. The script prints one colored line, which Claude Code displays. The installer just copies the script and adds that one setting.

```
Claude Code ──(JSON on stdin)──▶ node statusline.js ──(colored line)──▶ terminal
```

## What the installer changes

- Copies one file to `~/.claude/claude-status-line/statusline.js` (or under `$CLAUDE_CONFIG_DIR`); your other files are never touched.
- Sets only the `statusLine` key in `settings.json`. Other keys are kept, symlinks and file permissions are preserved, and the file is re-saved as 2-space JSON.
- Saves a timestamped `settings.json.<time>.bak` before replacing an existing `statusLine`.
- Writes atomically and refuses to touch invalid JSON (e.g. files with comments); use `--print` for those.

## Safety

The script makes no network requests, reads and writes no files, and starts no processes. There are no dependencies or install scripts, and both source files are short enough to read in minutes. `npx github:...` runs the default branch; pin a release with `#v1.0.0`.

## Troubleshooting

Run `npx github:Jhonrak1/claude-status-line doctor`.

- **No change after install:** restart Claude Code. A `statusLine` in project or local settings, or managed policy, overrides user settings; `doctor` lists those it finds.
- **`node` not found:** happens when Claude Code is launched from an IDE/GUI without your shell PATH. The installer falls back to Node's absolute path.
- **Garbled colors or wide emoji:** set `NO_COLOR=1` for plain text.

## Customize

Edit `~/.claude/claude-status-line/statusline.js` (colors are 256-color codes in the `section(fg, bg, text)` calls). Re-running `install` overwrites edits.

## Manual install

```sh
git clone https://github.com/Jhonrak1/claude-status-line.git
cd claude-status-line
node bin/cli.js install
```

## License

MIT
