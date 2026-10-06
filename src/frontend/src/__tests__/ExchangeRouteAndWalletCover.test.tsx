import type { GameError, TransferArg, TransferResult } from "@/backend";
import { TerminalHeader } from "@/components/TerminalHeader";
import { WalletPanel } from "@/components/WalletPanel";
import { AccountPage } from "@/pages/AccountPage";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  ok,
  playerProfile,
  transferErr,
  transferOk,
  walletBalances,
  walletTransferRecord,
} from "./helpers";
import { renderWithProviders } from "./render";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
  Toaster: () => null,
}));

// The header, account page and tab bar render router `Link`s. Stub the router
// surface to plain anchors so these surfaces can be exercised without standing
// up a router; `useRouterState` reports the arena path.
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

const RECIPIENT = "aaaaa-aa";

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
});

/**
 * Cover for the dedicated `/exchange` route and the production wallet.
 *
 * The accepted work adds a bottom-nav exchange tab and `/exchange` page hosting
 * the existing exchange panel, moves the language switch into the personal
 * center, and rewrites the wallet to show real ICP + Lucky balances, a deposit
 * address and ICP/Lucky transfer forms. The actor is a local typed mock, so this
 * proves the frontend's contract with the actor, never the real canister.
 */
describe("header language control", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
  });

  it("no longer renders the language toggle in the status strip", () => {
    renderWithProviders(
      <TerminalHeader state={gameState()} luckyBalance={12_345n} />,
    );

    expect(screen.getByTestId("shell.status_strip")).toBeInTheDocument();
    expect(screen.queryByTestId("lang.toggle")).not.toBeInTheDocument();
  });
});

