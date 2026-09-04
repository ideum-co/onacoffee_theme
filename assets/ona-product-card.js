/**
 * ONA Product Card — shared variant picker + AJAX Add to Cart.
 *
 * Consolidates what used to be two separate, drifting implementations:
 * snippets/ona-product-card-atc.liquid's inline <script type="module"> (used
 * by search results + PDP recommendations) and ona-featured-collection.liquid's
 * own inline {% javascript %} block (home page) — same behavior, copy-pasted
 * twice, with real bugs fixed independently (and inconsistently) in each copy
 * over time. This is now the single source of truth, loaded once globally.
 *
 * Operates on the shared data-attribute contract every surface's card markup
 * already uses: [data-ona-card] wraps a card, [data-card-variant] is a native
 * radio input per size option (selected via a real HTML5 radio group — Tab
 * lands on the checked option, arrow keys move between them, same as any
 * native radio group), [data-card-pill] is that option's visible label,
 * [data-card-price]/[data-card-price-wrap]/[data-card-opt-value]/[data-card-atc]
 * are the parts of the card that update on selection, [data-card-form] is the
 * add-to-cart form.
 */
import { CartAddEvent } from '@theme/events';

// window.__onaAutoOpenCart is set from the real `auto_open_cart_drawer`
// theme setting by an inline <script> in layout/theme.liquid, rendered
// before this module loads (a plain JS asset can't read Liquid settings
// itself). Fall back to false -- the setting's own default -- only if that
// inline setter is somehow missing.
window.__onaAutoOpenCart = window.__onaAutoOpenCart ?? false;

