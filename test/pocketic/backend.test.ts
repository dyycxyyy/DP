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
const admin = createIdentity("backend-admin");

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

/**
 * The generated `GameError` is a Candid variant, so `@dfinity/pic` decodes it
 * to `{ ok: null }` / `{ insufficientBalance: {...} }` — NOT the frontend
 * wrapper's `{ __kind__: ... }` shape.
 */
function isOk(result: object | null | undefined): boolean {
  return result !== null && result !== undefined && "ok" in result;
}

/** The single variant key of a decoded `GameError`, or undefined for `ok`. */
function errorKind(result: object | null | undefined): string | undefined {
  if (result === null || result === undefined) return undefined;
  const keys = Object.keys(result);
  return keys.length === 1 && keys[0] !== "ok" ? keys[0] : undefined;
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

it("answers every public read on a fresh canister instead of trapping", async () => {
  const state = await actor.getGameState();
  // The canister advances rounds lazily from `roundStart = 0`, so the first
  // read may already be past round 1; the initial pool is what matters.
  expect(state.round).toBeGreaterThanOrEqual(1n);
  expect(state.totalPrizePool).toBe(1_000_000n);
  expect(state.positions).toHaveLength(3);

  await expect(actor.getTopBetNumbers()).resolves.toEqual([]);
  // `roundStart` starts at 0, so the first read lazily draws round 1 and
  // records it in history; the read itself must not trap.
  const history = await actor.getRoundHistory(20n);
  expect(history).toHaveLength(1);
  expect(history[0].round).toBe(1n);
  await expect(actor.getDrawResult(1n)).resolves.toHaveLength(1);

  const pool = await actor.getExchangePoolState();
  expect(pool.icpBalance).toBe(1_000_000_000_000n);
  expect(pool.luckyBalance).toBe(1_000_000_000n);
  await expect(actor.getTreasuryBalance()).resolves.toBe(0n);

  const profile = await actor.getMyProfile();
  expect(profile.luckyBalance).toBe(0n);
  expect(profile.betCount).toBe(0n);
  expect(profile.winCount).toBe(0n);
  const betHistory = await actor.getMyBetHistory(0n, 50n);
  expect(betHistory.items).toEqual([]);
  const winHistory = await actor.getMyWinHistory(0n, 50n);
  expect(winHistory.items).toEqual([]);
});

it("exchanges ICP for Lucky at the fixed 1 ICP = 1000 Lucky rate", async () => {
  const alice = createIdentity("exchange-icp-to-lucky");
  actor.setIdentity(alice);

  const before = await actor.getExchangePoolState();
  const result = await actor.exchangeIcpToLucky(100_000_000n); // 1 ICP
  expect(isOk(result)).toBe(true);

  const profile = await actor.getMyProfile();
  expect(profile.luckyBalance).toBe(1000n);

  const after = await actor.getExchangePoolState();
  expect(after.icpBalance).toBe(before.icpBalance + 100_000_000n);
  expect(after.luckyBalance).toBe(before.luckyBalance - 1000n);
});

it("places a single bet that grows the prize pool and the top-bets tally", async () => {
  const bob = createIdentity("place-single-bet");
  actor.setIdentity(bob);

  // Fund the caller through the real exchange, then bet.
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const before = await actor.getGameState();

  const result = await actor.placeBet(betNumber("1234567"), 1n);
  expect(isOk(result)).toBe(true);

  const after = await actor.getGameState();
  expect(after.totalPrizePool).toBe(before.totalPrizePool + 1n);

  const top = await actor.getTopBetNumbers();
  expect(top).toHaveLength(1);
  expect(top[0].number).toEqual(betNumber("1234567"));
  expect(top[0].ticketCount).toBe(1n);

  const profile = await actor.getMyProfile();
  expect(profile.luckyBalance).toBe(999n);
  expect(profile.betCount).toBe(1n);
  const betHistory = await actor.getMyBetHistory(0n, 50n);
  expect(betHistory.items).toHaveLength(1);
});

it("places a batch of bets as one action and charges the summed cost", async () => {
  const carol = createIdentity("place-batch-bets");
  actor.setIdentity(carol);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const before = await actor.getGameState();

  const result = await actor.placeBets(
    [betNumber("1111111"), betNumber("2222222")],
    [1n, 1n],
  );
  expect(isOk(result)).toBe(true);

  const after = await actor.getGameState();
  expect(after.totalPrizePool).toBe(before.totalPrizePool + 2n);

  const top = await actor.getTopBetNumbers();
  const numbers = top.map((entry) => entry.number.join(""));
  expect(numbers).toContain("1111111");
  expect(numbers).toContain("2222222");
});

it("expands a per-position selection structure and charges the product", async () => {
  const dana = createIdentity("place-selections");
  actor.setIdentity(dana);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const before = await actor.getGameState();

  // Position 1: {1,2}; position 3: {4,5}; the rest single digits.
  // 2 x 1 x 2 x 1 x 1 x 1 x 1 = 4 tickets.
  const selections = [
    [1n, 2n],
    [3n],
    [4n, 5n],
    [6n],
    [7n],
    [8n],
    [9n],
  ];
  const counts = [2n, 1n, 2n, 1n, 1n, 1n, 1n];
  const result = await actor.placeBetSelections(selections, counts);
  expect(isOk(result)).toBe(true);

  // The whole submission is one game action: one summed deduction.
  const after = await actor.getGameState();
  expect(after.totalPrizePool).toBe(before.totalPrizePool + 4n);

  const profile = await actor.getMyProfile();
  expect(profile.luckyBalance).toBe(996n);
  // Accepted change: a complex submission is recorded as one bounded history
  // entry carrying the full ticket count, not one entry per expanded
  // combination, so the history stays bounded as the ticket count grows.
  expect(profile.betCount).toBe(1n);

  const history = await actor.getMyBetHistory(0n, 50n);
  expect(history.total).toBe(1n);
  expect(history.items).toHaveLength(1);
  expect(history.items[0].ticketCount).toBe(4n);
  expect(history.items[0].cost).toBe(4n);
  // The bounded record names the submission by its first selected digit per
  // position (the lexicographically smallest combination).
  expect(history.items[0].number.join("")).toBe("1346789");

  // The tally/top-K are merged from the bounded selection structure on the read
  // path, so every expanded combination still appears with its ticket count.
  const top = await actor.getTopBetNumbers();
  const topNumbers = top.map((entry) => entry.number.join(""));
  expect(topNumbers).toContain("1346789");
  expect(topNumbers).toContain("2356789");
  const topByNumber = new Map(
    top.map((entry) => [entry.number.join(""), entry.ticketCount]),
  );
  expect(topByNumber.get("1346789")).toBe(1n);
  expect(topByNumber.get("2356789")).toBe(1n);
});

it("treats a selection submission as one game action for the cooldown", async () => {
  const erik = createIdentity("selections-cooldown");
  actor.setIdentity(erik);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const selections = [
    [1n],
    [2n],
    [3n],
    [4n],
    [5n],
    [6n],
    [7n],
  ];
  const counts = [1n, 1n, 1n, 1n, 1n, 1n, 1n];
  expect(isOk(await actor.placeBetSelections(selections, counts))).toBe(true);

  // The submission consumed the single cooldown, so an immediate follow-up is
  // rejected.
  const second = await actor.placeBetSelections(selections, counts);
  expect(errorKind(second)).toBe("rateLimited");
});

it("rejects a selection submission with a mismatched count", async () => {
  const fiona = createIdentity("selections-mismatch");
  actor.setIdentity(fiona);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  // Position 1 declares 2 selected digits but supplies only one.
  const selections = [
    [1n],
    [2n],
    [3n],
    [4n],
    [5n],
    [6n],
    [7n],
  ];
  const counts = [2n, 1n, 1n, 1n, 1n, 1n, 1n];
  const result = await actor.placeBetSelections(selections, counts);
  expect(errorKind(result)).toBe("invalidAmount");
});

it("paginates the caller's bet history newest-first with a nextOffset cursor", async () => {
  const pager = createIdentity("bet-history-pagination");
  actor.setIdentity(pager);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  // One batch is one game action, so three distinct numbers land in one call.
  expect(
    isOk(
      await actor.placeBets(
        [betNumber("1000001"), betNumber("2000002"), betNumber("3000003")],
        [1n, 1n, 1n],
      ),
    ),
  ).toBe(true);

  const profile = await actor.getMyProfile();
  expect(profile.betCount).toBe(3n);

  // First page: two newest records, with a cursor to the remaining one.
  const first = await actor.getMyBetHistory(0n, 2n);
  expect(first.total).toBe(3n);
  expect(first.items).toHaveLength(2);
  expect(first.nextOffset).toEqual([2n]);
  // Newest-first: the last number placed is the first record returned.
  expect(first.items[0].number.join("")).toBe("3000003");
  expect(first.items[1].number.join("")).toBe("2000002");

  // Second page: the remaining record, and no further cursor.
  const second = await actor.getMyBetHistory(2n, 2n);
  expect(second.total).toBe(3n);
  expect(second.items).toHaveLength(1);
  expect(second.items[0].number.join("")).toBe("1000001");
  expect(second.nextOffset).toEqual([]);
});

it("caps a bet-history page at the backend's 50-record limit", async () => {
  const capped = createIdentity("bet-history-cap");
  actor.setIdentity(capped);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.placeBet(betNumber("4000004"), 1n))).toBe(true);

  // Requesting more than the cap returns at most the cap, not the request.
  const page = await actor.getMyBetHistory(0n, 500n);
  expect(page.total).toBe(1n);
  expect(page.items).toHaveLength(1);
  expect(page.nextOffset).toEqual([]);
});


