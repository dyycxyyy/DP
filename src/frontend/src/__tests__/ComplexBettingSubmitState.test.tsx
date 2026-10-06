import { Phase } from "@/backend";
import { BetForm } from "@/components/BetForm";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
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
  rateLimited,
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

/** A promise whose resolution the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * The accepted change: a full 10x7 selection (10,000,000 tickets) submits as
 * one bounded `placeBetSelections` call. These tests pin the user-visible
 * submission contract around it:
 *
 *  - the panel shows an in-progress state while the submission is in flight;
 *  - the submit button is disabled while in flight, so a second click cannot
 *    issue a duplicate submission;
 *  - a successful 10,000,000-ticket submission reports the full count and cost
 *    as one charge;
 *  - a rejected submission surfaces a localized error and no success.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister's behavior.
 */
describe("BetForm large complex-bet submission state", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("shows an in-progress state and disables submit while the submission is in flight", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    const actor = createFakeActor({
      placeBetSelections: vi.fn(() => pending.promise),
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

    // In flight: the button reports the submitting state and is disabled.
    await waitFor(() =>
      expect(screen.getByTestId("bet.submitting_state")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    expect(screen.getByTestId("bet.submit_button")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    // A second click while in flight must not issue a duplicate submission.
    await user.click(screen.getByTestId("bet.submit_button"));
    expect(actor.placeBetSelections).toHaveBeenCalledTimes(1);

    pending.resolve(ok());
    await waitFor(() =>
      expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("0"),
    );
  });

  it("reports the full 10,000,000-ticket count and cost as one charge on success", async () => {
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
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent(
      "10,000,000",
    );
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent(
      "10,000,000 Lucky",
    );

    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "已提交 10,000,000 注，扣除 10,000,000 Lucky",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("surfaces a localized error and no success when the submission is rate limited", async () => {
    const actor = createFakeActor({
      placeBetSelections: vi.fn(async () => rateLimited(2500n)),
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

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    // The selection is preserved so the user can retry after the cooldown.
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent(
      "10,000,000",
    );
  });

  it("surfaces a localized error and no success when the phase closes mid-submission", async () => {
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
        luckyBalance={10_000_000n}
        phase={Phase.betting}
      />,
    );

    await user.click(screen.getByTestId("bet.fill_button"));
    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("surfaces a localized error and no success when the balance is rejected by the backend", async () => {
    const actor = createFakeActor({
      placeBetSelections: vi.fn(async () =>
        insufficientBalance(10_000_000n, 0n),
      ),
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

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    // The selection is preserved so the user can retry after topping up.
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent(
      "10,000,000",
    );
  });
});
