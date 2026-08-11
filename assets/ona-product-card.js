(() => {
  const controllerKey = Symbol.for('ona.productCard.controller');
  if (document[controllerKey]) return;
  document[controllerKey] = true;

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;

    const pill = event.target.closest('[data-card-pill]');
    if (!pill) return;
    if (pill.getAttribute('aria-disabled') === 'true') return;

    const card = pill.closest('[data-ona-card]');
    if (!card) return;

    card.querySelectorAll('[data-card-pill]').forEach((candidate) => {
      const selected = candidate === pill;
      candidate.setAttribute('aria-checked', String(selected));
      candidate.classList.toggle('ona-card__pill--active', selected);
    });

    const variantInput = card.querySelector('[data-card-variant-input]');
    const price = card.querySelector('[data-card-price]');
    const optionValue = card.querySelector('[data-card-opt-value]');
    const addToCart = card.querySelector('[data-card-atc]');
    const available = pill.dataset.variantAvailable === 'true';

    if (variantInput) variantInput.value = pill.dataset.variantId || '';
    if (price) price.textContent = pill.dataset.variantPrice || '';
    if (optionValue) optionValue.textContent = pill.dataset.variantTitle || '';

    card.dataset.variantAvailable = String(available);
    if (addToCart) {
      addToCart.disabled = !available;
      addToCart.setAttribute('aria-disabled', String(!available));
      addToCart.textContent = available ? 'Add to cart' : 'Sold out';
    }
  });

  document.addEventListener('submit', async (event) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-card-form]')) return;
    if (event.defaultPrevented) return;

    event.preventDefault();

    const form = event.target;
    const card = form.closest('[data-ona-card]');
    const variantInput = card?.querySelector('[data-card-variant-input]');
    const addToCart = card?.querySelector('[data-card-atc]');

    if (!card || !variantInput || !addToCart || form.dataset.cardSubmitting === 'true') return;

    form.dataset.cardSubmitting = 'true';
    const originalLabel = addToCart.textContent;
    const originallyDisabled = addToCart.disabled;
    const submittedVariantId = variantInput.value;
    const pills = card.querySelectorAll('[data-card-pill]');

    card.setAttribute('aria-busy', 'true');
    pills.forEach((pill) => {
      pill.disabled = true;
    });
    addToCart.disabled = true;
    addToCart.setAttribute('aria-disabled', 'true');
    addToCart.textContent = 'Adding…';

    const formData = new FormData(form);
    formData.set('sections', 'ona_header');

    try {
      const request = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
        credentials: 'same-origin',
      });
      const response = await request.json();

      if (!request.ok || (response.status && response.status >= 400)) {
        throw new Error(response.description || response.message || 'Unable to add this item to the cart.');
      }

      document.dispatchEvent(
        new CustomEvent('cart:add', {
          bubbles: true,
          detail: { resource: response, sourceId: submittedVariantId },
        })
      );
      document.dispatchEvent(
        new CustomEvent('cart:update', {
          bubbles: true,
          detail: {
            resource: response,
            sourceId: submittedVariantId,
            data: { sections: response.sections || {} },
          },
        })
      );
    } catch (error) {
      console.error('[ONA product card]', error);
    } finally {
      delete form.dataset.cardSubmitting;
      card.removeAttribute('aria-busy');
      pills.forEach((pill) => {
        pill.disabled = pill.getAttribute('aria-disabled') === 'true';
      });
      addToCart.disabled = originallyDisabled;
      addToCart.setAttribute('aria-disabled', String(originallyDisabled));
      addToCart.textContent = originalLabel;
    }
  });
})();