it("locks a crowdfund position once a digit reaches the 100,000 threshold", async () => {
  const dave = createIdentity("crowdfund-lock");
  actor.setIdentity(dave);

  // Fund enough Lucky for the full threshold contribution.
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000_000n))).toBe(true); // 1000 ICP -> 1,000,000 Lucky

  const result = await actor.contributeCrowdfund(1n, 3n, 100_000n);
  expect(isOk(result)).toBe(true);

  const state = await actor.getGameState();
  const position1 = state.positions.find((p) => p.position === 1n);
  expect(position1).toBeDefined();
  expect(position1?.lockedDigit).toEqual([3n]);
  const digit3 = position1?.digits.find((d) => d.digit === 3n);
  expect(digit3?.amount).toBeGreaterThanOrEqual(100_000n);
  expect(digit3?.thresholdReached).toBe(true);
});

it("accumulates crowdfunding independently per digit and per position", async () => {
  const nina = createIdentity("independent-accumulation");
  actor.setIdentity(nina);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000_000n))).toBe(true);

  const amountOf = (
    state: Awaited<ReturnType<typeof actor.getGameState>>,
    position: bigint,
    digit: bigint,
  ): bigint =>
    state.positions
      .find((p) => p.position === position)
      ?.digits.find((d) => d.digit === digit)?.amount ?? 0n;

  const before = await actor.getGameState();
  const beforeDigit3 = amountOf(before, 1n, 3n);
  const beforeDigit4 = amountOf(before, 1n, 4n);
  const beforePosition2Digit3 = amountOf(before, 2n, 3n);

  expect(isOk(await actor.contributeCrowdfund(1n, 3n, 40_000n))).toBe(true);

  const after = await actor.getGameState();
  // The contribution lands on position 1 digit 3 only.
  expect(amountOf(after, 1n, 3n) - beforeDigit3).toBe(40_000n);
  // No other digit at the same position is affected.
  expect(amountOf(after, 1n, 4n) - beforeDigit4).toBe(0n);
  // No other position is affected.
  expect(amountOf(after, 2n, 3n) - beforePosition2Digit3).toBe(0n);
});

