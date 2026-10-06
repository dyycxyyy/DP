import { PlayerIdentity } from "@/backend";
import { ProfilePanel } from "@/components/ProfilePanel";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreMock, resetCoreMock, setCoreActor } from "./core-mock";
import {
  betHistoryPage,
  betNumber,
  betRecord,
  createFakeActor,
  playerProfile,
  winHistoryPage,
  winRecord,
} from "./helpers";
import { renderWithProviders } from "./render";

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

beforeEach(() => {
  resetCoreMock();
  setCoreActor(createFakeActor());
});

/**
 * Characterization baseline for the profile panel's non-history surface.
 *
 * The accepted performance work moves the profile history from an unbounded
 * array on `PlayerProfile` to the paginated `getMyBetHistory`/`getMyWinHistory`
 * reads, so the record-rendering assertions that depended on the old
 * `betHistory`/`winHistory` fields are deliberately NOT frozen here. What is
 * pinned is the surrounding behavior that must survive the migration: the
 * identity badge, the empty states, the loading skeleton and tab switching.
 */
describe("ProfilePanel", () => {
  it("shows the identity badge for the profile's identity", () => {
    renderWithProviders(
      <ProfilePanel
        isLoading={false}
        profile={playerProfile({ identity: PlayerIdentity.manipulator })}
      />,
    );

    expect(screen.getByTestId("profile.identity_badge")).toHaveTextContent(
      "操纵者",
    );
  });

  it("shows empty states for both tabs when there is no history", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProfilePanel isLoading={false} profile={playerProfile()} />,
    );

    expect(
      await screen.findByTestId("profile.bets_empty_state"),
    ).toHaveTextContent("暂无投注记录");
    await user.click(screen.getByTestId("profile.tab.wins"));
    expect(
      await screen.findByTestId("profile.wins_empty_state"),
    ).toHaveTextContent("暂无中奖记录");
  });

  it("switches between the bets and wins tabs", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProfilePanel isLoading={false} profile={playerProfile()} />,
    );

    expect(
      await screen.findByTestId("profile.bets_empty_state"),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId("profile.tab.wins"));
    expect(
      await screen.findByTestId("profile.wins_empty_state"),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId("profile.tab.bets"));
    expect(
      await screen.findByTestId("profile.bets_empty_state"),
    ).toBeInTheDocument();
  });

  it("renders a loading skeleton while the profile loads", () => {
    renderWithProviders(<ProfilePanel isLoading profile={undefined} />);

    expect(screen.getByTestId("profile.loading_state")).toBeInTheDocument();
  });
});

/**
 * Paginated history coverage.
 *
 * The accepted performance work replaces the unbounded `betHistory`/`winHistory`
 * arrays on `PlayerProfile` with the paginated `getMyBetHistory`/`getMyWinHistory`
 * reads. These tests pin the observable pagination contract the panel now owns:
 * the first page is requested with offset 0 and the panel's page size, the
 * records render newest-first, a `nextOffset` cursor surfaces a load-more
 * control that fetches the next page with that cursor, and a page without a
 * cursor offers no load-more. The actor is a local typed mock, so this proves
 * the frontend's contract with the actor, never the real canister's behavior.
 */
