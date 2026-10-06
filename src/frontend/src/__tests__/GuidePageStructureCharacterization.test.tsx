import { LanguageToggle } from "@/components/LanguageToggle";
import { translations } from "@/i18n/translations";
import { GuidePage } from "@/pages/GuidePage";
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
 * Characterization baseline for the guide page's stable contract.
 *
 * The guide copy and its zh/en dictionary values are intentionally being
 * replaced with a new narrative, so this file deliberately does NOT freeze the
 * current wording or the exact set of content sections. It pins only what the
 * accepted work must preserve: the guide navigation entry and route, the
 * `guide.page` root, a dictionary-driven title, the language toggle's effect on
 * the guide page, and zh/en dictionary parity for guide keys.
 *
 * The real router is exercised through `App`, so these are component/integration
 * journeys, not deployed browser E2E. The actor is a local typed mock, so this
 * proves the frontend's contract with the actor, never the real canister.
 */
describe("guide navigation entry and route", () => {
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

  it("keeps the guide tab wired to /guide", async () => {
    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    const tabBar = await screen.findByTestId("shell.tab_bar");
    expect(within(tabBar).getByTestId("tab.guide")).toHaveAttribute(
      "href",
      "/guide",
    );
  });

  it("renders the guide page at /guide and returns to the arena", async () => {
    const user = userEvent.setup();
    const { default: App } = await import("@/App");
    renderWithProviders(<App />);

    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();

    await user.click(screen.getByTestId("tab.guide"));
    expect(await screen.findByTestId("guide.page")).toBeInTheDocument();

    await user.click(screen.getByTestId("tab.arena"));
    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
  });
});

describe("guide page structure", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("renders the guide root with a dictionary-driven title", () => {
    renderWithProviders(<GuidePage />);

    const page = screen.getByTestId("guide.page");
    expect(page).toBeInTheDocument();
    // The title comes from the dictionary, so it survives a copy rewrite.
    expect(page).toHaveTextContent(translations.zh["guide.title"]);
  });

  it("sets the document title from the guide and app dictionary entries", () => {
    renderWithProviders(<GuidePage />);

    expect(document.title).toBe(
      `${translations.zh["nav.guide"]} · ${translations.zh["app.name"]}`,
    );
  });
});

describe("guide page language toggle", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setCoreActor(createFakeActor());
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("switches the guide title from Chinese to English and updates the document lang", async () => {
    const user = userEvent.setup();
    // Render the page next to the header language toggle, mirroring how the
    // guide is reached in the running app without standing up the router.
    renderWithProviders(
      <>
        <LanguageToggle />
        <GuidePage />
      </>,
    );

    expect(screen.getByTestId("guide.page")).toHaveTextContent(
      translations.zh["guide.title"],
    );
    expect(document.documentElement.lang).toBe("zh-CN");

    await user.click(screen.getByRole("radio", { name: "切换到English" }));

    await waitFor(() =>
      expect(screen.getByTestId("guide.page")).toHaveTextContent(
        translations.en["guide.title"],
      ),
    );
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem("arena.language")).toBe("en");
  });

  it("boots the guide page in the persisted language", () => {
    window.localStorage.setItem("arena.language", "en");

    renderWithProviders(<GuidePage />);

    expect(screen.getByTestId("guide.page")).toHaveTextContent(
      translations.en["guide.title"],
    );
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("guide dictionary parity", () => {
  it("defines every guide string in both dictionaries", () => {
    const guideKeys = Object.keys(translations.zh).filter((key) =>
      key.startsWith("guide."),
    );
    expect(guideKeys.length).toBeGreaterThan(0);
    for (const key of guideKeys) {
      expect(translations.zh[key as keyof typeof translations.zh]).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
    }
  });
});
