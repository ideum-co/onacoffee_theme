# Storefront UI/UX Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver consistent product cards, a usable solid hero CTA, one native quick-cart interaction, and a compact, layout-stable PDP on `staging` without disrupting Qikify or Appstle.

**Architecture:** Complete the approved cart stability plan first, then make Shopify's `cart-drawer-component` the only quick-cart surface. Consolidate ONA product-card markup, styles, and behavior into shared assets consumed by homepage, collection, search, and recommendations. Add a small theme-owned Appstle reservation block that observes vendor rendering but never reproduces subscription business logic.

**Tech Stack:** Shopify Liquid and JSON templates, Horizon web components, ES modules, CSS custom properties, Ruby source-regression tests, Shopify CLI Theme Check, Git.

## Global Constraints

- Work only on `staging`; do not modify, merge, or push `main`.
- Do not publish a Shopify theme.
- Keep Qikify Upsell and Appstle enabled.
- Do not modify vendor-owned app code or fabricate selling plans.
- Do not add a new framework or animation library.
- Product cards remain visually free: no border, surface, shadow, or individual background.
- Preserve Playfair Display, Karla, and the configured ONA color schemes.
- Interactive controls are at least 44 × 44 px; primary CTAs are at least 48 px high.
- Validate at 375, 768, 1024, and 1440 px with no horizontal scrolling.
- Respect `prefers-reduced-motion` and WCAG 2.1 AA focus/contrast requirements.
- Every independently reversible behavior change receives its own commit.

---

## File Structure

- Existing plan `docs/superpowers/plans/2026-08-11-cart-app-cleanup.md`: prerequisite removal of duplicate cart mutations and inferred checkout blocking.
- Extend `tests/cart_theme_regression_test.rb`: dependency-free contracts for cart, cards, hero, and PDP/Appstle integration.
- Create `assets/ona-product-card.js`: one delegated controller for variant selection, add-to-cart, cart events, and drawer opening.
- Create `assets/ona-product-card.css`: shared invisible-grid card system and responsive/action states.
- Modify `snippets/ona-product-card.liquid`: single semantic card renderer for all ONA storefront contexts.
- Modify `sections/ona-featured-collection.liquid`: render the shared card and remove duplicated card CSS/JS.
- Modify `sections/ona-collection-template.liquid`: keep its grid/filter shell and remove duplicated card controller.
- Modify `sections/ona-search-results.liquid`: retain the shared renderer and load shared assets once.
- Modify `sections/product-recommendations.liquid`: render the shared ONA card for recommendation products.
- Modify `sections/ona-header.liquid`: make its progressively enhanced link the native drawer trigger.
- Modify `sections/ona-slideshow.liquid` and `assets/ona-fixes.css`: solid, padded CTA with one mobile/desktop treatment.
- Create `blocks/ona-subscription-reserve.liquid`: Appstle loading/failure reservation shown only for subscription products.
- Create `assets/ona-subscription-reserve.js`: bounded observer that changes loading state without blocking purchase.
- Modify `templates/product.default.json`: compact summary and subscription reservation placement.
- Modify `sections/ona-product-information.liquid`: scoped purchase-panel alignment and full-details anchor.

---

### Task 1: Complete the Cart/App Stability Prerequisite

**Files:**
- Follow exactly: `docs/superpowers/plans/2026-08-11-cart-app-cleanup.md`
- Create: `tests/cart_theme_regression_test.rb`
- Modify: `assets/script.js`
- Regenerate: `assets/script.min.js`
- Modify: `sections/ona-cart-template.liquid`

**Interfaces:**
- Consumes: current `staging` branch at or after commit `d268a63`.
- Produces: one theme-owned line-removal mutation, an enabled checkout for personalized gift-card mixed carts, and `ruby tests/cart_theme_regression_test.rb` as the shared regression command.

- [ ] **Step 1: Execute Tasks 1–3 of the prerequisite plan with their RED/GREEN cycles**

Run each step in `docs/superpowers/plans/2026-08-11-cart-app-cleanup.md`; do not combine its commits.

- [ ] **Step 2: Run the prerequisite verification gate**

```bash
ruby -c tests/cart_theme_regression_test.rb
ruby tests/cart_theme_regression_test.rb
node --check assets/script.js
node --check assets/script.min.js
```

Expected: Ruby reports `Syntax OK` and `PASS: cart theme integration regressions`; both JavaScript checks exit 0.

