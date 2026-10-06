import { UserRole } from "@/backend";
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
  adminStatus,
  createFakeActor,
  gameState,
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
 * Characterization baseline for the existing super-admin console, taken before
 * the daily-statistics work lands.
 *
 * The accepted change adds an admin-role-only daily-statistics section to
 * `AdminPage` and new daily aggregation to the backend. This file deliberately
 * does NOT freeze the absence of that section. It pins the adjacent behavior
 * that must keep working:
 *
 * - the role gate fails closed when the backend check errors, so a new
 *   admin-only section cannot leak to a non-admin;
 * - the admin nav entry stays hidden from non-admins and visible to an admin;
 * - a failed admin status read degrades to a loading state instead of crashing,
 *   and a failed admin write surfaces an error toast.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister.
 */
describe("admin role gate fails closed", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("denies the console when the role check rejects", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => {
          throw new Error("backend unavailable");
        }),
      }),
    );

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.stop_button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.reset_button")).not.toBeInTheDocument();
  });

  it("denies the console while the role check is unresolved", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(() => new Promise<UserRole>(() => {})),
      }),
    );

    renderWithProviders(<AdminPage />);

    // The loading state is shown first; the console must never appear while the
    // check is pending, and the denial is the only other terminal state.
    expect(
      await screen.findByTestId("admin.loading_state"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.page")).not.toBeInTheDocument();
  });
});

describe("admin nav entry gating", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () => gameState({ round: 3n })),
      }),
    );
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("hides the admin tab from a non-admin", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.user),
        getGameState: vi.fn(async () => gameState({ round: 3n })),
      }),
    );

    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    const tabBar = await screen.findByTestId("shell.tab_bar");
    // The other tabs render, so the bar itself is present.
    expect(within(tabBar).getByTestId("tab.arena")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(tabBar).queryByTestId("tab.admin")).not.toBeInTheDocument(),
    );
  });

  it("shows the admin tab to an admin", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getGameState: vi.fn(async () => gameState({ round: 3n })),
      }),
    );

    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    const tabBar = await screen.findByTestId("shell.tab_bar");
    expect(await within(tabBar).findByTestId("tab.admin")).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});

describe("admin console error handling", () => {
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

  it("degrades to a loading state when the admin status read fails", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => {
          throw new Error("status unavailable");
        }),
      }),
    );

    renderWithProviders(<AdminPage />);

    // The console shell renders, but with no balances the pool section shows the
    // loading placeholder rather than crashing or rendering empty rows.
    expect(await screen.findByTestId("admin.page")).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.pool.prizePool.balance"),
    ).not.toBeInTheDocument();
  });

  it("surfaces an error toast when a stop-round write fails", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () =>
        adminStatus({ balances: adminPoolBalances({ prizePool: 1_000n }) }),
      ),
      stopNextRound: vi.fn(async () => {
        throw new Error("write failed");
      }),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await user.click(await screen.findByTestId("admin.stop_button"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
