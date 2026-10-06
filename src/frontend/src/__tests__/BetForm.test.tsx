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
import {
  createFakeActor,
  insufficientBalance,
  ok,
  phaseClosed,
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
}));

/** Select one digit in each of the 7 positions (single mode). */
async function selectSingleNumber(
  user: ReturnType<typeof userEvent.setup>,
  digits: string,
) {
  for (let position = 1; position <= 7; position += 1) {
    const digit = digits[position - 1];
    await user.click(screen.getByTestId(`bet.digit.${position}.${digit}`));
  }
}

describe("BetForm", () => {
  beforeEach(() => {
    resetCoreMock();
    // These tests exercise the signed-in betting flow; the signed-out prompt is
    // covered separately in AuthDisabledSubmit.test.tsx.
    setAuthenticated(true);
  });

  it("submits a single 7-digit number as one ticket through placeBetSelections", async () => {
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

    await selectSingleNumber(user, "1234567");
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("1");
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent("1 Lucky");

    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    // The per-position selection structure is submitted, not a materialized
    // combination list.
    expect(actor.placeBetSelections).toHaveBeenCalledWith(
      [[1n], [2n], [3n], [4n], [5n], [6n], [7n]],
      [1n, 1n, 1n, 1n, 1n, 1n, 1n],
    );
  });

  it("submits the per-position selection structure for a multi-digit selection", async () => {
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

    // No mode toggle: selecting more than one digit in a position is 复式.
    // Position 1: {1,2}; position 3: {4,5}; the rest single digits.
    await user.click(screen.getByTestId("bet.digit.1.1"));
    await user.click(screen.getByTestId("bet.digit.1.2"));
    await user.click(screen.getByTestId("bet.digit.2.3"));
    await user.click(screen.getByTestId("bet.digit.3.4"));
    await user.click(screen.getByTestId("bet.digit.3.5"));
    await user.click(screen.getByTestId("bet.digit.4.6"));
    await user.click(screen.getByTestId("bet.digit.5.7"));
    await user.click(screen.getByTestId("bet.digit.6.8"));
    await user.click(screen.getByTestId("bet.digit.7.9"));

    // 2 x 1 x 2 x 1 x 1 x 1 x 1 = 4 combinations.
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("4");
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent("4 Lucky");

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
      [3n],
      [4n, 5n],
      [6n],
      [7n],
      [8n],
      [9n],
    ]);
    expect(counts).toEqual([2n, 1n, 2n, 1n, 1n, 1n, 1n]);
  });

  it("blocks submission and shows required vs available when the balance is short", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={0n}
        phase={Phase.betting}
      />,
    );

    await selectSingleNumber(user, "1234567");

    expect(screen.getByTestId("bet.balance_error")).toHaveTextContent(
      "余额不足",
    );
    expect(screen.getByTestId("bet.balance_error")).toHaveTextContent(
      "1 Lucky",
    );
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("surfaces a backend insufficientBalance error without clearing the selection", async () => {
    const actor = createFakeActor({
      placeBetSelections: vi.fn(async () => insufficientBalance(1n, 0n)),
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

    await selectSingleNumber(user, "1234567");
    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    // The selection is preserved so the user can retry after topping up.
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("1");
  });

  it("closes betting outside the betting phase and refuses to submit", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10n}
        phase={Phase.crowdfunding}
      />,
    );

    expect(screen.getByTestId("bet.phase_closed")).toHaveTextContent(
      "当前非投注阶段",
    );
    await selectSingleNumber(user, "1234567");
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("shows the full 10,000,000-note cartesian product with no cap error", async () => {
    // Accepted change: the artificial 5,000-combination cap is removed. The
    // ticket count is the true cartesian product, so selecting all ten digits
    // in all seven positions is 10^7 = 10,000,000 notes and remains submittable.
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10_000_000n}
        phase={Phase.betting}
      />,
    );

    await user.click(screen.getByTestId("bet.fill_button"));

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent(
      "10,000,000",
    );
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent(
      "10,000,000 Lucky",
    );

    // No cap error surface exists, and the submit button is enabled.
    expect(screen.queryByTestId("bet.cap_error")).not.toBeInTheDocument();
    expect(screen.getByTestId("bet.submit_button")).toBeEnabled();
  });

  it("submits a full 10x7 selection as the per-position structure without freezing", async () => {
    // Accepted change: the client no longer materializes the cartesian product,
    // so a full 10,000,000-note selection submits as seven ten-digit arrays in
    // O(1) client memory. The backend expands it.
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
        luckyBalance={10_000_000n}
        phase={Phase.betting}
      />,
    );

    await user.click(screen.getByTestId("bet.fill_button"));
    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    const [selections, counts] = actor.placeBetSelections.mock.calls[0] as [
      bigint[][],
      bigint[],
    ];
    // Seven positions, each with all ten digits selected.
    expect(selections).toHaveLength(7);
    for (const position of selections) {
      expect(position).toEqual([0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]);
    }
    expect(counts).toEqual([10n, 10n, 10n, 10n, 10n, 10n, 10n]);
    // The successful submit resets the selection.
    await waitFor(() =>
      expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("0"),
    );
  });

  it("submits a large ticket count directly with no confirmation dialog", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10_000_000n}
        phase={Phase.betting}
      />,
    );

    // Positions 1-3 select all ten digits, positions 4-7 one each.
    // 10^3 = 1,000 tickets.
    for (let position = 1; position <= 3; position += 1) {
      for (let digit = 0; digit <= 9; digit += 1) {
        await user.click(screen.getByTestId(`bet.digit.${position}.${digit}`));
      }
    }
    await user.click(screen.getByTestId("bet.digit.4.1"));
    await user.click(screen.getByTestId("bet.digit.5.2"));
    await user.click(screen.getByTestId("bet.digit.6.3"));
    await user.click(screen.getByTestId("bet.digit.7.4"));

    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("1,000");
    expect(screen.queryByTestId("bet.cap_error")).not.toBeInTheDocument();

    // A single click submits immediately: no confirmation surface exists.
    expect(screen.queryByTestId("bet.confirm_dialog")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("bet.submit_button"));
    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
  });

  it("renders no single/multi mode toggle", () => {
    setCoreActor(createFakeActor());
    renderWithProviders(
      <BetForm
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10n}
        phase={Phase.betting}
      />,
    );

    expect(screen.queryByTestId("bet.mode.single")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bet.mode.multi")).not.toBeInTheDocument();
  });

  it("shows the remaining cooldown and disables submission while cooling down", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct={false}
        roundStopped={false}
        cooldownRemaining={2500}
        luckyBalance={10n}
        phase={Phase.betting}
      />,
    );

    await selectSingleNumber(user, "1234567");
    expect(screen.getByText(/冷却中/)).toBeInTheDocument();
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("reports a phaseClosed backend error when the phase closes between render and submit", async () => {
    const actor = createFakeActor({
      placeBetSelections: vi.fn(async () =>
        phaseClosed(Phase.crowdfunding, Phase.betting),
      ),
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

    await selectSingleNumber(user, "1234567");
    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    // The form stays usable (selection intact) rather than silently succeeding.
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("1");
  });

  it("accepts a successful ok result and resets the selection", async () => {
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

    await selectSingleNumber(user, "1234567");
    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("0"),
    );
  });
});
