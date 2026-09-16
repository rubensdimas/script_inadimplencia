import "@testing-library/jest-dom";

// Recharts measures its container with ResizeObserver and getBoundingClientRect.
// jsdom does not implement layout, so without this every chart renders at 0x0 and
// none of its children (bars, lines, axis ticks) are emitted, making them
// impossible to assert against in tests.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!("ResizeObserver" in globalThis)) {
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserverStub,
  });
}

Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  value: 800,
});
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  value: 600,
});
