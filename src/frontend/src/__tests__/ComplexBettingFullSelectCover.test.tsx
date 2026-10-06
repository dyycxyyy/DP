import { Phase } from "@/backend";
import { BetForm } from "@/components/BetForm";
import { ProfilePanel } from "@/components/ProfilePanel";
import { RankingPage } from "@/pages/RankingPage";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
  setCoreActor,
} from "./core-mock";
import {
  betHistoryPage,
  betNumber,
  betRecord,
  createFakeActor,
  ok,
  playerProfile,
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
 * Cover for the accepted "submit a full 10x7 selection (10,000,000 tickets)
 * without IC0522" change, on the two acceptance criteria the surrounding suites
 * do not already pin:
 *
 *  - the full-select submission is blocked locally when the balance cannot
 *    cover the 10,000,000-ticket cost, with the balance error shown and no
 *    actor call issued (the existing balance tests cover 1- and 4-ticket
 *    selections, not the full product);
 *  - after a successful large submission the top-bets ranking and the paginated
 *    bet history still read and render, so the read path does not stall behind
 *    the bounded aggregate.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister's behavior.
 */
describe("full-select complex-bet cover", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("blocks a full 10,000,000-ticket submission when the balance is short and issues no call", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        // One Lucky short of the full 10,000,000-ticket cost.
        luckyBalance={9_999_999n}
        phase={Phase.betting}
      />,
    );

    await user.click(screen.getByTestId("bet.fill_button"));

    // The full product is shown, but the balance gate blocks submission.
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent(
      "10,000,000",
    );
    expect(screen.getByTestId("bet.balance_error")).toHaveTextContent(
      "余额不足",
    );
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();

    // Clicking the disabled control must not reach the actor.
    await user.click(screen.getByTestId("bet.submit_button"));
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reads the top-bets ranking and paginated bet history after a large submission", async () => {
    const actor = createFakeActor({
      placeBetSelections: vi.fn(async () => ok()),
      // The bounded aggregate surfaces as one history record carrying the full
      // ticket count, and the ranking merges the submission's numbers.
      getMyBetHistory: vi.fn(async () =>
        betHistoryPage({
          total: 1n,
          items: [
            betRecord({
              number: betNumber("0000000"),
              round: 1n,
              cost: 10_000_000n,
              ticketCount: 10_000_000n,
            }),
          ],
        }),
      ),
      getTopBetNumbers: vi.fn(async () => [
        topBetNumber("0000000", 1n),
        topBetNumber("0000001", 1n),
      ]),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    const { unmount } = renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10_000_000n}
        phase={Phase.betting}
      />,
    );

    await user.click(screen.getByTestId("bet.fill_button"));
    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "已提交 10,000,000 注，扣除 10,000,000 Lucky",
    );

    // The read path still resolves after the large write: the ranking renders
    // its merged entries and the profile renders the bounded history record.
    unmount();

    renderWithProviders(<RankingPage />);
    const first = await screen.findByTestId("topbets.item.1");
    expect(first).toHaveTextContent("0000000");
    expect(first).toHaveTextContent("1");

    renderWithProviders(
      <ProfilePanel
        isLoading={false}
        profile={playerProfile({ betCount: 1n })}
      />,
    );
    const record = await screen.findByTestId("profile.bet_item.1");
    expect(record).toHaveTextContent("0000000");
    expect(record).toHaveTextContent("10,000,000");
    expect(actor.getMyBetHistory).toHaveBeenCalledWith(0n, 20n);
  });
});
