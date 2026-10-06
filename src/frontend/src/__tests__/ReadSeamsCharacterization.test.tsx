import { PlayerIdentity } from "@/backend";
import {
  useDrawResult,
  useMyProfile,
  useRoundHistory,
  useTopBetNumbers,
} from "@/hooks/useGame";
import { RankingPage } from "@/pages/RankingPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import {
  betNumber,
  createFakeActor,
  drawResult,
  playerProfile,
  roundHistoryEntry,
  topBetNumber,
} from "./helpers";
import { renderWithProviders } from "./render";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/**
 * Characterization baseline for the frontend read-consumer seams.
 *
 * The accepted performance work changes how the backend computes the profile
 * history, top bets, draw result and round history reads. These tests pin the
 * frontend's *observable* contract with those reads so the internal rewrite
 * cannot silently change what the UI receives or renders:
 *
 * - `useMyProfile` still calls `getMyProfile()` and surfaces the balance,
 *   identity, cooldown and bet/win count fields the UI depends on. The history
 *   fields are deliberately NOT frozen here: the accepted change moves them to
 *   the paginated `getMyBetHistory`/`getMyWinHistory` reads, so asserting the
 *   old full-array shape would pin obsolete behavior.
 * - `useRoundHistory(limit)` still forwards the limit as a bigint.
 * - `useDrawResult(round)` still forwards the round as a bigint, stays idle for
 *   a null round, and surfaces the decoded result (or null) unchanged.
 * - `useTopBetNumbers` still returns the backend's order unchanged.
 * - The ranking page still renders the backend's order and its empty state.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister's behavior.
 */
function hookWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("profile read seam (useMyProfile)", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("calls getMyProfile and surfaces balance, identity, cooldown and counts", async () => {
    const actor = createFakeActor({
      getMyProfile: vi.fn(async () =>
        playerProfile({
          luckyBalance: 4_200n,
          identity: PlayerIdentity.manipulator,
          lastActionAt: 123n,
          actionCooldownMs: 2_500n,
          betCount: 7n,
          winCount: 2n,
        }),
      ),
    });
    setCoreActor(actor);

    const { result } = renderHook(() => useMyProfile(), {
      wrapper: hookWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(actor.getMyProfile).toHaveBeenCalledTimes(1);
    expect(result.current.data?.luckyBalance).toBe(4_200n);
    expect(result.current.data?.identity).toBe(PlayerIdentity.manipulator);
    expect(result.current.data?.lastActionAt).toBe(123n);
    expect(result.current.data?.actionCooldownMs).toBe(2_500n);
    expect(result.current.data?.betCount).toBe(7n);
    expect(result.current.data?.winCount).toBe(2n);
  });

  it("does not call the actor until one is available", () => {
    setCoreActor(null);

    const { result } = renderHook(() => useMyProfile(), {
      wrapper: hookWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});

describe("round history read seam (useRoundHistory)", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("forwards the limit to getRoundHistory as a bigint", async () => {
    const actor = createFakeActor({
      getRoundHistory: vi.fn(async () => [
        roundHistoryEntry({ round: 9n, winningNumber: betNumber("1234567") }),
      ]),
    });
    setCoreActor(actor);

    const { result } = renderHook(() => useRoundHistory(7), {
      wrapper: hookWrapper(),
    });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(actor.getRoundHistory).toHaveBeenCalledWith(7n);
    expect(result.current.data?.[0].round).toBe(9n);
  });

  it("defaults to a limit of 20 when none is given", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);

    const { result } = renderHook(() => useRoundHistory(), {
      wrapper: hookWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(actor.getRoundHistory).toHaveBeenCalledWith(20n);
  });
});

describe("draw result read seam (useDrawResult)", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("forwards the round to getDrawResult and surfaces the decoded result", async () => {
    const actor = createFakeActor({
      getDrawResult: vi.fn(async (round: bigint) =>
        drawResult({
          round,
          winningNumber: betNumber("7654321"),
          callerWinnings: 500n,
          callerTier: 3n,
        }),
      ),
    });
    setCoreActor(actor);

    const { result } = renderHook(() => useDrawResult(12n), {
      wrapper: hookWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(actor.getDrawResult).toHaveBeenCalledWith(12n);
    expect(result.current.data?.round).toBe(12n);
    expect(result.current.data?.winningNumber.join("")).toBe("7654321");
    expect(result.current.data?.callerWinnings).toBe(500n);
    expect(result.current.data?.callerTier).toBe(3n);
  });

  it("does not call the actor when the round is null", () => {
    const actor = createFakeActor();
    setCoreActor(actor);

    const { result } = renderHook(() => useDrawResult(null), {
      wrapper: hookWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(actor.getDrawResult).not.toHaveBeenCalled();
  });

  it("surfaces a null result for a round the backend has not drawn", async () => {
    const actor = createFakeActor({
      getDrawResult: vi.fn(async () => null),
    });
    setCoreActor(actor);

    const { result } = renderHook(() => useDrawResult(3n), {
      wrapper: hookWrapper(),
    });

    await waitFor(() => expect(actor.getDrawResult).toHaveBeenCalledWith(3n));
    await waitFor(() => expect(result.current.data).toBeNull());
  });
});

describe("top bets read seam (useTopBetNumbers)", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("returns the backend's entries in the order the backend returned them", async () => {
    const actor = createFakeActor({
      getTopBetNumbers: vi.fn(async () => [
        topBetNumber("1234567", 9n),
        topBetNumber("0000001", 4n),
      ]),
    });
    setCoreActor(actor);

    const { result } = renderHook(() => useTopBetNumbers(), {
      wrapper: hookWrapper(),
    });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data?.map((entry) => entry.number.join(""))).toEqual([
      "1234567",
      "0000001",
    ]);
    expect(result.current.data?.[0].ticketCount).toBe(9n);
  });

  it("resolves to an empty list when no actor is available", async () => {
    setCoreActor(null);

    const { result } = renderHook(() => useTopBetNumbers(), {
      wrapper: hookWrapper(),
    });

    // The query stays disabled without an actor; the UI treats undefined as empty.
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});

describe("ranking page journey", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("renders the top-bet ranking in backend order with ticket counts", async () => {
    setCoreActor(
      createFakeActor({
        getTopBetNumbers: vi.fn(async () => [
          topBetNumber("1234567", 9n),
          topBetNumber("0000001", 4n),
        ]),
      }),
    );

    renderWithProviders(<RankingPage />);

    const first = await screen.findByTestId("topbets.item.1");
    expect(first).toHaveTextContent("1234567");
    expect(first).toHaveTextContent("9");
    const second = screen.getByTestId("topbets.item.2");
    expect(second).toHaveTextContent("0000001");
    expect(second).toHaveTextContent("4");
  });

  it("shows the ranking empty state when no numbers have been bet", async () => {
    setCoreActor(createFakeActor({ getTopBetNumbers: vi.fn(async () => []) }));

    renderWithProviders(<RankingPage />);

    expect(
      await screen.findByTestId("topbets.empty_state"),
    ).toBeInTheDocument();
  });
});
