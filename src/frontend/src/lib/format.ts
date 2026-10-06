import type { BetNumber, Digit } from "@/backend";

const GROUP = /\B(?=(\d{3})+(?!\d))/g;

/** Group an integer string with thin thousands separators. */
export function groupDigits(value: string): string {
  return value.replace(GROUP, ",");
}

/** Format a Lucky / ICP / ticket count as a grouped integer string. */
export function formatAmount(value: bigint | number): string {
  const n = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  return groupDigits(n.toString());
}

/** Format an ICP e8s amount as a decimal ICP string (up to 8 dp, trimmed). */
export function formatIcp(e8s: bigint): string {
  const negative = e8s < 0n;
  const abs = negative ? -e8s : e8s;
  const whole = abs / 100_000_000n;
  const frac = (abs % 100_000_000n)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  const body =
    frac.length > 0
      ? `${groupDigits(whole.toString())}.${frac}`
      : groupDigits(whole.toString());
  return negative ? `-${body}` : body;
}

/** Parse a user-entered decimal ICP string into e8s, or null when invalid. */
export function parseIcpToE8s(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{0,8})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = frac.padEnd(8, "0");
  return BigInt(whole) * 100_000_000n + BigInt(fracPadded);
}

/** Parse a user-entered integer string into a bigint, or null when invalid. */
export function parseInteger(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return BigInt(trimmed);
}

/** Render a 7-digit bet number with leading zeros preserved. */
export function formatNumber(number: BetNumber | Digit[]): string {
  return number.map((d) => d.toString()).join("");
}

/** Render a single digit cell value. */
export function formatDigit(digit: Digit): string {
  return digit.toString();
}

/** Format a countdown in milliseconds as mm:ss (or hh:mm:ss past an hour). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  if (hours > 0) return `${hours.toString().padStart(2, "0")}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** Format a cooldown in milliseconds as a single-decimal seconds string. */
export function formatCooldownSeconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

/** Convert a backend nanosecond timestamp to a Date, or null when invalid. */
export function timestampToDate(timestamp: bigint): Date | null {
  const date = new Date(Number(timestamp / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a backend nanosecond timestamp as a local date-time string. */
export function formatTimestamp(timestamp: bigint, locale = "zh-CN"): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a backend nanosecond timestamp as a local time string. */
export function formatTime(timestamp: bigint, locale = "zh-CN"): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Percentage of a threshold, clamped to 0..100. */
export function thresholdPercent(amount: bigint, threshold: bigint): number {
  if (threshold <= 0n) return 0;
  const pct = Number((amount * 1000n) / threshold) / 10;
  return Math.min(100, Math.max(0, pct));
}
