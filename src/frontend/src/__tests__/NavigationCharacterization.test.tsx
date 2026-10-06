import { translations } from "@/i18n/translations";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/**
 * Characterization baseline for the bottom-navigation contract.
 *
 * A new guide tab and route are planned, so this file deliberately does NOT
 * freeze the tab count or the full route list. It pins the behavior that must
 * survive that work: the existing arena/crowdfund/ranking tabs stay present and
 * point at their routes, the existing routes still render their pages, and the
 * zh/en dictionaries stay in parity (a new guide page must add both languages).
 *
 * The real router is exercised through `App`, so these are component/integration
 * journeys, not deployed browser E2E. The actor is a local typed mock, so this
 * proves the frontend's contract with the actor, never the real canister.
 */
describe("bottom navigation contract", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () => gameState({ round: 7n })),
      }),
    );
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("keeps the existing tabs wired to their routes", async () => {
    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

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
  });

  it("labels the existing tabs from the dictionary in both languages", async () => {
    const user = userEvent.setup();
    // The language switch now lives in the personal center, so render it next
    // to the app (which supplies the router context) to exercise the tab labels
    // in both languages.
    const { default: App } = await import("@/App");
    const { LanguageToggle } = await import("@/components/LanguageToggle");
    renderWithProviders(
      <>
        <LanguageToggle />
        <App />
      </>,
    );

    const tabBar = await screen.findByTestId("shell.tab_bar");
    expect(within(tabBar).getByTestId("tab.arena")).toHaveTextContent(
      translations.zh["nav.arena"],
    );
    expect(within(tabBar).getByTestId("tab.crowdfund")).toHaveTextContent(
      translations.zh["nav.crowdfund"],
    );
    expect(within(tabBar).getByTestId("tab.ranking")).toHaveTextContent(
      translations.zh["nav.ranking"],
    );

    await user.click(screen.getByRole("radio", { name: "切换到English" }));

    await waitFor(() =>
      expect(within(tabBar).getByTestId("tab.arena")).toHaveTextContent(
        translations.en["nav.arena"],
      ),
    );
    expect(within(tabBar).getByTestId("tab.crowdfund")).toHaveTextContent(
      translations.en["nav.crowdfund"],
    );
    expect(within(tabBar).getByTestId("tab.ranking")).toHaveTextContent(
      translations.en["nav.ranking"],
    );
  });

  it("renders the arena at the default route and navigates to crowdfund and ranking", async () => {
    const user = userEvent.setup();
    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();

    await user.click(screen.getByTestId("tab.crowdfund"));
    expect(await screen.findByTestId("crowdfund.page")).toBeInTheDocument();

    await user.click(screen.getByTestId("tab.ranking"));
    expect(await screen.findByTestId("ranking.page")).toBeInTheDocument();

    await user.click(screen.getByTestId("tab.arena"));
    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
  });
});

describe("dictionary parity invariant", () => {
  it("mirrors every zh key in en and vice versa", () => {
    expect(Object.keys(translations.en).sort()).toEqual(
      Object.keys(translations.zh).sort(),
    );
  });

  it("defines every navigation string in both dictionaries", () => {
    const navKeys = Object.keys(translations.zh).filter((key) =>
      key.startsWith("nav."),
    );
    expect(navKeys.length).toBeGreaterThan(0);
    for (const key of navKeys) {
      expect(translations.zh[key as keyof typeof translations.zh]).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
    }
  });
});
