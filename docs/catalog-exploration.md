# D1492 / WP-ROYS-1 — connect ERP to the original catalog

Brian corrected the scope after the first preview: keep the existing design and
single-page navigation from auto-parts-storev3.vercel.app. The replacement layout
was removed. Header, TreeSidebar, PartsTable, ProductDetailModal and RightCartPanel
are the active existing components again; src/index.css matches origin/main.

## Ownership and scope

- [x] Catalog exploration session owns feat/roysauto-d1492-catalog in its isolated worktree.
- [x] Restore original layout and styling; replace runtime mock catalog with ERP staging reads.
- [x] Test the original hosted site and RockAuto in real Firefox on VM511.
- [x] Adapt full vehicle context, stable ERP IDs, application notes, cart persistence and errors.
- [x] Final desktop/mobile visual verification and agent-pre-push passed; new-head orchestrator review follows.
- [ ] Brian requested promotion to main; release inventory and hosting gate remain required.

## Reference navigation checked

On 2026-11-04 (Eastern), Firefox navigated the existing site through 2010 → Hyundai
→ Elantra → 2.0L L4 → Brake & Wheel Hub → Brake Pad. Its URL stayed on one page;
parts appeared within the expanded tree and Quick Cart remained alongside it.

Firefox also navigated RockAuto through Toyota → 2020 → Camry → 2.5L L4 → Brake &
Wheel Hub → Brake Pad and waited for product listings. It verified the expanding
catalog, dense listing rows, application qualifiers and right-side Quick Cart.
No checkout, account creation or order submission was performed.
Reference: https://www.rockauto.com/en/catalog/toyota,2020,camry,2.5l+l4,3445372,brake+&+wheel+hub,brake+pad,1684
Local reference evidence: /srv/dev/reports/roysauto-d1492-correction/reference/.

## Integration details

The existing UI contract is adapted in src/lib/erp-api.ts. No direct database
access, staff tokens or Shopify checkout is involved. Vehicle/model queries use
the exact year and make; engine queries use year/make/model. Tree expansion keys
include the whole vehicle path so shared reference IDs do not cross-select cars.
Categories fetch mapped children on expansion. Search is bounded and paginated;
old responses cannot overwrite the newest selection.

Prices can be unavailable, quality tiers can be unspecified, and application
conditions remain visible. A year/model match alone is not an unconditional fit.
The test cart stores stable ERP IDs and quantities with public display snapshots.
It does not reserve inventory or establish payable totals. Accounts, card/address
capture, shipping/tax estimates and simulated order confirmation are inactive.

## Existing Vercel project and exact pending settings

Project: brian-barbers-projects/auto-parts-storev3.
Original public test alias: https://auto-parts-storev3.vercel.app.
Task preview: https://auto-parts-storev3-git-feat-roysa-b611e6-brian-barbers-projects.vercel.app.
GitHub's bot confirms project prj_MDoqEvUIZHzv65GCFYxLE03xVt2p.
Anonymous root and API probes returned 302 to Vercel SSO on the initial preview.

Agents have no authorized Vercel access. Brian was asked once on D1492:
1. Project → Settings → Deployment Protection: confirm Vercel Authentication
   covers Preview and attach a screenshot.
2. Settings → Environment Variables: ROYS_CATALOG_PREVIEW_ENABLED=true, Preview,
   branch feat/roysauto-d1492-catalog only, then redeploy that preview.

No dashboard settings, credentials, domains or Production variables changed.
The API still refuses Vercel Production even if the flag is present. Brian's new
request to merge main does not itself configure that environment. Protected
hosted acceptance and any wider environment configuration must be recorded before
claiming main is a working ERP-connected test catalog.

## Current validation

TypeScript, production build and eight contract tests passed on VM511. The final
integrated Firefox check passed five scenarios with 19 real ERP API requests and
zero browser exceptions: original tree/inline listings, application dialog and
persisted Quick Cart, exact part search and stock filter, two model years sharing
reference IDs without cross-selection, and mobile tree/table/cart. It also
asserts cleared stale search text, disabled checkout/no card fields, compact
mobile rows, no document overflow and an opaque cart sheet.

The original header and Quick Cart stay in view while the catalog scrolls. The
original CSS file is unchanged; targeted sizing/background corrections make the
existing components usable with the full catalog and mobile dialog overlays.
Screenshots reviewed at 1440×1000 and 390×844:

- [Original design with ERP parts](evidence/d1492/desktop.png)
- [Mobile catalog](evidence/d1492/mobile.png)
- [Mobile parts table](evidence/d1492/mobile-parts.png)
- [Mobile Quick Cart](evidence/d1492/mobile-cart.png)

Local evidence: /srv/dev/reports/roysauto-d1492-correction/verified/.
Source fitment spot-check: BRX2076 returned by the selected 2.5L Camry query has
both 2.5L and 3.5L applications in ERP. All conditions are retained in Details;
showing a result does not convert every application into an unconditional fit.

## Future work

Helcim sandbox checkout, shipping/tax, independent sales eligibility, SSR product
SEO, canonical .ca/.com rules, measured load/latency and catalog coverage remain
separate work packages. Multi-company ERP is outside scope. The existing Tools,
VIN, order-status and promotions placeholders are not connected by this change.
