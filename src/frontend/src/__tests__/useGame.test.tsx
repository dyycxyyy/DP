import { useActionCooldown, useCountdown } from "@/hooks/useGame";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the remaining milliseconds until a backend nanosecond deadline", () => {
    const deadline = BigInt(Date.now() + 125_000) * 1_000_000n;
    const { result } = renderHook(() => useCountdown(deadline));

    expect(result.current).toBe(125_000);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(120_000);
  });

  it("clamps to zero once the deadline has passed", () => {
    const deadline = BigInt(Date.now() - 1_000) * 1_000_000n;
    const { result } = renderHook(() => useCountdown(deadline));

    expect(result.current).toBe(0);
  });

  it("returns zero when no deadline is provided", () => {
    const { result } = renderHook(() => useCountdown(undefined));
    expect(result.current).toBe(0);
  });
});

describe("useActionCooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down the remaining cooldown from the profile's cooldown value", () => {
    const { result } = renderHook(() => useActionCooldown(1n, 3_000n));

    expect(result.current).toBe(3_000);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(2_000);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current).toBe(0);
  });

  it("returns zero when the backend reports no remaining cooldown", () => {
    const { result } = renderHook(() => useActionCooldown(1n, 0n));
    expect(result.current).toBe(0);
  });

  it("returns zero when the profile has not loaded", () => {
    const { result } = renderHook(() =>
      useActionCooldown(undefined, undefined),
    );
    expect(result.current).toBe(0);
  });
});