- [ ] **Step 3: Confirm Qikify and Appstle embeds remain enabled**

```bash
ruby -rjson -e 'j=JSON.parse(File.read("config/settings_data.json")); types=j.fetch("current").fetch("blocks").values.reject { |b| b["disabled"] }.map { |b| b["type"] }; abort "Qikify disabled" unless types.any? { |t| t.include?("qikify-upsell") }; abort "Appstle disabled" unless types.any? { |t| t.include?("appstle-subscription") }; puts "PASS: required app embeds enabled"'
```

Expected: `PASS: required app embeds enabled`.

---

### Task 2: Add UI/UX Source Regression Contracts

**Files:**
- Modify: `tests/cart_theme_regression_test.rb`
- Inspect: all production files listed in the File Structure section

**Interfaces:**
- Consumes: `read_repo(path)` and `assert(condition, message)` from Task 1.
- Produces: static assertions that fail before each UI/UX implementation and pass only when the approved contracts exist.

- [ ] **Step 1: Append the failing contracts**

Append this code before the final `puts` and change the final message to `PASS: storefront theme regressions`:

```ruby
header = read_repo('sections/ona-header.liquid')
card = read_repo('snippets/ona-product-card.liquid')
featured = read_repo('sections/ona-featured-collection.liquid')
collection = read_repo('sections/ona-collection-template.liquid')
search = read_repo('sections/ona-search-results.liquid')
recommendations = read_repo('sections/product-recommendations.liquid')
card_css = read_repo('assets/ona-product-card.css')
card_js = read_repo('assets/ona-product-card.js')
slideshow = read_repo('sections/ona-slideshow.liquid')
slideshow_css = read_repo('assets/ona-fixes.css')
product_template = read_repo('templates/product.default.json')
subscription_block = read_repo('blocks/ona-subscription-reserve.liquid')
subscription_js = read_repo('assets/ona-subscription-reserve.js')

assert(header.include?('data-testid="cart-drawer-trigger"'), 'header lacks native drawer trigger contract')
assert(header.include?('on:click="cart-drawer-component/open"'), 'header cart link does not open native drawer')
assert(header.include?('href="{{ routes.cart_url }}"'), 'header cart trigger lacks /cart fallback')

assert(card.include?('class="ona-card"'), 'shared ONA card root missing')
assert(card.include?('data-ona-card'), 'shared card behavior hook missing')
assert(card.include?('ona-card__media') && card.include?('ona-card__title') && card.include?('ona-card__action'), 'shared card semantic regions missing')
assert(!card_css.match?(/\.ona-card\s*\{[^}]*\b(?:border|box-shadow|background(?:-color)?)\s*:/m), 'shared card adds a visible container')
assert(card_css.include?('min-height: 44px'), 'card controls lack 44px target')
assert(card_css.include?('min-height: 48px'), 'card CTA lacks 48px target')
assert(card_css.include?('@media (prefers-reduced-motion: reduce)'), 'card motion ignores reduced-motion preference')
assert(card_js.include?("document.addEventListener('submit'"), 'shared card controller is not delegated')
assert(card_js.include?("new CustomEvent('cart:add'"), 'shared card controller does not emit native cart add event')

[featured, collection, search, recommendations].each_with_index do |source, index|
  assert(source.include?("render 'ona-product-card'"), "card consumer #{index + 1} does not render shared card")
end
assert(!featured.include?('ona-fc__pill'), 'featured collection retains duplicate card UI')
assert(!featured.include?("fetch('/cart/add.js'"), 'featured collection retains duplicate cart controller')
assert(!collection.include?("fetch('/cart/add.js'"), 'collection retains duplicate cart controller')

assert(slideshow.include?('slideshow__btn'), 'slideshow CTA hook missing')
assert(slideshow_css.match?(/\.slideshow__btn[\s\S]{0,400}min-height:\s*48px/), 'hero CTA lacks 48px minimum height')
assert(slideshow_css.match?(/\.slideshow__btn[\s\S]{0,400}padding:/), 'hero CTA lacks component padding')

assert(product_template.include?('truncatewords: 45'), 'PDP compact summary is not capped at 45 words')
assert(product_template.include?('ona_subscription_reserve'), 'PDP lacks subscription reservation block')
assert(subscription_block.include?('closest.product.selling_plan_groups'), 'subscription reserve is not product-aware')
assert(subscription_js.include?('8000'), 'Appstle failure timeout is not eight seconds')
assert(subscription_js.include?('MutationObserver'), 'Appstle reservation does not observe vendor rendering')
```

