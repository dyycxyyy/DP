import { Phase } from "@/backend";
import { DrawPanel } from "@/components/DrawPanel";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { betNumber, gameState, positionCrowdfund } from "./helpers";
import { renderWithProviders } from "./render";

describe("DrawPanel", () => {
  it("shows the prize pool and crowdfund totals for the live round", () => {
    renderWithProviders(
      <DrawPanel
        state={gameState({
          phase: Phase.crowdfunding,
          totalPrizePool: 1_234_567n,
          crowdfundTotal: 89_000n,
        })}
        isLoading={false}
      />,
    );

    expect(screen.getByTestId("draw.prize_pool")).toHaveTextContent(
      "1,234,567",
    );
    expect(screen.getByTestId("draw.crowdfund_total")).toHaveTextContent(
      "89,000",
    );
  });

  it("reveals a locked crowdfund digit before the round is drawn", () => {
    renderWithProviders(
      <DrawPanel
        state={gameState({
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
        })}
        isLoading={false}
      />,
    );

    // The locked position shows its digit; the others stay undecided.
    expect(screen.getByTestId("draw.digit.1")).toHaveTextContent("3");
    expect(screen.getByTestId("draw.digit.2")).toHaveTextContent("?");
    expect(screen.getByTestId("draw.digit.7")).toHaveTextContent("?");
  });

  it("shows the latest drawn winning number with leading zeros preserved", () => {
    renderWithProviders(
      <DrawPanel
        state={gameState({ phase: Phase.betting })}
        isLoading={false}
        latestWinningNumber={betNumber("0000001")}
        latestRound={7n}
      />,
    );

    expect(screen.getByTestId("draw.winning_number")).toHaveTextContent(
      "0000001",
    );
    // Every position is revealed from the drawn number.
    expect(screen.getByTestId("draw.digit.1")).toHaveTextContent("0");
    expect(screen.getByTestId("draw.digit.7")).toHaveTextContent("1");
  });

  it("renders placeholders while the round state is loading", () => {
    renderWithProviders(
      <DrawPanel state={undefined} isLoading latestWinningNumber={null} />,
    );

    expect(screen.getByTestId("draw.prize_pool")).toHaveTextContent("—");
    expect(screen.getByTestId("draw.crowdfund_total")).toHaveTextContent("—");
    expect(screen.getByTestId("draw.digit.1")).toHaveTextContent("?");
  });
});
