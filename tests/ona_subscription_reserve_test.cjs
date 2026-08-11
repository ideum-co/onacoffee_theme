const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const listeners = new Map();
const observers = [];
const timers = new Map();
const clearedTimers = [];
let timerId = 0;

function createReserve({ wrapperInitially = false, productDetailsPresent = true } = {}) {
  const label = { textContent: 'Loading subscription options…' };
  let wrapperPresent = wrapperInitially;

  const details = {
    querySelector: () => (wrapperPresent ? {} : null),
  };

  const reserve = {
    dataset: {},
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
    revealWrapper() {
      wrapperPresent = true;
      reserve.observer.callback();
    },
  };
}

function createRoot(reserves) {
  return {
    matches: () => false,
    querySelectorAll: (selector) => (selector === '[data-ona-subscription-reserve]' ? reserves : []),
  };
}

const initial = createReserve();
const documentRoot = createRoot([initial.reserve]);
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
    const reserve = [initial, ...dynamicReserves].find((entry) => entry.details === target);
    if (reserve) reserve.reserve.observer = this;
  }

  disconnect() {
    this.disconnected = true;
  }
}

const dynamicReserves = [];
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

evaluateModule();
assert.equal(initial.reserve.dataset.initialized, 'true');
assert.equal(initial.reserve.observer.options.childList, true);
assert.equal(initial.reserve.observer.options.subtree, true);
assert.equal(timers.size, 1);
assert.equal(listeners.get('shopify:section:load')?.length, 1);
assert.equal(listeners.get('shopify:section:unload')?.length, 1);

evaluateModule();
assert.equal(listeners.get('shopify:section:load').length, 1, 'module re-evaluation adds a load listener');
assert.equal(listeners.get('shopify:section:unload').length, 1, 'module re-evaluation adds an unload listener');
assert.equal(observers.length, 1, 'module re-evaluation adds an observer');
assert.equal(timers.size, 1, 'module re-evaluation adds a timer');

const loaded = createReserve();
dynamicReserves.push(loaded);
const loadedRoot = createRoot([loaded.reserve]);
dispatch('shopify:section:load', loadedRoot);
assert.equal(loaded.reserve.dataset.initialized, 'true');
assert.equal(timers.size, 2);

const loadedTimerId = [...timers.keys()].find((id) => id !== 1);
dispatch('shopify:section:unload', loadedRoot);
assert.equal(loaded.reserve.observer.disconnected, true);
assert.equal(clearedTimers.includes(loadedTimerId), true);
assert.equal(loaded.reserve.dataset.initialized, undefined);

const replacement = createReserve();
dynamicReserves.push(replacement);
dispatch('shopify:section:load', createRoot([replacement.reserve]));
assert.equal(replacement.reserve.dataset.initialized, 'true');
replacement.revealWrapper();
assert.equal(replacement.reserve.dataset.state, 'ready');
assert.equal(replacement.reserve.observer.disconnected, true);
assert.equal(replacement.label.textContent, '');

initial.reserve.isConnected = false;
initial.reserve.observer.callback();
assert.equal(initial.reserve.observer.disconnected, true);
assert.equal(clearedTimers.includes(1), true);

const timedOut = createReserve();
dynamicReserves.push(timedOut);
dispatch('shopify:section:load', createRoot([timedOut.reserve]));
const timeoutId = [...timers.keys()][0];
timers.get(timeoutId)();
assert.equal(timedOut.reserve.dataset.state, 'unavailable');
assert.equal(timedOut.label.textContent, 'Subscription options are temporarily unavailable');
assert.equal(timedOut.reserve.observer.disconnected, true);

console.log('PASS: subscription reserve lifecycle');
