# Cart and App Integration Cleanup Design

## Objective

Stabilize the Shopify cart in a dedicated `staging` branch without changing `main`. The first phase fixes confirmed theme-level conflicts while preserving Qikify Upsell as an active, required integration. The resulting branch will be connected to an unpublished Shopify theme for manual validation before any production decision.

## Scope

### Included

- Preserve Qikify gift and upsell behavior.
- Ensure gift-card recipient properties never disable checkout.
- Remove the duplicate legacy cart removal request from the global theme script.
- Use the native cart component as the single owner of line removal and quantity changes.
- Remove the inherited mixed-preorder checkout blocker from the staging cart because the store has not confirmed an active preorder business rule.
- Stop identifying a free gift through the hard-coded variant ID `40126200709311`.
- Render prices and discounts from Shopify cart data rather than forcing a line to display as free.
- Add automated static regressions and a manual draft-theme validation matrix.

### Excluded from the first phase

- Disabling Qikify.
- Bulk-disabling app embeds.
- Replacing the complete ONA cart with Horizon's cart template.
- Changing Shopify Admin campaign configuration.
- Deleting WOD PreOrder from the store before confirming it is unused.
- Merging `staging` into `main` or publishing a Shopify theme.

## Architecture

The cart will have one mutation owner: `assets/component-cart-items.js`. The remove button in `sections/ona-cart-template.liquid` will continue to invoke that component through Shopify's `on:click` action. The legacy jQuery `customCartRemove()` function and its startup call will be removed from `assets/script.js`, then `assets/script.min.js` will be regenerated from the source using the existing minification convention.

Liquid will no longer infer preorder status from line-item properties. Recipient fields such as `Recipient email`, `Recipient name`, `Message`, and `Send on` are legitimate personalization data, not fulfillment markers. The old mixed-cart counter, disabled checkout input, and preorder popup will be removed from the staging implementation.

Qikify remains responsible for adding, removing, or recalculating promotional gifts after the single native cart mutation. The theme will not identify a gift using a fixed variant ID or force its displayed price. Shopify's `original_price`, `final_price`, `final_line_price`, and discount allocations remain the source of truth.

## Data Flow

### Removing a cart line

1. The customer clicks the line's Remove button.
2. The `on:click` action calls `CartItemsComponent.onLineItemRemove(line)`.
3. The component sends one request to Shopify's cart change endpoint.
4. Shopify returns updated cart sections.
5. The component morphs the cart and emits the cart update event.
6. Qikify may react to that completed update and reconcile its promotional gift.

There must be no parallel jQuery request and no request addressed only by variant ID.

### Checkout eligibility

1. Shopify renders the current cart, including gift-card personalization and Qikify metadata.
2. The theme renders an enabled checkout control whenever the cart is not empty.
3. Shopify and installed checkout validation apps remain responsible for legitimate checkout restrictions.

## Error Handling

- Existing native cart request errors remain visible through `CartItemsComponent` error refs.
- The cart must re-enable controls after a failed mutation.
- Qikify failures must not trigger a second theme-owned cart request.
- No theme code may clear the complete cart as a fallback.

## Automated Verification

Static regression tests will verify that:

- `customCartRemove` is absent from both source and minified global scripts.
- The cart remove button retains exactly one native component action.
- No cart change request uses the row's variant ID from `data-item-id`.
- The mixed-preorder counters and disabled checkout branch are absent.
- Recipient property names are not used as preorder indicators.
- The hard-coded gift variant ID and forced `Free` branches are absent.
- `shopify theme check` introduces no new findings in modified files.

## Draft Theme Validation Matrix

The unpublished Shopify theme connected to `staging` must validate:

1. Coffee only: checkout enabled; remove deletes one selected line.
2. Gift card only, sent to self: checkout enabled.
3. Personalized gift card only: recipient properties persist in cart and checkout remains enabled.
4. Personalized gift card plus coffee: checkout remains enabled; each line can be removed independently.
5. Coffee qualifying for Qikify gift: gift appears with the correct Shopify discount.
6. Remove the paid trigger product: Qikify reconciles the gift without clearing unrelated products.
7. Remove an unrelated product: trigger product and Qikify gift remain when campaign conditions still apply.
8. Quantity changes: exactly one cart mutation occurs per completed user action.

Browser DevTools Network must be used during cases 5–8 to confirm the sequence of `/cart/change.js`, `/cart/update.js`, and app requests.

## Version-Control Strategy

- `main` remains the immutable baseline snapshot at commit `621b9ae` during this work.
- All specification, tests, fixes, and audit changes live in `staging`.
- Each independently reversible behavior change receives its own commit.
- `staging` is pushed to GitHub for connection to an unpublished Shopify theme.
- No merge into `main` occurs until the full validation matrix passes and the user explicitly approves it.

## Follow-up App Audit

After the cart fixes pass, app embeds will be evaluated one at a time in the draft theme. Qikify remains enabled. WOD PreOrder will be a candidate for disabling only after the store confirms that no active preorder product or campaign exists. Other overlapping apps will be handled in separate scoped designs so cart stabilization is not mixed with broad app removal.
