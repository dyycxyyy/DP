import { Phase } from "@/backend";
import { BetForm } from "@/components/BetForm";
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
import { createFakeActor, ok } from "./helpers";
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
 * Characterization baseline for the 复式 (complex) betting behavior adjacent to
 * the accepted "no artificial note-count cap" change.
 *
 * The request intentionally removes the 5,000-combination cap so that selecting
 * all ten digits in all seven positions (10,000,000 notes) is submittable. These
 * tests deliberately do NOT assert the cap error, the disabled submit at the
 * cap, or the 10,000,000 count itself. They pin the surrounding product math and
 * submission contract that must survive the cap removal:
 *
 *  - the cartesian-product count is recomputed on deselection, not only on
 *    selection (the product must shrink when a digit is toggled off);
 *  - a partially filled selection still shows the "pick a digit for every
 *    position" validation error and keeps submit disabled;
 *  - the submit button label reports the total cost;
 *  - a multi-position selection submits the per-position selection structure
 *    through the `placeBetSelections(selections, counts)` seam.
 */
describe("BetForm cap-adjacent characterization (product math and submit contract)", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
  });

  it("recomputes the cartesian product when a digit is deselected", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={1_000_000n}
        phase={Phase.betting}
      />,
    );

    // Position 1: {1,2,3}; position 2: {4,5}; the rest single.
    // 3 x 2 = 6 combinations.
    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.1.2"));
    await user.click(screen.getByTestId("bet.digit.1.3"));
    await user.click(screen.getByTestId("bet.digit.2.4"));
    await user.click(screen.getByTestId("bet.digit.2.5"));
    await user.click(screen.getByTestId("bet.digit.3.6"));
    await user.click(screen.getByTestId("bet.digit.4.7"));
    await user.click(screen.getByTestId("bet.digit.5.8"));
    await user.click(screen.getByTestId("bet.digit.6.9"));
    await user.click(screen.getByTestId("bet.digit.7.0"));

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("6");
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent("6 Lucky");

    // Deselect one digit from position 1: 2 x 2 = 4 combinations.
    await user.click(screen.getByTestId("bet.digit.1.3"));

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("4");
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent("4 Lucky");
    expect(screen.getByTestId("bet.digit.1.3")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps submit disabled and sends no request for a partial selection", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={1_000_000n}
        phase={Phase.betting}
      />,
    );

    // Only positions 1 and 2 are filled; positions 3-7 are empty. The product
    // count is zero, so the panel reports zero tickets and refuses to submit.
    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.2.2"));

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("0");
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();

    await user.click(screen.getByTestId("bet.submit_button"));
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("reports the total cost on the submit button label", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={1_000_000n}
        phase={Phase.betting}
      />,
    );

    // 2 x 2 = 4 tickets at 1 Lucky each.
    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.1.2"));
    await user.click(screen.getByTestId("bet.digit.2.3"));
    await user.click(screen.getByTestId("bet.digit.2.4"));
    await user.click(screen.getByTestId("bet.digit.3.5"));
    await user.click(screen.getByTestId("bet.digit.4.6"));
    await user.click(screen.getByTestId("bet.digit.5.7"));
    await user.click(screen.getByTestId("bet.digit.6.8"));
    await user.click(screen.getByTestId("bet.digit.7.9"));

    expect(screen.getByTestId("bet.submit_button")).toHaveTextContent(
      "提交投注 · 4 Lucky",
    );
  });

  it("submits the per-position selection structure for a multi-position selection", async () => {
    const actor = createFakeActor({
      placeBetSelections: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={1_000_000n}
        phase={Phase.betting}
      />,
    );

    // Position 1: {1,2}; position 2: {3,4}; position 3: {5,6}; the rest single.
    // 2 x 2 x 2 = 8 combinations, submitted as the selection structure.
    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.1.2"));
    await user.click(screen.getByTestId("bet.digit.2.3"));
    await user.click(screen.getByTestId("bet.digit.2.4"));
    await user.click(screen.getByTestId("bet.digit.3.5"));
    await user.click(screen.getByTestId("bet.digit.3.6"));
    await user.click(screen.getByTestId("bet.digit.4.7"));
    await user.click(screen.getByTestId("bet.digit.5.8"));
    await user.click(screen.getByTestId("bet.digit.6.9"));
    await user.click(screen.getByTestId("bet.digit.7.0"));

    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    const [selections, counts] = actor.placeBetSelections.mock.calls[0] as [
      bigint[][],
      bigint[],
    ];
    expect(selections).toEqual([
      [1n, 2n],
      [3n, 4n],
      [5n, 6n],
      [7n],
      [8n],
      [9n],
      [0n],
    ]);
    expect(counts).toEqual([2n, 2n, 2n, 1n, 1n, 1n, 1n]);
  });
});
