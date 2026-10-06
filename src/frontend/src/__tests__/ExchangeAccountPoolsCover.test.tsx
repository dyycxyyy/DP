import { AccountPage } from "@/pages/AccountPage";
import { ExchangePage } from "@/pages/ExchangePage";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
  setCoreActor,
} from "./core-mock";
import { createFakeActor, exchangePool, playerProfile } from "./helpers";
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

// The exchange and account pages render router `Link`s. Stub the router surface
// to plain anchors so these surfaces can be exercised without standing up a
// router; `useRouterState` reports the arena path.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/" } }),
}));

/**
 * Cover for the pool-balance display consolidation.
 *
 * The accepted work moves the exchange-pool (Lucky/ICP) and treasury balances
 * onto the token-exchange page and removes them from the personal center. The
 * actor is a local typed mock, so this proves the frontend's contract with the
 * actor, never the real canister.
 */
describe("exchange page pool balances", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
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

  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows the exchange pool Lucky/ICP and the treasury balance", async () => {
    renderWithProviders(<ExchangePage />);

    expect(
      await screen.findByTestId("exchange.pool_section"),
    ).toBeInTheDocument();
    // The section renders before the pool/treasury queries answer, so wait for
    // the resolved balances rather than reading the placeholder on first paint.
    await waitFor(() =>
      expect(screen.getByTestId("exchange.pool_lucky")).toHaveTextContent(
        "2,000,000",
      ),
    );
    expect(screen.getByTestId("exchange.pool_icp")).toHaveTextContent("1");
    expect(screen.getByTestId("exchange.treasury")).toHaveTextContent("500");
  });
});

describe("personal center omits pool balances", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
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

  afterEach(() => {
    window.localStorage.clear();
  });

  it("does not render the exchange pool or treasury balances", async () => {
    renderWithProviders(<AccountPage />);

    await screen.findByTestId("account.page");
    expect(
      screen.queryByTestId("exchange.pool_section"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("exchange.pool_lucky")).not.toBeInTheDocument();
    expect(screen.queryByTestId("exchange.pool_icp")).not.toBeInTheDocument();
    expect(screen.queryByTestId("exchange.treasury")).not.toBeInTheDocument();
  });
});