(function () {
  function openCartDrawer() {
    var drawer = document.querySelector('cart-drawer-component');
    if (drawer && typeof drawer.open === 'function') {
      drawer.open();
      return;
    }
    var trigger = document.querySelector('[data-testid="cart-drawer-trigger"]');
    trigger && trigger.click();
  }

  function onVariantChange(radio) {
    var card = radio.closest('[data-ona-card]');
    if (!card) return;

    var pills = card.querySelectorAll('[data-card-pill]');
    var priceEl = card.querySelector('[data-card-price]');
    var priceWrap = card.querySelector('[data-card-price-wrap]');
    var optVal = card.querySelector('[data-card-opt-value]');
    var atc = card.querySelector('[data-card-atc]');
    // A card can have more than one link to the product (e.g. home's cards
    // have a separate image link and title link) -- update all of them, not
    // just the first found.
    var cardLinks = card.querySelectorAll('[data-product-link]');
    var productUrl = null;
    cardLinks.forEach(function (link) {
      if (!link.dataset.productUrl) link.dataset.productUrl = link.getAttribute('href');
      if (!productUrl) productUrl = link.dataset.productUrl;
    });

    pills.forEach(function (pill) {
      var isActive = pill.htmlFor === radio.id;
      pill.classList.toggle('ona-pc__pill--active', isActive);
      pill.classList.toggle('ona-fc__pill--active', isActive);
      pill.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    // The card's product link(s) never reflected the selected variant --
    // clicking through after picking a size always landed on the default
    // variant instead of the one just chosen. Rebuild each link's query
    // string (not just append) so repeated selections replace the `variant`
    // param instead of accumulating duplicates. A card can have more than
    // one link to the same product (e.g. home's image link + title link) --
    // update all of them.
    cardLinks.forEach(function (link) {
      var url = link.dataset.productUrl;
      if (!url) return;
      var linkParts = url.split('?');
      var linkParams = new URLSearchParams(linkParts[1] || '');
      linkParams.set('variant', radio.value);
      link.href = linkParts[0] + '?' + linkParams.toString();
    });

    // The Add to cart button acts on the specific variant just picked, so
    // showing a different size's price next to it is misleading. Swap in
    // this radio's own pre-formatted, already money-filtered price.
    if (priceEl && radio.dataset.variantPrice) priceEl.textContent = radio.dataset.variantPrice;

    // The compare-at ("was $X") price and on-sale styling are per-VARIANT,
    // not per-product -- a variant with a different sale state than the one
    // Liquid rendered by default needs its strikethrough price rebuilt (or
    // dropped) to match on every selection, not just the price.
    if (priceWrap) {
      var variantOnSale = radio.dataset.variantOnSale === 'true';
      priceWrap.classList.toggle('price--on-sale', variantOnSale);
      var compareEl = priceWrap.querySelector('.price-item--compare');
      if (variantOnSale && radio.dataset.variantComparePrice) {
        if (!compareEl) {
          compareEl = document.createElement('span');
          compareEl.className = 'price-item price-item--compare';
          compareEl.appendChild(document.createElement('s'));
          priceWrap.appendChild(compareEl);
        }
        compareEl.querySelector('s').textContent = radio.dataset.variantComparePrice;
      } else if (compareEl) {
        compareEl.remove();
      }
    }

    if (optVal) optVal.textContent = radio.dataset.variantTitle || '';

    var available = radio.dataset.variantAvailable === 'true';
    if (atc) {
      atc.disabled = !available;
      atc.textContent = available ? (card.dataset.addLabel || 'Add to cart') : (card.dataset.soldOutLabel || 'Sold out');
    }
  }

  function onSubmit(form) {
    var card = form.closest('[data-ona-card]');
    if (!card) return;
    var atc = card.querySelector('[data-card-atc]');
    if (!atc || atc.disabled || atc.dataset.pending === 'true') return;

    atc.dataset.pending = 'true';
    atc.classList.add('is-loading');
    var label = atc.textContent;
    atc.textContent = card.dataset.addingLabel || 'Adding…';

    var checkedRadio = card.querySelector('[data-card-variant]:checked');
    var variantId = checkedRadio ? checkedRadio.value : (new FormData(form)).get('id');
    var quantityAdded = 1;

    var body = new URLSearchParams();
    body.append('id', variantId || '');
    body.append('quantity', String(quantityAdded));
    body.append('sections', 'ona_header');

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
      credentials: 'same-origin',
    })
      .then(function (r) {
        return r.ok ? r.json() : r.json().then(function (err) { throw err; });
      })
      .then(function (resp) {
        atc.textContent = 'Added ✓';

        // /cart/add.js does not return item_count, so the real cart must be
        // fetched separately to get an accurate total before dispatching.
        fetch('/cart.js', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .catch(function () { return { item_count: undefined }; })
          .then(function (cart) {
            // Dispatch a real CartAddEvent (not a plain CustomEvent) so
            // listeners that check `event instanceof CartAddEvent` (the
            // native theme class from @theme/events, same one
            // product-form-component uses) actually see this add.
            //
            // The badge is actually kept correct by cart-items-component's
            // #handleCartUpdate (assets/component-cart-items.js), which is
            // registered on `document` for this same event and morphs the
            // ENTIRE ona_header section back in from the fresh, real
            // server-rendered HTML in `sections['ona_header']` -- so badge
            // correctness comes from Liquid re-rendering `cart.item_count`
            // server-side, not from any client-side math. That's why
            // `itemCount` here is the quantity just added (a delta), matching
            // the same contract product-form.js and the proven-correct
            // ona-product-card-atc.liquid both use: `source:
            // 'product-form-component'` only matters to assets/cart-icon.js,
            // which this theme's header never actually loads.
            // `sections: resp.sections || {}` must be forwarded from the
            // real /cart/add.js response for that morph to fire; without it,
            // cart-items-component falls back to an async section refetch,
            // which is slower but still eventually correct.
            document.dispatchEvent(
              new CartAddEvent(cart, variantId || '', {
                source: 'product-form-component',
                sections: resp.sections || {},
                itemCount: quantityAdded,
              })
            );
          });

        if (window.__onaAutoOpenCart) setTimeout(openCartDrawer, 120);
        setTimeout(function () {
          atc.textContent = label;
          atc.classList.remove('is-loading');
        }, 1500);
      })
      .catch(function (err) {
        atc.textContent = (err && err.description) || card.dataset.errorLabel || 'Error';
        atc.classList.remove('is-loading');
        setTimeout(function () {
          atc.textContent = label;
        }, 2000);
      })
      .finally(function () {
        atc.dataset.pending = 'false';
      });
  }

  document.addEventListener('change', function (event) {
    var target = event.target;
    if (target.matches && target.matches('[data-card-variant]')) onVariantChange(target);
  });

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (form.matches && form.matches('[data-card-form]')) {
      event.preventDefault();
      onSubmit(form);
    }
  });
})();
