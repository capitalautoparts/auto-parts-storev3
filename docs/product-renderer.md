# Product document foundation (WP-ROYS-RP6-aa064791)

RP6 adds a small direct-entry product document, using the existing catalog reader
and RP5 ProductFacts. It renders supplied descriptions, ordered public specs,
application conditions and current CAD/pack/core/availability state. Gallery,
cross-reference and paginated fitment presentation remain RP7. Catalog documents
and `/catalog/` dispatch remain RP8. This does not establish public SEO readiness.

## One verified model and one public tree

`server/product-document.ts` projects the mapped product into a strict versioned
public model. Both Node and browser render `ProductDocument.tsx` with this exact
data. The JSON script escapes HTML delimiters and Unicode line separators; the
serialized seed is limited to 2 MB including escaping. The browser validates
nested fields, permitted URLs, numeric values and the requested pathname/SKU
before hydration. It never fetches the initial product again. The model carries
only consumed public fields, not raw upstream payloads or browser list state.

Invalid, duplicate, missing or mismatched seeds retain the readable server tree
and show recovery text. Script failures also leave the server tree and native
catalog link available. Validation detects malformed/tampered shapes and identity
mismatch; it is not an authenticity guarantee against arbitrary same-origin
script execution. React text rendering, JSON escaping and URL validation are the
injection boundaries.

Direct server documents hydrate independently of the catalog App. The first
browser render matches the server; only afterward does a separate control island
load existing `cartApi` and `WishlistProvider`. List storage is never read during
SSR. Add retains current price/purchasable disabling and writes the existing
browser test cart; checkout remains disabled. The catalog's existing product
overlay and navigation stay intact. An explicit Additional product details button
loads the existing detail modal and its bounded fitment data on demand, preserving
access to existing specifications/cross-references/applications without an initial
product re-fetch. Optional detail/fitment failures leave the verified document
and metadata intact; local close/Escape restores the details trigger. Native Browse performs a document navigation;
if a popstate changes the direct document's pathname, the current entry reloads
to prevent stale product content. Query/fragment changes retain product identity.

Vercel design-only static product paths have no server tree/seed and keep the
existing browser App route. Vite dev explicitly uses `ssrLoadModule`; preview and
on-prem use the built artifact. No activation bypass was added to on-prem.

## Packaged runtime

`npm run build` builds the static app, then a dedicated Vite SSR bundle at
`dist/server/product-renderer.js`. `ssr.noExternal: true` includes React and
ReactDOM server dependencies. The Node adapter dynamically resolves this artifact
relative to its own release directory. It never imports React from an unbundled
runtime source file or assumes the current working directory contains a checkout.

The final build step runs `scripts/check-product-release.mjs` on Node 22. It copies
only `server/`, `dist/` and `package.json` to an isolated temporary release, imports
the shipped handler with its default renderer, and checks useful escaped HTML,
strict bootstrap, one identity schema/canonical, referenced assets, refusal,
identity mismatch, 400/404/429/502/503 and GET-only semantics without `src/` or
`node_modules/`. Source HTTP tests inject a fixture renderer because CI runs tests
before build; that fixture is never the artifact proof.

GET-only is preserved: HEAD and other methods remain 405 with `Allow: GET`; no
HEAD parity is claimed. Missing identity is 404, malformed path 400, rate limit
429, malformed/refused/upstream outage 502 and inactive deployment 503. Template
or renderer failure returns a plain recoverable 503. Every response retains
no-store, noindex and nosniff. Price remains visible data only: identity JSON-LD
contains no Offer or price. Existing fixed upstream/time/body limits are unchanged.

No nginx, environment, settings, secret, indexing or installed infrastructure
change is required for existing `/products/` routing. No deploy is performed here.
