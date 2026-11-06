# Agent reference

`AGENTS.md` at the repo root is the single always-loaded rules file (Claude via `CLAUDE.md`, Codex directly).
These files hold the detail. Read the one for the area you are working in. Every statement here is
grounded in repo files; "pending" marks facts nobody has supplied yet.

| File | What it holds |
|---|---|
| [architecture.md](architecture.md) | Map of `src/`, state/cart/wishlist/auth, `server/` + `api/`, the catalog proxy contract (resources, params, validation, activation gate, error codes) |
| [catalog-api.md](catalog-api.md) | Every ERP gateway endpoint used, request params, response shapes as the client consumes them, the fitment tree call sequence |
| [design-system.md](design-system.md) | Roy's Auto tokens (from the theme patch), typography, wordmark, components, the two mockups described |
| [dev-commands.md](dev-commands.md) | Exact commands, all heavy ones on VM511; Firefox visual checks |
| [deploy-vercel.md](deploy-vercel.md) | Vercel preview vs main, activation variables, D1575 hosting note, the settings inventory template |

Other docs: `../AGENT-TOOLBOX.md` (where things live, use-what-exists-first ladder);
`../staging-catalog-gateway.md`, `../main-catalog-testing.md`, `../catalog-exploration.md` (D1492 history and evidence);
`../../API_SPEC.md` and `../../SETUP.md` are legacy (old AWS backend plan, `VITE_API_URL`), not the live design.
