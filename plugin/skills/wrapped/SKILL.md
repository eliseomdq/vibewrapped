---
name: wrapped
description: Generate the user's Vibe Coding Wrapped card from their local Claude Code history. Use when the user asks for their wrapped, their Claude Code stats, how much they used Claude Code, or a shareable summary of their year with their agent.
---

Run this command and show the user its terminal output:

```bash
npx -y vibewrapped
```

It reads the session transcripts under `~/.claude/projects` (or `$CLAUDE_CONFIG_DIR`) locally, saves `vibewrapped.png` in the current directory and opens it. Nothing is uploaded.

Useful flags, pass them only when the user asks for them:

- `--year 2026` limits the card to one calendar year.
- `--share` opens a pre-filled post on X; the user attaches the image.
- `--keep` raises `cleanupPeriodDays` to 3650 in `settings.json`, so Claude Code stops deleting sessions after 30 days. It changes the user's settings, so run it only when they agree.

After it finishes, tell the user where the card was saved. If the output says history only covers the last month, explain that Claude Code deletes transcripts after 30 days by default and offer `--keep`.
