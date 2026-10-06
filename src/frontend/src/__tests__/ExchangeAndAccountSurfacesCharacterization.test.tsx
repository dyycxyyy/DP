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
  depositAddress,
  exchangePool,
  gameState,
  ledgerBalance,
  playerProfile,
  walletBalances,
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
 * Characterization baseline for the exchange and account surfaces.
 *
 * The accepted work makes the dedicated `/exchange` page the home of the pool
 * and treasury balances and removes those balances from the personal center.
 * These tests deliberately do NOT assert where the treasury balance is shown or
 * that the account page hides the pool/treasury rows — those are the behaviors
 * intentionally changing. They pin the surrounding behavior that must survive:
 *
 *  - the `/exchange` route still renders the exchange panel and still wires the
 *    live exchange-pool balances into it (the pool display is not dropped while
 *    the treasury display is added);
 *  - the personal center still renders the wallet with the caller's own Lucky
 *    and ICP balances and the receive/send surfaces, so removing the pool and
 *    treasury rows cannot take the wallet itself with it.
 *
 * The real router is exercised through `App` for the route journey, so this is
 * component/integration coverage, not deployed browser E2E. The actor is a local
 * typed mock, so this proves the frontend's contract with the actor, never the
 * real canister's behavior.
 */
describe("exchange page pool wiring", () => {
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

  it("renders the live exchange-pool balances on the /exchange route", async () => {
    const { default: App, router } = await import("@/App");
    renderWithProviders(<App />);
    await router.navigate({ to: "/exchange" });

    const panel = await screen.findByTestId("exchange.panel");
    // The pool summary line is fed from `getExchangePoolState`, so the route
    // must keep passing the fetched pool into the panel.
    await waitFor(() => expect(panel).toHaveTextContent("2,000,000"));
    expect(panel).toHaveTextContent("1 ICP");
  });
});

describe("personal center wallet surfaces", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getWalletBalances: vi.fn(async () =>
          walletBalances({ lucky: 12_345n, icpE8s: 250_000_000n }),
        ),
        // The wallet's Lucky balance is the real ICRC-1 ledger balance, so the
        // caller's own balance is now sourced from `getLedgerBalance`.
        getLedgerBalance: vi.fn(async () =>
          ledgerBalance({ balance: 12_345n }),
        ),
        getDepositAddress: vi.fn(async () =>
          depositAddress({ accountText: "aaaaa-aa-deposit-address" }),
        ),
        getRecentTransfers: vi.fn(async () => []),
        getExchangePoolState: vi.fn(async () =>
          exchangePool({ luckyBalance: 2_000_000n, icpBalance: 100_000_000n }),
        ),
        getTreasuryBalance: vi.fn(async () => 500n),
      }),
    );
  });

  // `@/App` exports a module-level router singleton, so a test that navigates
  // it must restore the default route or a later test in the same worker starts
  // on `/account` instead of the arena.
  afterEach(async () => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    const { router } = await import("@/App");
    await router.navigate({ to: "/" });
  });

  it("keeps the caller's own balances and receive/send surfaces on /account", async () => {
    const { default: App, router } = await import("@/App");
    renderWithProviders(<App />);
    await router.navigate({ to: "/account" });

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
    expect(screen.getByTestId("wallet.panel")).toBeInTheDocument();

    // The caller's own balances survive the pool/treasury removal. The Lucky
    // balance is now the ledger balance, so it is fed from `getLedgerBalance`.
    await waitFor(() =>
      expect(screen.getByTestId("wallet.lucky_balance")).toHaveTextContent(
        "12,345",
      ),
    );
    expect(screen.getByTestId("wallet.icp_balance")).toHaveTextContent("2.5");

    // The receive and send surfaces survive as well.
    expect(screen.getByTestId("wallet.receive_section")).toBeInTheDocument();
    expect(screen.getByTestId("wallet.send_icp_section")).toBeInTheDocument();
    expect(screen.getByTestId("wallet.send_lucky_section")).toBeInTheDocument();
  });
});
