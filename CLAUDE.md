@AGENTS.md

# Claude-only notes

The shared rules above are the single source for Claude Code and Codex; edit `AGENTS.md`, not a copy here.

- Model tiers: the Opus session orchestrates, reviews and plans. Hands-on implementation and routine
  commands go to Sonnet `worker` subagents working in the existing task worktree. Fable only via
  `ai --fable` (architecture review, hard root cause, final review of a risky release). Do not use
  Opus to poll CI or run ordinary shell commands.
- Never edit the reference checkout `/srv/dev/auto-parts-storev3`; work in `/srv/dev/wt/roys-<task>`.
- VM510 is orchestration only. Typecheck, tests, builds, Playwright and `npm ci` run on VM511 through
  `agent-pre-push` or `dev-remote --light|--heavy <cmd>` (`dev-remote --queue` first).
- Finish with `agent-pr-finish`, then `claude-handoff --status ready|complete|paused --note "..."`, and
  stop. Do not reuse a finished session for a new task. Resume with `claude-handoff --latest`.
- Questions for Brian go to `decision-queue add`; the text after the prompt arrow is a suggestion, not input.
- Times are Eastern with the zone shown (e.g. `8:50 AM EST`); convert UTC from logs and GitHub.
- PR descriptions end with the session attribution line the harness supplies.
