# RoysAuto catalog workspace

Use a task branch/worktree from origin/staging; PRs target staging. Never edit
the reference checkout or merge a PR yourself. D1492: Canada/CAD first, protected
Vercel preview, ERP staging reads only. No new credentials, production domains,
Shopify checkout, payment processing or business-data mutations.

VM510 is orchestration only. Before validation use `dev-remote --queue`; run
`agent-pre-push` from this worktree (typecheck + tests on VM511). Custom builds
and Firefox visual checks also run on VM511. Node 22 is required. Use the
smallest relevant checks and do not duplicate active CI.

The API is fixed to staging and allowlisted in server/catalog-proxy.ts. Deployed
ERP access fails closed unless VERCEL_ENV=preview and the non-secret
ROYS_CATALOG_PREVIEW_ENABLED=true is set after protection verification. Never
put privileged credentials or a database URL in the browser or this repo.

Every PR needs a Smoke plan and exact deployment settings inventory. Record
desktop/mobile checks and any outstanding activation gate. Run agent-pr-finish
and claude-handoff before handing the PR to its independent reviewer.
