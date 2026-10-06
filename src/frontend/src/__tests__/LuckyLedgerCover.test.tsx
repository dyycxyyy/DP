import { TransactionKind, UserRole } from "@/backend";
import { WalletPanel } from "@/components/WalletPanel";
import { AdminPage } from "@/pages/AdminPage";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
  setCoreActor,
} from "./core-mock";
import {
  adminStatus,
  blockPage,
  createFakeActor,
  depositAddress,
  exchangePool,
  ledgerBalance,
  ledgerTransaction,
  mintOk,
  playerProfile,
  tokenInfo,
  transferErr,
  transferOk,
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

const RECIPIENT = "aaaaa-aa";

/**
 * Cover for the Lucky ICRC-1 / ICRC-2 ledger surfaces.
 *
 * The accepted work turns Lucky into a real token ledger and adds an admin
 * "Lucky 代币" section (metadata + mint form + recent transactions) plus a
 * wallet whose Lucky balance and transfer read/write the real ledger. These
 * tests drive the real components against a local typed actor mock, so they
 * prove the frontend's contract with the actor — never the real canister.
 */
describe("admin token panel", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders the token metadata, total supply and logo for an admin", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus()),
        getTokenInfo: vi.fn(async () =>
          tokenInfo({
            metadata: {
              name: "Lucky",
              symbol: "LUCKY",
              decimals: 0,
              fee: 0n,
              logo: "data:image/svg+xml;base64,PHN2Zy8+",
            },
            totalSupply: 12_345n,
          }),
        ),
      }),
    );

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.token.section"),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("admin.token.name")).toHaveTextContent(
      "Lucky",
    );
    expect(screen.getByTestId("admin.token.symbol")).toHaveTextContent("LUCKY");
    expect(screen.getByTestId("admin.token.decimals")).toHaveTextContent("0");
    expect(screen.getByTestId("admin.token.fee")).toHaveTextContent("0");
    expect(screen.getByTestId("admin.token.total_supply")).toHaveTextContent(
      "12,345",
    );
    expect(screen.getByTestId("admin.token.logo")).toHaveAttribute(
      "src",
      "data:image/svg+xml;base64,PHN2Zy8+",
    );
  });

  it("mints to the entered principal and amount, then refreshes supply and ledger", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      getTokenInfo: vi.fn(async () => tokenInfo({ totalSupply: 0n })),
      mintLucky: vi.fn(async () =>
        mintOk({ blockIndex: 0n, totalSupply: 1000n, amount: 1000n }),
      ),
      icrc3_get_blocks: vi.fn(async () =>
        blockPage({
          transactions: [
            ledgerTransaction({
              index: 0n,
              amount: 1000n,
              kind: TransactionKind.mint,
            }),
          ],
        }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    const form = await screen.findByTestId("admin.token.mint_form");
    await user.type(
      within(form).getByTestId("admin.token.owner_input"),
      RECIPIENT,
    );
    await user.type(
      within(form).getByTestId("admin.token.amount_input"),
      "1000",
    );
    await user.click(within(form).getByTestId("admin.token.mint_button"));

    await waitFor(() => expect(actor.mintLucky).toHaveBeenCalledTimes(1));
    expect(actor.mintLucky).toHaveBeenCalledWith({
      to: { owner: expect.objectContaining({ toText: expect.any(Function) }) },
      amount: 1000n,
      memo: undefined,
    });
    expect(toast.success).toHaveBeenCalled();

    // The mint invalidates the token snapshot and the block log, so both are
    // re-read after the write.
    await waitFor(() =>
      expect(actor.getTokenInfo.mock.calls.length).toBeGreaterThan(1),
    );
    await waitFor(() =>
      expect(actor.icrc3_get_blocks.mock.calls.length).toBeGreaterThan(1),
    );
  });

  it("keeps the mint button disabled for an invalid principal or amount", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    const form = await screen.findByTestId("admin.token.mint_form");
    await user.type(
      within(form).getByTestId("admin.token.owner_input"),
      "not-a-principal",
    );
    await user.type(
      within(form).getByTestId("admin.token.amount_input"),
      "1000",
    );

    expect(within(form).getByTestId("admin.token.mint_button")).toBeDisabled();
    expect(actor.mintLucky).not.toHaveBeenCalled();
  });

  it("renders recent ledger transactions newest-first", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus()),
        icrc3_get_blocks: vi.fn(async () =>
          blockPage({
            transactions: [
              ledgerTransaction({
                index: 0n,
                amount: 100n,
                kind: TransactionKind.mint,
              }),
              ledgerTransaction({
                index: 1n,
                amount: 250n,
                kind: TransactionKind.transfer,
              }),
            ],
          }),
        ),
      }),
    );

    renderWithProviders(<AdminPage />);

    const table = await screen.findByTestId("admin.token.ledger_table");
    const rows = within(table).getAllByRole("row");
    // Header row plus two transaction rows.
    expect(rows).toHaveLength(3);
    // Newest first: block #1 precedes block #0.
    expect(rows[1]).toHaveTextContent("#1");
    expect(rows[2]).toHaveTextContent("#0");
  });

  it("shows the empty ledger state when there are no transactions", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus()),
        icrc3_get_blocks: vi.fn(async () => blockPage({ transactions: [] })),
      }),
    );

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.token.ledger_empty_state"),
    ).toBeInTheDocument();
  });

  it("does not render the token section or call token methods for a non-admin", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.user),
    });
    setCoreActor(actor);

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.token.section")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.token.mint_form"),
    ).not.toBeInTheDocument();
    expect(actor.getTokenInfo).not.toHaveBeenCalled();
    expect(actor.mintLucky).not.toHaveBeenCalled();
    expect(actor.icrc3_get_blocks).not.toHaveBeenCalled();
  });
});

