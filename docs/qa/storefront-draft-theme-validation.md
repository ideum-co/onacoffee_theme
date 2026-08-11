# Storefront Draft-Theme Validation

Use this checklist after the reviewed implementation has been integrated into GitHub `staging` and connected to an unpublished Shopify draft theme. Do not publish the theme as part of this validation.

This runbook operationalizes the approved [cart/app cleanup design](../superpowers/specs/2026-08-11-cart-app-cleanup-design.md) and [storefront UI/UX design](../superpowers/specs/2026-08-11-storefront-ui-ux-unification-design.md). Record deviations against the applicable acceptance criterion.

## Test record

- Tester:
- Date and timezone:
- Draft-theme preview URL:
- Git commit deployed from `staging`:
- Browser and version:
- Qikify Upsell embed enabled: [ ]
- Appstle Subscription embed enabled: [ ]
- Theme remained unpublished: [ ]

Record each result as `PASS`, `FAIL`, or `BLOCKED` and link screenshots, video, console exports, network HAR files, or Chrome Performance traces where relevant.

## Product cards

Select one representative product that appears in all four contexts. At each viewport, confirm the same card structure, content order, image treatment, selector behavior, and CTA alignment.

| Context | 375 px | 768 px | 1024 px | 1440 px | Evidence |
|---|---|---|---|---|---|
| Homepage featured collection | [ ] | [ ] | [ ] | [ ] | |
| Collection | [ ] | [ ] | [ ] | [ ] | |
| Search | [ ] | [ ] | [ ] | [ ] | |
| Product recommendations | [ ] | [ ] | [ ] | [ ] | |

At every viewport and context:

- [ ] The card has no visible outline, surface, or shadow.
- [ ] A two-line title does not move variant selectors or CTAs out of alignment with adjacent cards.
- [ ] Images remain contained and are not cropped unexpectedly.
- [ ] Keyboard focus is visible on variant selectors and CTAs.
- [ ] Selected and unavailable selector states are announced without relying on color alone.
- [ ] Sold-out variant selectors cannot be activated.
- [ ] With `prefers-reduced-motion: reduce`, nonessential card image and control transitions are disabled.

Validate these product states wherever the context can render them:

| State | Result | Evidence or product URL |
|---|---|---|
| Simple product | [ ] | |
| Multiple variants with one product option | [ ] | |
| Complex product with two or more options | [ ] | |
| Sale product | [ ] | |
| Product without a badge or label | [ ] | |
| Sold-out product or variant | [ ] | |
| Product without an image | [ ] | |

### PC-01 — Complex product routes to the PDP

Precondition: identify a product with two or more product options and make it visible in each supported card context.

Steps:

1. Open the product card on homepage featured collection, collection, search, and product recommendations.
2. Confirm each card shows a full-width `Choose options` action instead of a partial quick-add selector.
3. Activate `Choose options` with a pointer and then with the keyboard.

Expected result: every action navigates to the correct product PDP; the card does not submit a variant or mutate the cart.

- Result: PASS / FAIL / BLOCKED
- Evidence for all four contexts and destination URLs:

### PC-02 — Single-option variant selection stays card-scoped

Precondition: place two cards with multiple variants under one product option in the same grid.

Steps:

1. Select an available non-default variant on the first card with a pointer and then with the keyboard.
2. Inspect the selected radio state, visible option value, displayed price, availability, hidden variant ID, and add-to-cart state on both cards.
3. Select a sold-out variant if it is exposed as a disabled selector.
4. Add the available selected variant once and inspect the resulting drawer line.

Expected result: only the first card updates; its selected state, price, availability, hidden ID, and CTA agree; the second card is unchanged; the sold-out variant cannot activate; and the drawer receives the selected available variant exactly once.

- Result: PASS / FAIL / BLOCKED
- Evidence, including before/after DOM state and added variant ID:

## Hero CTA

