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

function isOk(result: object | null | undefined): boolean {
  return result !== null && result !== undefined && "ok" in result;
}

/** A 7-digit bet number from a string like "1234567". */
function betNumber(value: string): bigint[] {
  return value.split("").map((d) => BigInt(d));
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
 * Characterization baseline for draw-time win matching of a complex (复式)
 * submission, which the accepted "submit a full 10x7 selection without IC0522"
 * change must NOT alter.
 *
 * The request intentionally changes how a large complex bet is recorded (a
 * bounded aggregate instead of per-note expansion), but every combination must
 * still participate in the draw with the existing match rules. This file gets
 * its own canister so the prize pool — and therefore the drawn number — is
 * deterministic.
 *
 * With no crowdfunding, the winning digits 1-3 are the leading digit of each
 * position, which for all-zero amounts is 9 (ties go to the larger digit). The
 * pool is 1,000,000 + 1,000 tickets = 1,001,000, so digits 4-5 are 0,0, and the
 * crowdfund total is 0, so digits 6-7 are 0,0. The drawn number is therefore
 * 9990000. The selection covers all ten digits in positions 1-3 and digit 0 in
 * positions 4-7, so every combination matches positions 4-7 and the first three
 * digits decide the tier: 9990000 matches all seven (tier 1), exactly two 9s
 * match six (tier 2), exactly one 9 matches five (tier 3), and no 9 matches
 * four (tier 4). Every one of the 1,000 combinations therefore participates in
 * the draw with the existing match rules.
 */
it("matches a complex bet's combinations against the drawn number and pays the tier", async () => {
  const dana = createIdentity("complex-draw-match");
  actor.setIdentity(dana);

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

  const round = (await actor.getGameState()).round;

  // The controller fast-forwards the round so the draw and payout run.
  const controller = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  expect(isOk(await controller.devAdvanceRound())).toBe(true);

  const draw = await actor.getDrawResult(round);
  expect(draw).toHaveLength(1);
  const result = draw[0];
  expect(result.winningNumber).toEqual(betNumber("9990000"));

  // Every combination participated in the draw: the per-tier winning-ticket
  // counts sum to the full 1,000-ticket submission.
  const tierCount = (tier: bigint): bigint =>
    result.tiers.find((entry) => entry.tier === tier)?.winningTickets ?? 0n;
  expect(tierCount(1n)).toBe(1n); // 9990000
  expect(tierCount(2n)).toBe(27n); // exactly two 9s
  expect(tierCount(3n)).toBe(243n); // exactly one 9
  expect(tierCount(4n)).toBe(729n); // no 9
  expect(tierCount(1n) + tierCount(2n) + tierCount(3n) + tierCount(4n)).toBe(
    1000n,
  );

  // The caller's best matched tier is 1 and the payout is positive.
  expect(result.callerTier).toEqual([1n]);
  expect(result.callerWinnings).toBeGreaterThan(0n);

  const tier1 = result.tiers.find((tier) => tier.tier === 1n);
  expect(tier1).toBeDefined();
  expect(tier1?.payoutPerTicket).toBeGreaterThan(0n);

  // The win is reflected in the caller's bounded win history.
  const wins = await actor.getMyWinHistory(0n, 50n);
  expect(wins.total).toBeGreaterThan(0n);
  expect(wins.items.length).toBeGreaterThan(0);
  expect(wins.items[0].tier).toBe(1n);
  expect(wins.items[0].payout).toBeGreaterThan(0n);
});