it("keeps crowdfunding after a lock without changing the locked digit", async () => {
  const erin = createIdentity("crowdfund-after-lock");
  actor.setIdentity(erin);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000_000n))).toBe(true);
  expect(isOk(await actor.contributeCrowdfund(2n, 5n, 100_000n))).toBe(true);

  const locked = await actor.getGameState();
  const lockedDigit = locked.positions.find((p) => p.position === 2n)?.lockedDigit;
  expect(lockedDigit).toEqual([5n]);

  // A second contribution to the same position from another caller is a
  // separate game action, so it is not blocked by the first caller's cooldown.
  const felix = createIdentity("crowdfund-after-lock-2");
  actor.setIdentity(felix);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000_000n))).toBe(true);
  expect(isOk(await actor.contributeCrowdfund(2n, 7n, 50_000n))).toBe(true);

  const state = await actor.getGameState();
  const position2 = state.positions.find((p) => p.position === 2n);
  // The locked digit is unchanged by the later contribution.
  expect(position2?.lockedDigit).toEqual([5n]);
});

it("rejects a second game action within the 3-second cooldown", async () => {
  const frank = createIdentity("cooldown");
  actor.setIdentity(frank);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.placeBet(betNumber("3333333"), 1n))).toBe(true);

  const second = await actor.placeBet(betNumber("4444444"), 1n);
  expect(errorKind(second)).toBe("rateLimited");
  if (second !== null && "rateLimited" in second) {
    expect(second.rateLimited.remainingMs).toBeGreaterThan(0n);
  }
});

