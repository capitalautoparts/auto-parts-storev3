# Agent Instructions: Roy's Auto storefront

The single always-loaded rules file for every agent in this repo: Codex reads it
directly, Claude Code loads it through `CLAUDE.md`. Keep it to rules every session
needs; detail lives in `docs/agent-reference/` (index: `docs/agent-reference/README.md`).
Where to find things: `docs/AGENT-TOOLBOX.md`. If something here is wrong, fix it.

## Project at a glance

Roy's Auto (repo `capitalautoparts/auto-parts-storev3`, package `capital-auto-parts-frontend`):
a RockAuto-style parts catalog storefront (Year > Make > Model > Engine > Category > parts table,
Quick Cart, wishlist). Vite 7 + React 18 + TypeScript + Tailwind 4 + Radix UI; a small
`server/catalog-proxy.ts` (re-exported by `api/catalog.ts`) is the only backend. Canada/CAD first.
Catalog data is read from ERP staging through a fixed gateway (see "D1492 constraints").
Cart and wishlist are browser-local test lists. Checkout, payments and accounts are disabled.
`API_SPEC.md` and `SETUP.md` describe an old AWS backend plan, not the live code.
Architecture: `docs/agent-reference/architecture.md`. Endpoints: `docs/agent-reference/catalog-api.md`.

## Branches, environments and releases

- `staging` is the agent integration branch. Feature PR -> `staging`. Never push or merge to
  `main` or `production`; never merge a PR yourself (an independent reviewer merges).
- CI (`.github/workflows/catalog-check.yml`) runs `npm test -- --run` and `npm run build` on PRs to
  `staging` and `main`, Node 22.
- On Vercel, a push to `main` deploys the Vercel "Production" environment of project
  `prj_MDoqEvUIZHzv65GCFYxLE03xVt2p`, which is the existing public test site
  (`https://auto-parts-storev3.vercel.app`) reading ERP staging data with checkout disabled. It is
  not a live business site. Other branches get protected Vercel previews. Detail and the settings
  inventory template: `docs/agent-reference/deploy-vercel.md`.

## One task, one branch, one worktree

- Never edit the reference checkout `/srv/dev/auto-parts-storev3`. Work in
  `/srv/dev/wt/roys-<task>` on a branch cut from `origin/staging`
  (`git worktree add /srv/dev/wt/roys-<task> -b <area>/<task> origin/staging`, or `ai --roys`).
- Update a branch by merging, never rebasing: `git fetch origin staging && git merge origin/staging`.
  No force push.
- Commit as often as you like locally. Push once, after
  `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` passes (and once per review-fix batch).
- Open the PR with an explicit base: `gh pr create --base staging --head <branch>`; verify with
  `gh pr view --json baseRefName,state,url,statusCheckRollup`.
- Every PR body has a **Smoke plan** section and the exact **Deployment settings inventory**
  (template in `docs/agent-reference/deploy-vercel.md`), plus desktop/mobile check results and any
  outstanding activation gate.
- After merge or closure, remove the clean worktree (`git worktree remove <path> && git worktree prune`).
  Never delete a dirty, unpushed, unmerged or open-PR worktree.

## Heavy work stays off VM510

VM510 is orchestration only. Do not run `tsc`, `npm test`, `vite build`, Playwright or `npm ci`
there. Run `dev-remote --queue` first, then `agent-pre-push` (typecheck, tests, build as needed on
VM511) or `dev-remote --light|--heavy <command>`. Node 22 is required. Do not repeat a passing check,
poll CI in a loop, or duplicate an active CI run. Exact commands: `docs/agent-reference/dev-commands.md`.

## Execution mode and stops

Carry the task brief forward; decide implementation details conservatively and note them in the PR.
Stop and queue a question (`decision-queue add --scope '...' --question '...' --recommendation '...'`)
only for: production data or any business-data write; money, payments, checkout or Shopify checkout;
anything customer-facing sent (email, SMS); new credentials, domains or deployment-protection changes;
unclear business rules (pricing, tiers, warranty, shipping, tax, returns); merge or release approval.
Keep working on whatever does not depend on the answer. Never put secrets, tokens or database URLs
in the repo, the browser bundle, docs or chat. ERP changes are filed for the ERP lanes; do not change
the ERP from this repo.