- [ ] **Step 2: Make the harness tolerate not-yet-created files while preserving RED**

Replace `read_repo` with:

```ruby
def read_repo(path)
  full_path = File.join(ROOT, path)
  File.exist?(full_path) ? File.read(full_path) : ''
end
```

- [ ] **Step 3: Run the test and verify RED**

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: exit 1 with `FAIL: header lacks native drawer trigger contract`.

- [ ] **Step 4: Commit the failing UI/UX contracts**

```bash
git add tests/cart_theme_regression_test.rb
git commit -m "test: capture storefront UI UX contracts"
```

---

### Task 3: Make the Header Link Open the Native Quick Cart

**Files:**
- Modify: `sections/ona-header.liquid:175-188`
- Test: `tests/cart_theme_regression_test.rb`

**Interfaces:**
- Consumes: `cart-drawer-component.open()` from `assets/cart-drawer.js` and `/cart` fallback from `routes.cart_url`.
- Produces: `data-testid="cart-drawer-trigger"` and `on:click="cart-drawer-component/open"` on the header cart link.

- [ ] **Step 1: Confirm the focused regression is RED**

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: `FAIL: header lacks native drawer trigger contract`.

- [ ] **Step 2: Replace the intentionally navigational cart-link markup**

Keep the `<a href="{{ routes.cart_url }}">` fallback, but change its behavior hooks to:

```liquid
<a
  href="{{ routes.cart_url }}"
  class="ona-cart-trigger"
  aria-label="{{ 'accessibility.cart' | t }}"
  aria-haspopup="dialog"
  on:click="cart-drawer-component/open"
  data-testid="cart-drawer-trigger"
>
```

Remove the obsolete comment that says the header click goes to `/cart`. Do not add a second click listener.

- [ ] **Step 3: Run regression and theme syntax checks**

```bash
ruby tests/cart_theme_regression_test.rb
shopify theme check --path . --fail-level error
```

Expected: header assertions pass; the regression advances to `shared ONA card root missing`. Theme Check adds no error in `sections/ona-header.liquid`.

- [ ] **Step 4: Commit the quick-cart trigger**

```bash
git add sections/ona-header.liquid
git commit -m "fix: open quick cart from header"
```

---

### Task 4: Build the Shared Free-Standing Product Card

**Files:**
- Modify: `snippets/ona-product-card.liquid`
- Create: `assets/ona-product-card.css`
- Create: `assets/ona-product-card.js`
- Test: `tests/cart_theme_regression_test.rb`

**Interfaces:**
- Consumes: Liquid `product`, optional `index`, and Shopify `/cart/add.js` section response.
- Produces: `.ona-card[data-ona-card]`; `[data-card-pill]`, `[data-card-form]`, `[data-card-variant-input]`, `[data-card-price]`, and `[data-card-atc]`; delegated controller initialized once per document.

- [ ] **Step 1: Confirm the card contract is RED**

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: `FAIL: shared ONA card root missing`.

- [ ] **Step 2: Refactor the snippet to one semantic grid**

Use this outer structure, retaining the existing responsive image and price/availability Liquid inside the named regions:

```liquid
<article class="ona-card" data-ona-card data-product-id="{{ product.id }}">
  <a href="{{ product.url }}" class="ona-card__media" aria-label="{{ product.title | escape }}">
    <!-- existing responsive product image -->
  </a>
  <div class="ona-card__badge">{% render 'ona-product-tags', product: product %}</div>
  <h3 class="ona-card__title"><a href="{{ product.url }}">{{ product.title | escape }}</a></h3>
  <div class="ona-card__price" data-card-price><!-- existing Shopify price logic --></div>
  <div class="ona-card__options"><!-- one-option pills only --></div>
  <div class="ona-card__action">
    <!-- zero/one option: existing product form; two or more options: full-width PDP link -->
  </div>
</article>
```

For `product.options.size >= 2`, render:

```liquid
<a class="ona-card__choose" href="{{ product.url }}">Choose options</a>
```

For simple cards, preserve hidden variant ID and quantity fields. Add `aria-disabled="true"` to sold-out pills in addition to the visual state.

- [ ] **Step 3: Add the invisible-grid styles**

