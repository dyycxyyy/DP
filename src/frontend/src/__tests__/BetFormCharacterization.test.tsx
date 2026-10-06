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
 * Characterization baseline for the betting panel.
 *
 * The accepted redesign removes the single/multi mode toggle and the large-bet
 * confirmation dialog, and makes multi-digit selection the default. These tests
 * deliberately avoid both the toggle and the confirmation dialog so they pin
 * behavior that must survive that change: the cartesian-product ticket math, the
 * clear/fill controls, and the per-position `placeBetSelections(selections,
 * counts)` submission seam.
 */
describe("BetForm characterization (mode-independent invariants)", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
  });

  it("counts one ticket per position when exactly one digit is selected in each", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10n}
        phase={Phase.betting}
      />,
    );

    for (let position = 1; position <= 7; position += 1) {
      await user.click(screen.getByTestId(`bet.digit.${position}.${position}`));
    }

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("1");
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent("1 Lucky");

    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    expect(actor.placeBetSelections).toHaveBeenCalledWith(
      [[1n], [2n], [3n], [4n], [5n], [6n], [7n]],
      [1n, 1n, 1n, 1n, 1n, 1n, 1n],
    );
  });

  it("clears every position back to zero tickets", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10n}
        phase={Phase.betting}
      />,
    );

    for (let position = 1; position <= 7; position += 1) {
      await user.click(screen.getByTestId(`bet.digit.${position}.1`));
    }
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("1");

    await user.click(screen.getByTestId("bet.clear_button"));

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("0");
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("submits one selection entry per position with its per-position count", async () => {
    // The submission seam: the client sends the per-position selection
    // structure and the backend expands the cartesian product itself.
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
        luckyBalance={10n}
        phase={Phase.betting}
      />,
    );

    // A single 7-digit selection is one digit per position, each count 1.
    for (let position = 1; position <= 7; position += 1) {
      await user.click(screen.getByTestId(`bet.digit.${position}.9`));
    }
    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    const [selections, counts] = actor.placeBetSelections.mock.calls[0] as [
      bigint[][],
      bigint[],
    ];
    expect(selections).toEqual([[9n], [9n], [9n], [9n], [9n], [9n], [9n]]);
    expect(counts).toEqual([1n, 1n, 1n, 1n, 1n, 1n, 1n]);
  });
});
