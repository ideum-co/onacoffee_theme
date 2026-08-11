# Storefront UI/UX Unification Design

**Date:** 2026-08-11  
**Branch:** `staging`  
**Status:** Approved design, pending implementation plan

## Objective

Unify ONA Coffee's storefront purchase experience without changing its established visual identity or disrupting Shopify, Qikify, or Appstle. Product cards must look consistent across storefront contexts, the hero CTA must be usable and visually intentional, the header cart icon must open the quick-cart drawer, and the PDP must present a compact and stable purchase flow while subscription content loads.

## Scope

This design covers:

- Product cards on homepage featured collections, collection pages, search results, and product recommendations.
- The primary CTA in ONA slideshow sections.
- Header cart trigger and cart-drawer opening behavior.
- The above-the-fold product-information and purchase area on the default PDP.
- Appstle subscription loading stability inside that PDP purchase area.
- Accessibility, responsive behavior, performance safeguards, and validation for those areas.

This design does not:

- Change ONA's color palette or typography.
- Add visible card borders, backgrounds, shadows, or containers around products.
- Redesign the cart drawer's entire visual language.
- Disable, reconfigure, or replace Qikify or Appstle.
- Migrate the theme wholesale to Horizon components.
- Publish a Shopify theme or modify `main`.

## Chosen Approach

Use a shared design layer and targeted behavioral corrections. Consolidate storefront cards around one semantic card structure and one set of styles while retaining a free-standing, editorial presentation. Use the existing native Shopify drawer component as the single quick-cart surface. Refine the existing PDP composition rather than replacing its Shopify blocks or app integration points.

This approach was chosen over CSS-only patches because structural differences would remain and drift again. It was chosen over a full Horizon migration because that would materially increase regression risk for installed apps and existing content.

## Visual Foundation

The existing ONA visual identity remains authoritative:

- Preserve configured Playfair Display and Karla typography.
- Preserve the existing cream, charcoal, burgundy, white, and product-specific accent colors.
- Reuse theme color-scheme variables instead of introducing component-level raw colors where equivalent tokens exist.
- Product imagery remains the dominant card element.
- Motion stays subtle and functional, generally 150–300 ms, and respects `prefers-reduced-motion`.

The generic palette, typography, and 3D styling returned by the UI/UX reference database are explicitly rejected because they conflict with ONA's established brand and would add unnecessary performance and accessibility risk. The applicable reference guidance is retained: prevent layout shift, reserve space for async content, ensure accessible controls, and use consistent responsive structure.

## Product Card System

### Presentation

Cards remain visually free on the page background. There is no visible outline, card surface, shadow, or individual background. The system uses an invisible internal grid to align content across products.

Every card follows the same semantic order:

1. Product image.
2. Optional merchandising label.
3. Product title.
4. Price and optional compare-at price.
5. Optional single-option variant selector.
6. Add-to-cart action.

The card implementation must be shared across homepage featured collections, ONA collection pages, ONA search results, and product recommendations. All four contexts expose quick purchase for products with zero or one product option. Products with two or more product options use the same visual structure but replace quick purchase with a full-width link to choose options on the PDP. Context-specific wrappers may control column count and section spacing but must not reorder card content or redefine its internal measurements.

### Alignment and Responsive Rules

- Image containers use a consistent aspect ratio within each product grid and preserve the complete product image with the existing intended fit behavior.
- Titles support up to two lines. The content grid reserves the title row so prices, selectors, and CTAs align across adjacent cards.
- Optional labels, compare-at prices, and selectors must collapse without leaving arbitrary fixed whitespace. Alignment is achieved with named grid rows and content-aware minimums, not oversized fixed heights.
- Primary CTAs align at the bottom of each row and use the full available card width on desktop and mobile.
- Variant controls have a minimum 44 px touch target and clear selected, sold-out, hover, and keyboard-focus states.
- Validate layouts at 375, 768, 1024, and 1440 px without horizontal scrolling.

### Data and Interaction

