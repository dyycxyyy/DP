import { Phase } from "@/backend";
import { CrowdfundPanel } from "@/components/CrowdfundPanel";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setCoreActor,
} from "./core-mock";
import { createFakeActor, gameState, ok, positionCrowdfund } from "./helpers";
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
 * Characterization baseline for the crowdfunding panel's behavior that the
 * accepted digit-button layout change must NOT alter.
 *
 * The request intentionally changes the digit pad from a single vertical stack
 * to a two-column arrangement (even digits left, odd digits right). These tests
 * therefore deliberately do NOT assert the current single-column ordering or
 * stacking. They pin the surrounding behavior instead: the shared pad re-homing
 * to the selected position, threshold locking, progress bars, cooldown gating,
 * the per-transaction cap, and the amount dialog journey.
 */
function renderPanel(
  overrides: {
    state?: ReturnType<typeof gameState>;
    cooldownRemaining?: number;
    luckyBalance?: bigint;
    isAuthenticated?: boolean;
  } = {},
) {
  return renderWithProviders(
    <CrowdfundPanel
      state={overrides.state ?? gameState({ phase: Phase.crowdfunding })}
      isLoading={false}
      canAct
      roundStopped={false}
      cooldownRemaining={overrides.cooldownRemaining ?? 0}
      luckyBalance={overrides.luckyBalance ?? 1_000_000n}
      isAuthenticated={overrides.isAuthenticated ?? true}
    />,
  );
}

/** The ten digit buttons of the shared pad, keyed by their digit label. */
function digitButtons(position: number): Map<number, HTMLElement> {
  const pad = screen.getByTestId("crowdfund.digit_pad");
  const map = new Map<number, HTMLElement>();
  for (let digit = 0; digit < 10; digit += 1) {
    map.set(
      digit,
      within(pad).getByTestId(`crowdfund.digit.${position}.${digit}`),
    );
  }
  return map;
}

describe("CrowdfundPanel characterization (layout-independent behavior)", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("renders exactly one shared pad with all ten digit buttons for the active position", () => {
    setCoreActor(createFakeActor());
    renderPanel();

    // The pad is shared: one instance, ten digits, scoped to the active position.
    expect(screen.getAllByTestId("crowdfund.digit_pad")).toHaveLength(1);
    const buttons = digitButtons(1);
    expect(buttons.size).toBe(10);
    for (const [digit, button] of buttons) {
      expect(button).toHaveTextContent(String(digit));
    }
  });

  it("re-homes the shared pad to the selected position and submits that position", async () => {
    const actor = createFakeActor({
      contributeCrowdfund: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    // Position 1 is active initially; position 3's digits are not rendered.
    expect(screen.getByTestId("crowdfund.digit.1.4")).toBeInTheDocument();
    expect(screen.queryByTestId("crowdfund.digit.3.4")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("crowdfund.position.3"));
    expect(screen.getByTestId("crowdfund.digit.3.4")).toBeInTheDocument();
    expect(screen.queryByTestId("crowdfund.digit.1.4")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("crowdfund.digit.3.4"));
    await user.type(screen.getByTestId("crowdfund.sheet_amount_input"), "250");
    await user.click(screen.getByTestId("crowdfund.sheet_submit_button"));

    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenCalledWith(3n, 4n, 250n),
    );
  });

  it("keeps the position selector showing leading and locked badges", () => {
    setCoreActor(createFakeActor());
    renderPanel({
      state: gameState({
        phase: Phase.crowdfunding,
        positions: [
          positionCrowdfund(1, { amounts: { 3: 40_000n }, leadingDigit: 3 }),
          positionCrowdfund(2, {
            amounts: { 7: 100_000n },
            leadingDigit: 7,
            lockedDigit: 7,
          }),
          positionCrowdfund(3),
        ],
      }),
    });

    expect(screen.getByTestId("crowdfund.position.1")).toHaveTextContent(
      "领先 3",
    );
    expect(screen.getByTestId("crowdfund.locked.2")).toHaveTextContent(
      "已锁定 7",
    );
    expect(screen.queryByTestId("crowdfund.locked.1")).not.toBeInTheDocument();
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

    const half = screen
      .getByTestId("crowdfund.digit.1.3")
      .querySelector<HTMLElement>("span[style]");
    expect(half?.style.width).toBe("50%");

    const empty = screen
      .getByTestId("crowdfund.digit.1.0")
      .querySelector<HTMLElement>("span[style]");
    expect(empty?.style.width).toBe("0%");
  });

  it("disables every digit button and shows the cooldown while cooling down", () => {
    setCoreActor(createFakeActor());
    renderPanel({ cooldownRemaining: 2500 });

    expect(screen.getAllByText(/冷却中/).length).toBeGreaterThan(0);
    for (const button of digitButtons(1).values()) {
      expect(button).toBeDisabled();
    }
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

  it("opens the amount dialog on a digit tap and submits the parsed amount", async () => {
    const actor = createFakeActor({
      contributeCrowdfund: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByTestId("crowdfund.digit.1.6"));
    expect(screen.getByTestId("crowdfund.sheet")).toBeInTheDocument();

    await user.type(
      screen.getByTestId("crowdfund.sheet_amount_input"),
      "12345",
    );
    await user.click(screen.getByTestId("crowdfund.sheet_submit_button"));

    await waitFor(() =>
      expect(actor.contributeCrowdfund).toHaveBeenCalledWith(1n, 6n, 12_345n),
    );
  });

  it("rejects an amount above the 100,000 per-transaction cap without a request", async () => {
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

  it("dismisses the amount dialog without submitting", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByTestId("crowdfund.digit.1.8"));
    expect(screen.getByTestId("crowdfund.sheet")).toBeInTheDocument();

    await user.click(screen.getByTestId("crowdfund.sheet_close_button"));
    expect(screen.queryByTestId("crowdfund.sheet")).not.toBeInTheDocument();
    expect(actor.contributeCrowdfund).not.toHaveBeenCalled();
  });

  it("renders the loading skeleton before positions arrive", () => {
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
