import { AdminPool, UserRole } from "@/backend";
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
  adminPoolBalances,
  adminResetOk,
  adminStatus,
  adminWithdrawOk,
  createFakeActor,
  ok,
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
 * Cover for the super-admin console.
 *
 * The accepted work adds an admin-role-only `/admin` page: non-admins see a
 * no-permission state and no controls; an admin can stop/resume the round,
 * withdraw from each pool to a recipient principal, and reset all game data
 * behind a two-step confirmation. The actor is a local typed mock, so this
 * proves the frontend's contract with the actor, never the real canister.
 */
describe("admin console permission gate", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows a no-permission state to a signed-in non-admin with no controls", async () => {
    setAuthenticated(true);
    setCoreActor(
      createFakeActor({ getCallerRole: vi.fn(async () => UserRole.user) }),
    );

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.stop_button")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.withdraw_button.prizePool"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.reset_button")).not.toBeInTheDocument();
  });

  it("shows the sign-in-required message to a signed-out visitor", async () => {
    setAuthenticated(false);
    setCoreActor(
      createFakeActor({ getCallerRole: vi.fn(async () => UserRole.guest) }),
    );

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
  });
});

describe("admin console round control", () => {
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

  it("stops the next round and reports success", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus({ roundStopped: false })),
      stopNextRound: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await user.click(await screen.findByTestId("admin.stop_button"));

    await waitFor(() => expect(actor.stopNextRound).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows the stopped status and disables stop when the round is stopped", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus({ roundStopped: true })),
      }),
    );

    renderWithProviders(<AdminPage />);

    // The status element renders as soon as the controller check resolves,
    // before `getAdminStatus` has answered, so wait for the stopped text rather
    // than the element's first appearance.
    await waitFor(() =>
      expect(screen.getByTestId("admin.round.status")).toHaveTextContent(
        "本局已停止",
      ),
    );
    expect(screen.getByTestId("admin.stop_button")).toBeDisabled();
    expect(screen.getByTestId("admin.resume_button")).toBeEnabled();
  });

  it("resumes a stopped round", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus({ roundStopped: true })),
      resumeRound: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await user.click(await screen.findByTestId("admin.resume_button"));

    await waitFor(() => expect(actor.resumeRound).toHaveBeenCalledTimes(1));
  });
});

describe("admin console pool withdrawal", () => {
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

  it("renders all four pool balances", async () => {
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

    expect(
      await screen.findByTestId("admin.pool.prizePool.balance"),
    ).toHaveTextContent("1,000");
    expect(screen.getByTestId("admin.pool.treasury.balance")).toHaveTextContent(
      "2,000",
    );
    expect(
      screen.getByTestId("admin.pool.exchangeLucky.balance"),
    ).toHaveTextContent("3,000");
    // ICP is denominated in e8s and rendered as a decimal.
    expect(
      screen.getByTestId("admin.pool.exchangeIcp.balance"),
    ).toHaveTextContent("4");
  });

  it("withdraws from the prize pool to the given recipient", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () =>
        adminStatus({ balances: adminPoolBalances({ prizePool: 1_000n }) }),
      ),
      withdrawFromPool: vi.fn(async () => adminWithdrawOk({ amount: 500n })),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    const row = await screen.findByTestId("admin.pool.prizePool");
    await user.type(within(row).getByTestId("admin.amount.prizePool"), "500");
    await user.type(
      within(row).getByTestId("admin.recipient.prizePool"),
      RECIPIENT,
    );
    await user.click(
      within(row).getByTestId("admin.withdraw_button.prizePool"),
    );

    await waitFor(() =>
      expect(actor.withdrawFromPool).toHaveBeenCalledWith(
        AdminPool.prizePool,
        500n,
        expect.objectContaining({ toText: expect.any(Function) }),
      ),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps the withdraw button disabled for an invalid recipient", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () =>
        adminStatus({ balances: adminPoolBalances({ treasury: 1_000n }) }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    const row = await screen.findByTestId("admin.pool.treasury");
    await user.type(within(row).getByTestId("admin.amount.treasury"), "500");
    await user.type(
      within(row).getByTestId("admin.recipient.treasury"),
      "not-a-principal",
    );

    expect(
      within(row).getByTestId("admin.withdraw_button.treasury"),
    ).toBeDisabled();
    expect(actor.withdrawFromPool).not.toHaveBeenCalled();
  });

  it("keeps the withdraw button disabled when the amount exceeds the balance", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () =>
        adminStatus({ balances: adminPoolBalances({ treasury: 100n }) }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    const row = await screen.findByTestId("admin.pool.treasury");
    await user.type(within(row).getByTestId("admin.amount.treasury"), "500");
    await user.type(
      within(row).getByTestId("admin.recipient.treasury"),
      RECIPIENT,
    );

    expect(
      within(row).getByTestId("admin.withdraw_button.treasury"),
    ).toBeDisabled();
    expect(actor.withdrawFromPool).not.toHaveBeenCalled();
  });
});

describe("admin console reset", () => {
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

  it("requires a second confirmation before resetting", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      resetGameData: vi.fn(async () => adminResetOk()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await user.click(await screen.findByTestId("admin.reset_button"));
    // First click only reveals the confirmation; nothing is reset yet.
    expect(actor.resetGameData).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("admin.reset_confirm_button"),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("admin.reset_confirm_button"));

    await waitFor(() => expect(actor.resetGameData).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalled();
  });

  it("cancels the reset confirmation without resetting", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await user.click(await screen.findByTestId("admin.reset_button"));
    await user.click(screen.getByTestId("admin.reset_cancel_button"));

    expect(actor.resetGameData).not.toHaveBeenCalled();
    expect(screen.getByTestId("admin.reset_button")).toBeInTheDocument();
  });
});
