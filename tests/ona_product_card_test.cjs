const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const listeners = new Map();
const emittedEvents = [];
const navigations = [];
let drawerCartItems = null;
let fetchImplementation = async () => {
  throw new Error('unexpected fetch');
};
let fetchCalls = [];

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }
  add(value) {
    this.values.add(value);
  }
  remove(value) {
    this.values.delete(value);
  }
  contains(value) {
    return this.values.has(value);
  }
  toggle(value, force) {
    if (force === undefined) force = !this.values.has(value);
    force ? this.values.add(value) : this.values.delete(value);
    return force;
  }
}

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeInput extends FakeElement {
  constructor() {
    super();
    this.checked = false;
    this.value = '';
  }
  matches(selector) {
    return selector === '[data-card-radio]';
  }
}

class FakeForm extends FakeElement {
  matches(selector) {
    return selector === '[data-card-form]';
  }
}

class FakeCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles;
    this.detail = options.detail;
  }
}

class FakeFormData {
  constructor(form) {
    this.form = form;
    this.values = new Map();

    const selectedRadio = form.cardState?.radios.find((radio) => radio.checked && !radio.disabled);
    const variantId = selectedRadio?.value || form.cardState?.variantInput?.value;
    if (variantId) this.values.set('id', variantId);
  }
  get(key) {
    return this.values.get(key) ?? null;
  }
  set(key, value) {
    this.values.set(key, value);
  }
}

const documentRoot = {
  addEventListener(name, callback) {
    const callbacks = listeners.get(name) || [];
    callbacks.push(callback);
    listeners.set(name, callbacks);
  },
  dispatchEvent(event) {
    emittedEvents.push(event);
    return true;
  },
  querySelector(selector) {
    if (selector === 'cart-items-component[data-drawer][data-section-id]') return drawerCartItems;
    return null;
  },
};

const context = vm.createContext({
  console: { error() {} },
  CustomEvent: FakeCustomEvent,
  DOMParser: class {
    parseFromString(html) {
      return {
        querySelector(selector) {
          if (selector !== '[ref="cartItemCount"]') return null;
          const match = html.match(/data-count="(\d+)"/);
          return match ? { textContent: match[1] } : null;
        },
      };
    }
  },
  document: documentRoot,
  Element: FakeElement,
  fetch: async (...args) => {
    fetchCalls.push(args);
    return fetchImplementation(...args);
  },
  FormData: FakeFormData,
  HTMLFormElement: FakeForm,
  HTMLInputElement: FakeInput,
  window: {
    location: {
      assign(url) {
        navigations.push(url);
      },
    },
    Shopify: { routes: { root: '/' } },
  },
});

vm.runInContext(source, context);
assert.equal(listeners.get('change')?.length, 1, 'controller must install one delegated change listener');
assert.equal(listeners.get('submit')?.length, 1, 'controller must install one delegated submit listener');

function createCard({ nativeVariantForm = false, productId = 'product-1', variantId = 'variant-1' } = {}) {
  const addToCart = new FakeElement();
  addToCart.textContent = 'Agregar al carrito';
  const comparePrice = new FakeElement();
  comparePrice.hidden = true;
  const compareValue = new FakeElement();
  const currentPrice = new FakeElement();
  const error = new FakeElement();
  error.hidden = true;
  const optionValue = new FakeElement();
  const priceContainer = new FakeElement();
  const variantInput = new FakeInput();
  variantInput.value = variantId;
  const radios = [];

  const selectors = new Map([
    ['[data-card-atc]', addToCart],
    ['[data-card-compare-price]', comparePrice],
    ['[data-card-compare-value]', compareValue],
    ['[data-card-current-price]', currentPrice],
    ['[data-card-error]', error],
    ['[data-card-opt-value]', optionValue],
    ['[data-card-price]', priceContainer],
  ]);
  if (!nativeVariantForm) selectors.set('[data-card-variant-input]', variantInput);

  const card = new FakeElement();
  card.dataset = {
    labelAddError: 'Error al agregar al carrito',
    labelAddToCart: 'Agregar al carrito',
    labelAdding: 'Agregando…',
    labelSoldOut: 'Agotado',
    productId,
  };
  card.querySelector = (selector) => selectors.get(selector) || null;
  card.querySelectorAll = (selector) => (selector === '[data-card-radio]' ? radios : []);

  const form = new FakeForm();
  form.dataset.cartUrl = '/cart';
  form.closest = (selector) => (selector === '[data-ona-card]' ? card : null);

  const state = { addToCart, card, comparePrice, compareValue, currentPrice, error, form, optionValue, priceContainer, radios, variantInput: nativeVariantForm ? null : variantInput };
  form.cardState = state;
  return state;
}

