import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import {
  createFakeActor,
  exchangePool,
  gameState,
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
  Toaster: () => null,
}));

/**
 * Characterization baseline for the anonymous-visitor route surface.
 *
 * The accepted work relocates the language toggle to the very top of the
 * personal center. That is the behavior intentionally changing, so this file
 * deliberately does NOT assert the toggle's position. It pins the surrounding
 * behavior that must survive the change: an anonymous visitor can open the
 * default route and each main page (crowdfunding, leaderboard, exchange,
 * history, how-to-play) and see that page's content rather than a blank screen.
 *
 * The real router is exercised through `App`, so these are component/integration
 * journeys, not deployed browser E2E. The actor is a local typed mock, so this
 * proves the frontend's contract with the actor, never the real canister.
 */
describe("anonymous visitor main pages", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    // No `setAuthenticated` call: the visitor stays anonymous.
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () => gameState({ round: 9n })),
        getTopBetNumbers: vi.fn(async () => [topBetNumber("1234567", 42n)]),
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getExchangePoolState: vi.fn(async () =>
          exchangePool({ luckyBalance: 2_000_000n, icpBalance: 100_000_000n }),
        ),
        getTreasuryBalance: vi.fn(async () => 500n),
      }),
    );
  });

  afterEach(async () => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    const { router } = await import("@/App");
    await router.navigate({ to: "/" });
  });

  async function renderAt(path: string) {
    const { default: App, router } = await import("@/App");
    renderWithProviders(<App />);
    await router.navigate({ to: path });
  }

  it("renders the betting home at the default route without a blank screen", async () => {
    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
    expect(screen.getByTestId("draw.panel")).toBeInTheDocument();
    expect(screen.getByTestId("bet.panel")).toBeInTheDocument();
  });

  it("renders the crowdfunding page content", async () => {
    await renderAt("/crowdfund");

    expect(await screen.findByTestId("crowdfund.page")).toBeInTheDocument();
    expect(screen.getByTestId("crowdfund.panel")).toBeInTheDocument();
  });

  it("renders the leaderboard page content", async () => {
    await renderAt("/ranking");

    expect(await screen.findByTestId("ranking.page")).toBeInTheDocument();
    expect(screen.getByTestId("topbets.panel")).toBeInTheDocument();
  });

  it("renders the exchange page content", async () => {
    await renderAt("/exchange");

    expect(await screen.findByTestId("exchange.page")).toBeInTheDocument();
    expect(screen.getByTestId("exchange.panel")).toBeInTheDocument();
  });

  it("renders the history page content", async () => {
    await renderAt("/history");

    expect(await screen.findByTestId("history.page")).toBeInTheDocument();
    expect(screen.getByTestId("history.panel")).toBeInTheDocument();
  });

  it("renders the how-to-play page content", async () => {
    await renderAt("/guide");

    expect(await screen.findByTestId("guide.page")).toBeInTheDocument();
    expect(screen.getByTestId("guide.content.panel")).toBeInTheDocument();
  });
});