- [ ] Desktop and mobile CTAs have adequate inline padding and a minimum 48 px target.
- [ ] Long labels wrap without clipping or overflowing the slide.
- [ ] Keyboard focus is visible.
- [ ] Hover and focus states meet WCAG 2.1 AA contrast against the slide.
- [ ] With `prefers-reduced-motion: reduce`, the CTA has no color transition.

## Cart and Qikify

Run the header checks once with an empty cart and once with a populated cart.

- [ ] Clicking the header cart control opens the same native drawer when the cart is empty.
- [ ] Clicking it opens the same native drawer when the cart is populated.
- [ ] With JavaScript disabled, the header cart link reaches `/cart`.
- [ ] Adding from homepage featured collection opens or refreshes that drawer.
- [ ] Adding from collection opens or refreshes that drawer.
- [ ] Adding from search opens or refreshes that drawer.
- [ ] Adding from product recommendations opens or refreshes that drawer.
- [ ] Adding from the PDP opens or refreshes that drawer.
- [ ] The cart badge and line items show the new cart state without a reload.
- [ ] A qualifying Qikify add inserts the configured gift exactly once.
- [ ] Removing gift qualification removes only the Qikify-managed gift.
- [ ] Unrelated paid and gift lines remain unchanged.
- [ ] The theme issues no duplicate add or remove mutation. Confirm in the Network panel.
- [ ] Checkout remains enabled for carts containing Qikify private line-item properties.

For cases CART-01 through CART-08, clear the Network panel immediately before each completed user action. Preserve requests to `/cart/add.js`, `/cart/change.js`, `/cart/update.js`, section-rendering endpoints, and Qikify endpoints. Use the Initiator column to distinguish the single theme-owned mutation from any later Qikify reconciliation request.

### CART-01 — Coffee only

Steps:

1. Start with an empty cart and add one coffee product.
2. Open the cart drawer and confirm checkout is enabled.
3. Clear the Network panel, then activate Remove once for that coffee line.

Expected result: one selected coffee line is removed, the empty cart state renders, and the theme owns exactly one completed remove mutation.

- Result: PASS / FAIL / BLOCKED
- Evidence, including Network request and initiator:

### CART-02 — Gift card sent to self

Steps:

1. Start with an empty cart and open a gift-card PDP.
2. Select the store's send-to-self option, or leave recipient delivery disabled if that is the equivalent storefront state.
3. Add the gift card, open the drawer, and proceed to the first checkout step without completing an order.

Expected result: the gift card is the only line, checkout remains enabled, and checkout navigation succeeds without a theme-level preorder or property blocker.

- Result: PASS / FAIL / BLOCKED
- Evidence, including cart and first checkout step:

### CART-03 — Personalized gift card property persistence

Steps:

1. Start with an empty cart and enable recipient delivery on a gift-card PDP.
2. Enter distinct test values for recipient name, recipient email, message, and send date where available.
3. Add the gift card and record the submitted `/cart/add.js` payload.
4. Open or refresh the drawer, then navigate to `/cart` and proceed to the first checkout step.

Expected result: the entered recipient properties persist on the same gift-card line wherever Shopify exposes them; checkout remains enabled and no property is treated as a preorder marker.

- Result: PASS / FAIL / BLOCKED
- Evidence, including submitted properties and their cart/checkout representation:

### CART-04 — Personalized gift card plus coffee

Steps:

1. Add a personalized gift card as in CART-03, then add one coffee product.
2. Confirm both lines are present and checkout is enabled.
3. Remove the coffee once and confirm the personalized gift card and its properties remain.
4. Restore the two-line setup, remove the gift card once, and confirm the coffee remains.

Expected result: each selected line can be removed independently; removing either line does not remove, replace, or clear the other line, and the theme owns exactly one mutation for each remove action.

- Result: PASS / FAIL / BLOCKED
- Evidence for both removal directions, including Network initiators:

### CART-05 — Qikify qualification

Steps:

1. Start with an empty cart and clear the Network panel.
2. Add the paid product or quantity that qualifies for the active Qikify promotion.
3. Wait for Qikify reconciliation to finish, then inspect the drawer and Shopify price/discount data.

Expected result: the configured promotional gift appears exactly once with the correct Shopify discount; the theme performs one add mutation and does not duplicate Qikify's reconciliation.

- Result: PASS / FAIL / BLOCKED
- Evidence, including theme request, Qikify requests, line keys, and discount display:

### CART-06 — Remove the paid Qikify trigger

Precondition: keep the qualifying trigger, promotional gift, and one unrelated paid product in the cart.

Steps:

1. Clear the Network panel.
2. Remove the paid trigger product once.
3. Wait for Qikify reconciliation to complete.

Expected result: Qikify removes or recalculates only its promotional gift according to campaign rules; the unrelated paid line remains; the cart is not cleared; and the theme owns exactly one remove mutation.

- Result: PASS / FAIL / BLOCKED
- Evidence, including before/after line keys and ordered Network requests:

### CART-07 — Remove an unrelated product while promotion remains valid

Precondition: keep a qualifying trigger, its promotional gift, and one unrelated paid product in the cart; ensure removing the unrelated line does not break the promotion threshold.

Steps:

1. Clear the Network panel.
2. Remove the unrelated product once.
3. Wait for any Qikify reconciliation to settle.

Expected result: only the unrelated product is removed; the trigger and promotional gift remain; the promotion stays applied; and the theme owns exactly one remove mutation.

- Result: PASS / FAIL / BLOCKED
- Evidence, including before/after line keys and ordered Network requests:

### CART-08 — Quantity changes have one theme-owned mutation

Run this case once on a normal coffee line and once on the Qikify trigger while the promotion is active.

Steps:

1. Clear the Network panel.
2. Perform exactly one completed quantity action: press increment once, press decrement once, or enter a value and commit it with the supported blur/Enter behavior.
3. Wait for the drawer and any Qikify reconciliation to settle before the next action.
4. Repeat for each supported quantity interaction, clearing Network between actions.

Expected result: each completed user action produces exactly one theme-owned cart mutation, controls recover after the response, and any Qikify request occurs only as subsequent app reconciliation. No action produces parallel theme-owned `/cart/change.js` or `/cart/update.js` requests.

- Result: PASS / FAIL / BLOCKED
- Evidence table with action, resulting quantity, theme-owned mutation count, endpoint, initiator, and Qikify follow-up:

### ADD-01 — All successful add-to-cart contexts use one drawer

Repeat these steps for homepage featured collection, collection, search, product recommendations, and the PDP.

Steps:

1. Open the context with the native cart drawer closed and clear the Network panel.
2. Add an available simple product once.
3. Observe the drawer, line items, badge count, focus, and Network requests.

Expected result: one add mutation succeeds, the same native drawer opens or refreshes with the added line and correct badge count, and no context creates a second theme-owned mutation.

| Context | Result | Add mutations owned by theme | Drawer opened/refreshed | Evidence |
|---|---|---:|---|---|
| Homepage featured collection | | | | |
| Collection | | | | |
| Search | | | | |
| Product recommendations | | | | |
| PDP | | | | |

### DRAWER-01 — Keyboard-only drawer journey

Steps:

1. Disconnect or set aside the pointing device and use `Tab`/`Shift+Tab` to focus the header cart trigger.
2. Confirm the trigger has a visible focus indicator and an accessible name, then press `Enter`.
3. Confirm focus moves inside the open drawer dialog and inspect its accessible dialog name with the browser accessibility tree.
4. Traverse every interactive drawer control with `Tab`/`Shift+Tab`; operate one supported quantity or removal action and listen with a screen reader to the loading, success, or error status announcement.
5. Press `Escape` to close the drawer.
6. Reopen it with the keyboard, activate the labelled close button, and confirm focus behavior again.