it("rejects a bet from a caller with no Lucky balance", async () => {
  const grace = createIdentity("no-balance");
  actor.setIdentity(grace);

  const result = await actor.placeBet(betNumber("5555555"), 1n);
  expect(errorKind(result)).toBe("insufficientBalance");
});

it("rejects an invalid bet number", async () => {
  const heidi = createIdentity("invalid-number");
  actor.setIdentity(heidi);

  const result = await actor.placeBet([1n, 2n, 3n], 1n);
  expect(errorKind(result)).toBe("invalidBetNumber");
});

it("exchanges Lucky for ICP with the 3% fee flowing to the treasury", async () => {
  const ivan = createIdentity("exchange-lucky-to-icp");
  actor.setIdentity(ivan);

  // 1 ICP -> 1000 Lucky, then exchange 1000 Lucky back.
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const poolBefore = await actor.getExchangePoolState();
  const treasuryBefore = await actor.getTreasuryBalance();

  const result = await actor.exchangeLuckyToIcp(1000n);
  expect(isOk(result)).toBe(true);

  // 3% of 1000 = 30 Lucky fee to the treasury; 970 Lucky net -> 0.97 ICP.
  const treasuryAfter = await actor.getTreasuryBalance();
  expect(treasuryAfter).toBe(treasuryBefore + 30n);

  const poolAfter = await actor.getExchangePoolState();
  expect(poolAfter.luckyBalance).toBe(poolBefore.luckyBalance + 970n);
  expect(poolAfter.icpBalance).toBe(poolBefore.icpBalance - 97_000_000n);

  const profile = await actor.getMyProfile();
  expect(profile.luckyBalance).toBe(0n);
});

it("rejects a Lucky -> ICP amount that is not a multiple of 1000", async () => {
  const judy = createIdentity("invalid-lucky-step");
  actor.setIdentity(judy);

  const result = await actor.exchangeLuckyToIcp(1500n);
  expect(errorKind(result)).toBe("invalidAmount");
});

