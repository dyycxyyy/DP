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
const admin = createIdentity("admin-guide-admin");

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
 * to `{ ok: null }` / `{ roundStopped: null }` — NOT the frontend wrapper's
 * `{ __kind__: ... }` shape.
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

/**
 * The admin control surface and the admin-editable guide.
 *
 * Admin authority is a platform role, not the anonymous installing principal:
 * `isCallerAdmin` returns false for anonymous callers, so the default
 * `setupCanister` sender is NOT an admin. This file installs with a named
 * sender, which makes that identity a canister controller and therefore an
 * admin recovery path. These tests call the real public methods the admin
 * console and guide page consume, so a backend whose admin/guide endpoints are
 * unimplemented stubs fails here rather than only in the mocked frontend suite.
 */

it("reads the admin status and the default guide without trapping", async () => {
  const status = await actor.getAdminStatus();
  expect(status.roundStopped).toBe(false);
  // The prize pool is seeded at 1,000,000 on a fresh canister.
  expect(status.balances.prizePool).toBe(1_000_000n);
  expect(status.balances.treasury).toBe(0n);
  expect(status.balances.exchangeLucky).toBe(1_000_000_000n);
  expect(status.balances.exchangeIcp).toBe(1_000_000_000_000n);

  const guide = await actor.getGuideText();
  expect(guide.isSet).toBe(false);
  expect(guide.text).toBe("");
});

it("reports the admin caller as admin and a named non-admin caller as not", async () => {
  const controller = adminActor();
  await expect(controller.isCallerController()).resolves.toBe(true);

  const visitor = createIdentity("admin-guide-not-controller");
  actor.setIdentity(visitor);
  await expect(actor.isCallerController()).resolves.toBe(false);
});

it("stops the round so betting is rejected, then resumes it", async () => {
  const controller = adminActor();
  const player = createIdentity("admin-guide-stop-player");

  // Fund the player through the real exchange so a bet would otherwise succeed.
  actor.setIdentity(player);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);

  // The admin stops the next round.
  expect(isOk(await controller.stopNextRound())).toBe(true);
  expect((await controller.getAdminStatus()).roundStopped).toBe(true);

  // A funded player's bet is now rejected with the stopped variant.
  const stopped = await actor.placeBet(betNumber("1234567"), 1n);
  expect(errorKind(stopped)).toBe("roundStopped");

  // The admin resumes, and the same bet is accepted.
  expect(isOk(await controller.resumeRound())).toBe(true);
  expect((await controller.getAdminStatus()).roundStopped).toBe(false);
  expect(isOk(await actor.placeBet(betNumber("1234567"), 1n))).toBe(true);
});

it("rejects stop and resume from a non-admin", async () => {
  const visitor = createIdentity("admin-guide-stop-rejected");
  actor.setIdentity(visitor);

  expect(errorKind(await actor.stopNextRound())).toBe("notRegistered");
  expect(errorKind(await actor.resumeRound())).toBe("notRegistered");
});

it("round-trips the guide text through the real canister", async () => {
  const controller = adminActor();

  const saved = "第一段\n\n第二段";
  expect(isOk(await controller.setGuideText(saved))).toBe(true);

  const guide = await controller.getGuideText();
  expect(guide.isSet).toBe(true);
  expect(guide.text).toBe(saved);

  // The saved text is readable by a non-admin too.
  const visitor = createIdentity("admin-guide-reader");
  actor.setIdentity(visitor);
  const read = await actor.getGuideText();
  expect(read.isSet).toBe(true);
  expect(read.text).toBe(saved);
});

it("rejects a guide save from a non-admin and an over-length text", async () => {
  const visitor = createIdentity("admin-guide-writer-rejected");
  actor.setIdentity(visitor);
  expect(errorKind(await actor.setGuideText("not allowed"))).toBe(
    "notRegistered",
  );

  const controller = adminActor();
  const tooLong = "x".repeat(20_001);
  expect(errorKind(await controller.setGuideText(tooLong))).toBe(
    "amountTooLarge",
  );
});

it("withdraws from the prize pool and credits the recipient", async () => {
  const controller = adminActor();
  const recipient = createIdentity("admin-guide-recipient");

  const before = await controller.getAdminStatus();
  const result = await controller.withdrawFromPool(
    { prizePool: null },
    500n,
    recipient.getPrincipal(),
  );
  expect("ok" in result).toBe(true);
  if (!("ok" in result)) return;
  expect(result.ok.amount).toBe(500n);
  expect(result.ok.remaining).toBe(before.balances.prizePool - 500n);

  // The pool is debited and the recipient's Lucky balance credited, so the
  // withdrawn tokens stay in circulation.
  const after = await controller.getAdminStatus();
  expect(after.balances.prizePool).toBe(before.balances.prizePool - 500n);

  actor.setIdentity(recipient);
  expect((await actor.getMyProfile()).luckyBalance).toBe(500n);
});

it("rejects an over-balance withdrawal and a zero amount", async () => {
  const controller = adminActor();
  const recipient = createIdentity("admin-guide-recipient-2");

  const tooMuch = await controller.withdrawFromPool(
    { prizePool: null },
    999_999_999_999n,
    recipient.getPrincipal(),
  );
  expect("err" in tooMuch).toBe(true);
  if ("err" in tooMuch) {
    expect(errorKind(tooMuch.err)).toBe("poolInsufficient");
  }

  const zero = await controller.withdrawFromPool(
    { prizePool: null },
    0n,
    recipient.getPrincipal(),
  );
  expect("err" in zero).toBe(true);
  if ("err" in zero) {
    expect(errorKind(zero.err)).toBe("invalidAmount");
  }
});

it("rejects a withdrawal from a non-admin", async () => {
  const visitor = createIdentity("admin-guide-withdraw-rejected");
  actor.setIdentity(visitor);

  const result = await actor.withdrawFromPool(
    { prizePool: null },
    1n,
    createIdentity("admin-guide-withdraw-target").getPrincipal(),
  );
  expect("err" in result).toBe(true);
  if ("err" in result) {
    expect(errorKind(result.err)).toBe("notRegistered");
  }
});

it("resets game data back to its initial state", async () => {
  const controller = adminActor();

  // Seed some state: a player with a balance and a non-default prize pool.
  const player = createIdentity("admin-guide-reset-player");
  actor.setIdentity(player);
  expect(isOk(await actor.exchangeIcpToLucky(100_000_000n))).toBe(true);
  expect(isOk(await actor.placeBet(betNumber("7654321"), 1n))).toBe(true);

  const before = await controller.getAdminStatus();
  expect(before.balances.prizePool).toBeGreaterThan(0n);

  const reset = await controller.resetGameData();
  expect("ok" in reset).toBe(true);
  if (!("ok" in reset)) return;
  expect(reset.ok.round).toBe(1n);
  expect(reset.ok.playersCleared).toBeGreaterThan(0n);

  const after = await controller.getAdminStatus();
  expect(after.balances.prizePool).toBe(0n);
  expect(after.balances.treasury).toBe(0n);
  expect(after.balances.exchangeLucky).toBe(0n);
  expect(after.balances.exchangeIcp).toBe(0n);

  // The player's balance is cleared with the rest of the game data.
  actor.setIdentity(player);
  expect((await actor.getMyProfile()).luckyBalance).toBe(0n);
});

it("rejects a reset from a non-admin", async () => {
  const visitor = createIdentity("admin-guide-reset-rejected");
  actor.setIdentity(visitor);

  const result = await actor.resetGameData();
  expect("err" in result).toBe(true);
  if ("err" in result) {
    expect(errorKind(result.err)).toBe("notRegistered");
  }
});
