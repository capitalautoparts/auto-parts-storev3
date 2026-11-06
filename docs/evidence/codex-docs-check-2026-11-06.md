# Codex docs-readiness check — 2026-11-06

Phase 0 step 5; documentation-only review on the isolated branch
`agent/roys-codex-docs-readiness-check-roy-5519`, based on `origin/staging` at
`ae22327ec23236d3bed52871790acc08b344c545`. Review timestamp: 11:19 AM EST.

## Scope and method

Orientation used only repository `AGENTS.md`, `docs/AGENT-TOOLBOX.md`,
`docs/agent-reference/{README,architecture,catalog-api,dev-commands,deploy-vercel}.md`,
and `docs/onprem-staging.md`, plus the mandatory host rules in `~/.codex/AGENTS.md`.
I did not consult the legacy setup/API docs, historical evidence, external documentation, other
agents or people. The two code files explicitly requested for verification were
`server/catalog-proxy.ts` and `server/onprem-server.ts`; no other runtime source was read.

The existing runtime guide was the right place for troubleshooting. The only new file is this
requested evidence record. No runtime, tests, settings, credentials or deployment state were changed.
This is source verification, not evidence that VM 459 or the live catalog was reachable.

## What the docs told me correctly

- `AGENTS.md` and the toolbox supplied the repository identity, task-worktree/staging PR workflow,
  read-only catalog scope, proxy location and required PR inventory. The checked-out branch was clean
  and exactly matched the fetched `origin/staging` before edits.
- The architecture and catalog API references gave the proxy's resources, required/allowed parameters,
  numeric bounds, search requirements, GET-only behavior and fixed gateway path construction. These
  match `upstreamUrl` and `createCatalogHandler` in `server/catalog-proxy.ts`.
- The architecture reference correctly described the 15-second fetch timeout, redirect rejection,
  stub rejection, 429 preservation, other upstream errors becoming 502, optional 403 `cf-ray`
  reference, JSON/size checks and the two activation error codes.
- The D1575 amendment and runtime guide identified the fixed LAN gateway and Vercel/on-prem
  exclusion. `catalogGateway` and `catalogEnabled` confirm the two fixed targets and the exact
  `ROYS_ONPREM=1`, `VERCEL` and activation-flag checks.
- The runtime guide correctly listed the health endpoint, separate static serving, loopback-only
  bind addresses and port range/default; these agree with `server/onprem-server.ts`.
- The development reference supplied the queue/pre-push commands and the deployment reference
  supplied the exact Smoke plan and Deployment settings inventory template. No new tool was needed.

## Missing, wrong or ambiguous information

- **Stale implementation status:** `architecture.md` ends with “Not in this branch's code yet.”;
  `deploy-vercel.md` still says staging has only the Vercel gateway until the on-prem PR merges.
  `catalog-api.md` and the root D1575 amendment also describe the code as landing later. At the
  checked commit, both fixed gateways and the on-prem gate are already implemented. The runtime
  guide is the more current description. I recorded this drift rather than expanding the requested
  two-file change into a general reference rewrite.
- **Activation wording:** the architecture's main gate description and the root D1492 text say
  deployed access requires `VERCEL=1`. The D1575 amendment qualifies that, but readers must reconcile
  the passages. Actual on-prem access requires `VERCEL` not `1`. The new section states the branches
  and conflict precedence together.
- **No diagnostic mapping:** the old runtime guide had only successful smoke commands; no response
  messages, first checks, error ordering or explanation of the multiple 502 causes. Architecture
  summarized several causes but did not provide a complete troubleshooting table.
- **Health is not catalog readiness:** the smoke section paired health and years responses without
  saying health does not check activation or fetch the catalog. That distinction required code.
- **Routing/method ambiguity:** “Everything else returns 404; non-GET returns 405” in the runtime
  architecture could imply 405 for every non-GET path. The router actually returns 404 for every
  unknown path regardless of method; `/api/catalog/` does not reach the proxy. The new section
  distinguishes the catalog and health 405 messages and the router's 404.
- **Precision gaps:** docs did not distinguish decoded values from encoded query text, the U+0000–U+001F
  control-character range, supplied short `q` with another search context, search `category` versus
  category-resource `slug`, or the listener's one-to-five-digit port syntax. Code supplied those details.
