import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Generated components expose stable `data-ocid` hooks; use them as test ids
// rather than asserting on CSS classes or DOM structure.
configure({ testIdAttribute: "data-ocid" });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// jsdom does not implement matchMedia, which several Radix primitives probe.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom lacks ResizeObserver, used by Radix scroll/select primitives.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub;
}
