import { Phase } from "@/backend";
import { ArenaPage } from "@/pages/ArenaPage";
import { screen, waitFor } from "@testing-library/react";
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
  positionCrowdfund,
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
 * Full round-cycle characterization.
 *
 * The backend advances rounds lazily on read, so a round that completes while
 * the page is open only becomes visible when the history query polls again.
 * These tests pin the observable end-to-end contract on the arena page: a
 * completed round's winning number, its public generation basis and its tier
 * payouts all appear without any user interaction, and the winning number's
 * digits 4-7 agree with the basis derived from the round's own pool and
 * crowdfund totals.
 *
 * Real timers are used because React Query's `refetchInterval` is a real
 * interval; the 5s poll is the behavior under test, so the wait is genuine.
 */
describe("full round cycle on the arena page", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("surfaces the winning number, basis and payouts of a completed round without interaction", async () => {
    // Round 12 completes: pool 1,000,123 -> positions 4-5 = "23";
    // crowdfund 4,567 -> positions 6-7 = "67"; positions 1-3 from crowdfunding.
    const winning = betNumber("1234567");
    const getRoundHistory = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        roundHistoryEntry({
          round: 12n,
          winningNumber: winning,
          totalPrizePool: 1_000_123n,
          crowdfundTotal: 4_567n,
          totalDistributed: 500n,
          positions: [
            {
              position: 1n,
              winningDigit: 1n,
              winningAmount: 100_000n,
              locked: true,
              digitAmounts: [],
            },
            {
              position: 2n,
              winningDigit: 2n,
              winningAmount: 30_000n,
              locked: false,
              digitAmounts: [],
            },
            {
              position: 3n,
              winningDigit: 3n,
              winningAmount: 20_000n,
              locked: false,
              digitAmounts: [],
            },
          ],
        }),
      ]);

    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({ round: 12n, phase: Phase.betting }),
        ),
        getRoundHistory,
        getDrawResult: vi.fn(async (round: bigint) =>
          drawResult({
            round,
            winningNumber: winning,
            callerWinnings: 500n,
            callerTier: 3n,
            tiers: [
              {
                tier: 3n,
                winningTickets: 1n,
                payoutPerTicket: 500n,
                distributed: 500n,
              },
            ],
          }),
        ),
      }),
    );

    renderWithProviders(<ArenaPage />);

    // Before the poll, the round has not been drawn yet.
    expect(
      await screen.findByTestId("basis.tiers_empty_state"),
    ).toHaveTextContent("本局尚未开奖");
    expect(screen.queryByTestId("draw.winning_number")).not.toBeInTheDocument();

    // No click or reload: the completed round must appear on the next poll.
    await waitFor(
      () =>
        expect(screen.getByTestId("draw.winning_number")).toHaveTextContent(
          "1234567",
        ),
      { timeout: 8_000 },
    );

    // The public generation basis is published for all seven positions.
    expect(screen.getByTestId("basis.item.1")).toHaveTextContent("锁定数字 1");
    expect(screen.getByTestId("basis.item.4")).toHaveTextContent("23");
    expect(screen.getByTestId("basis.item.6")).toHaveTextContent("67");

    // The tier payout table and the caller's own winnings are observable.
    // The draw-result query fires after the history poll resolves, so wait for
    // it rather than asserting on the same tick the winning number appears.
    await waitFor(
      () => expect(screen.getByTestId("basis.tiers_table")).toBeInTheDocument(),
      { timeout: 8_000 },
    );
    expect(screen.getByTestId("basis.tier_row.1")).toHaveTextContent("500");
    expect(screen.getByTestId("basis.my_winnings")).toHaveTextContent("500");
    expect(screen.getByTestId("basis.my_tier")).toHaveTextContent("三位");

    expect(getRoundHistory.mock.calls.length).toBeGreaterThanOrEqual(2);
  }, 15_000);

  it("keeps the winning number's digits 4-7 consistent with the round's own pool and crowdfund totals", async () => {
    // Pool 1,234,567 -> last two digits "67"; crowdfund 89,012 -> "12".
    // The winning number's positions 4-7 must equal those derived digits.
    const winning = betNumber("1236712");
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({ round: 5n, phase: Phase.betting }),
        ),
        getRoundHistory: vi.fn(async () => [
          roundHistoryEntry({
            round: 5n,
            winningNumber: winning,
            totalPrizePool: 1_234_567n,
            crowdfundTotal: 89_012n,
          }),
        ]),
        getDrawResult: vi.fn(async (round: bigint) =>
          drawResult({ round, winningNumber: winning }),
        ),
      }),
    );

    renderWithProviders(<ArenaPage />);

    await waitFor(() =>
      expect(screen.getByTestId("draw.winning_number")).toHaveTextContent(
        "1236712",
      ),
    );

    // Positions 4-5 derive from the prize pool's last two digits.
    expect(screen.getByTestId("basis.item.4")).toHaveTextContent("67");
    expect(screen.getByTestId("basis.item.5")).toHaveTextContent("67");
    // Positions 6-7 derive from the crowdfund total's last two digits.
    expect(screen.getByTestId("basis.item.6")).toHaveTextContent("12");
    expect(screen.getByTestId("basis.item.7")).toHaveTextContent("12");

    // The revealed digits in the draw panel match the winning number.
    expect(screen.getByTestId("draw.digit.4")).toHaveTextContent("6");
    expect(screen.getByTestId("draw.digit.5")).toHaveTextContent("7");
    expect(screen.getByTestId("draw.digit.6")).toHaveTextContent("1");
    expect(screen.getByTestId("draw.digit.7")).toHaveTextContent("2");
  });

  it("shows a locked crowdfund digit in the draw panel before the round is drawn", async () => {
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({
            round: 6n,
            phase: Phase.crowdfunding,
            positions: [
              positionCrowdfund(1, {
                amounts: { 3: 100_000n },
                leadingDigit: 3,
                lockedDigit: 3,
              }),
              positionCrowdfund(2),
              positionCrowdfund(3),
            ],
          }),
        ),
      }),
    );

    renderWithProviders(<ArenaPage />);

    // The locked position reveals its digit; the rest stay undecided.
    await waitFor(() =>
      expect(screen.getByTestId("draw.digit.1")).toHaveTextContent("3"),
    );
    expect(screen.getByTestId("draw.digit.2")).toHaveTextContent("?");
    expect(screen.getByTestId("draw.digit.7")).toHaveTextContent("?");
  });
});