it("keeps each caller's profile isolated", async () => {
  const kim = createIdentity("isolation-kim");
  const leo = createIdentity("isolation-leo");

  actor.setIdentity(kim);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect((await actor.getMyProfile()).luckyBalance).toBe(1000n);

  actor.setIdentity(leo);
  expect((await actor.getMyProfile()).luckyBalance).toBe(0n);
});

it("rejects a second crowdfund contribution within the 3-second cooldown", async () => {
  const mia = createIdentity("crowdfund-cooldown");
  actor.setIdentity(mia);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.contributeCrowdfund(3n, 1n, 100n))).toBe(true);

  const second = await actor.contributeCrowdfund(3n, 2n, 100n);
  expect(errorKind(second)).toBe("rateLimited");
  if (second !== null && "rateLimited" in second) {
    expect(second.rateLimited.remainingMs).toBeGreaterThan(0n);
  }
});

it("treats a batch of bets as one game action for the cooldown", async () => {
  const nate = createIdentity("batch-cooldown");
  actor.setIdentity(nate);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(
    isOk(await actor.placeBets([betNumber("1010101"), betNumber("2020202")], [1n, 1n])),
  ).toBe(true);

  // The batch consumed the single cooldown, so an immediate follow-up is rejected.
  const second = await actor.placeBet(betNumber("3030303"), 1n);
  expect(errorKind(second)).toBe("rateLimited");
});

it("rejects a crowdfund contribution to a position outside 1-3", async () => {
  const olive = createIdentity("invalid-position");
  actor.setIdentity(olive);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const result = await actor.contributeCrowdfund(4n, 1n, 100n);
  expect(errorKind(result)).toBe("invalidPosition");
});

it("rejects a crowdfund contribution above the 100,000 per-call cap", async () => {
  const pat = createIdentity("crowdfund-too-large");
  actor.setIdentity(pat);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000_000n))).toBe(true);
  const result = await actor.contributeCrowdfund(3n, 1n, 100_001n);
  expect(errorKind(result)).toBe("amountTooLarge");
});

it("rejects a crowdfund contribution of zero", async () => {
  const quinn = createIdentity("crowdfund-zero");
  actor.setIdentity(quinn);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const result = await actor.contributeCrowdfund(3n, 1n, 0n);
  expect(errorKind(result)).toBe("invalidAmount");
});

it("reports the leading digit as the highest amount, ties going to the larger digit", async () => {
  // Position 3 is untouched by the other tests in this file, so its per-digit
  // accumulators start at zero. Each contribution is a separate game action, so
  // each needs its own caller to avoid the 3-second cooldown.
  const rita = createIdentity("leading-tie-a");
  const sam = createIdentity("leading-tie-b");
  const tara = createIdentity("leading-tie-c");

  const leadingOf = async (position: bigint): Promise<bigint | undefined> =>
    (await actor.getGameState()).positions.find((p) => p.position === position)
      ?.leadingDigit;

  actor.setIdentity(rita);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.contributeCrowdfund(3n, 4n, 100n))).toBe(true);

  actor.setIdentity(sam);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.contributeCrowdfund(3n, 2n, 100n))).toBe(true);

  // Equal amounts: the larger digit (4) leads.
  expect(await leadingOf(3n)).toBe(4n);

  actor.setIdentity(tara);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.contributeCrowdfund(3n, 2n, 1n))).toBe(true);

  // Digit 2 now has the strictly higher amount, so it takes the lead.
  expect(await leadingOf(3n)).toBe(2n);
});

/**
 * Admin-gated dev controls.
 *
 * Admin authority is a platform role, not the anonymous installing principal:
 * `isCallerAdmin` returns false for anonymous callers, so the default
 * `setupCanister` sender is NOT an admin. This file installs with a named
 * sender, which makes that identity a canister controller and therefore an
 * admin recovery path. These tests pin the authorization boundary the
 * frontend's visibility gate relies on, and the two actions the panel exposes:
 * seeding a Lucky balance and fast-forwarding the round clock.
 */
