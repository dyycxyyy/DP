import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import { createFakeActor, gameState } from "./helpers";
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

describe("App default route", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("renders the arena at the default route without a blank screen", async () => {
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({ round: 5n, totalPrizePool: 1_000_000n }),
        ),
      }),
    );

    // Imported lazily so the module-level router is created after the mocks are
    // registered, and the default jsdom location ("/") selects the arena route.
    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
    // The header is part of the layout and shows the live round.
    await waitFor(() =>
      expect(screen.getByTestId("header.round")).toHaveTextContent("5"),
    );
  });
});