- **Operational limits:** the allowed docs describe the intended topology and a proposed host, not
  verified current deployment settings or reachability. I did not infer activation from them or run
  their `curl`, startup, build or browser examples. Desktop/mobile checks are not applicable to this
  docs-only diff. The PR inventory records settings as unchanged, not independently audited.

## Where reading code was necessary

| Source / functions | What the docs did not establish precisely |
| --- | --- |
| `server/catalog-proxy.ts`: `catalogGateway`, `catalogEnabled`, `createCatalogHandler` | On-prem code is present; method/conflict/flag/validation order; conflict wins over missing flag and local-development bypass; exact 503 bodies. |
| `server/catalog-proxy.ts`: `upstreamUrl` | Every literal 400 message, required-field cases, parser exceptions being returned as 400, first-failure behavior, numeric syntax and the search/slug edge cases listed above. |
| `server/catalog-proxy.ts`: upstream response handling | Stub detection precedes status handling; 403 is the only optional-reference case; no forwarded `Retry-After`; missing body, stream/JSON failures, redirect rejection and timeout share the reachability-message 502. The code does not expose a distinct client error code for each such cause. |
| `server/onprem-server.ts`: `createOnPremServer` | Exact-path dispatch, unconditional health success for GET, two different 405 bodies, unknown-path 404 regardless of method. |
| `server/onprem-server.ts`: `resolveListenOptions` | Exact loopback and port validation, default values and thrown listener-configuration errors rather than catalog responses. |

## Commands and results

This ledger covers discovery and verification through pre-push; subsequent commit/push/PR/review
and handoff results belong in the PR and handoff record. Commands below were run from the task
worktree unless an absolute path is shown. No live endpoint smoke requests or heavy local checks were run.

| Command(s) | Result / decision |
| --- | --- |
| `pwd`; `git status --short --branch` | Worked: isolated task worktree/branch, clean initial tree tracking `origin/staging`. |
| `rg --files -g AGENTS.md -g CLAUDE.md -g 'docs/agent-reference/**' -g 'docs/AGENT-TOOLBOX.md' -g 'docs/onprem-staging.md'` | Worked: located the permitted docs. Listing `CLAUDE.md` did not read it. |
| `cat /home/brian/.codex/AGENTS.md`; `cat AGENTS.md`; `cat` of the toolbox, five agent-reference files and runtime guide named above | Worked: read the host rules and allowed orientation documents. |
| `git fetch origin staging`; `git log -1 --format='%h %s' HEAD`; `git rev-parse HEAD origin/staging` | Worked: HEAD and current remote staging both `ae22327ec23236d3bed52871790acc08b344c545`; no merge needed. |
| `rg --files docs server -g AGENTS.md` | Exit 1/no matches: no additional instructions found below those directories. The batched shell consequently exited 1; the preceding fetch/log/ref checks succeeded. |
| `nl -ba server/catalog-proxy.ts`; `nl -ba server/onprem-server.ts` | Worked: read both files in full and traced every troubleshooting row to the relevant branch. |
| `TZ=America/Toronto date '+%Y-%m-%d %H:%M %Z'` | Worked: review timestamp in Eastern time. |
| `command -v dev-remote agent-pre-push agent-pr-finish claude-handoff herdr gh` | Worked: all required wrappers/CLI tools were available. |
| `git ls-files docs/evidence` | Worked: confirmed the existing evidence location without reading prior evidence. |
| `git add docs/onprem-staging.md docs/evidence/codex-docs-check-2026-11-06.md`; `git diff --cached --check`; `git diff --cached --stat`; `git diff --cached -- docs/onprem-staging.md docs/evidence/codex-docs-check-2026-11-06.md` | Worked: staged and reviewed the two-file documentation diff; whitespace check passed. |
| `dev-remote --queue` | Worked: all four general lanes were busy, light/service lanes idle, no jobs yet queued. Used the required wrapper and let it queue; no second validation job launched. |
| `agent-pr-finish --help` | Exit 2: did not show help; reported “Worktree is dirty; commit or explicitly resolve changes before handoff.” Deferred the actual finish check until after committing/pushing. |
| `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` | Exit 0: synced to VM511, queued 2m25s for a general lane, then passed `npm run typecheck` and `npm test -- --run` (27 tests passed, 0 failed). Wrapper reported `DEV_CHECK pass checks=typecheck,test`, 159s elapsed. No standalone build or browser run. |

After the wrapper passed, only this evidence record was finalized; no runtime changed and the passing
remote checks were not repeated. The final staged whitespace check is required before commit.
