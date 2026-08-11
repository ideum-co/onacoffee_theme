# Storefront Draft-Theme Validation

Use this checklist after the reviewed implementation has been integrated into GitHub `staging` and connected to an unpublished Shopify draft theme. Do not publish the theme as part of this validation.

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
- [ ] Sold-out variant selectors cannot be activated.

Validate these product states wherever the context can render them:

| State | Result | Evidence or product URL |
|---|---|---|
| Simple product | [ ] | |
| Complex product with two or more options | [ ] | |
| Sale product | [ ] | |
| Product without a badge or label | [ ] | |
| Sold-out product or variant | [ ] | |

## Hero CTA

- [ ] Desktop and mobile CTAs have adequate inline padding and a minimum 48 px target.
- [ ] Long labels wrap without clipping or overflowing the slide.
- [ ] Keyboard focus is visible.
- [ ] Hover and focus states remain legible against the slide.
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
- [ ] The cart badge and line items show the new cart state without a reload.
- [ ] A qualifying Qikify add inserts the configured gift exactly once.
- [ ] Removing gift qualification removes only the Qikify-managed gift.
- [ ] Unrelated paid and gift lines remain unchanged.
- [ ] The theme issues no duplicate add or remove mutation. Confirm in the Network panel.
- [ ] Checkout remains enabled for carts containing Qikify private line-item properties.

## PDP and Appstle

Use a subscription-eligible product and repeat the core purchase flow under each condition.

| Appstle condition | One-time purchase works | Subscription area result | No visible jump | Evidence |
|---|---|---|---|---|
| Normal response | [ ] | [ ] | [ ] | |
| Throttled response | [ ] | [ ] | [ ] | |
| Blocked response | [ ] | [ ] | [ ] | |
| Appstle absent or disabled | [ ] | [ ] | [ ] | |

For throttled testing, use browser request throttling. For blocked testing, block the Appstle request domain in DevTools. For the absent case, use a controlled draft-theme preview with the Appstle embed disabled and re-enable it immediately after the check.

- [ ] The description summary stops at approximately 45 words and links to full details.
- [ ] Quantity, option selectors, and add-to-cart remain usable at 375 px and desktop widths.
- [ ] One-time purchase remains functional in every Appstle condition.
- [ ] Normal Appstle rendering replaces the reserved area without a zero-height jump.
- [ ] The unavailable message appears after the reservation timeout when Appstle cannot render.

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
