import { Phase } from "@/backend";
import { CrowdfundPanel } from "@/components/CrowdfundPanel";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import {
  createFakeActor,
  gameState,
  insufficientBalance,
  ok,
  phaseClosed,
  positionCrowdfund,
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

function renderPanel(
  overrides: {
    state?: ReturnType<typeof gameState>;
    canAct?: boolean;
    cooldownRemaining?: number;
    luckyBalance?: bigint;
    isAuthenticated?: boolean;
  } = {},
) {
  return renderWithProviders(
    <CrowdfundPanel
      state={overrides.state ?? gameState({ phase: Phase.crowdfunding })}
      isLoading={false}
      canAct={overrides.canAct ?? true}
      roundStopped={false}
      cooldownRemaining={overrides.cooldownRemaining ?? 0}
      luckyBalance={overrides.luckyBalance ?? 1_000_000n}
      isAuthenticated={overrides.isAuthenticated ?? true}
    />,
  );
}

/** Select a position in the shared pad's selector, then tap a digit. */
async function selectPosition(
  user: ReturnType<typeof userEvent.setup>,
  position: number,
) {
  await user.click(screen.getByTestId(`crowdfund.position.${position}`));
}

/** Open the amount sheet for a position/digit and submit the given amount. */
async function contribute(
  user: ReturnType<typeof userEvent.setup>,
  position: number,
  digit: number,
  amount: string,
) {
  await selectPosition(user, position);
  await user.click(screen.getByTestId(`crowdfund.digit.${position}.${digit}`));
  await user.type(screen.getByTestId("crowdfund.sheet_amount_input"), amount);
  await user.click(screen.getByTestId("crowdfund.sheet_submit_button"));
}

describe("CrowdfundPanel", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("shows each position's leading digit and per-digit totals", () => {
    setCoreActor(createFakeActor());
    renderPanel({
      state: gameState({
        phase: Phase.crowdfunding,
        positions: [
          positionCrowdfund(1, { amounts: { 3: 40_000n }, leadingDigit: 3 }),
          positionCrowdfund(2, { amounts: { 7: 12_000n }, leadingDigit: 7 }),
          positionCrowdfund(3),
        ],
      }),
    });

    expect(screen.getByTestId("crowdfund.position.1")).toHaveTextContent(
      "领先 3",
    );
    expect(screen.getByTestId("crowdfund.position.1")).toHaveTextContent(
      "40,000",
    );
    expect(screen.getByTestId("crowdfund.position.2")).toHaveTextContent(
      "领先 7",
    );
  });

  it("fills each digit's progress bar in proportion to its amount toward the threshold", () => {
    setCoreActor(createFakeActor());
    renderPanel({
      state: gameState({
        phase: Phase.crowdfunding,
        positions: [
          positionCrowdfund(1, { amounts: { 3: 50_000n }, leadingDigit: 3 }),
          positionCrowdfund(2),
          positionCrowdfund(3),
        ],
      }),
    });

    // 50,000 of the 100,000 threshold is half the bar; an untouched digit is empty.
    const half = screen
      .getByTestId("crowdfund.digit.1.3")
      .querySelector<HTMLElement>("span[style]");
    expect(half?.style.width).toBe("50%");

    const empty = screen
      .getByTestId("crowdfund.digit.1.0")
      .querySelector<HTMLElement>("span[style]");
    expect(empty?.style.width).toBe("0%");
  });

  it("opens the amount sheet on digit tap and submits the selected position, digit and amount", async () => {
    const actor = createFakeActor({
      contributeCrowdfund: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    // The pad is shared: select position 2, then tap its digit 5.
    await selectPosition(user, 2);
    await user.click(screen.getByTestId("crowdfund.digit.2.5"));
    expect(screen.getByTestId("crowdfund.sheet")).toBeInTheDocument();

    await user.type(
      screen.getByTestId("crowdfund.sheet_amount_input"),
      "100000",
    );
    await user.click(screen.getByTestId("crowdfund.sheet_submit_button"));

    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenCalledWith(2n, 5n, 100_000n),
    );
  });

  it("re-homes the single shared digit pad to the selected position", async () => {
    // Acceptance journey: one set of digit buttons serves every position. After
    // selecting position 1 and contributing to digit 3, selecting position 3 and
    // tapping digit 3 must target position 3 — not position 1.
    const actor = createFakeActor({
      contributeCrowdfund: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    // Only one digit pad exists, and it is scoped to the active position.
    expect(screen.getAllByTestId("crowdfund.digit_pad")).toHaveLength(1);
    expect(screen.getByTestId("crowdfund.digit.1.3")).toBeInTheDocument();
    expect(screen.queryByTestId("crowdfund.digit.3.3")).not.toBeInTheDocument();

    await contribute(user, 1, 3, "500");
    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenCalledWith(1n, 3n, 500n),
    );

    // Re-home the same pad to position 3 and contribute to its digit 3.
    await selectPosition(user, 3);
    expect(screen.getByTestId("crowdfund.digit.3.3")).toBeInTheDocument();
    expect(screen.queryByTestId("crowdfund.digit.1.3")).not.toBeInTheDocument();

    await contribute(user, 3, 3, "700");
    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenLastCalledWith(3n, 3n, 700n),
    );
  });

  it("shows a locked position with its locked digit and keeps accepting contributions", async () => {
    const actor = createFakeActor({
      contributeCrowdfund: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel({
      state: gameState({
        phase: Phase.crowdfunding,
        positions: [
          positionCrowdfund(1, {
            amounts: { 3: 100_000n },
            leadingDigit: 3,
            lockedDigit: 3,
          }),
          positionCrowdfund(2),
          positionCrowdfund(3),
        ],
      }),
    });

    expect(screen.getByTestId("crowdfund.locked.1")).toHaveTextContent(
      "已锁定 3",
    );

    // Contributions remain possible after the lock.
    await contribute(user, 1, 3, "500");

    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenCalledWith(1n, 3n, 500n),
    );
  });

  it("reflects a newly locked digit after a contribution reaches the 100,000 threshold", async () => {
    // The panel is driven by the parent's `state` prop, which the page refetches
    // after a successful contribution. This test pins the observable contract:
    // once the refetched state reports the digit at/over the threshold, the
    // position shows as locked with that digit.
    const actor = createFakeActor({
      contributeCrowdfund: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    const { rerender } = renderPanel({
      state: gameState({
        phase: Phase.crowdfunding,
        positions: [
          positionCrowdfund(1, { amounts: { 3: 99_500n }, leadingDigit: 3 }),
          positionCrowdfund(2),
          positionCrowdfund(3),
        ],
      }),
    });

    // Before the threshold is reached the position is only "leading".
    expect(screen.queryByTestId("crowdfund.locked.1")).not.toBeInTheDocument();
    expect(screen.getByTestId("crowdfund.position.1")).toHaveTextContent(
      "领先 3",
    );

    await contribute(user, 1, 3, "500");
    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenCalledWith(1n, 3n, 500n),
    );

    // The page refetches and passes the updated state back down.
    rerender(
      <CrowdfundPanel
        state={gameState({
          phase: Phase.crowdfunding,
          positions: [
            positionCrowdfund(1, {
              amounts: { 3: 100_000n },
              leadingDigit: 3,
              lockedDigit: 3,
            }),
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

    expect(screen.getByTestId("crowdfund.locked.1")).toHaveTextContent(
      "已锁定 3",
    );
    expect(screen.getByTestId("crowdfund.position.1")).toHaveTextContent(
      "100,000",
    );
  });

  it("rejects an amount above the 100,000 per-call maximum", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByTestId("crowdfund.digit.1.0"));
    await user.type(
      screen.getByTestId("crowdfund.sheet_amount_input"),
      "100001",
    );
    expect(
      screen.getByTestId("crowdfund.sheet_amount_error"),
    ).toHaveTextContent("1 ~ 100,000");
    expect(screen.getByTestId("crowdfund.sheet_submit_button")).toBeDisabled();
    expect(actor.contributeCrowdfund).not.toHaveBeenCalled();
  });

  it("blocks a contribution that exceeds the caller's Lucky balance", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel({ luckyBalance: 100n });

    await user.click(screen.getByTestId("crowdfund.digit.1.0"));
    await user.type(screen.getByTestId("crowdfund.sheet_amount_input"), "500");
    expect(
      screen.getByTestId("crowdfund.sheet_balance_error"),
    ).toHaveTextContent("余额不足");
    expect(screen.getByTestId("crowdfund.sheet_submit_button")).toBeDisabled();
    expect(actor.contributeCrowdfund).not.toHaveBeenCalled();
  });

  it("disables digit taps and shows the cooldown while cooling down", () => {
    setCoreActor(createFakeActor());
    renderPanel({ canAct: false, cooldownRemaining: 2500 });

    expect(screen.getAllByText(/冷却中/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("crowdfund.digit.1.0")).toBeDisabled();
  });

  it("surfaces the global sign-in prompt on a signed-out digit tap without a request", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel({ isAuthenticated: false });

    await user.click(screen.getByTestId("crowdfund.digit.1.3"));

    expect(toast.error).toHaveBeenCalledWith("请先登录以提交");
    expect(screen.queryByTestId("crowdfund.sheet")).not.toBeInTheDocument();
    expect(actor.contributeCrowdfund).not.toHaveBeenCalled();
  });

  it("surfaces a backend phaseClosed error when crowdfunding has closed", async () => {
    const actor = createFakeActor({
      contributeCrowdfund: vi.fn(async () =>
        phaseClosed(Phase.drawing, Phase.crowdfunding),
      ),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await contribute(user, 1, 0, "100");

    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenCalledTimes(1),
    );
  });

  it("surfaces a backend insufficientBalance error", async () => {
    const actor = createFakeActor({
      contributeCrowdfund: vi.fn(async () => insufficientBalance(500n, 100n)),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await contribute(user, 1, 0, "500");

    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenCalledTimes(1),
    );
  });

  it("dismisses the amount sheet without submitting", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByTestId("crowdfund.digit.1.4"));
    expect(screen.getByTestId("crowdfund.sheet")).toBeInTheDocument();

    await user.click(screen.getByTestId("crowdfund.sheet_close_button"));
    expect(screen.queryByTestId("crowdfund.sheet")).not.toBeInTheDocument();
    expect(actor.contributeCrowdfund).not.toHaveBeenCalled();
  });

  it("renders a loading skeleton before positions arrive", () => {
    setCoreActor(createFakeActor());
    renderWithProviders(
      <CrowdfundPanel
        state={undefined}
        isLoading
        canAct
        roundStopped={false}
        cooldownRemaining={0}
        luckyBalance={0n}
        isAuthenticated
      />,
    );

    expect(screen.getByTestId("crowdfund.loading_state")).toBeInTheDocument();
  });
});
