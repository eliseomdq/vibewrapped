# vibewrapped

**Spotify Wrapped for your AI coding agent.** One command turns your local Claude Code history into a card you'll actually want to post.

```bash
npx vibewrapped
```

![Vibe Coding Wrapped card](https://raw.githubusercontent.com/eliseomdq/vibewrapped/main/docs/card.png)

*Sample card. Yours is built from your own sessions.*

## What's on your card

- **Tokens** you pushed through Claude Code (cache included, deduplicated per message)
- **Your coding persona**: The 3AM Shipper, The Orchestrator, The Backseat Driver, The Terminal Goblin…
- Sessions, hours with your agent, longest day streak, prompts, tool calls, peak hour
- **Claude's catchphrase**: the verbal tic it repeated most to you ("Let me…", "Perfect!", "Good catch"…), and if it still says it, the legendary **"You're absolutely right!"** count

## ⚠️ Claude Code is deleting your history

By default Claude Code deletes session transcripts older than **30 days** ([`cleanupPeriodDays`](https://code.claude.com/docs/en/settings-reference#cleanupperioddays)). If you want your December wrapped to cover more than November, run this today:

```bash
npx vibewrapped --keep
```

It sets `cleanupPeriodDays` to 3650 in your `~/.claude/settings.json` and leaves every other setting alone.

## Options

```
--year <yyyy>    Only count one calendar year (default: all history)
--dir <path>     Claude config dir (default: $CLAUDE_CONFIG_DIR or ~/.claude); repeatable
--out <file>     Where to save the card (default: ./vibewrapped.png)
--json           Print the raw stats as JSON
--share          Copy the card to your clipboard and open a pre-filled post on X
--keep           Stop Claude Code from deleting history after 30 days
--no-open        Do not open the card when done
```

## As a Claude Code plugin

```
/plugin marketplace add eliseomdq/vibewrapped
/plugin install vibewrapped@vibewrapped
```

Then ask Claude for your wrapped, or run `/vibewrapped:wrapped`.

## Privacy

Everything runs on your machine. vibewrapped reads the JSONL transcripts in `~/.claude/projects`, renders the PNG locally with bundled fonts and makes no network requests. The card only shows aggregate numbers: no project names, paths, branches or prompts.

## How the numbers are counted

- Claude Code writes one line per content block, so usage is counted once per message id and tool calls once per tool_use id.
- Prompts are your own messages: tool results, system notifications and interrupts are excluded.
- Active time adds up the gaps between events in a session, ignoring gaps over 30 minutes.
- Subagent runs count toward tokens and tool calls, not toward sessions or prompts.
- Days and hours use your machine's time zone.

Codex, Cursor and Gemini CLI support is next. PRs welcome.

## License

MIT. Card fonts: [Geist](https://github.com/vercel/geist-font), SIL Open Font License.
