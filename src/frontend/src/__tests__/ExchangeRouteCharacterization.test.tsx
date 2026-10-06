import { screen, waitFor } from "@testing-library/react";
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
 * Characterization baseline for the existing route tree and the wallet's
 * signed-out contract.
 *
 * The accepted work adds a dedicated `/exchange` route and a bottom-nav entry
 * for it, moves the exchange panel off the personal center, and rewrites the
 * wallet to show a real ICP balance plus receive/send surfaces. These tests
 * deliberately do NOT assert the exchange panel's location, the tab set, or the
 * wallet's new send/receive content — those are the behaviors intentionally
 * changing. They pin the surrounding behavior that must survive the change:
 *
 *  - the existing routes (`/account`, `/history`, `/guide`) still render their
 *    pages through the real router, so adding a sibling route cannot silently
 *    break the route tree;
 *  - the wallet still shows the shared sign-in prompt and no balance value when
 *    signed out, so the new balance/send surfaces cannot leak to a visitor.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister's behavior.
 */
describe("existing route tree", () => {
  beforeEach(() => {
    resetCoreMock();
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
    const { router } = await import("@/App");
    await router.navigate({ to: "/" });
  });

  async function renderAt(path: string) {
    const { default: App, router } = await import("@/App");
    renderWithProviders(<App />);
    await router.navigate({ to: path });
  }

  it("renders the personal center at /account", async () => {
    await renderAt("/account");

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
  });

  it("renders the round history at /history", async () => {
    await renderAt("/history");

    expect(await screen.findByTestId("history.page")).toBeInTheDocument();
  });

  it("renders the guide at /guide", async () => {
    await renderAt("/guide");

    expect(await screen.findByTestId("guide.page")).toBeInTheDocument();
  });
});

describe("wallet signed-out contract", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(false);
    setCoreActor(
      createFakeActor({
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

  it("shows the sign-in prompt and no balance value when signed out", async () => {
    const { WalletPanel } = await import("@/components/WalletPanel");
    renderWithProviders(
      <WalletPanel
        profile={undefined}
        exchangePool={undefined}
        treasury={undefined}
        isLoading={false}
      />,
    );

    expect(await screen.findByTestId("wallet.panel")).toBeInTheDocument();
    expect(screen.getByTestId("auth.prompt")).toHaveTextContent(
      "请先登录以查看账户余额",
    );
    // The balance slot renders the placeholder, never a numeric balance.
    await waitFor(() =>
      expect(screen.getByTestId("wallet.lucky_balance")).toHaveTextContent("—"),
    );
  });
});