Create `assets/ona-product-card.css` with a borderless root and named grid rows:

```css
.ona-card {
  display: grid;
  grid-template-rows: auto minmax(1.2rem, auto) minmax(2.8em, auto) auto auto auto;
  align-content: start;
  min-width: 0;
  height: 100%;
  color: var(--color-foreground, #2b2c30);
}
.ona-card__media { display: block; aspect-ratio: 168 / 250; overflow: hidden; }
.ona-card__media img { width: 100%; height: 100%; display: block; object-fit: contain; transition: transform 200ms ease; }
.ona-card__badge { min-height: 1.2rem; margin-top: 12px; text-align: center; }
.ona-card__title { margin: 4px 0; min-height: 2.4em; font: 700 1.3125rem/1.2 var(--font-subheading--family, Karla, sans-serif); text-align: center; }
.ona-card__title a { color: inherit; text-decoration: none; }
.ona-card__price { margin-bottom: 10px; text-align: center; }
.ona-card__options { align-self: end; text-align: center; }
.ona-card__pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.ona-card__pill { min-width: 44px; min-height: 44px; padding: 9px 14px; border: 1px solid var(--color-border, #9e9f9b); background: transparent; }
.ona-card__pill[aria-checked='true'] { color: var(--color-background, #fff); background: var(--color-foreground, #2b2c30); }
.ona-card__action { align-self: end; margin-top: 12px; }
.ona-card__action form { width: 100%; }
.ona-card__atc, .ona-card__choose { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; padding: 12px 18px; border: 1px solid var(--color-foreground, #2b2c30); background: var(--color-foreground, #2b2c30); color: var(--color-background, #fff); text-transform: uppercase; letter-spacing: .075em; }
.ona-card__pill:focus-visible, .ona-card__atc:focus-visible, .ona-card__choose:focus-visible { outline: 2px solid var(--color-primary, #661a34); outline-offset: 3px; }
.ona-card:hover .ona-card__media img { transform: scale(1.025); }
@media (prefers-reduced-motion: reduce) { .ona-card__media img { transition: none; } .ona-card:hover .ona-card__media img { transform: none; } }
```

Do not add `border`, `background`, or `box-shadow` to `.ona-card` itself.

- [ ] **Step 4: Add one delegated controller**

Create `assets/ona-product-card.js` as an ES module. It must:

1. Handle clicks on `[data-card-pill]` through one document listener.
2. Scope all changes with `pill.closest('[data-ona-card]')`.
3. Update `aria-checked`, active class, variant input, displayed price, option label, availability, and CTA copy.
4. Handle submits on `[data-card-form]` through one document listener.
5. POST `FormData` to `window.Shopify.routes.root + 'cart/add.js'` with `sections=ona_header`.
6. Dispatch both the native `cart:add` event consumed by `cart-drawer-component` and the existing `cart:update` compatibility event.
7. Restore button state on success or error and never retry a failed mutation automatically.

Use this event contract after a successful response:

```javascript
document.dispatchEvent(new CustomEvent('cart:add', {
  bubbles: true,
  detail: { resource: response, sourceId: variantInput.value }
}));
document.dispatchEvent(new CustomEvent('cart:update', {
  bubbles: true,
  detail: { resource: response, sourceId: variantInput.value, data: { sections: response.sections || {} } }
}));
```

- [ ] **Step 5: Load the assets once from the snippet**

At the top of `snippets/ona-product-card.liquid`, add:

```liquid
{{ 'ona-product-card.css' | asset_url | stylesheet_tag }}
<script src="{{ 'ona-product-card.js' | asset_url }}" type="module" fetchpriority="low"></script>
```

The module and delegated listeners must remain idempotent even if Shopify emits duplicate identical module tags from repeated snippets.

- [ ] **Step 6: Run focused checks**

```bash
node --check assets/ona-product-card.js
ruby tests/cart_theme_regression_test.rb
```

Expected: JavaScript syntax passes; shared-card assertions pass and the test advances to a consumer migration assertion.

- [ ] **Step 7: Commit the shared card unit**

```bash
git add snippets/ona-product-card.liquid assets/ona-product-card.css assets/ona-product-card.js
git commit -m "feat: add shared ONA product card"
```

---

### Task 5: Migrate Every Approved Card Context

