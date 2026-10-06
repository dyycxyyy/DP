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
 * Characterization baseline for the 复式 (complex) betting math that the
 * accepted "no artificial note-count cap" change must NOT alter.
 *
 * The request intentionally removes the 5,000-combination cap so that selecting
 * all ten digits in all seven positions (10,000,000 notes) is submittable. These
 * tests therefore deliberately do NOT assert the cap error, the disabled submit
 * at the cap, or the 10,000,000 count itself. They pin the surrounding behavior
 * instead: the cartesian-product count is the product of the per-position
 * selection sizes, each ticket costs 1 Lucky, the per-position selection
 * structure is submitted through the `placeBetSelections(selections, counts)`
 * seam, and the balance / phase / cooldown gates still block submission.
 */
describe("BetForm complex-betting characterization (cap-independent invariants)", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
  });

  it("counts the cartesian product of the per-position selection sizes", async () => {
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

    // Position 1: {1,2}; position 2: {3,4}; position 3: {5,6}; the rest single.
    // 2 x 2 x 2 x 1 x 1 x 1 x 1 = 8 combinations, well under any cap.
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

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("8");
    // One Lucky per ticket.
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent("8 Lucky");
  });

  it("submits the per-position selection structure as one placeBetSelections call", async () => {
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

    // 2 x 2 = 4 combinations, submitted as the selection structure.
    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.1.2"));
    await user.click(screen.getByTestId("bet.digit.2.3"));
    await user.click(screen.getByTestId("bet.digit.2.4"));
    await user.click(screen.getByTestId("bet.digit.3.5"));
    await user.click(screen.getByTestId("bet.digit.4.6"));
    await user.click(screen.getByTestId("bet.digit.5.7"));
    await user.click(screen.getByTestId("bet.digit.6.8"));
    await user.click(screen.getByTestId("bet.digit.7.9"));

    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    const [selections, counts] = actor.placeBetSelections.mock.calls[0] as [
      bigint[][],
      bigint[],
    ];
    // One entry per position, each holding that position's selected digits.
    expect(selections).toEqual([
      [1n, 2n],
      [3n, 4n],
      [5n],
      [6n],
      [7n],
      [8n],
      [9n],
    ]);
    expect(counts).toEqual([2n, 2n, 1n, 1n, 1n, 1n, 1n]);
  });

  it("selects all ten digits in every position from the fill control", async () => {
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

    await user.click(screen.getByTestId("bet.fill_button"));

    // Every digit button in every position reports itself as pressed. This is
    // the selection state the 10,000,000-note requirement builds on; the count
    // and cap behavior around it are intentionally changing and not asserted.
    for (let position = 1; position <= 7; position += 1) {
      for (let digit = 0; digit <= 9; digit += 1) {
        expect(
          screen.getByTestId(`bet.digit.${position}.${digit}`),
        ).toHaveAttribute("aria-pressed", "true");
      }
    }
  });

  it("clears a filled selection back to zero tickets", async () => {
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

    await user.click(screen.getByTestId("bet.fill_button"));
    await user.click(screen.getByTestId("bet.clear_button"));

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("0");
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("still blocks submission when the balance cannot cover the ticket count", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={3n}
        phase={Phase.betting}
      />,
    );

    // 2 x 2 = 4 tickets at 1 Lucky each, but only 3 Lucky available.
    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.1.2"));
    await user.click(screen.getByTestId("bet.digit.2.3"));
    await user.click(screen.getByTestId("bet.digit.2.4"));
    await user.click(screen.getByTestId("bet.digit.3.5"));
    await user.click(screen.getByTestId("bet.digit.4.6"));
    await user.click(screen.getByTestId("bet.digit.5.7"));
    await user.click(screen.getByTestId("bet.digit.6.8"));
    await user.click(screen.getByTestId("bet.digit.7.9"));

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("4");
    expect(screen.getByTestId("bet.balance_error")).toHaveTextContent(
      "余额不足",
    );
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("still blocks submission outside the betting phase", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={1_000_000n}
        phase={Phase.crowdfunding}
      />,
    );

    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.2.2"));
    await user.click(screen.getByTestId("bet.digit.3.3"));
    await user.click(screen.getByTestId("bet.digit.4.4"));
    await user.click(screen.getByTestId("bet.digit.5.5"));
    await user.click(screen.getByTestId("bet.digit.6.6"));
    await user.click(screen.getByTestId("bet.digit.7.7"));

    expect(screen.getByTestId("bet.phase_closed")).toBeInTheDocument();
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("still blocks submission while the action cooldown is active", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct={false}
        roundStopped={false}
        cooldownRemaining={2500}
        luckyBalance={1_000_000n}
        phase={Phase.betting}
      />,
    );

    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.2.2"));
    await user.click(screen.getByTestId("bet.digit.3.3"));
    await user.click(screen.getByTestId("bet.digit.4.4"));
    await user.click(screen.getByTestId("bet.digit.5.5"));
    await user.click(screen.getByTestId("bet.digit.6.6"));
    await user.click(screen.getByTestId("bet.digit.7.7"));

    expect(screen.getByText(/冷却中/)).toBeInTheDocument();
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });
});
