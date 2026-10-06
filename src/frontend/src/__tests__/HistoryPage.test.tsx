import { HistoryPage } from "@/pages/HistoryPage";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  roundHistoryEntry,
} from "./helpers";
import { renderWithProviders } from "./render";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

describe("HistoryPage", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("lists recent rounds with winning number, pools and distributed totals", async () => {
    setCoreActor(
      createFakeActor({
        getRoundHistory: vi.fn(async () => [
          roundHistoryEntry({
            round: 12n,
            winningNumber: betNumber("1234567"),
            totalPrizePool: 1_000_000n,
            crowdfundTotal: 250_000n,
            totalDistributed: 400_000n,
          }),
          roundHistoryEntry({
            round: 11n,
            winningNumber: betNumber("0000001"),
            totalPrizePool: 900_000n,
            crowdfundTotal: 100_000n,
            totalDistributed: 300_000n,
          }),
        ]),
      }),
    );

    renderWithProviders(<HistoryPage />);

    const first = await screen.findByTestId("history.item.1");
    expect(first).toHaveTextContent("第 12 局");
    expect(first).toHaveTextContent("1234567");
    expect(first).toHaveTextContent("1,000,000");
    expect(first).toHaveTextContent("250,000");
    expect(first).toHaveTextContent("400,000");

    const second = screen.getByTestId("history.item.2");
    expect(second).toHaveTextContent("第 11 局");
    expect(second).toHaveTextContent("0000001");
  });

  it("shows an empty state when there are no completed rounds", async () => {
    setCoreActor(createFakeActor({ getRoundHistory: vi.fn(async () => []) }));

    renderWithProviders(<HistoryPage />);

    expect(await screen.findByTestId("history.empty_state")).toHaveTextContent(
      "暂无历史对局",
    );
  });

  it("loads the selected round's draw result when a history item is clicked", async () => {
    const actor = createFakeActor({
      getRoundHistory: vi.fn(async () => [
        roundHistoryEntry({ round: 12n, winningNumber: betNumber("1234567") }),
        roundHistoryEntry({ round: 11n, winningNumber: betNumber("0000001") }),
      ]),
      getDrawResult: vi.fn(async (round: bigint) =>
        drawResult({
          round,
          winningNumber:
            round === 11n ? betNumber("0000001") : betNumber("1234567"),
          callerWinnings: round === 11n ? 777n : 0n,
        }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<HistoryPage />);

    // The newest round is selected by default.
    await waitFor(() => expect(actor.getDrawResult).toHaveBeenCalledWith(12n));

    await user.click(await screen.findByTestId("history.item.2"));
    await waitFor(() => expect(actor.getDrawResult).toHaveBeenCalledWith(11n));
    await waitFor(() =>
      expect(screen.getByTestId("basis.my_winnings")).toHaveTextContent("777"),
    );
  });
});
