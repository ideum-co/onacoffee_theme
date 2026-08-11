const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs
  .readFileSync(process.argv[2], 'utf8')
  .replace(/^import .*;$/gm, '');

class FakeMouseEvent {
  constructor({ altKey = false, button = 0, ctrlKey = false, defaultPrevented = false, metaKey = false, shiftKey = false } = {}) {
    this.altKey = altKey;
    this.button = button;
    this.ctrlKey = ctrlKey;
    this.defaultPrevented = defaultPrevented;
    this.metaKey = metaKey;
    this.shiftKey = shiftKey;
    this.prevented = 0;
  }

  preventDefault() {
    this.defaultPrevented = true;
    this.prevented += 1;
  }
}

class FakeDialogElement {}

class FakeDialogComponent {
  constructor() {
    this.isConnected = true;
    this.refs = { dialog: new FakeDialogElement() };
    this.showDialogCalls = 0;
  }

  addEventListener() {}
  removeEventListener() {}
  hasAttribute() {
    return false;
  }
  showDialog() {
    this.showDialogCalls += 1;
  }
}

let CartDrawerComponent;
const context = vm.createContext({
  AbortController,
  CartAddEvent: { eventName: 'cart:update' },
  DialogCloseEvent: { eventName: 'dialog:close' },
  DialogComponent: FakeDialogComponent,
  DialogOpenEvent: { eventName: 'dialog:open' },
  HTMLDialogElement: FakeDialogElement,
  MouseEvent: FakeMouseEvent,
  Theme: { translations: { cart_count: 'Cart' } },
  console,
  customElements: {
    define(_name, constructor) {
      CartDrawerComponent = constructor;
    },
    get() {
      return undefined;
    },
    whenDefined() {
      return Promise.resolve();
    },
  },
  document: {
    addEventListener() {},
    querySelector() {
      return null;
    },
    removeEventListener() {},
  },
  history: {
    back() {},
    pushState() {},
    replaceState() {},
    state: null,
  },
  isMobileBreakpoint() {
    return false;
  },
  window: {
    addEventListener() {},
  },
});

vm.runInContext(source, context);
assert.ok(CartDrawerComponent, 'cart drawer custom element was not defined');

function exercise(eventOptions, { operational = true } = {}) {
  const drawer = new CartDrawerComponent();
  if (!operational) drawer.refs.dialog = null;

  const event = new FakeMouseEvent(eventOptions);
  drawer.open(event);

  return { drawer, event };
}

const primary = exercise();
assert.equal(primary.event.prevented, 1, 'an operational drawer must cancel a plain primary click');
assert.equal(primary.drawer.showDialogCalls, 1, 'an operational drawer must open for a plain primary click');

for (const eventOptions of [{ button: 1 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }]) {
  const modified = exercise(eventOptions);
  assert.equal(modified.event.prevented, 0, 'modified/non-primary navigation must retain its browser default');
  assert.equal(modified.drawer.showDialogCalls, 0, 'modified/non-primary navigation must not open the drawer');
}

const unavailable = exercise({}, { operational: false });
assert.equal(unavailable.event.prevented, 0, 'an unavailable drawer must retain the link fallback');
assert.equal(unavailable.drawer.showDialogCalls, 0, 'an unavailable drawer must not attempt to open');

console.log('PASS: cart drawer progressive enhancement');
