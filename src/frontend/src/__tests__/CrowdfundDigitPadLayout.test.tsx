import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Phase } from "@/backend";
import { CrowdfundAmountDialog } from "@/components/CrowdfundAmountDialog";
import { CrowdfundPanel } from "@/components/CrowdfundPanel";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import { createFakeActor, gameState, positionCrowdfund } from "./helpers";
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
 * Accepted layout change: on the crowdfunding page the amount input sits
 * between two digit columns — even digits (0,2,4,6,8) to its left and odd
 * digits (1,3,5,7,9) to its right.
 *
 * jsdom does not compute CSS flex/grid placement, so the observable contract is
 * the DOM order of the three siblings plus the CSS rules that make each rail a
 * vertical column. The amount input must be the middle child, with the even
 * rail before it and the odd rail after it.
 */
// Vitest runs with the frontend package as its working directory, so the
// stylesheet is resolved from there rather than from `import.meta.url`.
const CSS_PATH = resolve(process.cwd(), "src/index.css");

/** The declaration block of a single CSS rule, matched by its selector. */
function cssRuleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`CSS rule not found: ${selector}`);
  return match[1];
}

function renderPanel() {
  return renderWithProviders(
    <CrowdfundPanel
      state={gameState({
        phase: Phase.crowdfunding,
        positions: [
          positionCrowdfund(1),
          positionCrowdfund(2),
          positionCrowdfund(3),
        ],
      })}
      isLoading={false}
      canAct
      roundStopped={false}
      cooldownRemaining={0}
      luckyBalance={1_000_000n}
      isAuthenticated
    />,
  );
}

function renderSheet() {
  return renderWithProviders(
    <CrowdfundAmountDialog
      open
      position={2}
      digit={5}
      luckyBalance={1_000_000n}
      isPending={false}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );
}

/** The digit buttons of the shared panel pad, in DOM order. */
function panelDigitButtonsInDomOrder(): HTMLElement[] {
  const pad = screen.getByTestId("crowdfund.digit_pad");
  return Array.from(pad.querySelectorAll<HTMLElement>("button"));
}

/** The digits rendered inside a dialog rail, in DOM order. */
function railDigits(testId: string): number[] {
  const rail = screen.getByTestId(testId);
  return Array.from(rail.querySelectorAll<HTMLElement>("button")).map(
    (button) => Number(button.getAttribute("data-ocid")?.split(".").pop()),
  );
}

describe("CrowdfundPanel digit pad two-column layout", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("renders the ten panel digit buttons in row-major order 0..9", () => {
    setCoreActor(createFakeActor());
    renderPanel();

    const buttons = panelDigitButtonsInDomOrder();
    expect(buttons).toHaveLength(10);

    // Row-major order is what makes a two-column grid put evens left and odds
    // right: consecutive entries pair into one row as (even, odd).
    const digits = buttons.map((button) =>
      Number(button.getAttribute("data-ocid")?.split(".").pop()),
    );
    expect(digits).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("renders the panel pad as a two-column grid container", () => {
    setCoreActor(createFakeActor());
    renderPanel();

    const pad = screen.getByTestId("crowdfund.digit_pad");
    expect(pad).toHaveClass("digit-pad");

    const body = cssRuleBody(readFileSync(CSS_PATH, "utf8"), ".digit-pad");
    expect(body).toMatch(/display:\s*grid/);
    expect(body).toMatch(/grid-template-columns:\s*repeat\(\s*2\s*,/);
  });

  it("places even digits in the left column and odd digits in the right", () => {
    setCoreActor(createFakeActor());
    renderPanel();

    const buttons = panelDigitButtonsInDomOrder();
    const columns = 2;

    // Derive each button's column from its row-major index and the grid's
    // column count, then assert the even/odd split the requirement states.
    const leftColumn: number[] = [];
    const rightColumn: number[] = [];

    buttons.forEach((button, index) => {
      const digit = Number(button.getAttribute("data-ocid")?.split(".").pop());
      if (index % columns === 0) leftColumn.push(digit);
      else rightColumn.push(digit);
    });

    expect(leftColumn).toEqual([0, 2, 4, 6, 8]);
    expect(rightColumn).toEqual([1, 3, 5, 7, 9]);
  });
});

describe("CrowdfundAmountDialog digit flanking layout", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("places the even-digit rail before the amount input and the odd-digit rail after it", () => {
    renderSheet();

    const evenRail = screen.getByTestId("crowdfund.sheet_digit_pad_left");
    const input = screen.getByTestId("crowdfund.sheet_amount_input");
    const oddRail = screen.getByTestId("crowdfund.sheet_digit_pad_right");

    // The three controls share one flex row; DOM order is the observable
    // contract that puts the input between the two rails.
    const row = evenRail.parentElement;
    expect(row).not.toBeNull();
    expect(oddRail.parentElement).toBe(row);
    expect(input.closest("div")?.parentElement).toBe(row);

    const children = Array.from(row?.children ?? []);
    expect(children.indexOf(evenRail)).toBeLessThan(children.indexOf(oddRail));
    // The input's wrapper sits strictly between the two rails.
    const inputWrapper = input.closest("div");
    expect(inputWrapper).not.toBeNull();
    expect(children.indexOf(inputWrapper as Element)).toBeGreaterThan(
      children.indexOf(evenRail),
    );
    expect(children.indexOf(inputWrapper as Element)).toBeLessThan(
      children.indexOf(oddRail),
    );
  });

  it("renders even digits in the left rail and odd digits in the right rail", () => {
    renderSheet();

    expect(railDigits("crowdfund.sheet_digit_pad_left")).toEqual([
      0, 2, 4, 6, 8,
    ]);
    expect(railDigits("crowdfund.sheet_digit_pad_right")).toEqual([
      1, 3, 5, 7, 9,
    ]);
  });

  it("renders each rail as a vertical column", () => {
    renderSheet();

    const body = cssRuleBody(readFileSync(CSS_PATH, "utf8"), ".digit-column");
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-direction:\s*column/);
  });
});
