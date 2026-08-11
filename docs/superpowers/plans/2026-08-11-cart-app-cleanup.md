# Cart and App Integration Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize cart removal and checkout behavior on `staging` while preserving Qikify and keeping `main` unchanged.

**Architecture:** Shopify's `CartItemsComponent` becomes the only theme-owned cart mutation path. Legacy jQuery cart removal and inferred preorder blocking are removed; Shopify cart prices, discounts, and installed app validations remain authoritative. Static Ruby regressions protect the integration contract, followed by Shopify theme validation and a manual draft-theme matrix.

**Tech Stack:** Shopify Liquid, ES modules, legacy jQuery source, Ruby regression script, Terser 5.43.1, Shopify CLI Theme Check, Git.

## Global Constraints

- Work only on the `staging` branch; do not modify or merge `main`.
- Qikify Upsell remains enabled and supported.
- Do not bulk-disable app embeds in this phase.
- Do not publish a Shopify theme.
- Do not identify cart lines by a fixed variant ID.
- Exactly one theme-owned cart mutation may result from a completed remove action.
- Gift-card recipient properties must never disable checkout.
- Every independently reversible behavior change receives its own commit.

---

## File Structure

- Create `tests/cart_theme_regression_test.rb`: dependency-free assertions over Liquid and JavaScript source/minified artifacts.
- Modify `assets/script.js`: remove legacy cart mutation and obsolete preorder-popup initialization.
- Regenerate `assets/script.min.js`: production artifact generated from `assets/script.js` without identifier mangling.
- Modify `sections/ona-cart-template.liquid`: use the native cart action only, remove inferred preorder checkout blocking, fixed gift ID, forced free pricing, and obsolete popup markup.
- Modify `docs/superpowers/specs/2026-08-11-cart-app-cleanup-design.md` only if implementation evidence contradicts the approved design.

### Task 1: Add Cart Integration Regression Harness

**Files:**
- Create: `tests/cart_theme_regression_test.rb`
- Inspect: `sections/ona-cart-template.liquid`
- Inspect: `assets/script.js`
- Inspect: `assets/script.min.js`

**Interfaces:**
- Consumes: repository files as UTF-8 text.
- Produces: a zero-dependency test command, `ruby tests/cart_theme_regression_test.rb`, returning exit 0 only when all cart integration invariants hold.

- [ ] **Step 1: Write the failing regression test**

Create `tests/cart_theme_regression_test.rb` with:

```ruby
# frozen_string_literal: true

ROOT = File.expand_path('..', __dir__)

def read_repo(path)
  File.read(File.join(ROOT, path))
end

def assert(condition, message)
  raise "FAIL: #{message}" unless condition
end

cart = read_repo('sections/ona-cart-template.liquid')
source = read_repo('assets/script.js')
minified = read_repo('assets/script.min.js')

assert(!source.include?('function customCartRemove'), 'legacy customCartRemove function remains in script.js')
assert(!source.match?(/\bcustomCartRemove\s*\(\s*\)/), 'legacy customCartRemove startup call remains in script.js')
assert(!minified.include?('customCartRemove'), 'legacy customCartRemove remains in script.min.js')
assert(!source.include?("url:'/cart/change.js'"), 'legacy jQuery cart/change request remains')

remove_buttons = cart.scan(%r{<button[^>]+on:click="/onLineItemRemove/\{\{ item\.index \| plus: 1 \}\}"[^>]*>})
assert(remove_buttons.length == 1, 'cart must expose exactly one native remove-button action template')
assert(!cart.include?('data-item-id="{{ item.id }}"'), 'cart row still exposes variant ID for legacy removal')

assert(!cart.include?('assign preorder_count'), 'inferred preorder counter remains')
assert(!cart.include?('assign normal_count'), 'mixed-cart normal counter remains')
assert(!cart.match?(/<input\s+disabled\s+type="submit"\s+name="checkout"/), 'checkout can still be hard-disabled')
assert(!cart.include?('preorder-tips-popup'), 'obsolete preorder popup remains')
assert(!source.include?('function preorderProduct'), 'obsolete preorder popup JavaScript remains')
assert(!minified.include?('preorderProduct'), 'obsolete preorder popup JavaScript remains minified')

assert(!cart.include?('40126200709311'), 'gift behavior still depends on a fixed variant ID')
assert(!cart.include?('assign is_gift'), 'fixed gift classification remains')
assert(!cart.match?(/if\s+is_gift.*?Free/m), 'theme still forces a cart line to display Free')

checkout_controls = cart.scan(/<input\s+type="submit"\s+name="checkout"/)
assert(checkout_controls.length == 1, 'cart must render exactly one enabled checkout control template')

puts 'PASS: cart theme integration regressions'
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: exit 1, beginning with `FAIL: legacy customCartRemove function remains in script.js`.

- [ ] **Step 3: Verify the test file itself is valid Ruby**

Run:

```bash
ruby -c tests/cart_theme_regression_test.rb
```

Expected: `Syntax OK`.

- [ ] **Step 4: Commit the failing regression harness**

```bash
git add tests/cart_theme_regression_test.rb
git commit -m "test: capture cart integration regressions"
```

### Task 2: Remove the Duplicate Legacy Cart Mutation

**Files:**
- Modify: `assets/script.js:1465-1484`
- Modify: `assets/script.js:1570`
- Regenerate: `assets/script.min.js`
- Test: `tests/cart_theme_regression_test.rb`

**Interfaces:**
- Consumes: remove buttons using `on:click="/onLineItemRemove/{{ item.index | plus: 1 }}"`.
- Produces: one theme-owned `/cart/change.js` mutation through `CartItemsComponent`; global JavaScript contains no `customCartRemove` function or call.

- [ ] **Step 1: Confirm the focused test currently fails for duplicate mutation**

Run:

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: `FAIL: legacy customCartRemove function remains in script.js`.

- [ ] **Step 2: Remove the legacy function and startup call**

In `assets/script.js`, delete the entire `function customCartRemove() { ... }` block and delete this statement from the document-ready callback:

```javascript
customCartRemove();
```

Do not change the native `on:click` action in the Liquid template.

- [ ] **Step 3: Regenerate the minified production artifact without mangling**

Run:

```bash
npx --yes terser@5.43.1 assets/script.js --compress drop_console=true --output assets/script.min.js
```

Expected: exit 0. Omitting `--mangle` preserves the theme's established no-mangle constraint.

- [ ] **Step 4: Run focused artifact checks**

Run:

```bash
! rg -n "customCartRemove|data:\s*\{\s*quantity:\s*0,\s*id:" assets/script.js assets/script.min.js
node --check assets/script.js
node --check assets/script.min.js
```

Expected: the negated `rg` check and both Node checks exit 0.

- [ ] **Step 5: Run the full regression test**

Run:

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: the previous `customCartRemove` failure is gone; the test now fails at `cart row still exposes variant ID for legacy removal` or the next cart-template invariant.

- [ ] **Step 6: Commit the single-mutation fix**

```bash
git add assets/script.js assets/script.min.js
git commit -m "fix: use one cart line removal flow"
```

### Task 3: Remove Inferred Preorder Blocking and Fixed Gift Logic

**Files:**
- Modify: `sections/ona-cart-template.liquid:29-32,74-91,114-115,169-195,219-231`
- Modify: `assets/script.js:1435-1463,1571`
- Regenerate: `assets/script.min.js`
- Test: `tests/cart_theme_regression_test.rb`

**Interfaces:**
- Consumes: Shopify line prices, final prices, discount allocations, and native item index.
- Produces: one enabled checkout control for non-empty carts; no property-based preorder inference; no hard-coded gift variant behavior; no unused preorder popup JavaScript.

- [ ] **Step 1: Confirm the regression test is still RED for cart-template behavior**

Run:

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: exit 1 on a remaining cart-template invariant.

- [ ] **Step 2: Remove the fixed gift classification**

In `sections/ona-cart-template.liquid`:

- Delete the `is_gift` assignment and comparison with `40126200709311`.
- Remove `data-item-id="{{ item.id }}"` from the cart row.
- Render the Remove button for every removable line; keep Shopify's `item.instructions.can_update_quantity` behavior for quantity controls.
- Replace the price conditional so `item.original_price`, `item.final_price`, and discount allocations determine the display.
- Render `item.final_line_price` without a forced `Free` branch.
- Delete the fixed-ID CSS rule.

- [ ] **Step 3: Replace mixed-preorder checkout markup with one enabled control**

Delete the `normal_count` / `preorder_count` property scan and both branches. Render exactly:

```liquid
<input type="submit" name="checkout" class="cart__submit btn btn--small-wide" value="Check out">
```

Delete the `.preorder-tips-popup` markup because no active business rule has been confirmed.

- [ ] **Step 4: Remove obsolete preorder popup JavaScript**

In `assets/script.js`, delete the entire `preorderProduct()` function and its document-ready call:

```javascript
preorderProduct();
```

- [ ] **Step 5: Regenerate and syntax-check the production artifact**

Run:

```bash
npx --yes terser@5.43.1 assets/script.js --compress drop_console=true --output assets/script.min.js
node --check assets/script.js
node --check assets/script.min.js
```

Expected: all commands exit 0.

- [ ] **Step 6: Run regression tests and verify GREEN**

Run:

```bash
ruby tests/cart_theme_regression_test.rb
```

Expected: `PASS: cart theme integration regressions`.

- [ ] **Step 7: Run Shopify Theme Check on modified theme files**

Run:

```bash
shopify theme check --path . --fail-level error
```

Expected: no new error references `sections/ona-cart-template.liquid`, `assets/script.js`, or `assets/script.min.js`. Existing unrelated locale translation findings may remain and must be reported separately.

- [ ] **Step 8: Commit checkout and gift cleanup**

```bash
git add sections/ona-cart-template.liquid assets/script.js assets/script.min.js
git commit -m "fix: stop gift properties blocking checkout"
```

### Task 4: Verify Branch Integrity and Publish Staging Changes

**Files:**
- Verify: all files modified in Tasks 1–3
- Update only if validation evidence requires it: `docs/superpowers/specs/2026-08-11-cart-app-cleanup-design.md`

**Interfaces:**
- Consumes: complete staging commit series.
- Produces: a clean `staging` branch on GitHub, ahead of `main`, suitable for Shopify draft-theme connection.

- [ ] **Step 1: Run the complete local verification gate**

Run:

```bash
ruby -c tests/cart_theme_regression_test.rb
ruby tests/cart_theme_regression_test.rb
node --check assets/script.js
node --check assets/script.min.js
git diff --check main...staging
```

Expected: Ruby syntax OK, regression PASS, both JavaScript checks exit 0, and no whitespace errors.

- [ ] **Step 2: Review the branch diff for scope**

Run:

```bash
git diff --stat main...staging
git diff main...staging -- sections/ona-cart-template.liquid assets/script.js tests/cart_theme_regression_test.rb
```

Expected: only the approved specification, regression harness, cart template, and global script artifacts changed.

- [ ] **Step 3: Confirm main remains at the baseline**

Run:

```bash
git rev-parse main
git rev-parse origin/main
```

Expected: both resolve to `621b9ae57995a45196220eab6b110fc0fd9f1061`.

- [ ] **Step 4: Push staging**

Run:

```bash
git push origin staging
```

Expected: `staging -> staging`; no push to `main`.

- [ ] **Step 5: Report the manual draft-theme validation matrix**

Hand off these required cases after the user connects `staging` to an unpublished Shopify theme:

1. Coffee only.
2. Gift card sent to self.
3. Personalized gift card.
4. Personalized gift card plus coffee.
5. Coffee qualifying for Qikify gift.
6. Remove the Qikify trigger product.
7. Remove an unrelated product while Qikify conditions remain valid.
8. Change quantities while observing Network requests.

For cases 5–8, the acceptance criterion is one theme-owned cart mutation per completed user action; subsequent Qikify reconciliation requests are allowed and must not clear unrelated lines.
