const reserveSelector = '[data-ona-subscription-reserve]';
const controllerKey = Symbol.for('ona.subscriptionReserve.controller');

function createSubscriptionReserveController() {
  const resources = new WeakMap();

  function reservesWithin(root) {
    if (!root) return [];

    const reserves = [];

    if (root.matches?.(reserveSelector)) reserves.push(root);
    root.querySelectorAll?.(reserveSelector).forEach((reserve) => reserves.push(reserve));

    return reserves;
  }

  function stopWatching(reserve, { resetInitialized = false } = {}) {
    const resource = resources.get(reserve);

    if (resource) {
      window.clearTimeout(resource.timeoutId);
      resource.observer?.disconnect();
      resources.delete(reserve);
    }

    if (resetInitialized) delete reserve.dataset.initialized;
  }

  function initializeReserve(reserve) {
    if (reserve.dataset.initialized === 'true') return;

    reserve.dataset.initialized = 'true';

    const productDetails = reserve.closest('.product-details');
    const label = reserve.querySelector('.ona-subscription-reserve__label');
    const resource = { observer: null, timeoutId: null };
    resources.set(reserve, resource);

    const markReady = () => {
      stopWatching(reserve);
      reserve.dataset.state = 'ready';

      if (label) label.textContent = '';
    };

    const markUnavailable = () => {
      stopWatching(reserve);
      reserve.dataset.state = 'unavailable';

      if (label) label.textContent = 'Subscription options are temporarily unavailable';
    };

    if (!productDetails) {
      markUnavailable();
      return;
    }

    if (productDetails.querySelector('.appstle_subscription_wrapper_div')) {
      markReady();
      return;
    }

    resource.observer = new MutationObserver(() => {
      if (!reserve.isConnected) {
        stopWatching(reserve, { resetInitialized: true });
        return;
      }

      if (productDetails.querySelector('.appstle_subscription_wrapper_div')) markReady();
    });

    resource.observer.observe(productDetails, { childList: true, subtree: true });
    resource.timeoutId = window.setTimeout(markUnavailable, 8000);
  }

  function initializeWithin(root) {
    reservesWithin(root).forEach(initializeReserve);
  }

  function cleanupWithin(root) {
    reservesWithin(root).forEach((reserve) => stopWatching(reserve, { resetInitialized: true }));
  }

  return { cleanupWithin, initializeWithin };
}

let controller = window[controllerKey];

if (!controller) {
  controller = createSubscriptionReserveController();
  window[controllerKey] = controller;

  document.addEventListener('shopify:section:load', (event) => controller.initializeWithin(event.target));
  document.addEventListener('shopify:section:unload', (event) => controller.cleanupWithin(event.target));
}

controller.initializeWithin(document);
