import { UserRole } from "@/backend";
import { AdminPage } from "@/pages/AdminPage";
import { GuidePage } from "@/pages/GuidePage";
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
  setCoreActor,
} from "./core-mock";
import { createFakeActor, gameState, guideText } from "./helpers";
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
 * Characterization baseline for the admin authorization boundary.
 *
 * The accepted work moves admin gating from canister-controller identity to
 * app-level authorization roles and adds a user-management panel. That is the
 * behavior intentionally changing, so this file deliberately does NOT assert
 * that `isCallerController` is the gate. It pins the invariant that must survive
 * the change: an unauthorized caller is denied at the *backend-call* level, not
 * merely visually. A non-admin must never trigger an admin-only read
 * (`getAdminStatus`, `getDailyStats`) or an admin-only write, and must never
 * reach the guide save. The existing suite asserts the visible absence of
 * controls; this file asserts the absence of the calls behind them, which is
 * what a gate that only hides buttons would fail. The gate is now the platform
 * role (`getCallerRole`), so the mocks resolve that seam.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister's authorization.
 */
describe("admin console denies an unauthorized caller at the call level", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("triggers no admin-only read or write and shows no controls", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.user),
    });
    setCoreActor(actor);

    renderWithProviders(<AdminPage />);

    // The denial is the terminal state, so the console never mounts.
    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.page")).not.toBeInTheDocument();

    // No admin-only read is issued for an unauthorized caller.
    expect(actor.getAdminStatus).not.toHaveBeenCalled();
    expect(actor.getDailyStats).not.toHaveBeenCalled();

    // No admin-only write is issued either.
    expect(actor.stopNextRound).not.toHaveBeenCalled();
    expect(actor.resumeRound).not.toHaveBeenCalled();
    expect(actor.withdrawFromPool).not.toHaveBeenCalled();
    expect(actor.resetGameData).not.toHaveBeenCalled();
  });

  it("triggers no admin-only read while the authorization check is unresolved", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(() => new Promise<UserRole>(() => {})),
    });
    setCoreActor(actor);

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.loading_state"),
    ).toBeInTheDocument();
    expect(actor.getAdminStatus).not.toHaveBeenCalled();
    expect(actor.getDailyStats).not.toHaveBeenCalled();
  });

  it("triggers no admin-only read when the authorization check rejects", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => {
        throw new Error("backend unavailable");
      }),
    });
    setCoreActor(actor);

    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByTestId("admin.no_permission"),
    ).toBeInTheDocument();
    expect(actor.getAdminStatus).not.toHaveBeenCalled();
    expect(actor.getDailyStats).not.toHaveBeenCalled();
  });
});

describe("guide page denies an unauthorized editor at the call level", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("reads the guide but never calls setGuideText and shows no edit control", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.user),
      getGuideText: vi.fn(async () =>
        guideText({ text: "只读内容", isSet: true }),
      ),
    });
    setCoreActor(actor);

    renderWithProviders(<GuidePage />);

    // Everyone reads the guide, so the content renders for a non-editor.
    await waitFor(() =>
      expect(screen.getByTestId("guide.content.panel")).toHaveTextContent(
        "只读内容",
      ),
    );
    expect(actor.getGuideText).toHaveBeenCalled();

    // The save is never reachable, and no edit control is offered.
    expect(screen.queryByTestId("guide.edit_button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guide.edit.panel")).not.toBeInTheDocument();
    expect(actor.setGuideText).not.toHaveBeenCalled();
  });
});

describe("authorized admin still reaches the admin actions", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("reads the admin status and daily stats once authorized", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      getGameState: vi.fn(async () => gameState({ round: 4n })),
    });
    setCoreActor(actor);

    renderWithProviders(<AdminPage />);

    expect(await screen.findByTestId("admin.page")).toBeInTheDocument();
    await waitFor(() => expect(actor.getAdminStatus).toHaveBeenCalled());
    await waitFor(() => expect(actor.getDailyStats).toHaveBeenCalled());
  });

  it("keeps the admin tab hidden from an unauthorized caller while other tabs remain", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.user),
        getGameState: vi.fn(async () => gameState({ round: 4n })),
      }),
    );

    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    const tabBar = await screen.findByTestId("shell.tab_bar");
    expect(within(tabBar).getByTestId("tab.arena")).toBeInTheDocument();
    expect(within(tabBar).getByTestId("tab.guide")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(tabBar).queryByTestId("tab.admin")).not.toBeInTheDocument(),
    );
  });
});
