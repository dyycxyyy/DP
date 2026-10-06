import { Phase } from "@/backend";
import { BetForm } from "@/components/BetForm";
import { CrowdfundPanel } from "@/components/CrowdfundPanel";
import { ExchangePanel } from "@/components/ExchangePanel";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import { createFakeActor, exchangePool, gameState } from "./helpers";
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
 * Signed-out submit behavior.
 *
 * The accepted contract: a visitor who is not signed in sees a sign-in prompt
 * on every submit surface, the submit control is inert, and no backend call is
 * made. `resetCoreMock()` leaves `isAuthenticated` false, so these tests pin the
 * signed-out branch. The signed-in flows are covered in the per-component
 * suites.
 */
describe("signed-out submit behavior", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("shows the sign-in prompt on the bet surface and makes no backend call", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct={false}
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10n}
        phase={Phase.betting}
      />,
    );

    // The prompt names the surface and offers a sign-in action.
    expect(screen.getByTestId("auth.prompt")).toHaveTextContent(
      "请先登录以投注",
    );
    expect(screen.getByTestId("auth.prompt_login_button")).toBeInTheDocument();

    for (let position = 1; position <= 7; position += 1) {
      await user.click(screen.getByTestId(`bet.digit.${position}.1`));
    }

    expect(screen.getByTestId("bet.submit_button")).toBeDisabled();
    await user.click(screen.getByTestId("bet.submit_button"));
    expect(actor.placeBetSelections).not.toHaveBeenCalled();
  });

  it("shows the sign-in prompt on the exchange surface and makes no backend call", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <ExchangePanel
        exchangePool={exchangePool({
          luckyBalance: 10_000_000n,
          icpBalance: 1_000_000_000n,
        })}
        luckyBalance={10_000_000n}
      />,
    );

    expect(screen.getByTestId("auth.prompt")).toHaveTextContent(
      "请先登录以兑换",
    );

    await user.type(screen.getByTestId("exchange.icp_input"), "1");
    expect(screen.getByTestId("exchange.icp_submit_button")).toBeDisabled();
    await user.click(screen.getByTestId("exchange.icp_submit_button"));
    expect(actor.exchangeIcpToLucky).not.toHaveBeenCalled();
  });

  it("shows the sign-in prompt on the crowdfund surface and makes no backend call", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderWithProviders(
      <CrowdfundPanel
        state={gameState({ phase: Phase.crowdfunding })}
        isLoading={false}
        canAct={false}
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={1_000_000n}
        isAuthenticated={false}
      />,
    );

    // The digit pad stays tappable while signed out so the tap can surface the
    // global sign-in prompt; it must not open the amount sheet or call the actor.
    const button = screen.getByTestId("crowdfund.digit.1.3");
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(screen.queryByTestId("crowdfund.sheet")).not.toBeInTheDocument();
    expect(actor.contributeCrowdfund).not.toHaveBeenCalled();
  });

  it("invokes the shared login action from the prompt", async () => {
    setCoreActor(createFakeActor());
    const user = userEvent.setup();

    renderWithProviders(
      <BetForm
        canAct={false}
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={10n}
        phase={Phase.betting}
      />,
    );

    await user.click(screen.getByTestId("auth.prompt_login_button"));
    await waitFor(() => expect(coreMock.login).toHaveBeenCalledTimes(1));
  });
});
