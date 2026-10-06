// Type-only module: brings the `@testing-library/jest-dom` matcher
// augmentations into the TypeScript program so `tsc --noEmit` sees
// `toBeInTheDocument`, `toHaveTextContent`, `toBeDisabled`, etc. on Vitest's
// `Assertion`. It is not a test file (the name does not match the Vitest
// `include` glob), so it is never collected or executed.
import "@testing-library/jest-dom/vitest";
