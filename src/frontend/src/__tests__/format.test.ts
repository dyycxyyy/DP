import {
  formatAmount,
  formatCooldownSeconds,
  formatCountdown,
  formatIcp,
  formatNumber,
  groupDigits,
  parseIcpToE8s,
  parseInteger,
  thresholdPercent,
} from "@/lib/format";
import { describe, expect, it } from "vitest";

describe("formatAmount", () => {
  it("groups integers with thousands separators", () => {
    expect(formatAmount(0n)).toBe("0");
    expect(formatAmount(999n)).toBe("999");
    expect(formatAmount(1000n)).toBe("1,000");
    expect(formatAmount(1_234_567n)).toBe("1,234,567");
  });
});

describe("groupDigits", () => {
  it("groups a digit string", () => {
    expect(groupDigits("1234567")).toBe("1,234,567");
  });
});

describe("formatIcp", () => {
  it("renders e8s as a trimmed decimal ICP string", () => {
    expect(formatIcp(0n)).toBe("0");
    expect(formatIcp(100_000_000n)).toBe("1");
    expect(formatIcp(97_000_000n)).toBe("0.97");
    expect(formatIcp(1_500_000n)).toBe("0.015");
    expect(formatIcp(1_234_567_890n)).toBe("12.3456789");
  });

  it("renders negative amounts with a leading sign", () => {
    expect(formatIcp(-100_000_000n)).toBe("-1");
  });
});

describe("parseIcpToE8s", () => {
  it("parses whole and fractional ICP into e8s", () => {
    expect(parseIcpToE8s("1")).toBe(100_000_000n);
    expect(parseIcpToE8s("0.1")).toBe(10_000_000n);
    expect(parseIcpToE8s("0.97")).toBe(97_000_000n);
    expect(parseIcpToE8s("10000")).toBe(1_000_000_000_000n);
  });

  it("rejects malformed input", () => {
    expect(parseIcpToE8s("")).toBeNull();
    expect(parseIcpToE8s("abc")).toBeNull();
    expect(parseIcpToE8s("1.2.3")).toBeNull();
    expect(parseIcpToE8s("-1")).toBeNull();
    // More than 8 decimal places is not representable in e8s.
    expect(parseIcpToE8s("0.123456789")).toBeNull();
  });
});

describe("parseInteger", () => {
  it("parses a non-negative integer string", () => {
    expect(parseInteger("0")).toBe(0n);
    expect(parseInteger("100000")).toBe(100_000n);
  });

  it("rejects non-integer input", () => {
    expect(parseInteger("")).toBeNull();
    expect(parseInteger("1.5")).toBeNull();
    expect(parseInteger("-1")).toBeNull();
    expect(parseInteger("1a")).toBeNull();
  });
});

describe("formatNumber", () => {
  it("preserves leading zeros in a 7-digit bet number", () => {
    expect(formatNumber([0n, 0n, 0n, 0n, 0n, 0n, 1n])).toBe("0000001");
    expect(formatNumber([1n, 2n, 3n, 4n, 5n, 6n, 7n])).toBe("1234567");
  });
});

describe("formatCountdown", () => {
  it("renders mm:ss and hh:mm:ss", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(65_000)).toBe("01:05");
    expect(formatCountdown(3_600_000)).toBe("01:00:00");
    expect(formatCountdown(-500)).toBe("00:00");
  });
});

describe("formatCooldownSeconds", () => {
  it("renders a single-decimal seconds string", () => {
    expect(formatCooldownSeconds(2500)).toBe("2.5");
    expect(formatCooldownSeconds(0)).toBe("0.0");
    expect(formatCooldownSeconds(-100)).toBe("0.0");
  });
});

describe("thresholdPercent", () => {
  it("computes a clamped percentage of the threshold", () => {
    expect(thresholdPercent(0n, 100_000n)).toBe(0);
    expect(thresholdPercent(50_000n, 100_000n)).toBe(50);
    expect(thresholdPercent(100_000n, 100_000n)).toBe(100);
    expect(thresholdPercent(200_000n, 100_000n)).toBe(100);
    expect(thresholdPercent(1n, 0n)).toBe(0);
  });
});