describe("ProfilePanel paginated history", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("requests the first bet page with offset 0 and renders its records", async () => {
    const actor = createFakeActor({
      getMyBetHistory: vi.fn(async () =>
        betHistoryPage({
          total: 2n,
          items: [
            betRecord({
              number: betNumber("1234567"),
              round: 9n,
              cost: 3n,
              ticketCount: 3n,
            }),
            betRecord({ number: betNumber("0000001"), round: 8n, cost: 1n }),
          ],
        }),
      ),
    });
    setCoreActor(actor);

    renderWithProviders(
      <ProfilePanel isLoading={false} profile={playerProfile()} />,
    );

    expect(await screen.findByTestId("profile.bet_item.1")).toHaveTextContent(
      "1234567",
    );
    expect(screen.getByTestId("profile.bet_item.2")).toHaveTextContent(
      "0000001",
    );
    // The panel's page size is 20; the first page starts at offset 0.
    expect(actor.getMyBetHistory).toHaveBeenCalledWith(0n, 20n);
    // A page with no cursor offers no load-more control.
    expect(
      screen.queryByTestId("profile.bets_load_more"),
    ).not.toBeInTheDocument();
  });

  it("loads the next bet page with the returned cursor when load-more is clicked", async () => {
    const getMyBetHistory = vi.fn(async (offset: bigint) =>
      offset === 0n
        ? betHistoryPage({
            total: 3n,
            nextOffset: 2n,
            items: [
              betRecord({ number: betNumber("1111111"), round: 3n }),
              betRecord({ number: betNumber("2222222"), round: 2n }),
            ],
          })
        : betHistoryPage({
            total: 3n,
            items: [betRecord({ number: betNumber("3333333"), round: 1n })],
          }),
    );
    setCoreActor(createFakeActor({ getMyBetHistory }));
    const user = userEvent.setup();

    renderWithProviders(
      <ProfilePanel isLoading={false} profile={playerProfile()} />,
    );

    expect(await screen.findByTestId("profile.bet_item.1")).toHaveTextContent(
      "1111111",
    );
    const loadMore = screen.getByTestId("profile.bets_load_more");

    await user.click(loadMore);

    // The cursor from the first page is forwarded as the next offset.
    await waitFor(() => expect(getMyBetHistory).toHaveBeenCalledWith(2n, 20n));
    expect(await screen.findByTestId("profile.bet_item.1")).toHaveTextContent(
      "3333333",
    );
    // The last page has no cursor, so the control disappears.
    await waitFor(() =>
      expect(
        screen.queryByTestId("profile.bets_load_more"),
      ).not.toBeInTheDocument(),
    );
  });

  it("requests the first win page and renders its records on the wins tab", async () => {
    const actor = createFakeActor({
      getMyWinHistory: vi.fn(async () =>
        winHistoryPage({
          total: 1n,
          items: [
            winRecord({
              number: betNumber("7654321"),
              round: 4n,
              tier: 3n,
              payout: 500n,
            }),
          ],
        }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <ProfilePanel isLoading={false} profile={playerProfile()} />,
    );

    await user.click(screen.getByTestId("profile.tab.wins"));

    expect(await screen.findByTestId("profile.win_item.1")).toHaveTextContent(
      "7654321",
    );
    expect(screen.getByTestId("profile.win_item.1")).toHaveTextContent("500");
    expect(actor.getMyWinHistory).toHaveBeenCalledWith(0n, 20n);
  });

  it("loads the next win page with the returned cursor when load-more is clicked", async () => {
    const getMyWinHistory = vi.fn(async (offset: bigint) =>
      offset === 0n
        ? winHistoryPage({
            total: 2n,
            nextOffset: 1n,
            items: [winRecord({ number: betNumber("1111111"), round: 2n })],
          })
        : winHistoryPage({
            total: 2n,
            items: [winRecord({ number: betNumber("2222222"), round: 1n })],
          }),
    );
    setCoreActor(createFakeActor({ getMyWinHistory }));
    const user = userEvent.setup();

    renderWithProviders(
      <ProfilePanel isLoading={false} profile={playerProfile()} />,
    );

    await user.click(screen.getByTestId("profile.tab.wins"));
    expect(await screen.findByTestId("profile.win_item.1")).toHaveTextContent(
      "1111111",
    );

    await user.click(screen.getByTestId("profile.wins_load_more"));

    await waitFor(() => expect(getMyWinHistory).toHaveBeenCalledWith(1n, 20n));
    expect(await screen.findByTestId("profile.win_item.1")).toHaveTextContent(
      "2222222",
    );
  });
});
