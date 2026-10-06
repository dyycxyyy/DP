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
  exchangePool,
  gameState,
  positionCrowdfund,
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

describe("ArenaPage", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("renders the live round, phase and pool figures without a blank screen", async () => {
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({
            round: 42n,
            phase: Phase.betting,
            totalPrizePool: 1_234_567n,
            crowdfundTotal: 89_000n,
            treasuryBalance: 500_000n,
            exchangePoolIcp: 100_000_000n,
            exchangePoolLucky: 2_000_000n,
          }),
        ),
        getExchangePoolState: vi.fn(async () =>
          exchangePool({ luckyBalance: 2_000_000n, icpBalance: 100_000_000n }),
        ),
        getTreasuryBalance: vi.fn(async () => 500_000n),
      }),
    );

    renderWithProviders(<ArenaPage />);

    // The page itself is present (no blank screen).
    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
    // Prize pool and crowdfund totals.
    await waitFor(() =>
      expect(screen.getByTestId("draw.prize_pool")).toHaveTextContent(
        "1,234,567",
      ),
    );
    expect(screen.getByTestId("draw.crowdfund_total")).toHaveTextContent(
      "89,000",
    );
    // The wallet, exchange and personal panels moved to the personal center, so
    // the home page no longer renders them.
    expect(screen.queryByTestId("wallet.panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("exchange.panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("profile.panel")).not.toBeInTheDocument();
  });

  it("shows the top-10 most-bet numbers in the order the backend returns them", async () => {
    setCoreActor(
      createFakeActor({
        getTopBetNumbers: vi.fn(async () => [
          topBetNumber("1234567", 9n),
          topBetNumber("0000001", 4n),
        ]),
      }),
    );

    renderWithProviders(<ArenaPage />);

    const first = await screen.findByTestId("topbets.item.1");
    expect(first).toHaveTextContent("1234567");
    expect(first).toHaveTextContent("9");
    const second = screen.getByTestId("topbets.item.2");
    expect(second).toHaveTextContent("0000001");
    expect(second).toHaveTextContent("4");
  });

  it("renders the latest drawn round's winning number and basis from history", async () => {
    setCoreActor(
      createFakeActor({
        getRoundHistory: vi.fn(async () => [
          roundHistoryEntry({
            round: 7n,
            winningNumber: betNumber("1234567"),
            totalPrizePool: 1_000_123n,
            crowdfundTotal: 4_567n,
            positions: [
              {
                position: 1n,
                winningDigit: 3n,
                winningAmount: 100_000n,
                locked: true,
                digitAmounts: [],
              },
            ],
          }),
        ]),
      }),
    );

    renderWithProviders(<ArenaPage />);

    expect(await screen.findByTestId("draw.winning_number")).toHaveTextContent(
      "1234567",
    );
    // Position 4-5 basis derives from the prize pool's last two digits.
    expect(screen.getByTestId("basis.item.4")).toHaveTextContent(
      "总奖池末两位",
    );
    expect(screen.getByTestId("basis.item.4")).toHaveTextContent("23");
    // Position 6-7 basis derives from the crowdfund total's last two digits.
    expect(screen.getByTestId("basis.item.6")).toHaveTextContent(
      "众筹总额末两位",
    );
    expect(screen.getByTestId("basis.item.6")).toHaveTextContent("67");
  });

  it("shows a locked crowdfund position with its locked digit", async () => {
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({
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

    const locked = await screen.findByTestId("crowdfund.locked.1");
    expect(locked).toHaveTextContent("已锁定 3");
    // The locked digit's amount is shown in the position block.
    expect(screen.getByTestId("crowdfund.position.1")).toHaveTextContent(
      "100,000",
    );
  });
});