it("reports the admin caller as admin and a named non-admin caller as not", async () => {
  const controller = adminActor();
  await expect(controller.isCallerController()).resolves.toBe(true);

  const visitor = createIdentity("dev-not-controller");
  actor.setIdentity(visitor);
  await expect(actor.isCallerController()).resolves.toBe(false);
});

it("credits the admin's Lucky balance through devSeedBalance", async () => {
  const controller = adminActor();

  const before = await controller.getMyProfile();
  expect(isOk(await controller.devSeedBalance(250_000n))).toBe(true);

  const after = await controller.getMyProfile();
  expect(after.luckyBalance).toBe(before.luckyBalance + 250_000n);
});

it("rejects devSeedBalance from a non-admin", async () => {
  const visitor = createIdentity("dev-seed-rejected");
  actor.setIdentity(visitor);

  const result = await actor.devSeedBalance(1_000_000n);
  expect(errorKind(result)).toBe("notRegistered");
  // The rejected call must not have credited the visitor.
  expect((await actor.getMyProfile()).luckyBalance).toBe(0n);
});

it("rejects a zero devSeedBalance amount from the admin", async () => {
  const controller = adminActor();
  const result = await controller.devSeedBalance(0n);
  expect(errorKind(result)).toBe("invalidAmount");
});

it("fast-forwards a round to completion through devAdvanceRound", async () => {
  const controller = adminActor();

  const before = await controller.getGameState();
  expect(isOk(await controller.devAdvanceRound())).toBe(true);

  // The lazy advance ran the draw, so the round that was current is now in
  // history with a winning number, and the live round has moved on.
  const history = await controller.getRoundHistory(20n);
  const completed = history.find((entry) => entry.round === before.round);
  expect(completed).toBeDefined();
  expect(completed?.winningNumber).toHaveLength(7);

  const after = await controller.getGameState();
  expect(after.round).toBeGreaterThan(before.round);
});

it("rejects devAdvanceRound from a non-admin", async () => {
  const visitor = createIdentity("dev-advance-rejected");
  actor.setIdentity(visitor);

  const result = await actor.devAdvanceRound();
  expect(errorKind(result)).toBe("notRegistered");
});

it("sets the round elapsed time through devSetRoundElapsed", async () => {
  const controller = adminActor();

  // 8 minutes of elapsed time is past the crowdfunding close, so the lazy
  // advance moves the round into its drawing/payout window.
  expect(isOk(await controller.devSetRoundElapsed(480_000_000_000n))).toBe(true);

  const state = await controller.getGameState();
  expect(state.round).toBeGreaterThanOrEqual(1n);
});

it("rejects devSetRoundElapsed from a non-admin", async () => {
  const visitor = createIdentity("dev-elapsed-rejected");
  actor.setIdentity(visitor);

  const result = await actor.devSetRoundElapsed(480_000_000_000n);
  expect(errorKind(result)).toBe("notRegistered");
});

/**
 * Production wallet public API.
 *
 * These call the real canister methods the frontend wallet consumes. The ICP
 * ledger canister (`ryjl3-tyaaa-aaaaa-aaaba-cai`) is not installed in this local
 * replica, so the ICP paths must degrade to a zero balance / `ledgerUnavailable`
 * rather than trapping — that is exactly the failure mode a stubbed backend
 * would hide. Lucky transfers are pure internal accounting and are asserted
 * end-to-end.
 */
it("returns a deterministic per-caller ICP deposit address", async () => {
  const alice = createIdentity("wallet-deposit-alice");
  const bob = createIdentity("wallet-deposit-bob");

  actor.setIdentity(alice);
  const first = await actor.getDepositAddress();
  const again = await actor.getDepositAddress();
  expect(again.accountText).toBe(first.accountText);
  expect(first.subaccount).toHaveLength(32);
  expect(first.accountText).toContain(first.owner.toText());

  // A different caller gets a different subaccount.
  actor.setIdentity(bob);
  const other = await actor.getDepositAddress();
  expect(other.accountText).not.toBe(first.accountText);
});

