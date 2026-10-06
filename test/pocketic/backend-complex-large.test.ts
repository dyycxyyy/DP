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
  }));
});

afterAll(async () => {
  await pic?.tearDown();
});

/** All ten digits selected in every one of the seven positions. */
const FULL_SELECTION = [
  [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
  [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
  [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
  [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
  [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
  [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
  [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
];
const FULL_COUNTS = [10n, 10n, 10n, 10n, 10n, 10n, 10n];
/** 10^7 tickets at 1 Lucky each. */
const FULL_TICKETS = 10_000_000n;

/**
 * The accepted change: a full 10x7 selection (10,000,000 tickets) must submit
 * successfully instead of returning the IC0522 instruction-limit error. The
 * backend records a bounded aggregate (the per-position selection structure)
 * and merges the tally/top-K on the read path, so the write is O(positions x
 * digits) rather than O(ticket count).
 *
 * This file gets its own canister so the exchange pool starts at its full
 * 1,000,000,000 Lucky and can fund the 10,000,000-Lucky submission.
 */
it("submits a full 10x7 selection of 10,000,000 tickets without an instruction-limit error", async () => {
  const alice = createIdentity("complex-large-submit");
  actor.setIdentity(alice);

  // 10,000 ICP -> 10,000,000 Lucky, exactly covering the full selection.
  expect(isOk(await actor.exchangeIcpToLucky(1_000_000_000_000n))).toBe(true);
  const before = await actor.getGameState();
  const profileBefore = await actor.getMyProfile();
  expect(profileBefore.luckyBalance).toBe(FULL_TICKETS);

  // The submission itself must not trap or return an error variant.
  const result = await actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS);
  expect(isOk(result)).toBe(true);

  // One summed debit of the full product, not one per combination.
  const profileAfter = await actor.getMyProfile();
  expect(profileBefore.luckyBalance - profileAfter.luckyBalance).toBe(
    FULL_TICKETS,
  );

  // One pool increase equal to the ticket count.
  const after = await actor.getGameState();
  expect(after.totalPrizePool - before.totalPrizePool).toBe(FULL_TICKETS);
});

it("keeps the history bounded at one entry for a 10,000,000-ticket submission", async () => {
  const bob = createIdentity("complex-large-bounded-history");
  actor.setIdentity(bob);

  expect(isOk(await actor.exchangeIcpToLucky(1_000_000_000_000n))).toBe(true);
  const profileBefore = await actor.getMyProfile();

  expect(isOk(await actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS))).toBe(
    true,
  );

  // One bounded history entry per submission, not one per note: the history
  // does not grow linearly with the ticket count.
  const profileAfter = await actor.getMyProfile();
  expect(profileAfter.betCount - profileBefore.betCount).toBe(1n);

  const history = await actor.getMyBetHistory(0n, 50n);
  expect(history.total).toBe(1n);
  expect(history.items).toHaveLength(1);
  expect(history.items[0].ticketCount).toBe(FULL_TICKETS);
  expect(history.items[0].cost).toBe(FULL_TICKETS);
  // The bounded record names the submission by its first selected digit per
  // position (the lexicographically smallest combination).
  expect(history.items[0].number.join("")).toBe("0000000");
});

it("merges a 10,000,000-ticket submission into the top-10 ranking on the read path", async () => {
  // A dedicated canister so exactly one complex submission is in the round:
  // the ranking is asserted on a known, isolated state.
  const isolated = await pic!.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  });
  const carol = createIdentity("complex-large-top-bets");
  isolated.actor.setIdentity(carol);

  expect(
    isOk(await isolated.actor.exchangeIcpToLucky(1_000_000_000_000n)),
  ).toBe(true);
  expect(
    isOk(
      await isolated.actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS),
    ),
  ).toBe(true);

  // Every number is in the full product, so every number carries one ticket.
  // The ranking is count desc, number asc, so the ten smallest numbers lead.
  const top = await isolated.actor.getTopBetNumbers();
  expect(top).toHaveLength(10);
  const numbers = top.map((entry) => entry.number.join(""));
  expect(numbers).toEqual([
    "0000000",
    "0000001",
    "0000002",
    "0000003",
    "0000004",
    "0000005",
    "0000006",
    "0000007",
    "0000008",
    "0000009",
  ]);
  for (const entry of top) {
    expect(entry.ticketCount).toBe(1n);
  }
});

it("sums a complex submission's contribution with a simple bet's tally on the read path", async () => {
  // A dedicated canister so the round holds exactly one simple bet and one
  // complex submission, and the merged counts are known.
  const isolated = await pic!.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  });

  // A simple bet on 0000000 by one caller.
  const simple = createIdentity("complex-large-merge-simple");
  isolated.actor.setIdentity(simple);
  expect(
    isOk(await isolated.actor.exchangeIcpToLucky(100_000_000n)),
  ).toBe(true);
  expect(
    isOk(await isolated.actor.placeBet([0n, 0n, 0n, 0n, 0n, 0n, 0n], 1n)),
  ).toBe(true);

  // A full complex submission by another caller: it contributes one ticket to
  // every number, including 0000000.
  const complex = createIdentity("complex-large-merge-complex");
  isolated.actor.setIdentity(complex);
  expect(
    isOk(await isolated.actor.exchangeIcpToLucky(1_000_000_000_000n)),
  ).toBe(true);
  expect(
    isOk(
      await isolated.actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS),
    ),
  ).toBe(true);

  // 0000000 carries the simple bet's one ticket plus the complex submission's
  // one, so it leads with two; every other number carries one.
  const top = await isolated.actor.getTopBetNumbers();
  const byNumber = new Map(
    top.map((entry) => [entry.number.join(""), entry.ticketCount]),
  );
  expect(byNumber.get("0000000")).toBe(2n);
  expect(byNumber.get("0000001")).toBe(1n);
  expect(top[0].number.join("")).toBe("0000000");
  expect(top[0].ticketCount).toBe(2n);
});

