# Product Highlight Editor Controls — Design

## Objective

Extend the native Horizon `Product highlight` section so merchants can control typography and internal spacing per section instance, while preserving the existing product selection, media, variants, and responsive behavior.

The custom legacy `ona-featured-product` section and unrelated theme sections are outside this change.

## Current architecture

- `sections/featured-product.liquid` owns the two-column section layout and its Shopify schema.
- `blocks/_featured-product.liquid` composes the product title, price, gallery, and swatches inside the content column.
- Text blocks such as `blocks/product-title.liquid` already support Horizon typography presets and custom typography through `snippets/typography-style.liquid`.
- The content column currently receives fixed responsive padding from CSS in `sections/featured-product.liquid`.

The implementation should extend these native patterns instead of introducing a second typography system.

## Editor model

### Section heading

Add an optional merchant-authored heading to `Product highlight`. This heading is distinct from the selected product's title and occupies its own top region in the content column. An empty value renders no heading or empty spacing.

Its typography uses the theme's native preset model:

- Default
- Paragraph
- Heading 1 through Heading 6
- Custom

When `Custom` is selected, the existing Horizon custom controls are exposed: font family role, size, weight where supported, line height, letter spacing, case, and wrapping. Global presets continue to be edited in Theme settings.

### Product text items

Existing text-bearing child blocks retain or receive the same native preset behavior rather than section-specific font pickers. At minimum, the product title and price remain independently configurable. Any text item already implemented as an editable Horizon block keeps its own settings and defaults.

Non-text items such as media, swatches, and controls do not receive typography settings.

### Content-column padding

Add four per-instance range settings for the content column:

- Top
- Bottom
- Left
- Right

The settings produce scoped CSS custom properties on the section instance. Defaults reproduce the current effective spacing: 20px on small screens and 40px on desktop. The implementation may use responsive defaults or a documented mobile clamp so existing sections do not visually regress.

## Layout behavior

The content column is divided into two vertical regions:

1. The optional section heading at the top.
2. The existing product content group below it.

On desktop, the column uses a full-height vertical flex layout. When the section heading exists, the regions use `justify-content: space-between`, placing the heading at the top and the product content toward the bottom, matching the supplied reference. When the heading is empty, the product content remains naturally aligned without a phantom gap.

The product title stays inside the product content group; it is not confused with the new section heading. Existing internal relationships among title, price, gallery, and swatches remain intact.

On mobile, media keeps its current first position. The content column remains readable in normal document flow; it does not force viewport-height whitespace. Padding values are constrained as needed to prevent excessive narrow-screen spacing.

## Scoping and compatibility

- Settings apply independently to every `Product highlight` instance.
- CSS selectors are scoped beneath the section's existing classes or a section-specific identifier.
- Existing saved instances continue rendering with backward-compatible defaults.
- No global typography tokens are changed.
- `ona-featured-product`, product templates, and other sections are not modified.
- Product selection, structured data, quick-add support, swatches, and theme-editor bindings remain functional.

## Implementation boundaries

Prefer a small reusable snippet or the existing text rendering/typography snippets for the new heading. Do not duplicate the large custom typography schema if an existing shared block or schema-compatible pattern can provide it cleanly. If Shopify static-block constraints prevent direct reuse, mirror the established Horizon field identifiers so `typography-style` can consume them without new CSS logic.

The content distribution belongs in `_featured-product.liquid`; per-instance padding values and the outer two-column layout belong in `featured-product.liquid`.

## Validation

The implementation plan must include:

- Shopify theme/schema validation.
- A render check with no section heading.
- A render check with a heading using a global preset.
- A render check with `Custom` typography.
- Independent typography checks for product title and price.
- Desktop verification of the separated top/bottom regions.
- Mobile verification of media order, natural content flow, and safe padding.
- Regression checks for product selection, price, media, and swatches.

## Acceptance criteria

1. A merchant can add or remove the section heading without editing code.
2. The heading and each supported product text item can use native typography presets, including `Custom`.
3. The heading sits at the top of the content column and the remaining content can sit at the bottom on desktop.
4. Top, bottom, left, and right content-column padding are configurable per section instance.
5. Multiple `Product highlight` instances can use different typography and padding.
6. Existing instances remain visually stable with default settings.
7. Mobile layout contains no forced empty vertical region or horizontal overflow.
8. Theme validation passes and existing product functionality is preserved.