- Shopify's selected or first available variant remains the initial card state.
- Changing a variant updates the hidden variant ID, availability, selected state, and displayed price in the same card only.
- Add-to-cart submits once through the theme's shared cart flow and refreshes the native drawer sections.
- Products that do not support simple one-option quick selection retain a clear link to the PDP rather than exposing an incomplete selector.

## Hero CTA

The approved direction is a solid, high-contrast CTA:

- White surface with burgundy text on dark/burgundy slides, using equivalent theme color tokens.
- Minimum height of 48 px and sufficient horizontal padding for the translated label.
- Visible hover, active, and keyboard-focus states.
- The complete button is the link target; the label must not receive a separate background that creates the current under-padded appearance.
- Mobile and desktop use the same visual treatment with responsive spacing, not separate inconsistent button designs.
- Contrast must meet WCAG 2.1 AA for text and focus indicators.

## Quick-Cart Behavior

### Single Surface

The existing `cart-drawer-component` is the authoritative quick-cart surface. The header cart icon opens this drawer whenever `settings.cart_type` is `drawer` and the visitor is not already on the cart page.

The same drawer opens after successful add-to-cart actions from homepage cards, collection cards, search cards, recommendations, featured product areas, and PDP purchase forms. Empty and populated carts use the same trigger behavior.

### Progressive Enhancement

- The trigger remains a valid link to `routes.cart_url` for navigation fallback.
- When the drawer component is initialized, the trigger intercepts the click, prevents navigation, and opens the dialog.
- If drawer JavaScript is unavailable or initialization fails, the link navigates to `/cart`.
- Opening moves focus into the dialog. Closing restores focus to the trigger.
- The drawer closes via its close button, `Escape`, or supported backdrop interaction without trapping focus elsewhere.
- Qikify remains responsible for its own gift eligibility and any reconciliation request after the theme's single cart mutation. The theme must not initiate a duplicate cart mutation.

## PDP Purchase Panel

### Information Hierarchy

The approved direction is the compact purchase panel:

1. Product title.
2. Current price.
3. Short product summary containing essential profile information.
4. Quantity and primary product option controls aligned in a compact responsive grid.
5. Purchase options with equal width and consistent internal alignment.
6. Reserved subscription integration region.
7. Primary add-to-cart action and accelerated checkout where currently enabled.

The full product description must not occupy the complete purchase column above the controls. Without requiring new merchant data, the compact summary uses the first 45 words of the plain-text product description and ends with an accessible “Read full details” link to the long-form content below. Extended description, story, origin, brew guidance, and other long-form material remain in or move to the existing progressive content sections below the primary purchase area.

### Control Consistency

- Quantity and variant controls share consistent heights, typography, borders, and spacing.
- On desktop they may share a row when content fits; on narrow screens they stack at full width.
- Purchase-option rows use the same width, radius, border, label alignment, and price alignment.
- Labels remain visible and are programmatically associated with their controls.
- The primary add-to-cart button uses the same minimum 48 px action height as the hero CTA.

## Appstle Loading Stability

Appstle remains the subscription provider and its supported integration marker remains intact. The theme reserves an explicit region for the expected subscription UI before the third-party script initializes.

### Loading State

- The reserved region appears only for products with selling plan groups or an Appstle integration marker that is expected to render subscription choices.
- Its minimum block size is based on the stable purchase-options layout and tuned at desktop and mobile breakpoints.
- A neutral, non-interactive loading structure may be shown while Appstle initializes. It must not mimic an actionable radio control or button.
- Once Appstle renders, the loading structure is removed without changing the surrounding content order.
- Height may grow for legitimate Appstle content but must not collapse from zero and push the add-to-cart area during initial load.

### Failure State

- Appstle failure must not block one-time purchase or add-to-cart.
- If Appstle has not rendered within eight seconds after DOM readiness, the loading structure changes to a compact, non-blocking “Subscription options are temporarily unavailable” status. The reserved minimum block size remains for the current page view so the purchase panel does not collapse.
- The theme must not duplicate subscription pricing logic or fabricate selling plans when Appstle is unavailable.

## Performance

