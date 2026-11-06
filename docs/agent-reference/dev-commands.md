# Dev commands

Node 22 is required (CI uses 22).

> Host-specific: the VM510/VM511 split and the `agent-pre-push`, `dev-check` and `dev-remote` wrappers
> exist on Autrex's VM510 agent host only. Elsewhere (a laptop, Codex cloud) run the npm scripts
> below directly with Node 22; GitHub CI remains the merge gate.

VM510 is orchestration only: do not run any of the heavy commands below directly there.
Run them on VM511 through the wrappers. Always check the queue first: `dev-remote --queue`.

## Wrappers (VM511; host-specific)

| Command | Use |
|---|---|
| `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` | Required before every push, from the task worktree. Diff-aware: cheap static checks on VM510, then typecheck and related tests once on VM511. GitHub CI is the merge gate |
| `dev-check [--full] [--base <git-ref>]` | The fast pre-push validation `agent-pre-push` builds on; `--full` typechecks every package (no full test suite) |
| `dev-remote --light <cmd>` | Cheap jobs (tsc, eslint) in the light lane (200% cpu, 4G) |
| `dev-remote --heavy <cmd>` | Builds and tests in a general lane |
| `dev-remote --service <cmd>` | Dev/preview servers and browsers (never holds a batch lock) |
| `dev-remote --validate [typecheck-cmd] [build-cmd]` | Sync once, typecheck in light, build in a general lane (defaults `npx tsc --noEmit` and `npm run build`) |
| `dev-remote --status` / `--queue` | Runner health / what each lane is doing |

Do not start a second heavy job because the first is slow; check `--queue` and wait or use an independent lane. A job idle 15 min or running 120 min is killed (exit 124).

## npm scripts (`package.json`)

| Script | What it runs | Where |
|---|---|---|
| `npm ci --no-audit --no-fund` | Install (as in CI) | `dev-remote --heavy npm ci --no-audit --no-fund` |
| `npm run dev` | `vite` on port 3000 with `/api/catalog` mounted (local dev skips the activation gate) | `dev-remote --service npm run dev` |
| `npm run typecheck` | `tsc --noEmit` | `dev-remote --light npm run typecheck` |
| `npm test -- --run` | `node scripts/test.mjs`: node:test over `tests/catalog.test.ts` and `tests/function-entrypoint.test.mjs` (only `--run` is accepted) | `dev-remote --heavy npm test -- --run` |
| `npm run build` | `npm run typecheck && vite build` (output `dist/`) | `dev-remote --heavy npm run build` |
| `npm run preview` | `vite preview` of `dist/` (also serves `/api/catalog`) | `dev-remote --service npm run preview` |
| `npm run lint` | `eslint . --ext ts,tsx ...` | Script exists but `eslint` is not in `package.json` devDependencies and CI does not run it; treat as unverified |
| `npm run test:browser` | `node scripts/browser-smoke.mjs`: Playwright **Firefox** against built assets served by `vite preview`, real ERP data, no interception | After `npm run build`, on VM511 only |

CI (`.github/workflows/catalog-check.yml`): `npm ci`, `npm test -- --run`, `npm run build` on Node 22.

## Firefox visual checks (1440 and 390)

1. Build on VM511, then run `npm run test:browser` there (set `ROYS_SMOKE_OUTPUT=<dir>` for screenshots; default `/tmp/roysauto-browser-smoke`).
   `ROYS_SMOKE_FUNCTION_ENTRYPOINT` can point at the packaged `api/catalog.js` instead of the Vite source adapter; it still needs the normal activation variables.
2. For ad-hoc screenshots use Playwright **Firefox** (`@playwright/test` 1.61.1 is a devDependency) with viewports 1440x900 and 390x844 against `vite preview`. Chromium does not
   launch on these hosts. Assert on rendered content (a heading, tree rows), never on exit code alone: a blank page also exits 0.
3. Do not stub `/api/**` for visual proof; it screenshots a mock. Compare with the mockups listed in `design-system.md`.
4. `scripts/reference-review.mjs` is a read-only comparison of the Vercel site and rockauto.com (VM511 only); public pages, normal viewing only.

## Git and PR

```
git fetch origin staging && git merge origin/staging      # never rebase
AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push
git push -u origin <branch>                                # once
gh pr create --base staging --head <branch>
gh pr view --json baseRefName,state,url,statusCheckRollup
agent-pr-finish && claude-handoff --status ready --note "<outcome>"
```

Check CI once after the push, then wait at least five minutes for one follow-up; no shell loops around `gh`. Do not rerun a failed job unless it is proven transient.
