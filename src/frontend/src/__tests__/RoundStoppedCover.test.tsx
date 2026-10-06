import { Phase } from "@/backend";
import { BetForm } from "@/components/BetForm";
import { CrowdfundPanel } from "@/components/CrowdfundPanel";
import { screen } from "@testing-library/react";
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
}));

/**
 * Cover for the admin "stop next round" gate.
 *
 * The accepted work makes a stopped round reject betting and crowdfunding: the
 * forms show a stopped notice, disable submission, and never call the write
 * methods. The actor is a local typed mock, so this proves the frontend's
 * contract with the actor, never the real canister.
 */
describe("BetForm with a stopped round", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
    vi.mocked(toast.error).mockClear();
  });

  it("shows the stopped notice and disables submission", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct
        cooldownRemaining={0}
        luckyBalance={10n}
        phase={Phase.betting}
        roundStopped
      />,
    );

    expect(screen.getByTestId("bet.round_stopped")).toBeInTheDocument();

    // Fill a valid single number; the submit button must stay disabled.
    for (let position = 1; position <= 7; position += 1) {
      await user.click(
        screen.getByTestId(`bet.digit.${position}.${position % 10}`),
      );
    }
    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();

    await user.click(screen.getByTestId("bet.submit_button"));
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });
});

describe("CrowdfundPanel with a stopped round", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
    vi.mocked(toast.error).mockClear();
  });

  it("shows the stopped notice and blocks a digit tap", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <CrowdfundPanel
        state={gameState({ phase: Phase.crowdfunding })}
        isLoading={false}
        canAct
        cooldownRemaining={0}
        luckyBalance={1_000_000n}
        isAuthenticated
        roundStopped
      />,
    );

    expect(screen.getByTestId("crowdfund.round_stopped")).toBeInTheDocument();

    // A stopped round makes the digit pad inert: the tap cannot open the amount
    // sheet or reach the write method.
    const digit = screen.getByTestId("crowdfund.digit.1.3");
    expect(digit).toBeDisabled();

    await user.click(digit);

    expect(
      screen.queryByTestId("crowdfund.sheet_amount_input"),
    ).not.toBeInTheDocument();
    expect(actor.contributeCrowdfund).not.toHaveBeenCalled();
  });
});
