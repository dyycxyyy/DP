import { TerminalHeader } from "@/components/TerminalHeader";
import { AccountPage } from "@/pages/AccountPage";
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
  exchangePool,
  gameState,
  playerProfile,
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
}));

// The header and the account page render router `Link`s. Stub the router
// surface to plain anchors so these surfaces can be exercised without standing
// up a router; the tab bar's `useRouterState` reports the arena path.
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

/**
 * Characterization baseline for the account surface and the header auth control.
 *
 * The accepted work turns the header auth control into a single personal-center
 * entry and moves the wallet/exchange/profile surfaces into the account page.
 * These tests pin the behavior that must survive that work: the login button
 * invokes the shared `login()` action when signed out, the signed-in control
 * links to the personal center, and the account page composes all three
 * surfaces. The actor is a local typed mock, so this proves the frontend's
 * contract with the actor, never the real canister's behavior.
 */
describe("header auth control", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("invokes the shared login action when signed out", async () => {
    setAuthenticated(false);
    const user = userEvent.setup();

    renderWithProviders(
      <TerminalHeader state={gameState()} luckyBalance={undefined} />,
    );

    await user.click(screen.getByTestId("header.login_button"));
    await waitFor(() => expect(coreMock.login).toHaveBeenCalledTimes(1));
    expect(coreMock.clear).not.toHaveBeenCalled();
  });

  it("links to the personal center when signed in", () => {
    setAuthenticated(true);

    renderWithProviders(
      <TerminalHeader state={gameState()} luckyBalance={12_345n} />,
    );

    expect(screen.getByTestId("header.account_button")).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.queryByTestId("header.login_button")).not.toBeInTheDocument();
  });
});

describe("account page composition", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
    setCoreActor(
      createFakeActor({
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

  it("composes the wallet, personal-panel and language surfaces without the exchange panel", async () => {
    renderWithProviders(<AccountPage />);

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
    expect(screen.getByTestId("wallet.panel")).toBeInTheDocument();
    expect(screen.getByTestId("profile.panel")).toBeInTheDocument();
    expect(screen.getByTestId("account.language_section")).toBeInTheDocument();
    // Token exchange now lives on its own /exchange page.
    expect(screen.queryByTestId("exchange.panel")).not.toBeInTheDocument();
  });

  it("shows the sign-in prompt on the account page when signed out", async () => {
    setAuthenticated(false);
    renderWithProviders(<AccountPage />);

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
    // The page-level prompt plus the wallet inline prompt both render while
    // signed out; at least one must be present.
    expect(screen.getAllByTestId("auth.prompt").length).toBeGreaterThan(0);
  });
});
