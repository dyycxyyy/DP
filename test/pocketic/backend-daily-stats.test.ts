import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;
let canisterId: CanisterFixture<_SERVICE>["canisterId"];

/**
 * The admin caller. Admin authority is a platform role, not the anonymous
 * installing principal: `isCallerAdmin` returns false for anonymous callers, so
 * the default `setupCanister` sender (anonymous) is NOT an admin. Installing
 * with a named sender makes that identity a canister controller, which the
 * backend treats as an admin recovery path (`getCallerRole` reports `#admin`).
 */
const admin = createIdentity("daily-stats-admin");

/** An actor calling as the admin identity. */
function adminActor(): Actor<_SERVICE> {
  const a = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  a.setIdentity(admin);
  return a;
}

/** A 7-digit bet number from a string like "1234567". */
function betNumber(value: string): bigint[] {
  return value.split("").map((d) => BigInt(d));
}

/** The generated `GameError` decodes to `{ ok: null }` / `{ <kind>: ... }`. */
function isOk(result: object | null | undefined): boolean {
  return result !== null && result !== undefined && "ok" in result;
}

/** The single variant key of a decoded `GameError`, or undefined for `ok`. */
function errorKind(result: object | null | undefined): string | undefined {
  if (result === null || result === undefined) return undefined;
  const keys = Object.keys(result);
  return keys.length === 1 && keys[0] !== "ok" ? keys[0] : undefined;
}

/** ISO `YYYY-MM-DD` for a nanosecond timestamp. */
function isoDayOfNs(ns: bigint): string {
  return new Date(Number(ns / 1_000_000n)).toISOString().slice(0, 10);
}

/** Shift an ISO day key by `days`. */
function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type DailyEntry = {
  date: string;
  stats: { totalBets: bigint; totalPayouts: bigint; treasuryIncome: bigint };
};

/** The decoded `DailyStatsOutcome` for a range, or throws on a backend error. */
async function dailyStats(
  caller: Actor<_SERVICE>,
  fromDate: string,
  toDate: string,
): Promise<DailyEntry[]> {
  const outcome = await caller.getDailyStats(fromDate, toDate);
  if (!("ok" in outcome)) {
    throw new Error(
      `getDailyStats returned an error: ${JSON.stringify(outcome)}`,
    );
  }
  return outcome.ok;
}

/**
 * The replica's current UTC day, derived from the live round's phase deadline.
 *
 * The backend keys daily buckets off `Time.now()` (replica time), which on a
 * fresh PocketIC instance starts at the IC genesis date rather than the host's
 * wall clock. Deriving the day from a backend timestamp keeps these tests
 * independent of both clocks.
 */
async function replicaDay(caller: Actor<_SERVICE>): Promise<string> {
  const state = await caller.getGameState();
  return isoDayOfNs(state.phaseDeadline);
}

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  ({ actor, canisterId } = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
    sender: admin.getPrincipal(),
  }));
});

afterAll(async () => {
  await pic?.tearDown();
});

/**
 * Daily statistics public API.
 *
 * Admin authority is a platform role, not the anonymous installing principal:
 * `isCallerAdmin` returns false for anonymous callers, so the default
 * `setupCanister` sender is NOT an admin. This file installs with a named
 * sender, which makes that identity a canister controller and therefore an
 * admin recovery path. These tests call the real `getDailyStats` the admin
 * console consumes, so a backend whose aggregation is an unimplemented stub
 * fails here rather than only in the mocked frontend suite.
 */

it("zero-fills every day of a range with no recorded activity", async () => {
  const controller = adminActor();

  // A range far in the past has no recorded activity on a fresh canister.
  const entries = await dailyStats(controller, "2000-01-01", "2000-01-03");
  expect(entries).toHaveLength(3);
  expect(entries.map((entry) => entry.date)).toEqual([
    "2000-01-01",
    "2000-01-02",
    "2000-01-03",
  ]);
  for (const entry of entries) {
    expect(entry.stats.totalBets).toBe(0n);
    expect(entry.stats.totalPayouts).toBe(0n);
    expect(entry.stats.treasuryIncome).toBe(0n);
  }
});

