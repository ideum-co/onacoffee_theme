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
 * (dropdown markup got destroyed on first use). This listener sidesteps all of
 * that: each pill already carries the money-formatted price for its own variant
 * (snippets/variant-main-picker.liquid), so on selection this just writes that
 * value into the card's own price display directly. Purely additive -- it runs
 * alongside the native mechanism, which still handles everything else (buy-button
 * availability, swatch state, the real product page) exactly as before.
 */
function updateUnitPrice(priceContainer, radio) {
  const unitPriceText = radio.dataset.variantUnitPrice || '';
  let unitPriceEl = priceContainer.querySelector('.unit-price');

  if (!unitPriceText) {
    // This variant has no unit price (e.g. mixed catalog) -- remove any stale
    // one left over from a previously selected variant that did have one.
    if (unitPriceEl) unitPriceEl.remove();
    return;
  }

  if (!unitPriceEl) {
    // The initially selected variant had no unit price, so price.liquid never
    // rendered the element at all. Build the same markup snippets/unit-price.liquid
    // would, using the a11y label carried on the pill itself.
    unitPriceEl = document.createElement('small');
    unitPriceEl.className = 'unit-price';
    const label = document.createElement('span');
    label.className = 'visually-hidden';
    label.textContent = radio.dataset.unitPriceA11yLabel || '';
    unitPriceEl.appendChild(label);
    unitPriceEl.appendChild(document.createTextNode(''));
    priceContainer.appendChild(unitPriceEl);
  }

  // Keep the visually-hidden label node intact; only the trailing text node
  // (the actual "$X.XX/unit" string) needs updating.
  const textNode = Array.from(unitPriceEl.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = unitPriceText;
  } else {
    unitPriceEl.appendChild(document.createTextNode(unitPriceText));
  }
}

function updateCardPrice(radio) {
  if (!(radio instanceof HTMLInputElement) || radio.dataset.variantPrice === undefined) return;

  const card = radio.closest('product-card');
  if (!card) return;

  const priceContainer = card.querySelector('product-price [ref="priceContainer"]');
  if (!priceContainer) return;

  const regularPrice = priceContainer.querySelector('.price__regular .price');
  const salePriceEl = priceContainer.querySelector('.price__sale .price-item--sale.price');
  const compareEl = priceContainer.querySelector('.price__sale .compare-at-price');
  const regularWrap = priceContainer.querySelector('.price__regular');
  const saleWrap = priceContainer.querySelector('.price__sale');

  const onSale = radio.dataset.variantOnSale === 'true';
  const price = radio.dataset.variantPrice;
  const comparePrice = radio.dataset.variantComparePrice;

  if (regularPrice) regularPrice.textContent = price;
  if (onSale && comparePrice) {
    if (salePriceEl) salePriceEl.textContent = price;
    if (compareEl) compareEl.textContent = comparePrice;
  }

  if (regularWrap) regularWrap.classList.toggle('price__hidden', onSale);
  if (saleWrap) saleWrap.classList.toggle('price__hidden', !onSale);

  updateUnitPrice(priceContainer, radio);
}

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.type === 'radio' && target.closest('product-card')) {
    updateCardPrice(target);
  }
});