function createRadio(cardState, data) {
  const radio = new FakeInput();
  Object.assign(radio.dataset, data);
  radio.value = data.variantId || '';
  radio.closest = (selector) => (selector === '[data-ona-card]' ? cardState.card : null);
  cardState.radios.push(radio);
  return radio;
}

function submitEvent(form) {
  return {
    defaultPrevented: false,
    prevented: 0,
    preventDefault() {
      this.defaultPrevented = true;
      this.prevented += 1;
    },
    target: form,
  };
}

function dispatch(name, event) {
  for (const listener of listeners.get(name) || []) listener(event);
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

function response(count, extra = {}) {
  return {
    ok: true,
    async json() {
      return { id: 'line', sections: { ona_header: `<span ref="cartItemCount" data-count="${count}"></span>` }, ...extra };
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function run() {
  const priceCard = createCard({ nativeVariantForm: true });
  const sale = createRadio(priceCard, {
    variantAvailable: 'true',
    variantCompareAtPrice: '$20.00',
    variantId: 'sale',
    variantOnSale: 'true',
    variantPrice: '$15.00',
    variantTitle: '250 g',
  });
  sale.checked = true;
  dispatch('change', { target: sale });
  assert.equal(new FakeFormData(priceCard.form).get('id'), 'sale');
  assert.equal(priceCard.currentPrice.textContent, '$15.00');
  assert.equal(priceCard.compareValue.textContent, '$20.00');
  assert.equal(priceCard.comparePrice.hidden, false);
  assert.equal(priceCard.priceContainer.classList.contains('price--on-sale'), true);
  assert.equal(priceCard.addToCart.textContent, 'Agregar al carrito');

  const regular = createRadio(priceCard, {
    variantAvailable: 'true',
    variantCompareAtPrice: '',
    variantId: 'regular',
    variantOnSale: 'false',
    variantPrice: '$18.00',
    variantTitle: '1 kg',
  });
  sale.checked = false;
  regular.checked = true;
  dispatch('change', { target: regular });
  assert.equal(new FakeFormData(priceCard.form).get('id'), 'regular');
  assert.equal(priceCard.currentPrice.textContent, '$18.00');
  assert.equal(priceCard.compareValue.textContent, '');
  assert.equal(priceCard.comparePrice.hidden, true);
  assert.equal(priceCard.priceContainer.classList.contains('price--on-sale'), false);

  const fallbackCard = createCard();
  drawerCartItems = null;
  fetchCalls = [];
  const fallbackSubmit = submitEvent(fallbackCard.form);
  dispatch('submit', fallbackSubmit);
  await flush();
  assert.equal(fallbackSubmit.prevented, 0, 'missing drawer must preserve native form submission');
  assert.equal(fetchCalls.length, 0, 'missing drawer must not start AJAX');

  const drawer = { open() {} };
  drawerCartItems = {
    dataset: { sectionId: 'ona_header' },
    closest(selector) {
      return selector === 'cart-drawer-component' ? drawer : null;
    },
  };

  fetchCalls = [];
  emittedEvents.length = 0;
  fetchImplementation = async () => response(1);
  const nativeVariantCard = createCard({ nativeVariantForm: true, variantId: 'initial' });
  const nativeSelected = createRadio(nativeVariantCard, {
    variantAvailable: 'true',
    variantCompareAtPrice: '',
    variantId: 'selected-without-hidden',
    variantOnSale: 'false',
    variantPrice: '$22.00',
    variantTitle: '1 kg',
  });
  nativeSelected.checked = true;
  const nativeSubmit = submitEvent(nativeVariantCard.form);
  const nativeDuplicateSubmit = submitEvent(nativeVariantCard.form);
  dispatch('submit', nativeSubmit);
  dispatch('submit', nativeDuplicateSubmit);
  await flush();
  assert.equal(nativeSubmit.prevented, 1, 'native radio-owned forms must retain AJAX enhancement');
  assert.equal(nativeDuplicateSubmit.prevented, 1, 'a disabled external radio must not let a duplicate native POST escape while AJAX is pending');
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0][1].body.get('id'), 'selected-without-hidden', 'AJAX must snapshot the checked native id before disabling controls');

  const firstRequest = deferred();
  const secondRequest = deferred();
  fetchCalls = [];
  emittedEvents.length = 0;
  fetchImplementation = () => (fetchCalls.length === 1 ? firstRequest.promise : secondRequest.promise);

  const firstCard = createCard({ productId: 'one', variantId: 'v1' });
  const secondCard = createCard({ productId: 'two', variantId: 'v2' });
  const firstSubmit = submitEvent(firstCard.form);
  const secondSubmit = submitEvent(secondCard.form);
  dispatch('submit', firstSubmit);
  dispatch('submit', secondSubmit);
  await flush();
  assert.equal(firstSubmit.prevented, 1);
  assert.equal(secondSubmit.prevented, 1);
  assert.equal(fetchCalls.length, 1, 'global cart mutations must start serially');

  firstRequest.resolve(response(1));
  await flush();
  assert.equal(fetchCalls.length, 2, 'second mutation must start after the first completes');
  secondRequest.resolve(response(2));
  await flush();

  const updates = emittedEvents.filter((event) => event.type === 'cart:update');
  assert.deepEqual(updates.map((event) => event.detail.data.productId), ['one', 'two']);
  assert.deepEqual(updates.map((event) => event.detail.resource.item_count), [1, 2]);

  fetchCalls = [];
  emittedEvents.length = 0;
  navigations.length = 0;
  fetchImplementation = async () => ({
    ok: false,
    async json() {
      return { description: 'No disponible', status: 422 };
    },
  });
  const rejectedCard = createCard();
  dispatch('submit', submitEvent(rejectedCard.form));
  await flush();
  assert.equal(rejectedCard.error.hidden, false);
  assert.equal(rejectedCard.error.textContent, 'No disponible');
  assert.equal(emittedEvents.some((event) => event.type === 'cart:error'), true);
  assert.equal(emittedEvents.some((event) => event.type === 'cart:update'), false);
  assert.equal(navigations.length, 0, 'a confirmed rejection must stay on the product grid');

  fetchCalls = [];
  emittedEvents.length = 0;
  navigations.length = 0;
  fetchImplementation = async () => {
    throw new Error('network result unknown');
  };
  const ambiguousCard = createCard();
  const queuedAfterAmbiguous = createCard({ productId: 'queued', variantId: 'queued-variant' });
  dispatch('submit', submitEvent(ambiguousCard.form));
  dispatch('submit', submitEvent(queuedAfterAmbiguous.form));
  await flush();
  assert.equal(fetchCalls.length, 1, 'an ambiguous result must cancel queued POSTs');
  assert.deepEqual(navigations, ['/cart'], 'an ambiguous result must trigger one cart reconciliation');
  assert.equal(ambiguousCard.error.textContent, 'Error al agregar al carrito');

  console.log('PASS: product card controller behavior');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
