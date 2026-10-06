import { DrawBasisPanel } from "@/components/DrawBasisPanel";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { betNumber, drawResult, roundHistoryEntry } from "./helpers";
import { renderWithProviders } from "./render";

describe("DrawBasisPanel", () => {
  it("publishes the generation basis for all seven positions", () => {
    renderWithProviders(
      <DrawBasisPanel
        drawResult={drawResult({
          round: 9n,
          winningNumber: betNumber("1234567"),
        })}
        isLoading={false}
        roundEntry={roundHistoryEntry({
          round: 9n,
          winningNumber: betNumber("1234567"),
          totalPrizePool: 1_000_123n,
          crowdfundTotal: 4_567n,
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
        })}
      />,
    );

    // Positions 1-3: crowdfunding result.
    expect(screen.getByTestId("basis.item.1")).toHaveTextContent("众筹结果");
    expect(screen.getByTestId("basis.item.1")).toHaveTextContent("锁定数字 1");
    expect(screen.getByTestId("basis.item.2")).toHaveTextContent("众筹结果");
    expect(screen.getByTestId("basis.item.2")).toHaveTextContent("领先数字 2");
    expect(screen.getByTestId("basis.item.3")).toHaveTextContent("众筹结果");

    // Positions 4-5: prize pool's last two digits (1,000,123 -> 23).
    expect(screen.getByTestId("basis.item.4")).toHaveTextContent(
      "总奖池末两位",
    );
    expect(screen.getByTestId("basis.item.4")).toHaveTextContent("23");
    expect(screen.getByTestId("basis.item.5")).toHaveTextContent(
      "总奖池末两位",
    );

    // Positions 6-7: crowdfund total's last two digits (4,567 -> 67).
    expect(screen.getByTestId("basis.item.6")).toHaveTextContent(
      "众筹总额末两位",
    );
    expect(screen.getByTestId("basis.item.6")).toHaveTextContent("67");
    expect(screen.getByTestId("basis.item.7")).toHaveTextContent(
      "众筹总额末两位",
    );
  });

  it("pads the last-two-digit basis with a leading zero", () => {
    renderWithProviders(
      <DrawBasisPanel
        drawResult={drawResult({ round: 9n })}
        isLoading={false}
        roundEntry={roundHistoryEntry({
          round: 9n,
          // 1,000,005 -> "05"; 4,500 -> "00".
          totalPrizePool: 1_000_005n,
          crowdfundTotal: 4_500n,
        })}
      />,
    );

    expect(screen.getByTestId("basis.item.4")).toHaveTextContent("05");
    expect(screen.getByTestId("basis.item.6")).toHaveTextContent("00");
  });

  it("renders the per-tier payout table with counts, per-ticket and distributed amounts", () => {
    renderWithProviders(
      <DrawBasisPanel
        drawResult={drawResult({
          tiers: [
            {
              tier: 1n,
              winningTickets: 2n,
              payoutPerTicket: 500n,
              distributed: 1000n,
            },
            {
              tier: 2n,
              winningTickets: 0n,
              payoutPerTicket: 0n,
              distributed: 0n,
            },
          ],
        })}
        isLoading={false}
        roundEntry={roundHistoryEntry()}
      />,
    );

    expect(screen.getByTestId("basis.tiers_table")).toBeInTheDocument();
    expect(screen.getByTestId("basis.tier_row.1")).toHaveTextContent("一位");
    expect(screen.getByTestId("basis.tier_row.1")).toHaveTextContent("2");
    expect(screen.getByTestId("basis.tier_row.1")).toHaveTextContent("500");
    expect(screen.getByTestId("basis.tier_row.1")).toHaveTextContent("1,000");
    expect(screen.getByTestId("basis.tier_row.2")).toHaveTextContent("二位");
  });

  it("labels every prize tier and renders its distributed payout", () => {
    renderWithProviders(
      <DrawBasisPanel
        drawResult={drawResult({
          tiers: [
            {
              tier: 7n,
              winningTickets: 1n,
              payoutPerTicket: 700n,
              distributed: 700n,
            },
            {
              tier: 6n,
              winningTickets: 2n,
              payoutPerTicket: 60n,
              distributed: 120n,
            },
            {
              tier: 5n,
              winningTickets: 3n,
              payoutPerTicket: 50n,
              distributed: 150n,
            },
            {
              tier: 4n,
              winningTickets: 4n,
              payoutPerTicket: 40n,
              distributed: 160n,
            },
            {
              tier: 3n,
              winningTickets: 5n,
              payoutPerTicket: 30n,
              distributed: 150n,
            },
            {
              tier: 2n,
              winningTickets: 6n,
              payoutPerTicket: 20n,
              distributed: 120n,
            },
            {
              tier: 1n,
              winningTickets: 7n,
              payoutPerTicket: 10n,
              distributed: 70n,
            },
          ],
        })}
        isLoading={false}
        roundEntry={roundHistoryEntry()}
      />,
    );

    const expected: Array<[number, string]> = [
      [1, "七位全中"],
      [2, "六位"],
      [3, "五位"],
      [4, "四位"],
      [5, "三位"],
      [6, "二位"],
      [7, "一位"],
    ];
    for (const [row, label] of expected) {
      expect(screen.getByTestId(`basis.tier_row.${row}`)).toHaveTextContent(
        label,
      );
    }
    // Distributed equals winningTickets x payoutPerTicket for each row.
    expect(screen.getByTestId("basis.tier_row.1")).toHaveTextContent("700");
    expect(screen.getByTestId("basis.tier_row.2")).toHaveTextContent("120");
    expect(screen.getByTestId("basis.tier_row.7")).toHaveTextContent("70");
  });

  it("shows the caller's own winnings and highest tier", () => {
    renderWithProviders(
      <DrawBasisPanel
        drawResult={drawResult({
          callerWinnings: 12_345n,
          callerTier: 3n,
        })}
        isLoading={false}
        roundEntry={roundHistoryEntry()}
      />,
    );

    expect(screen.getByTestId("basis.my_winnings")).toHaveTextContent("12,345");
    expect(screen.getByTestId("basis.my_tier")).toHaveTextContent("三位");
  });

  it("shows 未中奖 when the caller has no winning tier", () => {
    renderWithProviders(
      <DrawBasisPanel
        drawResult={drawResult({ callerWinnings: 0n, callerTier: undefined })}
        isLoading={false}
        roundEntry={roundHistoryEntry()}
      />,
    );

    expect(screen.getByTestId("basis.my_tier")).toHaveTextContent("未中奖");
  });

  it("shows an empty-state message before the round is drawn", () => {
    renderWithProviders(
      <DrawBasisPanel drawResult={null} isLoading={false} roundEntry={null} />,
    );

    expect(screen.getByTestId("basis.tiers_empty_state")).toHaveTextContent(
      "本局尚未开奖",
    );
  });

  it("renders a loading skeleton while the draw result is loading", () => {
    renderWithProviders(
      <DrawBasisPanel drawResult={undefined} isLoading roundEntry={null} />,
    );

    expect(screen.getByTestId("basis.loading_state")).toBeInTheDocument();
  });
});
