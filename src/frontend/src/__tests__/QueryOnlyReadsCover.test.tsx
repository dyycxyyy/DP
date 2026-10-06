import { Phase } from "@/backend";
import { AppShell } from "@/components/AppShell";
import {
  POLL_FAST_MS,
  POLL_NEAR_TRANSITION_MS,
  POLL_SLOW_MS,
  adaptivePollInterval,
} from "@/hooks/useGame";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
  setCoreActor,
} from "./core-mock";
import { createFakeActor, gameState } from "./helpers";
import { renderWithProviders } from "./render";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

// The shell renders router `Link`s. Stub the router surface to plain anchors so
// the shell can be exercised without standing up a router; `useRouterState`
// reports the arena path.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/" } }),
}));

/**
 * Cover for the read/write cost split.
 *
 * The accepted work routes read-only data through query calls and makes the
 * shell's polling phase-adaptive, so a page that only reads never triggers a
 * write. The actor is a local typed mock, so this proves the frontend's
 * contract with the actor, never the real canister.
 */
describe("adaptivePollInterval", () => {
  it("polls fast when the phase deadline is near", () => {
    const near =
      BigInt(Date.now() + POLL_NEAR_TRANSITION_MS - 1_000) * 1_000_000n;
    expect(adaptivePollInterval(near)).toBe(POLL_FAST_MS);
  });

  it("polls slow when the phase has plenty of time left", () => {
    const far = BigInt(Date.now() + 300_000) * 1_000_000n;
    expect(adaptivePollInterval(far)).toBe(POLL_SLOW_MS);
  });

  it("falls back to the slow cadence without a deadline", () => {
    expect(adaptivePollInterval(undefined)).toBe(POLL_SLOW_MS);
  });
});

describe("shell polling performs no writes", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("reads state and profile without invoking any write method", async () => {
    const actor = createFakeActor({
      getGameState: vi.fn(async () => gameState({ phase: Phase.betting })),
    });
    setCoreActor(actor);

    renderWithProviders(
      <AppShell>
        <div data-ocid="test.child" />
      </AppShell>,
    );

    await waitFor(() => expect(actor.getGameState).toHaveBeenCalled());
    await waitFor(() => expect(actor.getMyProfile).toHaveBeenCalled());

    // Reads only: no write method is ever called by mounting/polling the shell.
    expect(actor.placeBet).not.toHaveBeenCalled();
    expect(actor.placeBets).not.toHaveBeenCalled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
    expect(actor.contributeCrowdfund).not.toHaveBeenCalled();
    expect(actor.exchangeIcpToLucky).not.toHaveBeenCalled();
    expect(actor.exchangeLuckyToIcp).not.toHaveBeenCalled();
    expect(actor.transferIcp).not.toHaveBeenCalled();
    expect(actor.transferLucky).not.toHaveBeenCalled();
    expect(actor.stopNextRound).not.toHaveBeenCalled();
    expect(actor.resumeRound).not.toHaveBeenCalled();
    expect(actor.withdrawFromPool).not.toHaveBeenCalled();
    expect(actor.resetGameData).not.toHaveBeenCalled();
    expect(actor.setGuideText).not.toHaveBeenCalled();
  });
});