describe("wallet Lucky ledger surface", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows the real ledger balance rather than the internal profile counter", async () => {
    setCoreActor(
      createFakeActor({
        getMyProfile: vi.fn(async () => playerProfile({ luckyBalance: 7n })),
        getLedgerBalance: vi.fn(async () => ledgerBalance({ balance: 4_200n })),
        getWalletBalances: vi.fn(async () => walletBalances()),
        getDepositAddress: vi.fn(async () => depositAddress()),
        getRecentTransfers: vi.fn(async () => []),
      }),
    );

    renderWithProviders(
      <WalletPanel
        profile={playerProfile({ luckyBalance: 7n })}
        exchangePool={exchangePool()}
        treasury={0n}
        isLoading={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("wallet.lucky_balance")).toHaveTextContent(
        "4,200",
      ),
    );
  });

  it("sends Lucky through icrc1_transfer with the recipient and amount", async () => {
    const actor = createFakeActor({
      getMyProfile: vi.fn(async () => playerProfile({ luckyBalance: 0n })),
      getLedgerBalance: vi.fn(async () => ledgerBalance({ balance: 1_000n })),
      getWalletBalances: vi.fn(async () => walletBalances()),
      getDepositAddress: vi.fn(async () => depositAddress()),
      getRecentTransfers: vi.fn(async () => []),
      icrc1_transfer: vi.fn(async () => transferOk(3n)),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <WalletPanel
        profile={playerProfile({ luckyBalance: 0n })}
        exchangePool={exchangePool()}
        treasury={0n}
        isLoading={false}
      />,
    );

    const section = await screen.findByTestId("wallet.send_lucky_section");
    await user.type(
      within(section).getByTestId("wallet.lucky_recipient_input"),
      RECIPIENT,
    );
    await user.type(
      within(section).getByTestId("wallet.lucky_amount_input"),
      "500",
    );
    await user.click(within(section).getByTestId("wallet.lucky_submit_button"));

    await waitFor(() => expect(actor.icrc1_transfer).toHaveBeenCalledTimes(1));
    expect(actor.icrc1_transfer).toHaveBeenCalledWith({
      to: { owner: expect.objectContaining({ toText: expect.any(Function) }) },
      amount: 500n,
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("surfaces a ledger InsufficientFunds error without a success toast", async () => {
    const actor = createFakeActor({
      getMyProfile: vi.fn(async () => playerProfile({ luckyBalance: 0n })),
      getLedgerBalance: vi.fn(async () => ledgerBalance({ balance: 100n })),
      getWalletBalances: vi.fn(async () => walletBalances()),
      getDepositAddress: vi.fn(async () => depositAddress()),
      getRecentTransfers: vi.fn(async () => []),
      icrc1_transfer: vi.fn(async () =>
        transferErr({
          __kind__: "InsufficientFunds",
          InsufficientFunds: { balance: 100n },
        }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <WalletPanel
        profile={playerProfile({ luckyBalance: 0n })}
        exchangePool={exchangePool()}
        treasury={0n}
        isLoading={false}
      />,
    );

    const section = await screen.findByTestId("wallet.send_lucky_section");
    await user.type(
      within(section).getByTestId("wallet.lucky_recipient_input"),
      RECIPIENT,
    );
    await user.type(
      within(section).getByTestId("wallet.lucky_amount_input"),
      "50",
    );
    await user.click(within(section).getByTestId("wallet.lucky_submit_button"));

    await waitFor(() => expect(actor.icrc1_transfer).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps the Lucky send button disabled above the ledger balance", async () => {
    const actor = createFakeActor({
      getMyProfile: vi.fn(async () => playerProfile({ luckyBalance: 0n })),
      getLedgerBalance: vi.fn(async () => ledgerBalance({ balance: 100n })),
      getWalletBalances: vi.fn(async () => walletBalances()),
      getDepositAddress: vi.fn(async () => depositAddress()),
      getRecentTransfers: vi.fn(async () => []),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <WalletPanel
        profile={playerProfile({ luckyBalance: 0n })}
        exchangePool={exchangePool()}
        treasury={0n}
        isLoading={false}
      />,
    );

    const section = await screen.findByTestId("wallet.send_lucky_section");
    await user.type(
      within(section).getByTestId("wallet.lucky_recipient_input"),
      RECIPIENT,
    );
    await user.type(
      within(section).getByTestId("wallet.lucky_amount_input"),
      "500",
    );

    expect(
      within(section).getByTestId("wallet.lucky_submit_button"),
    ).toBeDisabled();
    expect(actor.icrc1_transfer).not.toHaveBeenCalled();
  });
});
