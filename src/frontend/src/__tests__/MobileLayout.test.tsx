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
 * Phone-sized layout characterization.
 *
 * jsdom has no layout engine, so it cannot measure real horizontal overflow
 * (`scrollWidth`/`clientWidth` are always 0). These tests instead pin the
 * structural contract that keeps the page usable at 375px: a width-constrained
 * container that clips horizontal overflow, and a mobile-first single-column
 * grid that only expands to multiple columns at the `lg` breakpoint. The
 * horizontal padding lives on the shell wrapper (`AppShell`), not on the page
 * container. A real overflow measurement requires a browser and is out of scope
 * for this suite.
 */
describe("phone-sized layout (375px)", () => {
  beforeEach(() => {
    resetCoreMock();
    setCoreActor(createFakeActor());
  });

  it("reports a 375px viewport as mobile", () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 375,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(true);

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: original,
    });
  });

  it("stacks the arena in a single column inside a width-constrained container", async () => {
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () => gameState({ round: 3n })),
      }),
    );

    renderWithProviders(<ArenaPage />);

    const page = await screen.findByTestId("arena.page");
    // The page container constrains width and clips horizontal overflow so the
    // content cannot run edge-to-edge on a narrow viewport.
    expect(page.className).toContain("max-w-[1600px]");
    expect(page.className).toContain("overflow-x-hidden");

    // The layout grid is single-column by default and only splits at `lg`.
    const grid = page.firstElementChild as HTMLElement;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("lg:grid-cols-12");
    expect(grid.className).not.toContain("grid-cols-12 ");
  });

  it("stacks the history page in a single column inside a width-constrained container", async () => {
    renderWithProviders(<HistoryPage />);

    const page = await screen.findByTestId("history.page");
    expect(page.className).toContain("max-w-[1600px]");
    expect(page.className).toContain("overflow-x-hidden");

    const grid = page.querySelector(".grid") as HTMLElement;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("lg:grid-cols-12");
  });
});
