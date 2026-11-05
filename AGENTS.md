# RoysAuto catalog workspace

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
