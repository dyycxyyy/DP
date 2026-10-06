import { AccountPage } from "@/pages/AccountPage";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
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

// The personal center renders router `Link`s; stub the router surface to plain
// anchors so the page can be exercised without standing up a router.
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
    select({ location: { pathname: "/account" } }),
}));

/**
 * The interface language contract.
 *
 * Chinese is the default, the 中/EN switch lives in the personal center (not the
 * status strip), and switching updates both the visible copy and the document
 * `lang` attribute. The choice is persisted and survives a remount.
 */
describe("interface language", () => {
  beforeEach(() => {
    resetCoreMock();
    window.localStorage.clear();
    setAuthenticated(true);
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () => gameState({ round: 5n })),
      }),
    );
  });

  // The suite runs in a single jsdom fork, so the persisted language and the
  // document `lang` attribute leak into later files unless reset here.
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  it("defaults to Chinese and exposes the language switch in the personal center", async () => {
    renderWithProviders(<AccountPage />);

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
    expect(screen.getByText("个人中心")).toBeInTheDocument();

    // The 中/EN switch is present in the personal center and Chinese is active.
    expect(screen.getByTestId("lang.toggle")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "切换到中文" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "切换到English" }),
    ).not.toBeChecked();
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("switches to English at runtime and updates the document lang", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountPage />);

    await screen.findByTestId("account.page");
    await user.click(screen.getByRole("radio", { name: "切换到English" }));

    await waitFor(() =>
      expect(screen.getByText("Personal Center")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("radio", { name: "Switch to English" }),
    ).toBeChecked();
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem("arena.language")).toBe("en");
  });

  it("boots in the persisted language on a fresh mount", async () => {
    // A returning visitor's stored choice must win over the Chinese default.
    window.localStorage.setItem("arena.language", "en");

    renderWithProviders(<AccountPage />);

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
    expect(screen.getByText("Personal Center")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Switch to English" }),
    ).toBeChecked();
    expect(document.documentElement.lang).toBe("en");
  });

  it("keeps the chosen language across a remount", async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<AccountPage />);

    await screen.findByTestId("account.page");
    await user.click(screen.getByRole("radio", { name: "切换到English" }));
    await waitFor(() =>
      expect(screen.getByText("Personal Center")).toBeInTheDocument(),
    );

    // Unmount and mount a fresh provider tree, as a reload would.
    first.unmount();
    renderWithProviders(<AccountPage />);

    expect(await screen.findByTestId("account.page")).toBeInTheDocument();
    expect(screen.getByText("Personal Center")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Switch to English" }),
    ).toBeChecked();
    expect(document.documentElement.lang).toBe("en");
  });
});