it("returns a single zero-filled day for a one-day range", async () => {
  const controller = adminActor();

  const entries = await dailyStats(controller, "2000-02-01", "2000-02-01");
  expect(entries).toHaveLength(1);
  expect(entries[0].date).toBe("2000-02-01");
  expect(entries[0].stats.totalBets).toBe(0n);
});

it("rejects a non-controller caller", async () => {
  const visitor = createIdentity("daily-stats-not-controller");
  actor.setIdentity(visitor);

  const outcome = await actor.getDailyStats("2000-01-01", "2000-01-03");
  expect("err" in outcome).toBe(true);
  if ("err" in outcome) {
    expect(errorKind(outcome.err)).toBe("notRegistered");
  }
});

it("rejects a malformed date and a reversed range", async () => {
  const controller = adminActor();

  const malformed = await controller.getDailyStats("not-a-date", "2000-01-03");
  expect("err" in malformed).toBe(true);
  if ("err" in malformed) {
    expect(errorKind(malformed.err)).toBe("invalidAmount");
  }

  const reversed = await controller.getDailyStats("2000-01-03", "2000-01-01");
  expect("err" in reversed).toBe(true);
  if ("err" in reversed) {
    expect(errorKind(reversed.err)).toBe("invalidAmount");
  }
});

it("records a bet in the replica's current UTC day's total bets", async () => {
  const controller = adminActor();
  const player = createIdentity("daily-stats-bettor");

  const day = await replicaDay(controller);
  const from = shiftDay(day, -1);
  const to = shiftDay(day, 1);
  const before = await dailyStats(controller, from, to);
  const beforeByDate = new Map(
    before.map((entry) => [entry.date, entry.stats.totalBets]),
  );

  // Fund the player through the real exchange, then place a bet.
  actor.setIdentity(player);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.placeBet(betNumber("1234567"), 1n))).toBe(true);

  const after = await dailyStats(controller, from, to);
  const increased = after.filter(
    (entry) => entry.stats.totalBets > (beforeByDate.get(entry.date) ?? 0n),
  );
  expect(increased).toHaveLength(1);
  expect(increased[0].stats.totalBets).toBe(
    (beforeByDate.get(increased[0].date) ?? 0n) + 1n,
  );
});

it("records a draw's payouts in the replica's current UTC day", async () => {
  const controller = adminActor();
  const player = createIdentity("daily-stats-drawer");

  // Complete the current round first so this test starts from a clean round
  // with no bets carried over from the earlier tests.
  expect(isOk(await controller.devAdvanceRound())).toBe(true);

  const day = await replicaDay(controller);
  const from = shiftDay(day, -1);
  const to = shiftDay(day, 1);
  const before = await dailyStats(controller, from, to);
  const beforeByDate = new Map(
    before.map((entry) => [entry.date, entry.stats.totalPayouts]),
  );

  // With no crowdfunding, the winning digits 1-3 are 0 and digits 6-7 are 0;
  // digits 4-5 are the tens/units of the prize pool at draw time. Placing one
  // ticket moves the pool by exactly one, so the winning number is predictable
  // and a bet on it is a guaranteed tier-1 win.
  const poolBefore = (await controller.getGameState()).totalPrizePool;
  const poolAtDraw = poolBefore + 1n;
  const d4 = (poolAtDraw / 10n) % 10n;
  const d5 = poolAtDraw % 10n;
  const winning = [0n, 0n, 0n, d4, d5, 0n, 0n];

  actor.setIdentity(player);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.placeBet(winning, 1n))).toBe(true);

  const state = await controller.getGameState();
  expect(isOk(await controller.devAdvanceRound())).toBe(true);

  const history = await controller.getRoundHistory(20n);
  const completed = history.find((entry) => entry.round === state.round);
  expect(completed).toBeDefined();
  const distributed = completed?.totalDistributed ?? 0n;
  // The guaranteed winning ticket means the draw actually paid out.
  expect(distributed).toBeGreaterThan(0n);

  const after = await dailyStats(controller, from, to);
  const increased = after.filter(
    (entry) => entry.stats.totalPayouts > (beforeByDate.get(entry.date) ?? 0n),
  );
  // The day's payouts grew by exactly the completed round's distribution.
  expect(increased).toHaveLength(1);
  expect(increased[0].stats.totalPayouts).toBe(
    (beforeByDate.get(increased[0].date) ?? 0n) + distributed,
  );
});