**Files:**
- Modify: `sections/ona-featured-collection.liquid`
- Modify: `sections/ona-collection-template.liquid`
- Modify: `sections/ona-search-results.liquid`
- Modify: `sections/product-recommendations.liquid`
- Test: `tests/cart_theme_regression_test.rb`

**Interfaces:**
- Consumes: `{% render 'ona-product-card', product: product, index: forloop.index %}` from Task 4.
- Produces: four context wrappers that control only grid columns/gaps and contain no independent card mutation controller.

- [ ] **Step 1: Confirm consumer assertions are RED**

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: failure identifies the first consumer without the shared renderer or duplicated `ona-fc__pill` behavior.

- [ ] **Step 2: Replace homepage featured-card internals**

Inside `.ona-fc__grid`, reduce each product iteration to:

```liquid
<li class="ona-fc__item">
  {% render 'ona-product-card', product: p, index: forloop.index %}
</li>
```

Keep section header, empty state, view-all, schema, and responsive grid rules. Remove all `.ona-fc__card`, media, badge, title, price, pill, form, and ATC styles. Remove the complete inline card JavaScript and `window.__onaAutoOpenCart` script.

- [ ] **Step 3: Remove the collection's duplicated card controller**

Keep its existing `{% render 'ona-product-card' %}` loop. Delete the controller that binds `[data-ona-card]`, posts `/cart/add.js`, and manually opens the drawer. Do not alter filters, category tiles, pagination, or collection-description scripts.

- [ ] **Step 4: Confirm search uses the shared renderer**

Keep `sections/ona-search-results.liquid` on the shared snippet. Pass `index: forloop.index` if absent so image loading priority remains deterministic. Remove only any context-specific card rules that conflict with `.ona-card` internals.

- [ ] **Step 5: Replace recommendation block rendering**

Within `sections/product-recommendations.liquid`, replace the `_product-card` content block for real product results with:

```liquid
{% render 'ona-product-card', product: product, index: forloop.index %}
```

Keep the existing recommendation fetch/component wrapper and section layout. Do not render quick add for placeholder products in theme-editor empty states.

- [ ] **Step 6: Run complete card checks**

```bash
node --check assets/ona-product-card.js
ruby tests/cart_theme_regression_test.rb
shopify theme check --path . --fail-level error
```

Expected: consumer and duplication assertions pass; Theme Check adds no errors in the four modified sections.

- [ ] **Step 7: Commit the card migration**

```bash
git add sections/ona-featured-collection.liquid sections/ona-collection-template.liquid sections/ona-search-results.liquid sections/product-recommendations.liquid
git commit -m "refactor: unify storefront product cards"
```

---

### Task 6: Apply the Approved Solid Hero CTA

**Files:**
- Modify: `assets/ona-fixes.css:456-484`
- Verify: `sections/ona-slideshow.liquid:102-174`
- Test: `tests/cart_theme_regression_test.rb`

**Interfaces:**
- Consumes: existing `.slideshow__btn` and `.slideshow__btn--mobile` anchors.
- Produces: one solid visual treatment with a 48 px minimum height and responsive spacing.

- [ ] **Step 1: Confirm hero assertion is RED**

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: `FAIL: hero CTA lacks 48px minimum height` or padding assertion.

- [ ] **Step 2: Replace the CTA rules**

Use the configured button colors and keep the anchor as the complete surface:

```css
[data-section-type="ona-slideshow"] .slideshow__btn,
[data-section-type="ona-slideshow"] .slideshow__btn--mobile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  max-width: 100%;
  padding: 12px 24px;
  border: 1px solid var(--color-btn-primary-text);
  background: var(--color-btn-primary-text);
  color: var(--color-btn-primary);
  line-height: 1.2;
  text-decoration: none;
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
}
[data-section-type="ona-slideshow"] .slideshow__btn:hover,
[data-section-type="ona-slideshow"] .slideshow__btn:focus-visible,
[data-section-type="ona-slideshow"] .slideshow__btn--mobile:hover,
[data-section-type="ona-slideshow"] .slideshow__btn--mobile:focus-visible {
  background: transparent;
  color: var(--color-btn-primary-text);
}
@media (prefers-reduced-motion: reduce) {
  [data-section-type="ona-slideshow"] .slideshow__btn,
  [data-section-type="ona-slideshow"] .slideshow__btn--mobile { transition: none; }
}
```

Retain the existing desktop/mobile visibility rules and margins, but remove conflicting `line-height: 2.2` and inner-label backgrounds.

