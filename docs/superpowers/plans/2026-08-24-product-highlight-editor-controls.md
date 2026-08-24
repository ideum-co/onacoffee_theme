# Product Highlight Editor Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separately editable top heading, native typography presets for all supported Product highlight text, and per-instance content-column padding controls.

**Architecture:** Keep Horizon's static-block composition. Add a native `text` static block as the section heading, split `_featured-product` into heading and product-content regions, extend the featured price block to use `typography-style`, and expose four section padding values as scoped CSS variables.

**Tech Stack:** Shopify Liquid, JSON section/block schemas, Horizon typography snippets, CSS custom properties, Node.js static regression tests, Shopify CLI theme validation.

## Global Constraints

- Scope changes to native `Product highlight`; do not modify `ona-featured-product` or unrelated sections.
- Settings apply independently to every section instance.
- Preserve product selection, structured data, media, price updates, swatches, and theme-editor bindings.
- Empty section headings render no element and create no phantom vertical gap.
- Desktop separates the heading at the top from product content below; mobile uses natural flow without forced viewport-height whitespace.
- Existing instances retain 40px desktop and at most 20px mobile content padding by default.
- Use existing Horizon typography field identifiers and `snippets/typography-style.liquid`; do not introduce global typography tokens.

## File map

- Create `tests/product-highlight-editor-controls.test.js`: source-level regression checks for schema, composition, typography, scoping, and responsive safeguards.
- Modify `sections/featured-product.liquid`: section-level padding settings, scoped variables, responsive CSS, and preset configuration for the new heading block.
- Modify `blocks/_featured-product.liquid`: compose the new heading and split the vertical layout into explicit regions.
- Modify `blocks/_featured-product-price.liquid`: support the native `Custom` typography controls and emit typography variables.

---

### Task 1: Section heading and vertical content regions

**Files:**
- Create: `tests/product-highlight-editor-controls.test.js`
- Modify: `blocks/_featured-product.liquid`
- Modify: `sections/featured-product.liquid`

**Interfaces:**
- Consumes: Horizon static blocks through `{% content_for 'block' %}` and blank-text suppression from `snippets/text.liquid`.
- Produces: static block ID `featured-product-heading`; wrappers `.featured-product-heading-region` and `.featured-product-details-region`; `.featured-product-card-layout` as the vertical distribution hook.

- [ ] **Step 1: Write failing composition tests**

Create `tests/product-highlight-editor-controls.test.js` with Node built-ins only:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const section = read('sections/featured-product.liquid');
const productBlock = read('blocks/_featured-product.liquid');
const priceBlock = read('blocks/_featured-product-price.liquid');

assert.match(
  productBlock,
  /content_for 'block', type: 'text', id: 'featured-product-heading'/,
  'Product highlight must compose a native text block for its section heading',
);
assert.match(productBlock, /featured-product-heading-region/);
assert.match(productBlock, /featured-product-details-region/);
assert.match(productBlock, /featured-product-card-layout/);

