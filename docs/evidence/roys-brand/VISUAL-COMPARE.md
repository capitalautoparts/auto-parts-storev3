# Roy's Auto brand visual compare

Build: `vite build` of branch `agent/roys-brand-theme` (commit 4fba0f1), served by `vite preview` on VM511,
captured with Playwright Firefox via `scripts/brand-screenshots.mjs`. No API interception. Catalog years loaded
from the existing staging gateway; the tree was not expanded and no parts table or items in the cart were exercised
(not captured: parts table, cart with items, product modal, auth modal).

Screenshots: `desktop-1440.png` (1440x900), `mobile-390.png` (390x844).
Mockups: `/srv/dev/reports/infra/roysauto-2026-11-06/roys-auto-storefront-{desktop,mobile}.png`.

| Element | Result | Notes |
|---|---|---|
| Wordmark | Match | Outlined "roy's auto" in header, desktop and mobile (centred on mobile). Tab title "roy's auto". |
| Colours | Match | Ink header/subbar, paper `#f3efe6` background, burgundy `#6e1f2b` mobile cart FAB, charcoal Quick Cart bar. |
| Header | Match | Nav links, hours, heart/cart, Part Catalog / Part Number Search / Tools, search, VIN Lookup / Need Help? all present and styled alike. Placeholder text differs (staging: "Search by vehicle ... or part number..."). |
| Favicon | Match (by source) | `public/favicon.svg` linked from `index.html`; not visible in screenshots. |
| Tree | Different (layout/data) | Mockup shows an expanded fitment tree (2013 Hyundai Elantra ... Brake Pad) with a highlighted burgundy-tint row and KOREA tag; staging shows the collapsed year list (2003-2027). Expansion not exercised. |
| Breadcrumb / "Selected fitment" | Different (feature) | Mockup has a "SELECTED FITMENT" breadcrumb; staging shows a "Catalog test - Canada / CAD - ERP staging - Checkout disabled" notice strip (intentional, D1492). |
| Table tiers | Not captured | Charcoal "REAR" band and burgundy Add button are recoloured in code (`bg-brand-charcoal`, `bg-brand-accent`); tier pills (Daily Driver / Premium), per-row heart and Details styling are a later layout WP. Needs data-driven capture. |
| Cart | Partly different | Quick Cart header/colours match. Mockup shows a filled cart with shipping/billing address forms; staging shows an empty cart, CAD estimate disclaimer and a disabled burgundy checkout button. Mobile cart FAB is burgundy as in the mockup but smaller (mockup ~56px, ours ~56px at 390 CSS px; mockup image is 2x). |
| Checkout | Different (intentional) | Mockup has address forms and an Add/checkout flow. Checkout is disabled per D1492; CheckoutPage and OrderConfirmationPage hunks were skipped. |
| Mobile header | Match | Hamburger left, wordmark centred, search below. Hamburger icon slightly smaller than the mockup (minor). |

## Brand bugs found
None needing a fix now. Colours, wordmark and favicon wiring match the mockups.

## Layout / feature gaps for later Phase 2 WPs
- Expanded fitment tree with selected-row tint and region tag.
- "Selected fitment" breadcrumb above the parts table.
- Tier pills and per-row wishlist heart in the parts table; Details button styling.
- Filled-cart view and shipping/billing forms (checkout stays disabled under D1492).
- Add-to-cart toast.
