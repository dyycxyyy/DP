import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
  setCoreActor,
} from "./core-mock";
import {
  createFakeActor,
  exchangePool,
  gameState,
  playerProfile,
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
 * Cover for the dedicated `/exchange` route through the real router.
 *
 * The accepted work adds a bottom-nav exchange tab and a `/exchange` page that
 * hosts the existing exchange panel. The real router is exercised through
 * `App`, so these are component/integration journeys, not deployed browser E2E.
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister.
 */
describe("exchange route", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () => gameState({ round: 3n })),
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

  it("renders the exchange panel at /exchange through the real router", async () => {
    const { default: App, router } = await import("@/App");
    renderWithProviders(<App />);
    await router.navigate({ to: "/exchange" });

    expect(await screen.findByTestId("exchange.page")).toBeInTheDocument();
    expect(screen.getByTestId("exchange.panel")).toBeInTheDocument();
  });

  it("reaches /exchange from the bottom-nav exchange tab", async () => {
    const user = userEvent.setup();
    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
    await user.click(screen.getByTestId("tab.exchange"));

    expect(await screen.findByTestId("exchange.page")).toBeInTheDocument();
    expect(screen.getByTestId("exchange.panel")).toBeInTheDocument();
  });
});
