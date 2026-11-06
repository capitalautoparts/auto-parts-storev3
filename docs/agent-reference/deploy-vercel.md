# Deployment: Vercel and hosting (D1492, amended by D1575)

Agents change no Vercel, Cloudflare or DNS settings and have no authorized Vercel account access. This file records what the code expects.

## Vercel today

- Project: `brian-barbers-projects/auto-parts-storev3`, id `prj_MDoqEvUIZHzv65GCFYxLE03xVt2p`. `api/catalog.ts` is the serverless function; static assets come from `vite build`.
  There is no `vercel.json` in the repo. `amplify.yml` is a legacy AWS Amplify build file and is not the deploy path.
- **Preview** (any non-`main` branch/PR): protected previews. Catalog access needs `VERCEL=1` (platform) and `ROYS_CATALOG_PREVIEW_ENABLED=true` (non-secret, exact lowercase) with `VERCEL_ENV=preview`.
- **Main** (Vercel labels it "Production"): the existing public test URL `https://auto-parts-storev3.vercel.app`, staging data, checkout disabled. Catalog access needs `VERCEL=1`,
  `ROYS_CATALOG_PREVIEW_ENABLED=true`, `VERCEL_ENV=production`, `VERCEL_PROJECT_ID=prj_MDoqEvUIZHzv65GCFYxLE03xVt2p` and `VERCEL_GIT_COMMIT_REF=main`. These identity variables come from Vercel; never set or override them.
  Do not broaden the project or branch exception or change deployment protection.
- Failure modes: `VERCEL=1` together with `ROYS_ONPREM=1` is rejected first with JSON 503 `CATALOG_DEPLOYMENT_NOT_ALLOWED`, even if the flag is missing or local-development mode is used. Otherwise flag missing/false -> 503 `CATALOG_FLAG_DISABLED`; wrong platform identity -> 503 `CATALOG_DEPLOYMENT_NOT_ALLOWED`. Setting the flag to false and redeploying disables ERP reads.
- Noindex headers are not access control: a public main alias with the flag on exposes staging catalog data publicly.
- More: `docs/main-catalog-testing.md`, `docs/staging-catalog-gateway.md`.

## D1575 amendment (Brian, 2026-11-06 8:50 AM EST)

Cloudflare Bot Fight Mode blocks Vercel server-side calls to `staging.autrex.ca`. The catalog-connected test site runs on our own staging VM
(proposed `roys-staging.autrex.ca`, infra-owned, deploy pattern like capautov3 staging) and reaches the VM 453 staging gateway over the LAN, so the Roy's -> VM 453 hop never crosses Cloudflare. VM 453's own gateway still
calls ERP at `https://staging.autopartserp.com` through Cloudflare today (server-to-server, outside this repo; a later infra WP may move
it to the LAN). Do not assume the whole request path bypasses Cloudflare.
Vercel is **design previews only**. The on-prem upstream is the fixed `http://192.168.88.233/api/erp` (VM 453 nginx on the LAN, plain HTTP, no Host header, no credentials).
It is selected only when the non-secret deploy-target env `ROYS_ONPREM=1` is set together with `ROYS_CATALOG_PREVIEW_ENABLED=true`, and `VERCEL` is not `1`.
This is the on-prem activation branch alongside the Vercel branch above; the conflicting Vercel/on-prem combination is denied before the flag check.
The on-prem VM is 459 `roysauto-staging`, proposed host `roys-staging.autrex.ca`.
[#9](https://github.com/capitalautoparts/auto-parts-storev3/pull/9) (fixed LAN upstream and `server/onprem.ts`) and
[#11](https://github.com/capitalautoparts/auto-parts-storev3/pull/11) (deploy workflow) have merged.
VM 459 serves `staging` via #11's `.github/workflows/deploy-onprem-staging.yml`; infra owns the runtime deployment.
See [the runtime guide](../onprem-staging.md). Checkout stays disabled; no credentials in the browser.

## Deployment settings inventory (copy into every PR)

```
## Deployment settings inventory
- Vercel settings changed: none | <exact setting, scope (Preview/Production), old -> new>
- Environment variables added/changed/removed: none | <NAME (non-secret?) scope: value shape only, never secrets>
- ROYS_CATALOG_PREVIEW_ENABLED expected: true in <Preview/Production> (unchanged | <change>)
- Vercel project / branch exception (prj_MDoqEvUIZHzv65GCFYxLE03xVt2p + main): unchanged
- Upstream in server/catalog-proxy.ts: unchanged (https://staging.autrex.ca/api/erp) | <new fixed LAN upstream, approved by infra>
- Cloudflare / DNS / deployment protection / domains: none changed
- New credentials, secrets or database URLs: none
- On-prem staging host (D1575): n/a | <VM 459 roysauto-staging, ROYS_ONPREM=1, ROYS_CATALOG_PREVIEW_ENABLED=true, owner infra, status>
- Outstanding activation gate: none | <what must happen, who owns it>
- Checkout / payments / Shopify: disabled, unchanged

## Smoke plan
1. Pre-push: AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push -> <result>
2. Desktop 1440 and mobile 390 Firefox checks on the integrated page -> <what, result>
3. Post-deploy (after approved promotion): one read-only years request, then <flows> -> <pending|result>
```