- Preserve responsive image dimensions, `srcset`, and explicit width/height to avoid card layout shift.
- Load only above-the-fold card images eagerly; remaining card images stay lazy-loaded.
- Avoid adding another global framework or a new animation library.
- Reuse delegated listeners or existing web-component events instead of binding repeated global handlers per card.
- Load non-critical third-party integrations asynchronously or deferred where their supported embed permits it; do not alter vendor-owned code.
- Track cumulative layout shift around the PDP purchase panel before and after the Appstle reservation change. The implementation target is no visible purchase-panel jump and a page CLS below 0.1 in representative testing.

## Accessibility

- Interactive controls have minimum 44 × 44 px targets; primary CTAs have minimum 48 px height.
- Icon-only controls have accessible names.
- Keyboard focus is visible and is not removed by hover styling.
- Card selectors use correct radio semantics or native form controls and communicate selected and unavailable states without color alone.
- The cart drawer manages focus, close behavior, dialog labelling, and status announcements.
- Reduced-motion preferences disable nonessential transitions.
- Text and interactive states meet WCAG 2.1 AA contrast requirements.

## Error Handling and Fallbacks

- Cart drawer unavailable: navigate to `/cart`.
- Card AJAX add unavailable: retain a functional product form submission or route to the PDP according to the existing supported pattern.
- Complex product options not supported by quick add: route to PDP.
- Appstle unavailable: keep one-time purchase and add-to-cart operational.
- Product image unavailable: render a stable placeholder with meaningful alternative text behavior.
- Sold-out variant: update availability state and prevent invalid add-to-cart while preserving access to other available variants.

## Validation Strategy

### Automated and Static Checks

- Add source-level regression assertions for a shared card contract, the native cart-drawer trigger, and absence of duplicate theme-owned cart mutations.
- Run JavaScript syntax checks for all modified source and generated artifacts.
- Run Shopify Theme Check and separate pre-existing unrelated findings from new errors.
- Run `git diff --check` and confirm `main` and `origin/main` remain unchanged.

### Visual and Interaction Matrix

Validate on an unpublished Shopify draft theme connected to `staging`:

1. Homepage cards with short and two-line titles.
2. Collection, search, and recommendation cards for the same product.
3. Products with no label, sale price, one variant, multiple simple variants, complex options, and sold-out variants.
4. Hero CTA on desktop and mobile, including focus and long-label behavior.
5. Empty cart icon click.
6. Populated cart icon click.
7. Add from homepage, collection, search, recommendations, and PDP.
8. Qikify gift qualification, reconciliation, unrelated-line removal, and trigger-product removal.
9. PDP with Appstle loading normally, throttled, blocked, and absent on a non-subscription product.
10. Keyboard-only navigation and reduced-motion mode.
11. Widths of 375, 768, 1024, and 1440 px.

### Acceptance Criteria

- The same product has the same card hierarchy and internal alignment in every approved storefront context.
- No visible card contour is introduced.
- Hero CTA has a stable 48 px minimum height, correct padding, and accessible states.
- The header cart icon opens the drawer instead of navigating when the drawer is available.
- Every successful add-to-cart context opens or refreshes the same drawer.
- PDP controls have coherent widths and spacing, and extended copy no longer dominates the purchase column.
- Delayed Appstle initialization does not visibly push the core purchase controls from an unreserved state.
- One-time purchase remains functional if Appstle does not load.
- Qikify remains enabled and unrelated cart lines are preserved.
- No changes are published to a live Shopify theme and `main` remains unchanged.

## Delivery Sequence

Implementation should proceed in independently verifiable phases on `staging`:

1. Complete the already approved cart/app stability cleanup because it protects subsequent drawer work from duplicate mutations.
2. Correct and validate the native quick-cart trigger across add-to-cart contexts.
3. Consolidate the product card structure and styles.
4. Correct the slideshow CTA.
5. Refine the PDP hierarchy and Appstle loading reservation.
6. Run local gates, push `staging`, and execute the draft-theme validation matrix.

Each reversible behavior change receives its own commit. No phase may modify or merge `main`.