it("reads wallet balances without trapping when the ICP ledger is absent", async () => {
  const carol = createIdentity("wallet-balances-carol");
  actor.setIdentity(carol);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);

  const balances = await actor.getWalletBalances();
  expect(balances.lucky).toBe(1000n);
  // The ledger is unreachable locally, so the ICP read degrades to zero.
  expect(balances.icpE8s).toBe(0n);
  expect(balances.icpFeeE8s).toBe(10_000n);
});

it("transfers Lucky between accounts and records both directions", async () => {
  const dave = createIdentity("wallet-lucky-dave");
  const erin = createIdentity("wallet-lucky-erin");

  actor.setIdentity(dave);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true); // 1000 Lucky

  const result = await actor.transferLucky(erin.getPrincipal(), 400n);
  expect(isOk(result)).toBe(true);

  expect((await actor.getMyProfile()).luckyBalance).toBe(600n);

  // The sender sees an outgoing record; the recipient sees an incoming one.
  const outgoing = await actor.getRecentTransfers();
  expect(outgoing).toHaveLength(1);
  expect(outgoing[0].direction).toEqual({ outgoing: null });
  expect(outgoing[0].asset).toEqual({ lucky: null });
  expect(outgoing[0].amount).toBe(400n);
  expect(outgoing[0].counterparty.toText()).toBe(erin.getPrincipal().toText());

  actor.setIdentity(erin);
  expect((await actor.getMyProfile()).luckyBalance).toBe(400n);
  const incoming = await actor.getRecentTransfers();
  expect(incoming).toHaveLength(1);
  expect(incoming[0].direction).toEqual({ incoming: null });
  expect(incoming[0].counterparty.toText()).toBe(dave.getPrincipal().toText());
});

it("rejects a Lucky transfer above the balance and a self-transfer", async () => {
  const frank = createIdentity("wallet-lucky-frank");
  actor.setIdentity(frank);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true); // 1000 Lucky

  const tooMuch = await actor.transferLucky(
    createIdentity("wallet-lucky-target").getPrincipal(),
    1001n,
  );
  expect(errorKind(tooMuch)).toBe("insufficientBalance");

  const self = await actor.transferLucky(frank.getPrincipal(), 1n);
  expect(errorKind(self)).toBe("invalidRecipient");
});

it("returns recent transfers newest-first", async () => {
  const grace = createIdentity("wallet-order-grace");
  const target = createIdentity("wallet-order-target").getPrincipal();
  actor.setIdentity(grace);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);

  expect(isOk(await actor.transferLucky(target, 100n))).toBe(true);
  expect(isOk(await actor.transferLucky(target, 200n))).toBe(true);

  const records = await actor.getRecentTransfers();
  expect(records).toHaveLength(2);
  // Newest first: the 200 transfer was recorded last.
  expect(records[0].amount).toBe(200n);
  expect(records[1].amount).toBe(100n);
});

it("validates an ICP transfer and degrades to ledgerUnavailable without a ledger", async () => {
  const heidi = createIdentity("wallet-icp-heidi");
  actor.setIdentity(heidi);

  // Zero and fee-or-below amounts are rejected before any ledger call.
  expect(errorKind(await actor.transferIcp(heidi.getPrincipal(), 0n))).toBe(
    "invalidAmount",
  );
  expect(
    errorKind(await actor.transferIcp(heidi.getPrincipal(), 10_000n)),
  ).toBe("amountTooSmall");

  // A valid amount reaches the (absent) ledger and must not trap.
  const result = await actor.transferIcp(
    createIdentity("wallet-icp-target").getPrincipal(),
    100_000_000n,
  );
  expect(errorKind(result)).toBe("ledgerUnavailable");
});
