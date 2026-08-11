const reserves = document.querySelectorAll('[data-ona-subscription-reserve]');

reserves.forEach((reserve) => {
  if (reserve.dataset.initialized === 'true') return;

  reserve.dataset.initialized = 'true';

  const productDetails = reserve.closest('.product-details');
  const label = reserve.querySelector('.ona-subscription-reserve__label');
  let observer;
  let timeoutId;

  const markReady = () => {
    window.clearTimeout(timeoutId);
    observer?.disconnect();
    reserve.dataset.state = 'ready';

    if (label) label.textContent = '';
  };

  const markUnavailable = () => {
    observer?.disconnect();
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

  observer = new MutationObserver(() => {
    if (productDetails.querySelector('.appstle_subscription_wrapper_div')) markReady();
  });

  observer.observe(productDetails, { childList: true, subtree: true });
  timeoutId = window.setTimeout(markUnavailable, 8000);
});
