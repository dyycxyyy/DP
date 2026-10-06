import { UserRole } from "@/backend";
import { ArenaPage } from "@/pages/ArenaPage";
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
import { createFakeActor, gameState, ok } from "./helpers";
import { renderWithProviders } from "./render";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/**
 * Admin-role-gated dev controls.
 *
 * The panel is rendered by `ArenaPage` only when the caller's platform role
 * resolves to `#admin`, so an ordinary visitor never sees the controls. These
 * tests pin that gate and the two actions the panel exposes: seeding a Lucky
 * balance and fast-forwarding the round. The actor is a local typed mock, so
 * this proves the frontend's contract with the actor, never the real canister's
 * authorization.
 */
describe("admin-role-gated dev controls", () => {
  beforeEach(() => {
    resetCoreMock();
    // The dev controls are only actionable while signed in; the role gate is
    // what decides whether the panel renders at all.
    setAuthenticated(true);
  });

  it("never renders the dev panel for an ordinary visitor", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.user),
      }),
    );

    renderWithProviders(<ArenaPage />);

    // The page itself renders, so the absence below is the gate, not a blank page.
    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("draw.prize_pool")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("dev.panel")).not.toBeInTheDocument();
  });

  it("renders the dev panel for an admin", async () => {
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(async () => UserRole.admin),
      }),
    );

    renderWithProviders(<ArenaPage />);

    expect(await screen.findByTestId("dev.panel")).toBeInTheDocument();
    expect(screen.getByTestId("dev.advance_button")).toBeInTheDocument();
  });

  it("seeds the caller's Lucky balance through devSeedBalance", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      devSeedBalance: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<ArenaPage />);
    await screen.findByTestId("dev.panel");

    await user.click(screen.getByTestId("dev.seed_preset.100000"));

    await waitFor(() =>
      expect(actor.devSeedBalance).toHaveBeenCalledWith(100_000n),
    );
  });

  it("seeds a custom amount typed into the input", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      devSeedBalance: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<ArenaPage />);
    await screen.findByTestId("dev.panel");

    // The button stays disabled until a positive integer is entered.
    expect(screen.getByTestId("dev.seed_button")).toBeDisabled();
    await user.type(screen.getByTestId("dev.seed_input"), "250000");
    expect(screen.getByTestId("dev.seed_button")).toBeEnabled();

    await user.click(screen.getByTestId("dev.seed_button"));

    await waitFor(() =>
      expect(actor.devSeedBalance).toHaveBeenCalledWith(250_000n),
    );
  });

  it("fast-forwards the round through devAdvanceRound", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      devAdvanceRound: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<ArenaPage />);
    await screen.findByTestId("dev.panel");

    await user.click(screen.getByTestId("dev.advance_button"));

    await waitFor(() => expect(actor.devAdvanceRound).toHaveBeenCalledTimes(1));
  });

  it("sets the round elapsed time through devSetRoundElapsed", async () => {
    const actor = createFakeActor({
      getCallerRole: vi.fn(async () => UserRole.admin),
      devSetRoundElapsed: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(<ArenaPage />);
    await screen.findByTestId("dev.panel");

    // "众筹结束 · 8 分钟" = 8 * 60 * 1e9 ns.
    await user.click(screen.getByTestId("dev.elapsed.480000000000"));

    await waitFor(() =>
      expect(actor.devSetRoundElapsed).toHaveBeenCalledWith(480_000_000_000n),
    );
  });

  it("keeps the panel hidden while the role query is unresolved", async () => {
    // A never-resolving query leaves the role unresolved, which must not render
    // the controls.
    setCoreActor(
      createFakeActor({
        getCallerRole: vi.fn(() => new Promise<UserRole>(() => {})),
        getGameState: vi.fn(async () => gameState({ round: 2n })),
      }),
    );

    renderWithProviders(<ArenaPage />);

    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
    expect(screen.queryByTestId("dev.panel")).not.toBeInTheDocument();
  });
});