- [ ] **Step 3: Run regression and CSS scope checks**

```bash
ruby tests/cart_theme_regression_test.rb
rg -n "slideshow__btn" assets/ona-fixes.css sections/ona-slideshow.liquid
```

Expected: hero assertions pass; selectors are scoped to ONA slideshow markup.

- [ ] **Step 4: Commit the CTA change**

```bash
git add assets/ona-fixes.css
git commit -m "fix: give slideshow CTA a solid action style"
```

---

### Task 7: Build the Compact PDP and Appstle Reservation

**Files:**
- Create: `blocks/ona-subscription-reserve.liquid`
- Create: `assets/ona-subscription-reserve.js`
- Modify: `templates/product.default.json`
- Modify: `sections/ona-product-information.liquid`
- Test: `tests/cart_theme_regression_test.rb`

**Interfaces:**
- Consumes: `closest.product.selling_plan_groups`, Appstle's injected `.appstle_subscription_wrapper_div`, and existing Horizon product blocks.
- Produces: `[data-ona-subscription-reserve]` with states `loading`, `ready`, and `unavailable`; `#ona-product-full-details`; a 45-word purchase summary.

- [ ] **Step 1: Confirm PDP assertions are RED**

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: failure begins with `PDP compact summary is not capped at 45 words`.

- [ ] **Step 2: Create the subscription reservation block**

Create `blocks/ona-subscription-reserve.liquid`:

```liquid
{% if closest.product.selling_plan_groups.size > 0 %}
  <div class="ona-subscription-reserve" data-ona-subscription-reserve data-state="loading" role="status" aria-live="polite">
    <span class="ona-subscription-reserve__label">Loading subscription options…</span>
  </div>
  <script src="{{ 'ona-subscription-reserve.js' | asset_url }}" type="module" fetchpriority="low"></script>
{% endif %}

{% stylesheet %}
  .ona-subscription-reserve { min-block-size: 136px; display: grid; place-items: center; padding: 16px; border: 1px dashed color-mix(in srgb, currentColor 40%, transparent); }
  .ona-subscription-reserve[data-state='ready'] { display: none; }
  .ona-subscription-reserve[data-state='unavailable'] { min-block-size: 136px; }
  .ona-subscription-reserve__label { font-size: .875rem; text-align: center; }
  @media (max-width: 749px) { .ona-subscription-reserve { min-block-size: 148px; } }
{% endstylesheet %}

{% schema %}
{ "name": "ONA subscription reserve", "tag": null, "settings": [] }
{% endschema %}
```

- [ ] **Step 3: Observe Appstle without controlling it**

Create `assets/ona-subscription-reserve.js`. For each reservation node:

- Find its nearest `.product-details`.
- If `.appstle_subscription_wrapper_div` already exists, set `data-state="ready"` and clear its status text.
- Otherwise observe that product-details subtree with `MutationObserver`.
- Disconnect and mark ready when the Appstle wrapper appears.
- After `8000` ms, disconnect, set `data-state="unavailable"`, and replace text with `Subscription options are temporarily unavailable`. Do not disable or alter any form control.
- Guard initialization with `reserve.dataset.initialized` so repeated module execution is harmless.

- [ ] **Step 4: Compact the product description in the JSON template**

In `templates/product.default.json`, replace the current full-description text setting:

```liquid
{{ closest.product.description }}
```

with:

```liquid
<p>{{ closest.product.description | strip_html | truncatewords: 45 }}</p><p><a href="#ona-product-full-details">Read full details</a></p>
```

Add an `ona-subscription-reserve` theme block immediately after the variant/quantity group and before `buy_buttons_eYQEYi`. Use JSON block type `ona-subscription-reserve` and a stable ID `ona_subscription_reserve`.

- [ ] **Step 5: Add the long-form anchor and compact control layout**

In `sections/ona-product-information.liquid`, add `id="ona-product-full-details"` to the first long-form content region after the primary product-information section. Replace the current inline quantity/variant display rules with a scoped responsive grid:

```css
.product-top .product-details-container .qty-options-row,
.product-top .product-details .qty-options-row {
  display: grid;
  grid-template-columns: minmax(120px, auto) minmax(0, 1fr);
  gap: 12px;
  align-items: end;
}
.product-top .product-details-container :is(.quantity-component, .variant-option__button-label),
.product-top .product-details :is(.quantity-component, .variant-option__button-label) {
  min-height: 44px;
}
.product-top .product-details-container add-to-cart-component .button,
.product-top .product-details add-to-cart-component .button { min-height: 48px; width: 100%; }
@media (max-width: 749px) {
  .product-top .product-details-container .qty-options-row,
  .product-top .product-details .qty-options-row { grid-template-columns: 1fr; }
}
```

Do not override Appstle's prices, radio state, selling-plan inputs, or request logic.

- [ ] **Step 6: Run PDP checks**

```bash
node --check assets/ona-subscription-reserve.js
ruby tests/cart_theme_regression_test.rb
shopify theme check --path . --fail-level error
```

Expected: JavaScript syntax passes, regression prints `PASS: storefront theme regressions`, and Theme Check adds no errors in the new block, product template, or product section.

- [ ] **Step 7: Commit the PDP unit**

```bash
git add blocks/ona-subscription-reserve.liquid assets/ona-subscription-reserve.js templates/product.default.json sections/ona-product-information.liquid
git commit -m "feat: stabilize compact subscription purchase panel"
```

---

### Task 8: Verify Branch Integrity and Prepare Draft-Theme Validation

**Files:**
- Verify: all files changed by Tasks 1–7
- Do not modify: `main`

**Interfaces:**
- Consumes: complete commit sequence on `staging`.
- Produces: clean, pushed `staging` suitable for an unpublished Shopify draft theme.

- [ ] **Step 1: Run the complete local gate**

```bash
ruby -c tests/cart_theme_regression_test.rb
ruby tests/cart_theme_regression_test.rb
node --check assets/script.js
node --check assets/script.min.js
node --check assets/ona-product-card.js
node --check assets/ona-subscription-reserve.js
shopify theme check --path . --fail-level error
git diff --check main...staging
```

Expected: Ruby syntax OK, storefront regression PASS, all JavaScript syntax checks pass, no new Theme Check errors in modified files, and no whitespace errors.

- [ ] **Step 2: Confirm required app embeds and main baseline**

```bash
ruby -rjson -e 'j=JSON.parse(File.read("config/settings_data.json")); types=j.fetch("current").fetch("blocks").values.reject { |b| b["disabled"] }.map { |b| b["type"] }; abort unless types.any? { |t| t.include?("qikify-upsell") }; abort unless types.any? { |t| t.include?("appstle-subscription") }; puts "PASS: Qikify and Appstle enabled"'
git rev-parse main
git rev-parse origin/main
```

Expected: app check passes; both main refs remain `621b9ae57995a45196220eab6b110fc0fd9f1061`.

- [ ] **Step 3: Review scope and commit sequence**

```bash
git diff --stat main...staging
git log --oneline main..staging
```

Expected: only approved specs/plans, regression harness, cart stability, quick-cart, card, slideshow, and PDP files are present; commits remain independently reversible.

- [ ] **Step 4: Push staging only**

```bash
git push origin staging
```

Expected: remote `staging` advances; `main` is not pushed.

- [ ] **Step 5: Execute the unpublished draft-theme matrix**

After the user connects GitHub `staging` to a Shopify draft theme, validate and record:

1. Cards for the same product on homepage, collection, search, and recommendations at 375, 768, 1024, and 1440 px.
2. No visible card outline/surface/shadow; two-line titles do not move selectors or CTAs.
3. Simple, complex-option, sale, unlabeled, and sold-out card states.
4. Hero CTA padding, focus, long labels, hover, and reduced motion.
5. Empty and populated header cart clicks open the drawer; JavaScript-disabled fallback reaches `/cart`.
6. Add from all approved contexts opens or refreshes the same drawer.
7. Qikify gift qualification/removal preserves unrelated lines and causes no duplicate theme mutation.
8. PDP with Appstle normal, throttled, blocked, and absent; one-time purchase stays functional.
9. Chrome Performance recording confirms no visible zero-height Appstle jump and representative page CLS remains below 0.1.

- [ ] **Step 6: Record draft-theme-only findings without publishing**

If a live integration failure is found, record its exact URL, viewport, steps, expected result, actual result, console output, and network requests. When the failure can be represented by repository source or deterministic browser automation, add that failing regression before the fix. Commit the focused fix separately on `staging`, rerun Tasks 8.1–8.5, and leave the theme unpublished for user approval.
