(() => {
  const controllerKey = Symbol.for('ona.productCard.controller');
  if (document[controllerKey]) return;

  let mutationQueue = Promise.resolve();
  let reconciliationPending = false;

  function resolveDrawerContext() {
    const cartItems = document.querySelector('cart-items-component[data-drawer][data-section-id]');
    const drawer = cartItems?.closest('cart-drawer-component');
    const sectionId = cartItems?.dataset.sectionId;

    if (!sectionId || !drawer || typeof drawer.open !== 'function') return null;

    return { sectionId };
  }

  function clearError(card) {
    const error = card.querySelector('[data-card-error]');
    if (!error) return;

    error.hidden = true;
    error.textContent = '';
  }

  function showError(card, sourceId, message) {
    const error = card.querySelector('[data-card-error]');
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }

    document.dispatchEvent(
      new CustomEvent('cart:error', {
        bubbles: true,
        detail: {
          sourceId,
          data: { description: message, errors: null, message },
        },
      })
    );
  }

  function updateVariant(radio) {
    if (!radio.checked || radio.disabled) return;

    const card = radio.closest('[data-ona-card]');
    if (!card) return;

    const addToCart = card.querySelector('[data-card-atc]');
    const comparePrice = card.querySelector('[data-card-compare-price]');
    const compareValue = card.querySelector('[data-card-compare-value]');
    const currentPrice = card.querySelector('[data-card-current-price]');
    const optionValue = card.querySelector('[data-card-opt-value]');
    const price = card.querySelector('[data-card-price]');
    const variantInput = card.querySelector('[data-card-variant-input]');
    const available = radio.dataset.variantAvailable === 'true';
    const onSale = radio.dataset.variantOnSale === 'true';

    card.querySelectorAll('[data-card-radio]').forEach((candidate) => {
      const label = candidate.labels?.[0];
      label?.classList.toggle('ona-card__pill--active', candidate === radio);
    });

    if (variantInput) variantInput.value = radio.dataset.variantId || '';
    if (currentPrice) currentPrice.textContent = radio.dataset.variantPrice || '';
    if (compareValue) compareValue.textContent = onSale ? radio.dataset.variantCompareAtPrice || '' : '';
    if (comparePrice) comparePrice.hidden = !onSale;
    if (optionValue) optionValue.textContent = radio.dataset.variantTitle || '';
    price?.classList.toggle('price--on-sale', onSale);

    card.dataset.variantAvailable = String(available);
    clearError(card);

    if (addToCart) {
      addToCart.disabled = !available;
      addToCart.setAttribute('aria-disabled', String(!available));
      addToCart.textContent = available ? card.dataset.labelAddToCart || '' : card.dataset.labelSoldOut || '';
    }
  }

  function setSubmittingState(card, form, submitting) {
    const addToCart = card.querySelector('[data-card-atc]');
    const radios = card.querySelectorAll('[data-card-radio]');

    if (!addToCart) return;

    if (submitting) {
      form.dataset.cardSubmitting = 'true';
      card.setAttribute('aria-busy', 'true');
      radios.forEach((radio) => {
        radio.disabled = true;
      });
      addToCart.disabled = true;
      addToCart.setAttribute('aria-disabled', 'true');
      addToCart.textContent = card.dataset.labelAdding || '';
      return;
    }

    delete form.dataset.cardSubmitting;
    card.removeAttribute('aria-busy');
    radios.forEach((radio) => {
      radio.disabled = radio.dataset.variantAvailable !== 'true';
    });

    const available = card.dataset.variantAvailable !== 'false';
    addToCart.disabled = !available;
    addToCart.setAttribute('aria-disabled', String(!available));
    addToCart.textContent = available ? card.dataset.labelAddToCart || '' : card.dataset.labelSoldOut || '';
  }

  async function parseResponse(request, fallbackMessage) {
    let response;

    try {
      response = await request.json();
    } catch (cause) {
      throw Object.assign(new Error(fallbackMessage, { cause }), { ambiguous: true });
    }

    if (!request.ok || (response.status && response.status >= 400)) {
      throw Object.assign(new Error(response.description || response.message || fallbackMessage), { ambiguous: false });
    }

    return response;
  }

  function navigateToCart(form) {
    const cartUrl = form.dataset.cartUrl || `${window.Shopify.routes.root}cart`;
    window.location.assign(cartUrl);
  }

  async function performMutation({ card, form, sectionId, submittedVariantId }) {
    const fallbackMessage = card.dataset.labelAddError || '';
    let ambiguous = false;

    if (reconciliationPending) {
      setSubmittingState(card, form, false);
      return;
    }

    const formData = new FormData(form);
    formData.set('sections', sectionId);

    try {
      let request;
      try {
        request = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: formData,
          credentials: 'same-origin',
        });
      } catch (cause) {
        throw Object.assign(new Error(fallbackMessage, { cause }), { ambiguous: true });
      }

      const response = await parseResponse(request, fallbackMessage);
      const sections = response.sections || {};
      const drawerSectionHtml = sections[sectionId];
      if (typeof drawerSectionHtml !== 'string') {
        throw Object.assign(new Error(fallbackMessage), { ambiguous: true });
      }

      const sectionDocument = new DOMParser().parseFromString(drawerSectionHtml, 'text/html');
      const itemCountText = sectionDocument.querySelector('[ref="cartItemCount"]')?.textContent?.trim() || '';
      const itemCount = Number.parseInt(itemCountText, 10);
      if (!Number.isFinite(itemCount)) {
        throw Object.assign(new Error(fallbackMessage), { ambiguous: true });
      }

      const resource = { ...response, item_count: itemCount };
      document.dispatchEvent(
        new CustomEvent('cart:update', {
          bubbles: true,
          detail: {
            resource,
            sourceId: submittedVariantId,
            data: {
              source: 'ona-product-card',
              productId: card.dataset.productId,
              variantId: submittedVariantId,
              itemCount,
              sections,
            },
          },
        })
      );
    } catch (error) {
      ambiguous = error?.ambiguous === true;
      showError(card, submittedVariantId, error?.message || fallbackMessage);

      if (ambiguous) {
        reconciliationPending = true;
        navigateToCart(form);
      } else {
        console.error('[ONA product card]', error);
      }
    } finally {
      if (!ambiguous) setSubmittingState(card, form, false);
    }
  }

  function handleChange(event) {
    if (!(event.target instanceof HTMLInputElement) || !event.target.matches('[data-card-radio]')) return;
    updateVariant(event.target);
  }

  function handleSubmit(event) {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-card-form]')) return;
    if (event.defaultPrevented) return;

    const form = event.target;
    const card = form.closest('[data-ona-card]');
    const variantInput = card?.querySelector('[data-card-variant-input]');
    const addToCart = card?.querySelector('[data-card-atc]');
    const drawerContext = resolveDrawerContext();

    // Keep Shopify's native POST/navigation when the drawer cannot consume the AJAX response.
    if (!card || !variantInput || !addToCart || !drawerContext) return;

    event.preventDefault();
    if (form.dataset.cardSubmitting === 'true') return;

    clearError(card);
    setSubmittingState(card, form, true);

    const mutation = {
      card,
      form,
      sectionId: drawerContext.sectionId,
      submittedVariantId: variantInput.value,
    };

    mutationQueue = mutationQueue.then(() => performMutation(mutation), () => performMutation(mutation));
  }

  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);
  document[controllerKey] = { handleChange, handleSubmit };
})();