describe("wallet signed-in surfaces", () => {
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
        getDepositAddress: vi.fn(async () =>
          depositAddress({ accountText: "aaaaa-aa-deposit-address" }),
        ),
        getRecentTransfers: vi.fn(async () => []),
      }),
    );
  });

  it("shows the Lucky and ICP balances, deposit address and transfer forms", async () => {
    renderWithProviders(
      <WalletPanel
        profile={playerProfile({ luckyBalance: 12_345n })}
        exchangePool={exchangePool()}
        treasury={500n}
        isLoading={false}
      />,
    );

    expect(await screen.findByTestId("wallet.panel")).toBeInTheDocument();
    // Lucky balance is grouped; ICP is rendered as a decimal (2.5 ICP).
    await waitFor(() =>
      expect(screen.getByTestId("wallet.lucky_balance")).toHaveTextContent(
        "12,345",
      ),
    );
    expect(screen.getByTestId("wallet.icp_balance")).toHaveTextContent("2.5");

    // Receive surface with the caller's deposit address.
    expect(screen.getByTestId("wallet.receive_section")).toBeInTheDocument();
    expect(screen.getByTestId("wallet.deposit_address")).toHaveTextContent(
      "aaaaa-aa-deposit-address",
    );

    // Both transfer forms are present.
    expect(screen.getByTestId("wallet.send_icp_section")).toBeInTheDocument();
    expect(screen.getByTestId("wallet.send_lucky_section")).toBeInTheDocument();
  });

  it("submits an ICP transfer and reports success", async () => {
    const user = userEvent.setup();
    const transferIcp = vi.fn(
      async (_recipient: Principal, _amount: bigint): Promise<GameError> =>
        ok(),
    );
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getWalletBalances: vi.fn(async () =>
          walletBalances({ lucky: 12_345n, icpE8s: 250_000_000n }),
        ),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => []),
        transferIcp,
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

    await screen.findByTestId("wallet.panel");
    await user.type(
      screen.getByTestId("wallet.icp_recipient_input"),
      RECIPIENT,
    );
    await user.type(screen.getByTestId("wallet.icp_amount_input"), "1");
    await user.click(screen.getByTestId("wallet.icp_submit_button"));

    await waitFor(() => expect(transferIcp).toHaveBeenCalledTimes(1));
    expect(transferIcp.mock.calls[0][0].toText()).toBe(RECIPIENT);
    expect(transferIcp.mock.calls[0][1]).toBe(100_000_000n);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("rejects an ICP transfer that exceeds the balance", async () => {
    const user = userEvent.setup();
    const transferIcp = vi.fn(
      async (_recipient: Principal, _amount: bigint): Promise<GameError> =>
        ok(),
    );
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getWalletBalances: vi.fn(async () =>
          walletBalances({ lucky: 12_345n, icpE8s: 50_000_000n }),
        ),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => []),
        transferIcp,
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

    await screen.findByTestId("wallet.panel");
    await user.type(
      screen.getByTestId("wallet.icp_recipient_input"),
      RECIPIENT,
    );
    // 1 ICP + fee exceeds the 0.5 ICP balance.
    await user.type(screen.getByTestId("wallet.icp_amount_input"), "1");

    expect(
      await screen.findByTestId("wallet.icp_amount_error"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wallet.icp_submit_button")).toBeDisabled();
    expect(transferIcp).not.toHaveBeenCalled();
  });

  it("submits a Lucky transfer through the ICRC-1 ledger and reports success", async () => {
    const user = userEvent.setup();
    const icrc1_transfer = vi.fn(
      async (_arg: TransferArg): Promise<TransferResult> => transferOk(7n),
    );
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getWalletBalances: vi.fn(async () =>
          walletBalances({ lucky: 12_345n, icpE8s: 250_000_000n }),
        ),
        getLedgerBalance: vi.fn(async () =>
          ledgerBalance({ balance: 12_345n }),
        ),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => []),
        icrc1_transfer,
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

    await screen.findByTestId("wallet.panel");
    await user.type(
      screen.getByTestId("wallet.lucky_recipient_input"),
      RECIPIENT,
    );
    await user.type(screen.getByTestId("wallet.lucky_amount_input"), "500");
    await user.click(screen.getByTestId("wallet.lucky_submit_button"));

    await waitFor(() => expect(icrc1_transfer).toHaveBeenCalledTimes(1));
    expect(icrc1_transfer.mock.calls[0][0].to.owner.toText()).toBe(RECIPIENT);
    expect(icrc1_transfer.mock.calls[0][0].amount).toBe(500n);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("surfaces a ledger transfer failure as an error toast", async () => {
    const user = userEvent.setup();
    const icrc1_transfer = vi.fn(
      async (_arg: TransferArg): Promise<TransferResult> =>
        transferErr({
          __kind__: "InsufficientFunds",
          InsufficientFunds: { balance: 100n },
        }),
    );
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getWalletBalances: vi.fn(async () =>
          walletBalances({ lucky: 12_345n, icpE8s: 250_000_000n }),
        ),
        getLedgerBalance: vi.fn(async () =>
          ledgerBalance({ balance: 12_345n }),
        ),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => []),
        icrc1_transfer,
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

    await screen.findByTestId("wallet.panel");
    await user.type(
      screen.getByTestId("wallet.lucky_recipient_input"),
      RECIPIENT,
    );
    await user.type(screen.getByTestId("wallet.lucky_amount_input"), "500");
    await user.click(screen.getByTestId("wallet.lucky_submit_button"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("renders the recent transfer records", async () => {
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getWalletBalances: vi.fn(async () =>
          walletBalances({ lucky: 12_345n, icpE8s: 250_000_000n }),
        ),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => [
          walletTransferRecord({ id: 1n }),
        ]),
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

    expect(
      await screen.findByTestId("wallet.transfers_list"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wallet.transfer_item.1")).toBeInTheDocument();
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
        getWalletBalances: vi.fn(async () =>
          walletBalances({ lucky: 12_345n, icpE8s: 250_000_000n }),
        ),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => []),
      }),
    );
  });

  it("shows the sign-in prompt and no balances or transfer forms", async () => {
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
    // Balance slots render the placeholder, never a numeric balance.
    await waitFor(() =>
      expect(screen.getByTestId("wallet.lucky_balance")).toHaveTextContent("—"),
    );
    expect(screen.getByTestId("wallet.icp_balance")).toHaveTextContent("—");
    // No receive/send surfaces leak to a signed-out visitor.
    expect(
      screen.queryByTestId("wallet.receive_section"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("wallet.send_icp_section"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("wallet.send_lucky_section"),
    ).not.toBeInTheDocument();
  });

  it("shows the sign-in prompt on the personal center when signed out", async () => {
    renderWithProviders(<AccountPage />);

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
    expect(screen.getAllByTestId("auth.prompt").length).toBeGreaterThan(0);
    expect(
      screen.queryByTestId("wallet.send_icp_section"),
    ).not.toBeInTheDocument();
  });
});