## Use what exists first

Before adding a dependency or file, walk the ladder in `docs/AGENT-TOOLBOX.md`: `src/components/ui`,
`src/lib` helpers, `src/features/catalog/model.ts`, existing scripts. Locate code with `rg`.

## Definition of done

1. Work is on a task branch and worktree cut from current `origin/staging`.
2. `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` passed from the worktree.
3. Committed and pushed once; PR exists with base `staging` and a Smoke plan and settings inventory.
4. GitHub CI is green; Codex and reviewer findings are handled as one batch.
5. Visual changes were checked on the integrated page at 1440 px and 390 px widths (Firefox on VM511,
   see `docs/agent-reference/dev-commands.md`), compared with the mockups in
   `docs/agent-reference/design-system.md`.
6. `agent-pr-finish` passed, then `claude-handoff --status ready` (or `complete`). Report the PR URL.
   Times in messages and PRs are Eastern (e.g. `8:50 AM EST`).

## D1492 constraints (verbatim)

Use a task branch/worktree from origin/staging; PRs target staging. Never edit
the reference checkout or merge a PR yourself. D1492: Canada/CAD first, protected
Vercel previews and the existing main test site, ERP staging reads only. Brian's
follow-up authorizes fixing main activation with his existing flag; no new
credentials, production domains,
Shopify checkout, payment processing or business-data mutations.

VM510 is orchestration only. Before validation use `dev-remote --queue`; run
`agent-pre-push` from this worktree (typecheck + tests on VM511). Custom builds
and Firefox visual checks also run on VM511. Node 22 is required. Use the
smallest relevant checks and do not duplicate active CI.

The API is fixed to https://staging.autrex.ca/api/erp and allowlisted in
server/catalog-proxy.ts. This existing public gateway reads ERP staging. Do not
add arbitrary upstreams, automatic alternate routes, or relay credentials to this
repository. Reject gateway development-stub responses. Deployed
ERP access requires VERCEL=1 and the non-secret ROYS_CATALOG_PREVIEW_ENABLED=true.
Preview retains its existing activation behavior. Vercel Production is allowed
only for project prj_MDoqEvUIZHzv65GCFYxLE03xVt2p and Git branch main; this exception
serves the existing public test URL using staging data, with checkout disabled.
Do not broaden the project/branch exception or change deployment protection. Never
put privileged credentials or a database URL in the browser or this repo.

Every PR needs a Smoke plan and exact deployment settings inventory. Record
desktop/mobile checks and any outstanding activation gate. Run agent-pr-finish
and claude-handoff before handing the PR to its independent reviewer.

## D1575 hosting amendment (Brian, 2026-11-06 8:50 AM EST)

Amends D1492. Cloudflare Bot Fight Mode (free plan) blocks Vercel's server-side catalog calls to
`staging.autrex.ca`, and no scoped exception is possible. Therefore:

- The catalog-connected test site moves to our own staging VM 459 `roysauto-staging`, proposed host
  `roys-staging.autrex.ca` (Cloudflare-proxied for visitors). Infra owns it and uses the same deploy
  pattern as capautov3 staging. It reads ERP staging over the LAN, never through Cloudflare.
- Vercel stays for design previews only (no catalog access needed or promised there).
- The on-prem upstream is the fixed `http://192.168.88.233/api/erp` (VM 453 nginx on the LAN, plain
  HTTP, no Host header, no credentials). It is selected only when the non-secret deploy-target env
  `ROYS_ONPREM=1` is set together with `ROYS_CATALOG_PREVIEW_ENABLED=true` and `VERCEL` not `1`.
  The code lands in the on-prem upstream PR (branch `agent/roys-onprem-catalog-upstream`, adds
  `server/onprem.ts` and `docs/onprem-staging.md`); until it merges, the `staging.autrex.ca/api/erp`
  constant is the only upstream. Still fixed upstreams only: no env-configurable URL, no fallback route.
- Checkout stays disabled. No credentials in the browser or this repo. Stub-response rejection,
  GET-only and the parameter allowlist are unchanged.
