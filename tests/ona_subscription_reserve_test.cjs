const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const listeners = new Map();
const observers = [];
const timers = new Map();
const clearedTimers = [];
const documentReserves = [];
let globalObserver;
let timerId = 0;

function createReserve({
  loadingLabel = 'Cargando opciones de suscripción…',
  productDetailsPresent = true,
  unavailableLabel = 'Las opciones de suscripción no están disponibles temporalmente.',
  wrapperInitially = false,
} = {}) {
  const label = { textContent: loadingLabel };
  let wrapperPresent = wrapperInitially;

  const details = {
    querySelector: () => (wrapperPresent ? {} : null),
  };

  const reserve = {
    dataset: { loadingLabel, state: 'loading', unavailableLabel },
    isConnected: true,
    matches: (selector) => selector === '[data-ona-subscription-reserve]',
    closest: () => (productDetailsPresent ? details : null),
    querySelector: () => label,
    querySelectorAll: () => [],
  };

  return {
    details,
    label,
    reserve,
    hideWrapper() {
      wrapperPresent = false;
    },
    revealWrapper() {
      wrapperPresent = true;
      reserve.observer?.callback([{ addedNodes: [{}], removedNodes: [] }]);
    },
  };
}

function createRoot(reserves) {
  return {
    matches: () => false,
    querySelectorAll: (selector) => (selector === '[data-ona-subscription-reserve]' ? reserves : []),
  };
}

const documentRoot = createRoot(documentReserves);
documentRoot.documentElement = documentRoot;
documentRoot.addEventListener = (name, callback) => {
  const callbacks = listeners.get(name) || [];
  callbacks.push(callback);
  listeners.set(name, callbacks);
};

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    observers.push(this);
  }

  observe(target, options) {
    this.target = target;
    this.options = options;
    if (target === documentRoot) {
      globalObserver = this;
      return;
    }

    const reserve = allReserves.find((entry) => entry.details === target);
    if (reserve) reserve.reserve.observer = this;
  }

  disconnect() {
    this.disconnected = true;
  }
}

const allReserves = [];
const windowObject = {
  clearTimeout(id) {
    clearedTimers.push(id);
    timers.delete(id);
  },
  setTimeout(callback, delay) {
    assert.equal(delay, 8000);
    timerId += 1;
    timers.set(timerId, callback);
    return timerId;
  },
};

const context = vm.createContext({
  document: documentRoot,
  MutationObserver: FakeMutationObserver,
  window: windowObject,
});

function evaluateModule() {
  vm.runInContext(`(() => { ${source}\n})()`, context);
}

function dispatch(name, target) {
  for (const listener of listeners.get(name) || []) listener({ target });
}

function morph({ added = [], removed = [] }) {
  globalObserver.callback([{ addedNodes: added.map((entry) => entry.reserve), removedNodes: removed.map((entry) => entry.reserve) }]);
}

// Initially ineligible: the module still installs one document observer and lifecycle listeners.
evaluateModule();
assert.ok(globalObserver, 'module does not observe combined-listing morphs');
assert.equal(globalObserver.options.childList, true);
assert.equal(globalObserver.options.subtree, true);
assert.equal(listeners.get('shopify:section:load')?.length, 1);
assert.equal(listeners.get('shopify:section:unload')?.length, 1);
assert.equal(timers.size, 0);

evaluateModule();
assert.equal(listeners.get('shopify:section:load').length, 1, 'module re-evaluation adds a load listener');
assert.equal(listeners.get('shopify:section:unload').length, 1, 'module re-evaluation adds an unload listener');
assert.equal(observers.filter((observer) => observer.target === documentRoot).length, 1, 'module re-evaluation adds a document observer');

// Combined listing ineligible -> eligible: a reserve introduced by morph initializes.
const eligible = createReserve();
allReserves.push(eligible);
documentReserves.push(eligible.reserve);
morph({ added: [eligible] });
assert.equal(eligible.reserve.dataset.initialized, 'true');
assert.equal(eligible.reserve.observer.options.childList, true);
assert.equal(eligible.reserve.observer.options.subtree, true);
assert.equal(timers.size, 1);

eligible.revealWrapper();
assert.equal(eligible.reserve.dataset.state, 'ready');
assert.equal(eligible.label.textContent, '');
assert.equal(eligible.reserve.observer.disconnected, true);
assert.equal(timers.size, 0);

// Combined listing eligible -> eligible: old lifecycle is cleaned and replacement starts fresh.
const replacement = createReserve();
allReserves.push(replacement);
eligible.reserve.isConnected = false;
documentReserves.splice(documentReserves.indexOf(eligible.reserve), 1, replacement.reserve);
morph({ added: [replacement], removed: [eligible] });
assert.equal(eligible.reserve.dataset.initialized, undefined);
assert.equal(replacement.reserve.dataset.initialized, 'true');
assert.equal(timers.size, 1);

// A ready reserve whose Appstle subtree is removed in-place is reset by the global lifecycle observer.
replacement.revealWrapper();
replacement.hideWrapper();
morph({ added: [], removed: [] });
assert.equal(replacement.reserve.dataset.state, 'loading');
assert.equal(replacement.label.textContent, replacement.reserve.dataset.loadingLabel);
assert.equal(timers.size, 1);

// Theme-editor section load/unload remains supported and cleans observers/timers.
const loaded = createReserve();
allReserves.push(loaded);
const loadedRoot = createRoot([loaded.reserve]);
const timersBeforeLoad = new Set(timers.keys());
dispatch('shopify:section:load', loadedRoot);
assert.equal(loaded.reserve.dataset.initialized, 'true');
const loadedTimerId = [...timers.keys()].find((id) => !timersBeforeLoad.has(id));
dispatch('shopify:section:unload', loadedRoot);
assert.equal(loaded.reserve.observer.disconnected, true);
assert.equal(clearedTimers.includes(loadedTimerId), true);
assert.equal(loaded.reserve.dataset.initialized, undefined);

// Timeout uses the localized label supplied by Liquid, never an English JS literal.
const timedOut = createReserve();
allReserves.push(timedOut);
const timersBeforeTimeoutReserve = new Set(timers.keys());
dispatch('shopify:section:load', createRoot([timedOut.reserve]));
const timeoutId = [...timers.keys()].find((id) => !timersBeforeTimeoutReserve.has(id));
timers.get(timeoutId)();
assert.equal(timedOut.reserve.dataset.state, 'unavailable');
assert.equal(timedOut.label.textContent, timedOut.reserve.dataset.unavailableLabel);
assert.equal(timedOut.reserve.observer.disconnected, true);

console.log('PASS: subscription reserve morph and section lifecycle');
