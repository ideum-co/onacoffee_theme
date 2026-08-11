const reserveSelector = '[data-ona-subscription-reserve]';
const appstleSelector = '.appstle_subscription_wrapper_div';
const controllerKey = Symbol.for('ona.subscriptionReserve.controller');

function createSubscriptionReserveController() {
  const resources = new WeakMap();
  const activeReserves = new Set();

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

    activeReserves.delete(reserve);
    if (resetInitialized) delete reserve.dataset.initialized;
  }

  function setLoadingState(reserve) {
    reserve.dataset.state = 'loading';
    const label = reserve.querySelector('.ona-subscription-reserve__label');
    if (label) label.textContent = reserve.dataset.loadingLabel || '';
  }

  function initializeReserve(reserve) {
    if (reserve.dataset.initialized === 'true') return;

    reserve.dataset.initialized = 'true';
    const productDetails = reserve.closest('.product-details');
    const label = reserve.querySelector('.ona-subscription-reserve__label');
    const resource = { observer: null, productDetails, timeoutId: null };
    resources.set(reserve, resource);
    activeReserves.add(reserve);

    const markReady = () => {
      stopWatching(reserve);
      reserve.dataset.state = 'ready';
      if (label) label.textContent = '';
    };

    const markUnavailable = () => {
      if (resource.timeoutId) {
        window.clearTimeout(resource.timeoutId);
        resource.timeoutId = null;
      }
      reserve.dataset.state = 'unavailable';
      if (label) label.textContent = reserve.dataset.unavailableLabel || '';
    };

    if (!productDetails) {
      markUnavailable();
      return;
    }

    if (productDetails.querySelector(appstleSelector)) {
      markReady();
      return;
    }

    resource.observer = new MutationObserver(() => {
      if (!reserve.isConnected) {
        stopWatching(reserve, { resetInitialized: true });
        return;
      }

      if (productDetails.querySelector(appstleSelector)) markReady();
    });

    resource.observer.observe(productDetails, { childList: true, subtree: true });
    resource.timeoutId = window.setTimeout(markUnavailable, 8000);
  }

  function restartReserve(reserve) {
    stopWatching(reserve, { resetInitialized: true });
    setLoadingState(reserve);
    initializeReserve(reserve);
  }

  function initializeWithin(root) {
    reservesWithin(root).forEach(initializeReserve);
  }

  function cleanupWithin(root) {
    reservesWithin(root).forEach((reserve) => stopWatching(reserve, { resetInitialized: true }));
  }

  function reconcileDocument() {
    activeReserves.forEach((reserve) => {
      if (!reserve.isConnected) stopWatching(reserve, { resetInitialized: true });
    });

    reservesWithin(document).forEach((reserve) => {
      const productDetails = reserve.closest('.product-details');
      const resource = resources.get(reserve);
      const wrapperPresent = Boolean(productDetails?.querySelector(appstleSelector));

      if (resource && resource.productDetails !== productDetails) {
        restartReserve(reserve);
      } else if (wrapperPresent && reserve.dataset.state !== 'ready') {
        restartReserve(reserve);
      } else if (!wrapperPresent && reserve.dataset.state === 'ready') {
        restartReserve(reserve);
      } else if (reserve.dataset.state === 'loading' && !resource) {
        restartReserve(reserve);
      } else {
        initializeReserve(reserve);
      }
    });
  }

  function handleDocumentMutations(records) {
    records.forEach((record) => {
      record.removedNodes?.forEach((node) => cleanupWithin(node));
    });
    reconcileDocument();
  }

  return { cleanupWithin, handleDocumentMutations, initializeWithin, reconcileDocument };
}

let controller = window[controllerKey];

if (!controller) {
  controller = createSubscriptionReserveController();
  window[controllerKey] = controller;

  document.addEventListener('shopify:section:load', (event) => controller.initializeWithin(event.target));
  document.addEventListener('shopify:section:unload', (event) => controller.cleanupWithin(event.target));

  const morphObserver = new MutationObserver(controller.handleDocumentMutations);
  morphObserver.observe(document.documentElement, { childList: true, subtree: true });
}

controller.initializeWithin(document);
