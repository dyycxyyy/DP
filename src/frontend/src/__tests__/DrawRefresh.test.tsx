import { Phase } from "@/backend";
import { useRoundHistory } from "@/hooks/useGame";
import { ArenaPage } from "@/pages/ArenaPage";
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
  gameState,
  roundHistoryEntry,
} from "./helpers";
import { renderWithProviders } from "./render";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

/**
 * The backend advances rounds lazily on read, so a round that completes while
 * the page is open only becomes visible when the history query polls again.
 * These tests pin that polling contract: the draw result panel must surface a
 * newly completed round without any user interaction.
 *
 * They use real timers because React Query's `refetchInterval` is a real
 * interval; the 5s poll is the behavior under test, so the wait is genuine.
 */
describe("draw-result auto-refresh", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("refetches round history on the configured interval", async () => {
    const getRoundHistory = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([roundHistoryEntry({ round: 8n })]);
    setCoreActor(createFakeActor({ getRoundHistory }));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRoundHistory(1), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([]));

    await waitFor(
      () => {
        expect(getRoundHistory.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(result.current.data).toHaveLength(1);
      },
      { timeout: 8_000 },
    );
  }, 15_000);

  it("surfaces a newly completed draw in the panel without user interaction", async () => {
    // First poll: no completed round yet. Later polls: round 8 has been drawn.
    const getRoundHistory = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        roundHistoryEntry({
          round: 8n,
          winningNumber: betNumber("7654321"),
          totalPrizePool: 1_000_321n,
          crowdfundTotal: 12_345n,
        }),
      ]);

    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({ round: 8n, phase: Phase.betting }),
        ),
        getRoundHistory,
        getDrawResult: vi.fn(async (round: bigint) =>
          drawResult({ round, winningNumber: betNumber("7654321") }),
        ),
      }),
    );

    renderWithProviders(<ArenaPage />);

    // Before the poll, the panel shows the pre-draw empty state.
    expect(
      await screen.findByTestId("basis.tiers_empty_state"),
    ).toHaveTextContent("本局尚未开奖");
    expect(screen.queryByTestId("draw.winning_number")).not.toBeInTheDocument();

    // No click or reload: the panel must update itself on the next poll.
    await waitFor(
      () =>
        expect(screen.getByTestId("draw.winning_number")).toHaveTextContent(
          "7654321",
        ),
      { timeout: 8_000 },
    );
    expect(getRoundHistory.mock.calls.length).toBeGreaterThanOrEqual(2);
  }, 15_000);

  it("replaces the shown draw when a later round completes", async () => {
    const getRoundHistory = vi
      .fn()
      .mockResolvedValueOnce([
        roundHistoryEntry({ round: 8n, winningNumber: betNumber("1111111") }),
      ])
      .mockResolvedValue([
        roundHistoryEntry({ round: 9n, winningNumber: betNumber("2222222") }),
      ]);

    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({ round: 9n, phase: Phase.betting }),
        ),
        getRoundHistory,
        getDrawResult: vi.fn(async (round: bigint) =>
          drawResult({
            round,
            winningNumber:
              round === 9n ? betNumber("2222222") : betNumber("1111111"),
          }),
        ),
      }),
    );

    renderWithProviders(<ArenaPage />);

    await waitFor(() =>
      expect(screen.getByTestId("draw.winning_number")).toHaveTextContent(
        "1111111",
      ),
    );

    await waitFor(
      () =>
        expect(screen.getByTestId("draw.winning_number")).toHaveTextContent(
          "2222222",
        ),
      { timeout: 8_000 },
    );
  }, 15_000);
});