assert.match(
  section,
  /"featured-product-heading"\s*:\s*\{[\s\S]*?"type"\s*:\s*"text"/,
  'The preset must define the static heading block',
);
assert.match(section, /\.featured-product-card-layout\s*\{[\s\S]*?display:\s*flex/);
assert.match(section, /justify-content:\s*space-between/);
assert.match(
  section,
  /\.featured-product-heading-region:empty\s*\{[\s\S]*?display:\s*none/,
  'Blank headings must not reserve space',
);
```

- [ ] **Step 2: Run the test and verify the new composition is missing**

Run: `node tests/product-highlight-editor-controls.test.js`

Expected: FAIL on `Product highlight must compose a native text block for its section heading`.

- [ ] **Step 3: Split `_featured-product` into two explicit regions**

In `blocks/_featured-product.liquid`, replace the current `product_card_children` capture with:

```liquid
{% capture product_card_children %}
  <div class="featured-product-card-layout">
    <div class="featured-product-heading-region">
      {% content_for 'block', type: 'text', id: 'featured-product-heading' %}
    </div>

    <div class="featured-product-details-region">
      <div class="featured-product-content-top">
        {% content_for 'block', type: 'product-title', id: 'featured-product-title' %}
        {% content_for 'block', type: '_featured-product-price', id: 'featured-product-price' %}
      </div>
      {% content_for 'block', type: '_featured-product-gallery', id: 'featured-product-gallery' %}
      {% if product_has_swatches %}
        <div class="featured-product-content-bottom">
          {%- content_for 'block', type: 'swatches', id: 'featured-product-swatches' -%}
        </div>
      {% endif %}
    </div>
  </div>
{% endcapture %}
```

Keep the existing `product-card` render. Keep `.featured-product-content-top` rules and add only structural rules that are intrinsic to the block:

```css
.featured-product-card-layout,
.featured-product-details-region {
  display: flex;
  flex-direction: column;
}

.featured-product-card-layout {
  flex: 1;
  min-height: 100%;
}

.featured-product-details-region {
  gap: var(--product-card-gap);
}

.featured-product-heading-region:empty {
  display: none;
}
```

- [ ] **Step 4: Register the native text block in the section preset**

In `sections/featured-product.liquid`, add this static block before `featured-product-title` inside the existing `featured-product` preset block:

```json
"featured-product-heading": {
  "type": "text",
  "name": "Section heading",
  "static": true,
  "settings": {
    "text": "<p>Product highlight</p>",
    "type_preset": "h2",
    "width": "100%",
    "max_width": "none"
  }
}
```

Add section-scoped desktop distribution and a mobile reset in the existing stylesheet:

```css
@media screen and (min-width: 750px) {
  .featured-product-section .featured-product-card-layout:has(.featured-product-heading-region:not(:empty)) {
    justify-content: space-between;
  }
}

@media screen and (max-width: 749px) {
  .featured-product-section .featured-product-card-layout {
    min-height: auto;
    gap: var(--gap-xl);
  }
}
```

If Shopify's rendered blank text block leaves an empty wrapper, replace `:empty` with a Liquid boolean class derived from the heading block output; do not use JavaScript.

- [ ] **Step 5: Run the composition tests**

Run: `node tests/product-highlight-editor-controls.test.js`

Expected: PASS through all assertions currently present.

- [ ] **Step 6: Commit the heading layout**

```bash
git add tests/product-highlight-editor-controls.test.js blocks/_featured-product.liquid sections/featured-product.liquid
git commit -m "feat: separate product highlight heading"
```

---

### Task 2: Per-instance content-column padding

**Files:**
- Modify: `tests/product-highlight-editor-controls.test.js`
- Modify: `sections/featured-product.liquid`

**Interfaces:**
- Consumes: section settings `content_padding_top`, `content_padding_bottom`, `content_padding_left`, and `content_padding_right` as integer pixel values.
- Produces: scoped CSS properties `--featured-content-padding-*` on `.featured-product-section`; the content card consumes them through existing `--padding-block` and `--padding-inline` properties.

- [ ] **Step 1: Add failing padding assertions**

Append to `tests/product-highlight-editor-controls.test.js`:

```js
for (const id of [
  'content_padding_top',
  'content_padding_bottom',
  'content_padding_left',
  'content_padding_right',
]) {
  assert.match(section, new RegExp(`"id"\\s*:\\s*"${id}"`), `Missing ${id}`);
}

for (const property of ['top', 'bottom', 'left', 'right']) {
  assert.match(
    section,
    new RegExp(`--featured-content-padding-${property}:\\s*\\{\\{ section\\.settings\\.content_padding_${property} \\}\\}px`),
    `Missing scoped ${property} padding variable`,
  );
}

assert.match(section, /--padding-block:\s*var\(--featured-content-padding-top\) var\(--featured-content-padding-bottom\)/);
assert.match(section, /--padding-inline:\s*var\(--featured-content-padding-left\) var\(--featured-content-padding-right\)/);
assert.match(section, /@media screen and \(max-width: 749px\)[\s\S]*?min\(20px, var\(--featured-content-padding-left\)\)/);
```

- [ ] **Step 2: Run the test and verify settings are missing**

Run: `node tests/product-highlight-editor-controls.test.js`

Expected: FAIL with `Missing content_padding_top`.

- [ ] **Step 3: Add four padding settings**

In the schema of `sections/featured-product.liquid`, add a `Content column padding` header followed by four range settings. Use this exact shape for each setting, changing ID and label:

```json
{
  "type": "range",
  "id": "content_padding_top",
  "label": "Top",
  "min": 0,
  "max": 120,
  "step": 4,
  "unit": "px",
  "default": 40
}
```

Use IDs `content_padding_top`, `content_padding_bottom`, `content_padding_left`, and `content_padding_right`; default all four to `40`.

- [ ] **Step 4: Emit scoped variables and replace fixed padding**

Extend the inline style on `.featured-product-section`:

```liquid
--featured-content-padding-top: {{ section.settings.content_padding_top }}px;
--featured-content-padding-bottom: {{ section.settings.content_padding_bottom }}px;
--featured-content-padding-left: {{ section.settings.content_padding_left }}px;
--featured-content-padding-right: {{ section.settings.content_padding_right }}px;
```

Replace the fixed card padding with logical two-value properties:

```css
.featured-product-section .product-grid__card {
  --padding-block: var(--featured-content-padding-top) var(--featured-content-padding-bottom);
  --padding-inline: var(--featured-content-padding-left) var(--featured-content-padding-right);
}
```

Inside the existing mobile media query, cap each side while preserving merchant values below 20px:

```css
.featured-product-section .product-grid__card {
  --padding-block: min(20px, var(--featured-content-padding-top)) min(20px, var(--featured-content-padding-bottom));
  --padding-inline: min(20px, var(--featured-content-padding-left)) min(20px, var(--featured-content-padding-right));
}
```

- [ ] **Step 5: Run the static test**

Run: `node tests/product-highlight-editor-controls.test.js`

Expected: PASS.

- [ ] **Step 6: Commit scoped padding controls**

```bash
git add tests/product-highlight-editor-controls.test.js sections/featured-product.liquid
git commit -m "feat: add product highlight content padding"
```

---

### Task 3: Custom typography for the featured price

**Files:**
- Modify: `tests/product-highlight-editor-controls.test.js`
- Modify: `blocks/_featured-product-price.liquid`

**Interfaces:**
- Consumes: `type_preset`, `font`, `font_size`, `line_height`, `letter_spacing`, `case`, and `wrap` using the identifiers expected by `snippets/typography-style.liquid`.
- Produces: `custom-typography` and `custom-font-size` classes plus inline CSS variables on `<product-price>`.

- [ ] **Step 1: Add failing featured-price assertions**

Append to `tests/product-highlight-editor-controls.test.js`:

```js
assert.match(priceBlock, /"value"\s*:\s*"custom"/);
for (const id of ['font', 'font_size', 'line_height', 'letter_spacing', 'case', 'wrap']) {
  assert.match(priceBlock, new RegExp(`"id"\\s*:\\s*"${id}"`), `Featured price missing ${id}`);
}
assert.match(priceBlock, /render 'typography-style', settings: block_settings/);
assert.match(priceBlock, /custom-typography/);
assert.match(priceBlock, /block_settings\.type_preset == 'custom'/);
```

- [ ] **Step 2: Run the test and verify Custom is missing**

Run: `node tests/product-highlight-editor-controls.test.js`

Expected: FAIL on the missing `custom` preset.

- [ ] **Step 3: Make the price element consume native typography variables**

Before `<product-price>`, derive classes:

```liquid
{% liquid
  assign price_classes = block_settings.type_preset | default: 'h6'
  if block_settings.type_preset == 'custom'
    assign price_classes = price_classes | append: ' custom-typography'
    if block_settings.font_size != blank
      assign price_classes = price_classes | append: ' custom-font-size'
    endif
  endif
%}
```

Change the element class to `text-right {{ price_classes }} spacing-style` and add this within its existing `style` attribute:

```liquid
{% render 'typography-style', settings: block_settings %}
```

- [ ] **Step 4: Add the `Custom` option and its fields to the price schema**

Add `{"value":"custom","label":"t:options.custom"}` after `h6`. Copy the established field definitions from `blocks/product-title.liquid` for these IDs, without changing values or defaults:

```text
font
font_size
line_height
letter_spacing
case
wrap
```

For every copied field, set `visible_if` to `{{ block.settings.type_preset == 'custom' }}`. Keep the existing sale-price setting and preset options intact.

- [ ] **Step 5: Run tests and Shopify validation**

Run: `node tests/product-highlight-editor-controls.test.js`

Expected: PASS.

Run: `shopify theme check --path .`

Expected: exit code 0 with no new errors in the four changed Liquid files.

- [ ] **Step 6: Commit price typography**

```bash
git add tests/product-highlight-editor-controls.test.js blocks/_featured-product-price.liquid
git commit -m "feat: add custom typography to featured price"
```

---

### Task 4: Responsive and theme-editor verification

**Files:**
- Modify if a verified defect is found: `sections/featured-product.liquid`
- Modify if a verified defect is found: `blocks/_featured-product.liquid`
- Modify if a verified defect is found: `blocks/_featured-product-price.liquid`
- Test: `tests/product-highlight-editor-controls.test.js`

**Interfaces:**
- Consumes: the completed section in Shopify preview/editor.
- Produces: verification evidence that all acceptance criteria work together; no new public interface.

- [ ] **Step 1: Run all automated validation from a clean diff**

Run:

```bash
node tests/product-highlight-editor-controls.test.js
shopify theme check --path .
git diff --check
```

Expected: all commands exit 0; Theme Check reports no new errors in Product highlight files.

- [ ] **Step 2: Verify the empty-heading state**

Start a development preview with `shopify theme dev`, add Product highlight, clear the section-heading text, and inspect desktop and mobile.

Expected: no heading DOM content, no reserved top region, no large empty mobile gap, and existing product content remains visible.

- [ ] **Step 3: Verify presets and instance isolation**

Create two Product highlight instances. In the first, choose Heading 2 for the section heading, Heading 4 for product title, and Paragraph for price. In the second, choose Custom for all three and select visibly different font roles and sizes.

Expected: each item changes independently; the second instance does not change the first; global presets remain unchanged.

- [ ] **Step 4: Verify desktop distribution and padding**

Set heading text, then set top/bottom/left/right padding to `8/24/40/56`.

Expected: the heading remains at the top of the content column, the product detail region sits below it, and DevTools computed padding matches the four selected values on desktop.

- [ ] **Step 5: Verify mobile behavior and product regressions**

At 390px viewport width, select variants/swatches and inspect product title, price, media order, and horizontal overflow.

Expected: media remains first; content follows natural flow; each padding side is capped at 20px; selected swatches still update displayed price/media; no horizontal scrollbar appears.

- [ ] **Step 6: Record only verification-driven fixes and commit**

If verification requires changes, add a focused regression assertion before each fix, rerun all commands from Step 1, and commit:

```bash
git add tests/product-highlight-editor-controls.test.js sections/featured-product.liquid blocks/_featured-product.liquid blocks/_featured-product-price.liquid
git commit -m "fix: harden product highlight editor controls"
```

If no fixes are required, do not create an empty commit.
