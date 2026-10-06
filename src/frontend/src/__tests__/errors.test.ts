import { Phase } from "@/backend";
import { DEFAULT_LANGUAGE, translate } from "@/i18n/translations";
import { gameErrorMessage, toErrorMessage } from "@/lib/errors";
import { describe, expect, it } from "vitest";

const t = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>,
) => translate(DEFAULT_LANGUAGE, key, vars);

describe("gameErrorMessage", () => {
  it("renders insufficientBalance with required and available amounts", () => {
    const message = gameErrorMessage(t, {
      __kind__: "insufficientBalance",
      insufficientBalance: { required: 5n, available: 2n },
    });
    expect(message).toContain("余额不足");
    expect(message).toContain("5");
    expect(message).toContain("2");
  });

  it("renders rateLimited with the remaining cooldown in seconds", () => {
    const message = gameErrorMessage(t, {
      __kind__: "rateLimited",
      rateLimited: { remainingMs: 2500n },
    });
    expect(message).toContain("操作过于频繁");
    expect(message).toContain("2.5");
  });

  it("renders phaseClosed with the current and required phase labels", () => {
    const message = gameErrorMessage(t, {
      __kind__: "phaseClosed",
      phaseClosed: { current: Phase.crowdfunding, required: Phase.betting },
    });
    expect(message).toContain("众筹中");
    expect(message).toContain("投注中");
  });

  it("renders poolInsufficient with the token and available amount", () => {
    const message = gameErrorMessage(t, {
      __kind__: "poolInsufficient",
      poolInsufficient: { token: "Lucky", available: 100n },
    });
    expect(message).toContain("Lucky");
    expect(message).toContain("100");
  });

  it("renders amountTooLarge and amountTooSmall bounds", () => {
    expect(
      gameErrorMessage(t, {
        __kind__: "amountTooLarge",
        amountTooLarge: { max: 100_000n },
      }),
    ).toContain("100,000");
    expect(
      gameErrorMessage(t, {
        __kind__: "amountTooSmall",
        amountTooSmall: { min: 1n },
      }),
    ).toContain("1");
  });

  it("renders invalidAmount with the required step", () => {
    const message = gameErrorMessage(t, {
      __kind__: "invalidAmount",
      invalidAmount: { step: 1000n },
    });
    expect(message).toContain("1,000");
  });

  it("renders invalidPosition and invalidBetNumber", () => {
    expect(
      gameErrorMessage(t, {
        __kind__: "invalidPosition",
        invalidPosition: null,
      }),
    ).toContain("第 1-3 位");
    expect(
      gameErrorMessage(t, {
        __kind__: "invalidBetNumber",
        invalidBetNumber: null,
      }),
    ).toContain("7 位");
  });

  it("renders roundNotFound with the round number", () => {
    const message = gameErrorMessage(t, {
      __kind__: "roundNotFound",
      roundNotFound: { round: 7n },
    });
    expect(message).toContain("7");
  });

  it("renders the wallet-specific ledger and recipient failures", () => {
    expect(
      gameErrorMessage(t, {
        __kind__: "ledgerUnavailable",
        ledgerUnavailable: { reason: "timeout" },
      }),
    ).toContain("账本");
    expect(
      gameErrorMessage(t, {
        __kind__: "invalidRecipient",
        invalidRecipient: null,
      }),
    ).toContain("principal");
    expect(
      gameErrorMessage(t, { __kind__: "notRegistered", notRegistered: null }),
    ).toContain("登录");
  });

  it("falls back to a generic message for an unknown variant", () => {
    expect(
      gameErrorMessage(t, {
        __kind__: "someFutureVariant",
        someFutureVariant: null,
      } as never),
    ).toBe("操作失败，请稍后重试");
  });
});

describe("toErrorMessage", () => {
  it("extracts a message from an Error, a string, or falls back", () => {
    expect(toErrorMessage(t, new Error("boom"))).toBe("boom");
    expect(toErrorMessage(t, "plain")).toBe("plain");
    expect(toErrorMessage(t, 42)).toBe("操作失败，请稍后重试");
  });
});
