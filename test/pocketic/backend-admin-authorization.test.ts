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
 * installing principal: `getCallerRole` reports `#guest` for anonymous callers,
 * so the default `setupCanister` sender (anonymous) is NOT an admin. Installing
 * with a named sender makes that identity a canister controller, which the
 * backend treats as an admin recovery path (`getCallerRole` reports `#admin`).
 */
const admin = createIdentity("admin-authz-admin");

/** An actor calling as the admin identity. */
function adminActor(): Actor<_SERVICE> {
  const a = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  a.setIdentity(admin);
  return a;
}

/** The single variant key of a decoded `UserRole`, e.g. "admin". */
function roleKind(
  role: { admin: null } | { user: null } | { guest: null },
): string {
  return Object.keys(role)[0];
}

/** The single variant key of a decoded outcome variant, e.g. "ok" / "err". */
function outcomeKind(outcome: object): string {
  return Object.keys(outcome)[0];
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
 * Platform-role admin authorization and user management.
 *
 * Admin authority is the platform application-level role system
 * (`#admin` / `#user` / `#guest`), not the canister-controller identity. The
 * canister controller is kept as a recovery path: a controller that has never
 * registered still reports `#admin`. These tests call the real public methods
 * the admin console and role gate consume, so a backend whose authorization is
 * an unimplemented stub fails here rather than only in the mocked frontend
 * suite.
 *
 * `getCallerRole` is the app's own safe query and answers for every caller. The
 * platform package's `isCallerAdmin` is deliberately not called here: it traps
 * for an unregistered caller rather than returning a boolean, so it is not the
 * frontend's role gate.
 */

it("reports the controller as admin through the recovery path", async () => {
  const controller = adminActor();

  // The install sender is a canister controller but has never registered a
  // platform role, so this exercises the recovery path specifically.
  expect(roleKind(await controller.getCallerRole())).toBe("admin");
});

it("reports a non-controller anonymous caller as guest", async () => {
  // A freshly created actor calls as the anonymous principal until an identity
  // is set. Anonymous is not a controller here, so it must not be an admin.
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);

  expect(roleKind(await guest.getCallerRole())).toBe("guest");
});

it("reports an unregistered named caller as guest", async () => {
  const visitor = createIdentity("admin-authz-unregistered");
  actor.setIdentity(visitor);

  expect(roleKind(await actor.getCallerRole())).toBe("guest");
});

it("rejects listUsers from a non-admin caller", async () => {
  const visitor = createIdentity("admin-authz-list-rejected");
  actor.setIdentity(visitor);

  const outcome = await actor.listUsers();
  expect(outcomeKind(outcome)).toBe("err");
  if ("err" in outcome) {
    expect(Object.keys(outcome.err)[0]).toBe("notRegistered");
  }
});

it("promotes a user to admin, lists them, then demotes them back", async () => {
  const controller = adminActor();
  const target = createIdentity("admin-authz-target");
  const targetPrincipal = target.getPrincipal();

  // The target starts unregistered and is not an admin.
  actor.setIdentity(target);
  expect(roleKind(await actor.getCallerRole())).toBe("guest");

  // The admin promotes the target.
  const promoted = await controller.promoteToAdmin(targetPrincipal);
  expect(outcomeKind(promoted)).toBe("ok");
  if ("ok" in promoted) {
    expect(promoted.ok.principal.toText()).toBe(targetPrincipal.toText());
    expect(roleKind(promoted.ok.role)).toBe("admin");
  }

  // The target now reports admin.
  actor.setIdentity(target);
  expect(roleKind(await actor.getCallerRole())).toBe("admin");

  // The admin sees the target in the user list with the admin role.
  const listed = await controller.listUsers();
  expect(outcomeKind(listed)).toBe("ok");
  if ("ok" in listed) {
    const entry = listed.ok.find(
      (candidate) => candidate.principal.toText() === targetPrincipal.toText(),
    );
    expect(entry).toBeDefined();
    expect(roleKind(entry!.role)).toBe("admin");
  }

  // The admin demotes the target back to a regular user.
  const demoted = await controller.demoteToUser(targetPrincipal);
  expect(outcomeKind(demoted)).toBe("ok");
  if ("ok" in demoted) {
    expect(roleKind(demoted.ok.role)).toBe("user");
  }

  // The target is no longer an admin, but is still a registered user.
  actor.setIdentity(target);
  expect(roleKind(await actor.getCallerRole())).toBe("user");
});

it("rejects a role change from a non-admin caller", async () => {
  const visitor = createIdentity("admin-authz-change-rejected");
  const target = createIdentity("admin-authz-change-target");
  actor.setIdentity(visitor);

  const promoted = await actor.promoteToAdmin(target.getPrincipal());
  expect(outcomeKind(promoted)).toBe("err");
  if ("err" in promoted) {
    expect(Object.keys(promoted.err)[0]).toBe("notRegistered");
  }

  const demoted = await actor.demoteToUser(target.getPrincipal());
  expect(outcomeKind(demoted)).toBe("err");
  if ("err" in demoted) {
    expect(Object.keys(demoted.err)[0]).toBe("notRegistered");
  }
});
