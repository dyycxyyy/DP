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

/**
 * Characterization baseline for the user-visible contract of a complex (复式)
 * submission, which the accepted "submit a full 10x7 selection without IC0522"
 * change must NOT alter.
 *
 * The request intentionally changes how the backend records a large complex
 * bet: it will stop expanding the cartesian product note-by-note and record a
 * bounded aggregate instead. These tests therefore deliberately do NOT pin the
 * per-combination expansion internals or the exact number of history records a
 * large submission produces. They pin the observable contract instead: one
 * summed debit of tickets x 1 Lucky, one pool increase equal to the ticket
 * count, and one 3-second cooldown.
 *
 * The selection is 10 x 10 x 10 x 1 x 1 x 1 x 1 = 1,000 tickets: large enough
 * to exercise the aggregate path, small enough that the current per-note
 * expansion completes well inside the instruction limit. The 10,000,000-note
 * case is the behavior the request intentionally changes and is not asserted.
 */
it("charges one summed debit and one pool increase for a 1,000-ticket complex bet", async () => {
  const alice = createIdentity("complex-aggregate");
  actor.setIdentity(alice);

  // Fund 1,000 Lucky through the real exchange (1 ICP = 1000 Lucky).
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const before = await actor.getGameState();
  const profileBefore = await actor.getMyProfile();

  // Positions 1-3: all ten digits; positions 4-7: one digit each.
  // 10 x 10 x 10 x 1 x 1 x 1 x 1 = 1,000 tickets.
  const selections = [
    [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
    [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
    [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
    [0n],
    [0n],
    [0n],
    [0n],
  ];
  const counts = [10n, 10n, 10n, 1n, 1n, 1n, 1n];
  expect(isOk(await actor.placeBetSelections(selections, counts))).toBe(true);

  // One summed deduction of the product, not one per combination.
  const profileAfter = await actor.getMyProfile();
  expect(profileBefore.luckyBalance - profileAfter.luckyBalance).toBe(1000n);
  // Accepted change: the submission is recorded as one bounded history entry
  // carrying the full ticket count, so `betCount` grows by one per submission
  // rather than by the ticket count. The history stays bounded as the ticket
  // count grows.
  expect(profileAfter.betCount - profileBefore.betCount).toBe(1n);

  // One pool increase equal to the ticket count.
  const after = await actor.getGameState();
  expect(after.totalPrizePool - before.totalPrizePool).toBe(1000n);

  // The bounded history entry carries the full ticket count and cost.
  const history = await actor.getMyBetHistory(0n, 50n);
  expect(history.total).toBe(1n);
  expect(history.items).toHaveLength(1);
  expect(history.items[0].ticketCount).toBe(1000n);
  expect(history.items[0].cost).toBe(1000n);
});

it("consumes exactly one 3-second cooldown for a 1,000-ticket complex bet", async () => {
  const bob = createIdentity("complex-cooldown");
  actor.setIdentity(bob);

  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  const selections = [
    [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
    [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
    [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n],
    [0n],
    [0n],
    [0n],
    [0n],
  ];
  const counts = [10n, 10n, 10n, 1n, 1n, 1n, 1n];
  expect(isOk(await actor.placeBetSelections(selections, counts))).toBe(true);

  // The whole submission is one game action, so an immediate follow-up is
  // rejected by the single cooldown it consumed.
  const second = await actor.placeBetSelections(selections, counts);
  expect(errorKind(second)).toBe("rateLimited");
  if (second !== null && "rateLimited" in second) {
    expect(second.rateLimited.remainingMs).toBeGreaterThan(0n);
  }
});
