import { UserRole } from "@/backend";
import { WalletPanel } from "@/components/WalletPanel";
import { AdminPage } from "@/pages/AdminPage";
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
  setCoreActor,
} from "./core-mock";
import {
  adminPoolBalances,
  adminStatus,
  createFakeActor,
  depositAddress,
  exchangePool,
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
 * Characterization baseline for behavior adjacent to the Lucky ICRC-2 ledger
 * work.
 *
 * The accepted change turns Lucky into a real ICRC-1/ICRC-2 ledger, adds
 * admin-only minting, adds a "Lucky 代币" section to the admin console, and
 * rewires the wallet's Lucky balance/transfer to the real ledger. Those are the
 * behaviors intentionally changing, so this file deliberately does NOT freeze
 * the internal-only Lucky accounting, the wallet's Lucky transfer call, or the
 * absence of a token section.
 *
 * It pins the surrounding behavior that must survive:
 *
 *  - the admin console's existing sections (round control, all four pool rows,
 *    reset, user management, daily statistics) still render together for an
 *    admin, so a new token section cannot displace them;
 *  - a non-admin still reaches no admin console and triggers no admin-only read
 *    or write, so the new minting surface cannot leak past the role gate;
 *  - the wallet's ICP balance and ICP send surface still render when the
 *    wallet-balances read fails, so moving the Lucky balance onto a new ledger
 *    cannot take the adjacent ICP path down with it.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister.
 */
describe("admin console existing sections coexist", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders every existing section together for an admin", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () =>
          adminStatus({
            balances: adminPoolBalances({
              prizePool: 1_000n,
              treasury: 2_000n,
              exchangeLucky: 3_000n,
              exchangeIcp: 400_000_000n,
            }),
          }),
        ),
      }),
    );

    renderWithProviders(<AdminPage />);

    // The console shell and its round-control section.
    expect(await screen.findByTestId("admin.page")).toBeInTheDocument();
    expect(screen.getByTestId("admin.round.status")).toBeInTheDocument();
    expect(screen.getByTestId("admin.stop_button")).toBeInTheDocument();

    // All four withdrawable pool rows.
    expect(
      await screen.findByTestId("admin.pool.prizePool.balance"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.pool.treasury.balance"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.pool.exchangeLucky.balance"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.pool.exchangeIcp.balance"),
    ).toBeInTheDocument();

    // The destructive reset section.
    expect(screen.getByTestId("admin.reset_button")).toBeInTheDocument();

    // The user-management and daily-statistics sections.
    expect(screen.getByTestId("admin.users.section")).toBeInTheDocument();
    expect(screen.getByTestId("admin.stats.section")).toBeInTheDocument();
  });
});

describe("admin console denies a non-admin at the call level", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows no existing section and triggers no admin-only read or write", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.user),
    });
    setCoreActor(actor);

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.users.section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.stats.section")).not.toBeInTheDocument();

    // No admin-only read or write is issued for an unauthorized caller.
    expect(actor.getAdminStatus).not.toHaveBeenCalled();
    expect(actor.getDailyStats).not.toHaveBeenCalled();
    expect(actor.listUsers).not.toHaveBeenCalled();
    expect(actor.stopNextRound).not.toHaveBeenCalled();
    expect(actor.resumeRound).not.toHaveBeenCalled();
    expect(actor.withdrawFromPool).not.toHaveBeenCalled();
    expect(actor.resetGameData).not.toHaveBeenCalled();
  });
});

describe("wallet ICP path survives a failed balances read", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("still renders the ICP balance slot and ICP send surface", async () => {
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getWalletBalances: vi.fn(async () => {
          throw new Error("wallet balances unavailable");
        }),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => []),
      }),
    );

    renderWithProviders(
      <WalletPanel
        profile={playerProfile({ luckyBalance: 12_345n })}
        exchangePool={exchangePool()}
        treasury={500n}
        isLoading={false}
      />,
    );

    // The panel renders rather than crashing, and the adjacent ICP surface is
    // still present even though the balances read failed.
    expect(await screen.findByTestId("wallet.panel")).toBeInTheDocument();
    expect(screen.getByTestId("wallet.icp_balance")).toHaveTextContent("—");
    expect(screen.getByTestId("wallet.send_icp_section")).toBeInTheDocument();
    expect(screen.getByTestId("wallet.send_lucky_section")).toBeInTheDocument();

    // The Lucky balance falls back to the profile value rather than blanking.
    await waitFor(() =>
      expect(screen.getByTestId("wallet.lucky_balance")).toHaveTextContent(
        "12,345",
      ),
    );
  });

  it("keeps the ICP send form disabled without a known ICP balance", async () => {
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getWalletBalances: vi.fn(async () => {
          throw new Error("wallet balances unavailable");
        }),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => []),
      }),
    );

    renderWithProviders(
      <WalletPanel
        profile={playerProfile({ luckyBalance: 12_345n })}
        exchangePool={exchangePool()}
        treasury={500n}
        isLoading={false}
      />,
    );

    const section = await screen.findByTestId("wallet.send_icp_section");
    const submit = within(section).getByTestId("wallet.icp_submit_button");
    // With no known balance the form cannot authorize a transfer.
    expect(submit).toBeDisabled();
  });
});
