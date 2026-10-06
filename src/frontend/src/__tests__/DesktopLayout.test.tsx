import { useIsMobile } from "@/hooks/use-mobile";
import { ArenaPage } from "@/pages/ArenaPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { act, renderHook, screen } from "@testing-library/react";
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

/**
 * Desktop-width layout characterization.
 *
 * jsdom has no layout engine, so this pins the structural contract that makes
 * the page a multi-column terminal at desktop widths: the same grid that is
 * single-column on phones expands to 12 columns at the `lg` breakpoint, and the
 * `useIsMobile` hook reports a wide viewport as non-mobile. A real rendered
 * layout requires a browser and is out of scope for this suite.
 */
describe("desktop layout (1280px)", () => {
  beforeEach(() => {
    resetCoreMock();
    setCoreActor(createFakeActor());
  });

  it("reports a 1280px viewport as non-mobile", () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(false);

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: original,
    });
  });

  it("expands the arena into a 12-column grid with two regions at desktop width", async () => {
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () => gameState({ round: 3n })),
      }),
    );

    renderWithProviders(<ArenaPage />);

    const page = await screen.findByTestId("arena.page");
    const grid = page.firstElementChild as HTMLElement;
    // The desktop contract: the grid splits into 12 columns at `lg`, and the
    // two regions claim 8 / 4 columns respectively. The wallet/exchange/profile
    // panels moved to the personal center, so no third column remains.
    expect(grid.className).toContain("lg:grid-cols-12");
    expect(grid.children).toHaveLength(2);
    expect((grid.children[0] as HTMLElement).className).toContain(
      "lg:col-span-8",
    );
    expect((grid.children[1] as HTMLElement).className).toContain(
      "lg:col-span-4",
    );
  });

  it("expands the history page into a 7/5 column split at desktop width", async () => {
    renderWithProviders(<HistoryPage />);

    const page = await screen.findByTestId("history.page");
    const grid = page.querySelector(".grid") as HTMLElement;
    expect(grid.className).toContain("lg:grid-cols-12");
    expect((grid.children[0] as HTMLElement).className).toContain(
      "lg:col-span-7",
    );
    expect((grid.children[1] as HTMLElement).className).toContain(
      "lg:col-span-5",
    );
  });
});
