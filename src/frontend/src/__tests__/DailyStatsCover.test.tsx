import { UserRole } from "@/backend";
import { AdminPage } from "@/pages/AdminPage";
import { screen, waitFor, within } from "@testing-library/react";
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
  adminStatus,
  createFakeActor,
  dailyStatsEntry,
  dailyStatsErr,
  dailyStatsOk,
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

/** ISO `YYYY-MM-DD` for a date offset by `days` from today (UTC). */
function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Cover for the controller-only daily-statistics section added to `AdminPage`.
 *
 * The accepted work adds a date-ranged table of per-UTC-day bets, payouts and
 * treasury income, backed by the controller-gated `getDailyStats` query. The
 * actor is a local typed mock, so this proves the frontend's contract with the
 * actor — the query arguments it sends and the values it renders — never the
 * real canister's aggregation.
 */
describe("admin daily statistics section", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders the three metrics for a controller", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus()),
        getDailyStats: vi.fn(async () =>
          dailyStatsOk([
            dailyStatsEntry(isoDay(0), {
              totalBets: 1_234n,
              totalPayouts: 567n,
              treasuryIncome: 89n,
            }),
          ]),
        ),
      }),
    );

    renderWithProviders(<AdminPage />);

    const section = await screen.findByTestId("admin.stats.section");
    // The table (and its headers) only renders once the query resolves.
    const row = await within(section).findByTestId("admin.stats.row.1");
    expect(within(section).getByText("投注总额")).toBeInTheDocument();
    expect(within(section).getByText("奖项支出")).toBeInTheDocument();
    expect(within(section).getByText("国库收入")).toBeInTheDocument();

    expect(row).toHaveTextContent("1,234");
    expect(row).toHaveTextContent("567");
    expect(row).toHaveTextContent("89");
  });

  it("hides the section from a non-admin", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.user),
      }),
    );

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.stats.section")).not.toBeInTheDocument();
  });

  it("renders zero values for days with no activity", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
        getAdminStatus: vi.fn(async () => adminStatus()),
        getDailyStats: vi.fn(async () =>
          dailyStatsOk([
            dailyStatsEntry(isoDay(-1)),
            dailyStatsEntry(isoDay(0)),
          ]),
        ),
      }),
    );

    renderWithProviders(<AdminPage />);

    const row = await screen.findByTestId("admin.stats.row.1");
    // A zero-filled day renders numeric zeroes, not a blank cell.
    const cells = within(row).getAllByRole("cell");
    expect(cells).toHaveLength(4);
    expect(cells[1]).toHaveTextContent("0");
    expect(cells[2]).toHaveTextContent("0");
    expect(cells[3]).toHaveTextContent("0");
  });

  it("queries the default last-7-days range on mount", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      getDailyStats: vi.fn(async () => dailyStatsOk([])),
    });
    setCoreActor(actor);

    renderWithProviders(<AdminPage />);

    await waitFor(() =>
      expect(actor.getDailyStats).toHaveBeenCalledWith(isoDay(-6), isoDay(0)),
    );
  });

  it("drives the query from the selected date range", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      getDailyStats: vi.fn(async () => dailyStatsOk([])),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await waitFor(() => expect(actor.getDailyStats).toHaveBeenCalled());

    const from = screen.getByTestId("admin.stats.from_input");
    const to = screen.getByTestId("admin.stats.to_input");
    await user.clear(from);
    await user.type(from, "2026-09-01");
    await user.clear(to);
    await user.type(to, "2026-09-03");
    await user.click(screen.getByTestId("admin.stats.apply_button"));

    await waitFor(() =>
      expect(actor.getDailyStats).toHaveBeenCalledWith(
        "2026-09-01",
        "2026-09-03",
      ),
    );
  });

  it("drives the query from the 30-day preset", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      getDailyStats: vi.fn(async () => dailyStatsOk([])),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    await waitFor(() => expect(actor.getDailyStats).toHaveBeenCalled());

    await user.click(screen.getByTestId("admin.stats.preset30_button"));

    await waitFor(() =>
      expect(actor.getDailyStats).toHaveBeenCalledWith(isoDay(-29), isoDay(0)),
    );
  });

  it("shows an error state with a retry when the query fails", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getAdminStatus: vi.fn(async () => adminStatus()),
      getDailyStats: vi.fn(async () =>
        dailyStatsErr({ __kind__: "notRegistered", notRegistered: null }),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.stats.error_state"),
    ).toBeInTheDocument();

    const callsBefore = actor.getDailyStats.mock.calls.length;
    await user.click(screen.getByTestId("admin.stats.retry_button"));

    await waitFor(() =>
      expect(actor.getDailyStats.mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );
  });
});
