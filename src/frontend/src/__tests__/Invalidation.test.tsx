import { useDevAdvanceRound, usePlaceBet } from "@/hooks/useGame";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreMock, resetCoreMock, setCoreActor } from "./core-mock";
import { createFakeActor, ok } from "./helpers";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => ({
    identity: undefined,
    login: coreMock.login,
    clear: coreMock.clear,
    loginStatus: coreMock.isAuthenticated ? "success" : "idle",
    isInitializing: false,
    isLoginIdle: !coreMock.isAuthenticated,
    isLoggingIn: false,
    isLoginSuccess: coreMock.isAuthenticated,
    isLoginError: false,
    isAuthenticated: coreMock.isAuthenticated,
  }),
}));

/**
 * Targeted per-mutation invalidation.
 *
 * The accepted performance work centralizes polling in `AppShell` and replaces
 * the blanket `["game"]` invalidation with per-mutation key lists, so a write
 * refetches only the queries it actually changes. These tests pin the observable
 * contract: a bet invalidates the paginated bet-history prefix (plus the round
 * state, profile and top-bets), and a draw invalidates the paginated win-history
 * prefix (plus the round state, profile and round history). The actor is a local
 * typed mock, so this proves the frontend's cache contract, never the real
 * canister's behavior.
 */
function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function wrapperFor(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/** The query keys `invalidateQueries` was called with, in order. */
function invalidatedKeys(spy: { mock: { calls: unknown[][] } }): unknown[][] {
  return spy.mock.calls.map(
    (call) => (call[0] as { queryKey: unknown[] }).queryKey,
  );
}

describe("targeted mutation invalidation", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("invalidates the paginated bet-history prefix after a bet", async () => {
    const actor = createFakeActor({
      placeBetSelections: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const queryClient = makeClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => usePlaceBet(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate({
      selections: [[1n], [2n], [3n], [4n], [5n], [6n], [7n]],
      counts: [1n, 1n, 1n, 1n, 1n, 1n, 1n],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(actor.placeBetSelections).toHaveBeenCalledTimes(1);

    const keys = invalidatedKeys(spy);
    // The paginated bet-history prefix is invalidated so every mounted page
    // variant refreshes, not just the one currently on screen.
    expect(keys).toContainEqual(["game", "betHistory"]);
    // The round pools, the caller's balance/cooldown and the top-bet ranking
    // all move on a bet.
    expect(keys).toContainEqual(["game", "state"]);
    expect(keys).toContainEqual(["game", "profile"]);
    expect(keys).toContainEqual(["game", "topBets"]);
    // A bet does not touch the win history.
    expect(keys).not.toContainEqual(["game", "winHistory"]);
  });

  it("invalidates the paginated win-history prefix after a draw", async () => {
    const actor = createFakeActor({ devAdvanceRound: vi.fn(async () => ok()) });
    setCoreActor(actor);
    const queryClient = makeClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDevAdvanceRound(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(actor.devAdvanceRound).toHaveBeenCalledTimes(1);

    const keys = invalidatedKeys(spy);
    // A completed draw can credit the caller, so the paginated win-history
    // prefix and the round history both refresh.
    expect(keys).toContainEqual(["game", "winHistory"]);
    expect(keys).toContainEqual(["game", "history"]);
    expect(keys).toContainEqual(["game", "state"]);
    expect(keys).toContainEqual(["game", "profile"]);
    // A draw does not touch the caller's bet history.
    expect(keys).not.toContainEqual(["game", "betHistory"]);
  });
});
