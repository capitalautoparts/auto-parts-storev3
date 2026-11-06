# Design system: Roy's Auto

Status: the brand theme exists as `roys-auto-theme.patch` (12 files; outlined wordmark, tokens, favicon) in
`/srv/dev/reports/infra/roysauto-2026-11-06/`. **It is being ported in a separate PR (Phase 1)**; until that merges, `src/index.css`
still holds the old red Capital Auto Parts values. Check `src/index.css` before relying on the values below. The patch also touches
`src/pages/CheckoutPage.tsx` and `OrderConfirmationPage.tsx`, which no longer exist on staging; drop those hunks when porting.

## Tokens (from the patch, `src/index.css` `:root`)

| Token | Value | Use |
|---|---|---|
| `--brand-navy` / `--brand-ink` | `#1f2326` (ink) | Header bar, text |
| `--brand-charcoal` | `#2e3438` | Second bar, table headers, section bars |
| `--brand-cream` | `#ffffff` | Inputs, cards |
| `--brand-gold` | `#f3efe6` (paper) | Page tone, badge fill |
| `--brand-sand` | `#e4dfd2` | Daily Driver pill, dividers |
| `--brand-accent` (new) | `#6e1f2b` (burgundy) | Primary buttons, cart FAB, ring |
| `--primary`, `--sidebar-primary`, `--ring` | `#6e1f2b` | Focus and primary actions |
| `--primary-foreground` | `#f6f3ec` | Text on burgundy |
| `--background` / `--foreground` | `#f3efe6` / `#1f2326` | Page |
| `--accent` / `--accent-foreground` | `#efe3e5` / `#3b141b` | Selected row tint (Brake Pad row), Premium pill |
| `--radius` | `0.65rem` | Unchanged |

Unchanged by the patch: card/popover/muted/border/input are neutral HSL greys; `--destructive` stays red (`0 88% 41%`); chart colors unchanged.
Utility classes: `bg-brand-accent`, `bg-brand-charcoal`, `bg-brand-gold`, `text-brand-ink` (`--color-brand-accent` is added to the `@theme inline` block in `src/index.css`, which is what Tailwind 4 reads;
`src/index.css` has no `@config` line, so `tailwind.config.js` is not the source of truth for colors).

## Typography

Fonts (Google Fonts `@import` in `src/index.css`): display **Outfit** 500/600 (`--font-display`, wordmark and uppercase tracked labels), body
**IBM Plex Sans** 400-700 (`--font-sans`). The old theme used Barlow Condensed. Section labels are small uppercase with wide tracking
(`tracking-[0.2em]`..`0.25em`, 11-12 px, semibold).

## Wordmark and favicon

`src/components/Logo.tsx` (new in the patch): inline SVG `viewBox="58 -700 4191 902"`, `role="img"`, `aria-label="roy’s auto"`, `fill="currentColor"`,
so it takes the parent text color (white on the ink header). Used in Header as `<Logo className="h-7 sm:h-8 w-auto text-white" />`.
Lowercase "roy's auto", Outfit SemiBold outlined with a redrawn apostrophe. `public/favicon.svg`: ink circle `#1F2326` with a paper-colored `#F3EFE6`
glyph. `index.html` title becomes `roy’s auto`. Do not retype the wordmark in text; use the component.

## Components inventory

- `src/components/ui/`: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart,
  checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty, field, form, hover-card, input, input-group, input-otp, item, kbd,
  label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton,
  slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.
- App components: `Header`, `VehicleSearchBar`, `TreeSidebar`, `PartsTable`, `ProductDetailModal`, `ProductImage`, `RightCartPanel`,
  `wishlist/WishlistButton`, `wishlist/WishlistPanel`, `auth/AuthModal` (see `architecture.md`).

## Reference mockups

Files in `/srv/dev/reports/infra/roysauto-2026-11-06/`: `roys-auto-storefront-desktop.png` (1440 wide) and `roys-auto-storefront-mobile.png` (390 CSS px at 2x).
Compare integrated-page screenshots against these at 1440 and 390 widths.

Desktop: ink header bar with white wordmark at left, centered nav (Help, Order Status, Promotions, Account) in tracked uppercase, "OPEN MON-SAT 8AM - 8PM",
heart and cart icons (cart badge shows 1). Charcoal second bar: outlined buttons "Part Catalog", "Part Number Search", "Tools"; a wide white search field
("Search parts for 2013 Hyundai Elantra..."); outlined "VIN Lookup" and "Need Help?". Below, paper background, left/main column "PART CATALOG" with an
expanded RockAuto-style tree: years 2009-2013, 2013 open > "KOREA Hyundai" > Elantra > 2.0L L4 > "Brake & Wheel Hub" > "Brake Pad" (selected, tinted row);
siblings Brake Rotor, Wheel Bearing & Hub, Body & Lamp Assembly, Engine, Suspension. A divider, then "SELECTED FITMENT" with the breadcrumb
"2013 Hyundai Elantra > 2.0L L4 > Brake & Wheel Hub > Brake Pad". A charcoal-headed table "REAR" / "PRICE PER ITEM" with columns Image, Tier, Part, Details, Price, Cart.
Rows: Daily Driver (sand pill) Raybestos MZG813CH, ceramic pads, warranty 30 day, position Rear, green "In Stock", $15.36; Premium (blush pill) Wagner ZD813,
12 month warranty, $17.42. Each row has a burgundy "Add" button with cart icon, a heart (wishlist), and an outlined "Details" button. A toast reads "Added to cart!".
Right column (about 320 px, border-left): ink "QUICK CART" bar, "SHOPPING CART - 1 item saved", an item card (name, part number, description, position, qty stepper, price, remove X),
then one-page "SHIPPING ADDRESS" and "BILLING ADDRESS" sections with charcoal headers and labeled fields (Email, Full name, Address, City, State/Province, Postal code,
Country = Canada, Phone). Sections use small uppercase tracked labels.

Mobile: ink bar with hamburger at left and centered wordmark; charcoal bar with a full-width white search field ("Search by vehicle (2010 Hyundai Elantra..."); paper body
with "PART CATALOG" and collapsed year rows 2009-2013 with chevrons; a round burgundy floating cart button at bottom right. The Quick Cart opens as a sheet.

Note the mockup shows the cart panel with address forms. In the repo these forms are a disabled test UI (D1492): checkout, payment and order placement stay off.
