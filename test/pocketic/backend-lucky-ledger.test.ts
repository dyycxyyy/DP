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
const admin = createIdentity("lucky-ledger-admin");

/** An actor calling as the admin identity. */
function adminActor(): Actor<_SERVICE> {
  const a = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  a.setIdentity(admin);
  return a;
}

/** The single variant key of a decoded variant, e.g. "mint" / "Ok" / "err". */
function variantKind(value: object): string {
  return Object.keys(value)[0];
}

/** An ICRC-1 account with no subaccount. */
function account(owner: { getPrincipal(): unknown }): {
  owner: unknown;
  subaccount: [] | [Uint8Array];
} {
  return { owner: owner.getPrincipal(), subaccount: [] };
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
 * The Lucky ICRC-1 / ICRC-2 / ICRC-3 ledger public API.
 *
 * These call the real canister methods the admin token panel and the wallet
 * consume, so a backend whose ledger is an unimplemented stub fails here rather
 * than only in the mocked frontend suite. The canister is installed with a
 * named sender, which makes that identity a controller and therefore an admin
 * recovery path for the minting surface.
 */

it("reports the ICRC-1 token metadata", async () => {
  await expect(actor.icrc1_name()).resolves.toBe("Lucky");
  await expect(actor.icrc1_symbol()).resolves.toBe("LUCKY");
  await expect(actor.icrc1_decimals()).resolves.toBe(0);
  await expect(actor.icrc1_fee()).resolves.toBe(0n);
});

it("includes the four-leaf-clover logo data URL in icrc1_metadata", async () => {
  const metadata = await actor.icrc1_metadata();
  const byKey = new Map(metadata.map((entry) => [entry.key, entry.value]));

  expect(byKey.get("icrc1:name")).toEqual({ Text: "Lucky" });
  expect(byKey.get("icrc1:symbol")).toEqual({ Text: "LUCKY" });
  expect(byKey.get("icrc1:decimals")).toEqual({ Nat: 0n });
  expect(byKey.get("icrc1:fee")).toEqual({ Nat: 0n });

  const logo = byKey.get("icrc1:logo");
  expect(logo).toBeDefined();
  expect(logo).toEqual(
    expect.objectContaining({ Text: expect.stringMatching(/^data:image\//) }),
  );
});

it("declares ICRC-1 and ICRC-2 as supported standards", async () => {
  const standards = await actor.icrc1_supported_standards();
  const names = standards.map((standard) => standard.name);
  expect(names).toContain("ICRC-1");
  expect(names).toContain("ICRC-2");
});

it("starts with zero supply and zero balances", async () => {
  const controller = adminActor();
  await expect(controller.icrc1_total_supply()).resolves.toBe(0n);
  await expect(
    controller.icrc1_balance_of(account(createIdentity("lucky-empty"))),
  ).resolves.toBe(0n);
});

it("mints to a target account and grows the total supply", async () => {
  const controller = adminActor();
  const target = createIdentity("lucky-mint-target");

  const before = await controller.icrc1_total_supply();
  const outcome = await controller.mintLucky({
    to: account(target),
    amount: 1000n,
    memo: [],
  });

  expect(variantKind(outcome)).toBe("ok");
  if ("ok" in outcome) {
    expect(outcome.ok.amount).toBe(1000n);
    expect(outcome.ok.totalSupply).toBe(before + 1000n);
    expect(outcome.ok.blockIndex).toBeGreaterThanOrEqual(0n);
  }

  await expect(
    controller.icrc1_balance_of(account(target)),
  ).resolves.toBe(1000n);
  await expect(controller.icrc1_total_supply()).resolves.toBe(before + 1000n);
});

it("rejects a mint from a non-admin caller without changing supply or balance", async () => {
  const controller = adminActor();
  const visitor = createIdentity("lucky-mint-rejected");
  const target = createIdentity("lucky-mint-rejected-target");

  const supplyBefore = await controller.icrc1_total_supply();

  actor.setIdentity(visitor);
  const outcome = await actor.mintLucky({
    to: account(target),
    amount: 500n,
    memo: [],
  });

  expect(variantKind(outcome)).toBe("err");
  if ("err" in outcome) {
    expect(variantKind(outcome.err)).toBe("notRegistered");
  }

  await expect(controller.icrc1_total_supply()).resolves.toBe(supplyBefore);
  await expect(
    controller.icrc1_balance_of(account(target)),
  ).resolves.toBe(0n);
});

it("transfers between accounts and records the block in icrc3_get_blocks", async () => {
  const controller = adminActor();
  const sender = createIdentity("lucky-transfer-sender");
  const recipient = createIdentity("lucky-transfer-recipient");

  // Fund the sender through the real admin mint.
  const minted = await controller.mintLucky({
    to: account(sender),
    amount: 1000n,
    memo: [],
  });
  expect(variantKind(minted)).toBe("ok");

  actor.setIdentity(sender);
  const result = await actor.icrc1_transfer({
    to: account(recipient),
    amount: 400n,
    fee: [],
    memo: [],
    from_subaccount: [],
    created_at_time: [],
  });

  expect(variantKind(result)).toBe("Ok");
  let blockIndex = -1n;
  if ("Ok" in result) {
    blockIndex = result.Ok;
  }

  await expect(actor.icrc1_balance_of(account(sender))).resolves.toBe(600n);
  await expect(actor.icrc1_balance_of(account(recipient))).resolves.toBe(400n);

  // The transfer is queryable in the block log at the returned index.
  const page = await controller.icrc3_get_blocks(blockIndex, 1n, []);
  expect(page.transactions).toHaveLength(1);
  expect(page.transactions[0].index).toBe(blockIndex);
  expect(page.transactions[0].amount).toBe(400n);
  expect(variantKind(page.transactions[0].kind)).toBe("transfer");
});

it("rejects a transfer above the balance with InsufficientFunds", async () => {
  const controller = adminActor();
  const sender = createIdentity("lucky-transfer-poor");
  const recipient = createIdentity("lucky-transfer-poor-target");

  await controller.mintLucky({ to: account(sender), amount: 100n, memo: [] });

  actor.setIdentity(sender);
  const result = await actor.icrc1_transfer({
    to: account(recipient),
    amount: 101n,
    fee: [],
    memo: [],
    from_subaccount: [],
    created_at_time: [],
  });

  expect(variantKind(result)).toBe("Err");
  if ("Err" in result) {
    expect(variantKind(result.Err)).toBe("InsufficientFunds");
  }
  await expect(actor.icrc1_balance_of(account(sender))).resolves.toBe(100n);
});

it("approves an allowance, reports it, and spends it with transfer_from", async () => {
  const controller = adminActor();
  const owner = createIdentity("lucky-approve-owner");
  const spender = createIdentity("lucky-approve-spender");
  const recipient = createIdentity("lucky-approve-recipient");

  await controller.mintLucky({ to: account(owner), amount: 1000n, memo: [] });

  // The owner grants the spender an allowance.
  actor.setIdentity(owner);
  const approved = await actor.icrc2_approve({
    spender: account(spender),
    amount: 300n,
    fee: [],
    memo: [],
    from_subaccount: [],
    expected_allowance: [],
    expires_at: [],
    created_at_time: [],
  });
  expect(variantKind(approved)).toBe("Ok");

  const allowance = await actor.icrc2_allowance({
    account: account(owner),
    spender: account(spender),
  });
  expect(allowance.allowance).toBe(300n);

  // The spender moves tokens under the allowance.
  actor.setIdentity(spender);
  const moved = await actor.icrc2_transfer_from({
    from: account(owner),
    to: account(recipient),
    amount: 200n,
    fee: [],
    memo: [],
    spender_subaccount: [],
    created_at_time: [],
  });
  expect(variantKind(moved)).toBe("Ok");

  await expect(actor.icrc1_balance_of(account(owner))).resolves.toBe(800n);
  await expect(actor.icrc1_balance_of(account(recipient))).resolves.toBe(200n);

  // The remaining allowance is the granted amount minus the spend.
  const remaining = await actor.icrc2_allowance({
    account: account(owner),
    spender: account(spender),
  });
  expect(remaining.allowance).toBe(100n);
});

it("rejects a transfer_from above the allowance with InsufficientAllowance", async () => {
  const controller = adminActor();
  const owner = createIdentity("lucky-overallow-owner");
  const spender = createIdentity("lucky-overallow-spender");
  const recipient = createIdentity("lucky-overallow-recipient");

  await controller.mintLucky({ to: account(owner), amount: 1000n, memo: [] });

  actor.setIdentity(owner);
  await actor.icrc2_approve({
    spender: account(spender),
    amount: 100n,
    fee: [],
    memo: [],
    from_subaccount: [],
    expected_allowance: [],
    expires_at: [],
    created_at_time: [],
  });

  actor.setIdentity(spender);
  const result = await actor.icrc2_transfer_from({
    from: account(owner),
    to: account(recipient),
    amount: 101n,
    fee: [],
    memo: [],
    spender_subaccount: [],
    created_at_time: [],
  });

  expect(variantKind(result)).toBe("Err");
  if ("Err" in result) {
    expect(variantKind(result.Err)).toBe("InsufficientAllowance");
  }
  await expect(actor.icrc1_balance_of(account(owner))).resolves.toBe(1000n);
});

it("reports the caller's ledger balance and the zero fee", async () => {
  const controller = adminActor();
  const holder = createIdentity("lucky-ledger-balance");

  await controller.mintLucky({ to: account(holder), amount: 777n, memo: [] });

  actor.setIdentity(holder);
  const balance = await actor.getLedgerBalance();
  expect(balance.balance).toBe(777n);
  expect(balance.fee).toBe(0n);
});

it("returns the token snapshot for the admin panel", async () => {
  const controller = adminActor();
  const info = await controller.getTokenInfo();
  expect(info.metadata.name).toBe("Lucky");
  expect(info.metadata.symbol).toBe("LUCKY");
  expect(info.metadata.decimals).toBe(0);
  expect(info.metadata.fee).toBe(0n);
  expect(info.metadata.logo).toMatch(/^data:image\//);
  expect(info.totalSupply).toBeGreaterThanOrEqual(0n);
});