it("lists each number once with its cumulative count when several complex submissions overlap", async () => {
  // A dedicated canister so the round holds exactly two full submissions.
  const isolated = await pic!.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  });

  // Two callers each submit the full 10x7 selection. Every number is in both
  // products, so every number carries two tickets.
  const first = createIdentity("complex-large-overlap-a");
  isolated.actor.setIdentity(first);
  expect(
    isOk(await isolated.actor.exchangeIcpToLucky(1_000_000_000_000n)),
  ).toBe(true);
  expect(
    isOk(
      await isolated.actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS),
    ),
  ).toBe(true);

  const second = createIdentity("complex-large-overlap-b");
  isolated.actor.setIdentity(second);
  expect(
    isOk(await isolated.actor.exchangeIcpToLucky(1_000_000_000_000n)),
  ).toBe(true);
  expect(
    isOk(
      await isolated.actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS),
    ),
  ).toBe(true);

  // The top-10 is a ranking of distinct numbers: each number appears once with
  // its cumulative ticket count (two here), ordered count desc then number asc.
  const top = await isolated.actor.getTopBetNumbers();
  expect(top).toHaveLength(10);
  const numbers = top.map((entry) => entry.number.join(""));
  expect(new Set(numbers).size).toBe(numbers.length);
  expect(numbers).toEqual([
    "0000000",
    "0000001",
    "0000002",
    "0000003",
    "0000004",
    "0000005",
    "0000006",
    "0000007",
    "0000008",
    "0000009",
  ]);
  for (const entry of top) {
    expect(entry.ticketCount).toBe(2n);
  }
});

it("consumes exactly one 3-second cooldown for a 10,000,000-ticket submission", async () => {
  const dana = createIdentity("complex-large-cooldown");
  actor.setIdentity(dana);

  expect(isOk(await actor.exchangeIcpToLucky(1_000_000_000_000n))).toBe(true);
  expect(isOk(await actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS))).toBe(
    true,
  );

  // The whole submission is one game action, so an immediate follow-up is
  // rejected by the single cooldown it consumed.
  const second = await actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS);
  expect(errorKind(second)).toBe("rateLimited");
  if (second !== null && "rateLimited" in second) {
    expect(second.rateLimited.remainingMs).toBeGreaterThan(0n);
  }
});

it("rejects a full selection the balance cannot cover without a partial debit", async () => {
  const erik = createIdentity("complex-large-insufficient");
  actor.setIdentity(erik);

  // Fund 9,999,900 Lucky — short of the full 10,000,000-ticket cost. The ICP
  // amount is a whole multiple of the exchange step (0.1 ICP = 100 Lucky).
  expect(isOk(await actor.exchangeIcpToLucky(999_990_000_000n))).toBe(true);
  const profileBefore = await actor.getMyProfile();
  expect(profileBefore.luckyBalance).toBe(9_999_900n);

  const result = await actor.placeBetSelections(FULL_SELECTION, FULL_COUNTS);
  expect(errorKind(result)).toBe("insufficientBalance");

  // No partial deduction: the balance is exactly what it was before.
  const profileAfter = await actor.getMyProfile();
  expect(profileAfter.luckyBalance).toBe(profileBefore.luckyBalance);
  expect(profileAfter.betCount).toBe(profileBefore.betCount);
});
