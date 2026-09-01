import { ThemeEvents } from '@theme/events';
import { morph } from '@theme/morph';

/**
 * Collection-card price sync.
 *
 * Root cause: this theme's product-price.js updates a card's price by matching
 * product-price[data-block-id=...] inside the HTML fetched from the Section
 * Rendering API (section_id=section-rendering-product-card, wired up in
 * variant-picker.js's SECTION_ID_MAP for swatches-variant-picker-component).
 * That reference section (sections/section-rendering-product-card.liquid) renders
 * a bare <product-price> with no data-block-id at all, so the selector never
 * matches, updatePrice() returns early, and the card's price silently stays on
 * whichever variant was selected when the page first rendered.
 *
 * That's native Horizon plumbing shared with the real product page (where it
 * works, because the page's own <product-price> always carries a real
 * data-block-id). Patching it to also work for cards means either changing the
 * stock reference section to fabricate a matching block id (no reliable way to
 * compute one from outside the block's own section) or reworking variant-picker.js's
 * fetch/morph path itself -- both touch fragile core theme JS shared by every
 * variant picker on the site; a prior attempt at the direct fix broke the picker
 * (dropdown markup got destroyed on first use).
 *
 * This listener sidesteps all of that without touching any core file: it listens
 * for the same variant:update event product-price.js already listens for, and
 * morphs the card's own price container from the same fetched HTML -- just
 * matched by DOM proximity (event.target.closest('product-card')) instead of the
 * data-block-id product-price.js relies on.
 *
 * Two earlier versions of this fix instead hand-rolled the price/compare-price/
 * unit-price update from per-pill data attributes computed at Liquid render
 * time. That duplicated snippets/price.liquid's own formatting logic (and got
 * it wrong twice -- a stale-text-node bug and a currency-formatting bug, both
 * Codex-caught) and was fundamentally racy for multi-option products, since a
 * pill's rendered price attribute only reflects what the OTHER options were set
 * to at render time, not whatever the shopper has changed them to since.
 *
 * Reading the price straight out of the fetched HTML sidesteps all three
 * problems at once: it's the exact same server-rendered markup
 * snippets/price.liquid produces for the real product page (zero duplicated
 * formatting logic to get wrong), and variant:update only fires once
 * fetchUpdatedSection's own request has resolved with the FINAL settled variant
 * for the complete current option combination (its #abortController already
 * cancels/ignores stale in-flight requests), so this can't show a value for a
 * combination that no longer matches what's actually selected.
 *
 * Purely additive -- it runs alongside the native mechanism, which still
 * handles everything else (buy-button availability, swatch state, the real
 * product page) exactly as before.
 */
document.addEventListener(ThemeEvents.variantUpdate, (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const card = target.closest('product-card');
  if (!card) return;

  const priceContainer = card.querySelector('product-price [ref="priceContainer"]');
  if (!priceContainer) return;

  const newHtml = event.detail?.data?.html;
  const newPriceContainer = newHtml?.querySelector?.('product-price [ref="priceContainer"]');
  if (!newPriceContainer) return;

  morph(priceContainer, newPriceContainer, { childrenOnly: true });
});
