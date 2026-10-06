import { AppShell } from "@/components/AppShell";
import { TerminalHeader } from "@/components/TerminalHeader";
import { translations } from "@/i18n/translations";
import { AccountPage } from "@/pages/AccountPage";
import { screen, waitFor, within } from "@testing-library/react";
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
  Toaster: () => null,
}));

// The header, account page and tab bar render router `Link`s. Stub the router
// surface to plain anchors so these surfaces can be exercised without standing
// up a router; `useRouterState` reports the arena path so the arena tab is the
// active one.
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
 * Cover for the personal-center consolidation.
 *
 * The accepted work turns the header auth control into a personal-center entry
 * (sign in when signed out, open `/account` when signed in), consolidates the
 * wallet/exchange/profile surfaces plus a sign-out action into the personal
 * center, and removes the redundant 我的账号 bottom tab. The actor is a local
 * typed mock, so this proves the frontend's contract with the actor, never the
 * real canister's behavior.
 */
describe("header auth control as personal-center entry", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("links to the personal center when signed in", () => {
    setAuthenticated(true);
    renderWithProviders(
      <TerminalHeader state={gameState()} luckyBalance={12_345n} />,
    );

    const entry = screen.getByTestId("header.account_button");
    expect(entry).toHaveAttribute("href", "/account");
    expect(entry).toHaveAttribute("aria-label", "个人中心");
  });

  it("shows the sign-in control instead of the personal-center entry when signed out", () => {
    setAuthenticated(false);
    renderWithProviders(
      <TerminalHeader state={gameState()} luckyBalance={undefined} />,
    );

    expect(screen.getByTestId("header.login_button")).toBeInTheDocument();
    expect(
      screen.queryByTestId("header.account_button"),
    ).not.toBeInTheDocument();
  });
});

describe("personal center sign-out", () => {
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

  it("invokes the shared clear action from the sign-out button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountPage />);

    const signOut = await screen.findByTestId("account.sign_out_button");
    await user.click(signOut);

    await waitFor(() => expect(coreMock.clear).toHaveBeenCalledTimes(1));
    expect(coreMock.login).not.toHaveBeenCalled();
  });

  it("hides the sign-out action when signed out", async () => {
    setAuthenticated(false);
    renderWithProviders(<AccountPage />);

    await screen.findByTestId("account.page");
    expect(
      screen.queryByTestId("account.sign_out_button"),
    ).not.toBeInTheDocument();
  });
});

describe("bottom tab bar", () => {
  beforeEach(() => {
    resetCoreMock();
    setCoreActor(createFakeActor());
  });

  it("keeps the remaining tabs plus the exchange and guide tabs and drops the 我的账号 tab", async () => {
    renderWithProviders(
      <AppShell>
        <div />
      </AppShell>,
    );

    const tabBar = await screen.findByTestId("shell.tab_bar");
    const tabs = within(tabBar).getAllByRole("link");

    expect(tabs.map((tab) => tab.getAttribute("href"))).toEqual([
      "/",
      "/crowdfund",
      "/ranking",
      "/exchange",
      "/guide",
    ]);
    expect(within(tabBar).queryByText("我的账号")).not.toBeInTheDocument();
    expect(within(tabBar).queryByText("Account")).not.toBeInTheDocument();
  });

  it("navigates each remaining tab to its route", async () => {
    renderWithProviders(
      <AppShell>
        <div />
      </AppShell>,
    );

    const tabBar = await screen.findByTestId("shell.tab_bar");
    expect(within(tabBar).getByTestId("tab.arena")).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(tabBar).getByTestId("tab.crowdfund")).toHaveAttribute(
      "href",
      "/crowdfund",
    );
    expect(within(tabBar).getByTestId("tab.ranking")).toHaveAttribute(
      "href",
      "/ranking",
    );
    expect(within(tabBar).getByTestId("tab.exchange")).toHaveAttribute(
      "href",
      "/exchange",
    );
  });
});

describe("personal center composition", () => {
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

  it("shows the language toggle and no token-exchange panel", async () => {
    renderWithProviders(<AccountPage />);

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
    expect(screen.getByTestId("account.language_section")).toBeInTheDocument();
    expect(screen.getByTestId("lang.toggle")).toBeInTheDocument();
    // Token exchange moved to its own /exchange page.
    expect(screen.queryByTestId("exchange.panel")).not.toBeInTheDocument();
  });

  it("places the language toggle at the very top, above the header row", async () => {
    renderWithProviders(<AccountPage />);

    const page = await screen.findByTestId("account.page");
    const languageSection = screen.getByTestId("account.language_section");
    const toggle = screen.getByTestId("lang.toggle");
    // The header row is the title/back-link band that follows the toggle.
    const headerRow = screen.getByTestId("account.back_link").parentElement;
    expect(headerRow).not.toBeNull();

    // The toggle lives inside the language section, and that section is the
    // first child of the page — ahead of the header row in document order.
    expect(languageSection).toContainElement(toggle);
    expect(page.firstElementChild).toBe(languageSection);
    expect(
      languageSection.compareDocumentPosition(headerRow as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("personal-center dictionary parity", () => {
  const zhKeys = Object.keys(translations.zh).sort();
  const enKeys = Object.keys(translations.en).sort();

  it("mirrors every zh key in en and vice versa", () => {
    expect(enKeys).toEqual(zhKeys);
  });

  it("defines every personal-center string in both dictionaries", () => {
    const personalCenterKeys = zhKeys.filter((key) =>
      key.startsWith("personalCenter."),
    );
    expect(personalCenterKeys.length).toBeGreaterThan(0);
    for (const key of personalCenterKeys) {
      expect(translations.zh[key as keyof typeof translations.zh]).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
    }
  });
});
