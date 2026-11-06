# Agent toolbox: where things live

Locate code with `rg` and this table. Rules are in `AGENTS.md`; detail in `docs/agent-reference/README.md`.

| Need | Look here |
|---|---|
| Rules for all agents | `AGENTS.md` (Claude adds `CLAUDE.md`) |
| Page layout, app state | `src/App.tsx` |
| Tree, search bar, parts table, cart panel, detail dialog | `src/components/*.tsx` |
| UI primitives (Radix wrappers) | `src/components/ui/` |
| Catalog query keys, types, price/cart/storage helpers, `catalogFetch` | `src/features/catalog/model.ts` |
| ERP calls and ERP-to-UI mapping | `src/lib/erp-api.ts`; UI types in `src/lib/api.ts` |
| Data hooks | `src/lib/hooks.ts` (`useQuery`, `useMutation`); `src/hooks/` |
| Wishlist / auth state | `src/contexts/` |
| Tokens, fonts | `src/index.css` (`:root`, `@theme inline`) |
| Proxy, allowlist, activation gate | `server/catalog-proxy.ts`; Vercel entry `api/catalog.ts`; Vite mount `vite.config.ts` |
| Tests | `tests/catalog.test.ts`, `tests/function-entrypoint.test.mjs`, runner `scripts/test.mjs` |
| Browser smoke / reference review | `scripts/browser-smoke.mjs`, `scripts/reference-review.mjs` |
| CI | `.github/workflows/catalog-check.yml` |
| D1492 history and evidence | `docs/staging-catalog-gateway.md`, `docs/main-catalog-testing.md`, `docs/catalog-exploration.md`, `docs/evidence/` |
| Endpoint contracts | `docs/agent-reference/catalog-api.md` |
| Design tokens and mockups | `docs/agent-reference/design-system.md` |
| Commands, deploy, settings inventory | `docs/agent-reference/dev-commands.md`, `deploy-vercel.md` |
| Legacy (do not follow) | `API_SPEC.md`, `SETUP.md`, `amplify.yml` (old AWS backend plan) |

## Use what exists first

Say in one line which rung you are on before adding anything new:

1. An existing UI primitive in `src/components/ui/` (button, badge, table, sheet, dialog, select, skeleton, spinner, empty, breadcrumb, pagination, ...).
2. An existing app component you can extend (`PartsTable`, `TreeSidebar`, `RightCartPanel`, ...).
3. An existing helper: `cn` in `src/lib/utils.ts`, `priceLabel` / `readQuery` / `changeQuery` / `searchParams` / `safeStorage` in `model.ts`, `useQuery` in `hooks.ts`, `availability.ts`.
4. An existing catalog call: extend `erp-api.ts` using a resource the proxy already allows. A new resource or param means editing the allowlist in `server/catalog-proxy.ts` plus a test in `tests/catalog.test.ts`; a missing ERP capability is filed for the ERP lanes, not worked around.
5. An existing script (`scripts/*.mjs`) or `agent-pre-push` / `dev-remote` before writing a new tool.
6. Only then: a new component or file, following the existing naming and Tailwind token classes (`bg-brand-*`, no hard-coded hex).
7. A new dependency is last. Check `package.json` first (Radix, lucide-react, sonner, date-fns, react-hook-form, recharts, wouter, cmdk are already there) and say why none fits.

Never add a mock catalog fallback, a configurable upstream URL, or secrets.