Expected result: focus enters the labelled dialog, remains in a logical drawer sequence without escaping behind the open modal, every icon-only control has an accessible name, cart changes expose an appropriate status announcement, both `Escape` and the close button close the drawer, and focus returns to the original header trigger after each close.

- Result: PASS / FAIL / BLOCKED
- Evidence, including browser accessibility-tree capture, focused-element sequence, and screen reader/status notes:

## PDP and Appstle

Use the same subscription-eligible product for the normal, throttled, blocked, and eligible-product embed-absent conditions. Keep the Appstle embed enabled except for the controlled embed-absent condition, and re-enable it immediately afterward.

| Appstle condition | One-time purchase works | Subscription area result | No visible jump | Evidence |
|---|---|---|---|---|
| Normal response | [ ] | [ ] | [ ] | |
| Throttled response | [ ] | [ ] | [ ] | |
| Blocked Appstle requests on an eligible product | [ ] | [ ] | [ ] | |
| Embed absent or disabled on an eligible product | [ ] | [ ] | [ ] | |

For throttled testing, use browser request throttling. For blocked testing, block the Appstle request domain in DevTools. For the absent case, use a controlled draft-theme preview with the Appstle embed disabled and re-enable it immediately after the check.

For each eligible-product condition:

1. Start a cold PDP load with the requested Appstle network condition active.
2. Record the purchase panel from before Appstle initialization through ready or timeout state.
3. Select one-time purchase, choose an available variant and quantity, and add it to cart.
4. Confirm the native drawer opens or refreshes with the selected variant and quantity.

Expected result: the reserved region prevents a zero-height jump; normal/throttled Appstle content replaces the loading state when it arrives; blocked/absent Appstle reaches the non-blocking unavailable state at eight seconds without collapsing the reserved minimum height; and one-time purchase plus add-to-cart works in every condition.

- [ ] The description summary stops at approximately 45 words and links to full details.
- [ ] Quantity, option selectors, and add-to-cart remain usable at 375 px and desktop widths.
- [ ] One-time purchase remains functional in every Appstle condition.
- [ ] Normal Appstle rendering replaces the reserved area without a zero-height jump.
- [ ] The unavailable message appears after the reservation timeout when Appstle cannot render.

### PDP-01 — Product without selling plans

Precondition: identify a product with no selling plan groups and verify the product data before loading the PDP.

Steps:

1. Load the PDP cold with the Appstle embed enabled globally.
2. Inspect the purchase panel before and after third-party scripts settle.
3. Select a variant and quantity, choose one-time purchase, and add the product to cart.

Expected result: the theme does not render the subscription reservation/loading status for this product, Appstle subscription choices do not appear, and the one-time purchase opens or refreshes the native drawer normally.

- Result: PASS / FAIL / BLOCKED
- Evidence, including product selling-plan data, purchase-panel DOM, and add-to-cart Network request:

## Performance and CLS

In Chrome DevTools Performance, record a cold-load trace for a representative subscription PDP with screenshots and Web Vitals enabled.

- [ ] No visible zero-height Appstle jump occurs in the purchase panel.
- [ ] Representative page CLS is below `0.1`.
- [ ] Save the trace and record its filename or link:
- Observed CLS:

## Failure record

Create one record per failure before changing repository code:

- Exact preview URL:
- Git commit:
- Viewport:
- Browser and device mode:
- Preconditions and app state:
- Reproduction steps:
  1.
  2.
  3.
- Expected result:
- Actual result:
- Console output or export:
- Relevant network requests or HAR:
- Screenshot, video, or Performance trace:
- Deterministic repository regression possible: yes / no

If the failure can be represented by source inspection or deterministic browser automation, add the failing regression before the focused fix. Keep the fix independently reversible, rerun the complete local gate and this matrix, and leave the draft theme unpublished for user approval.
