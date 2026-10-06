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
 * Characterization baseline for the user-visible aggregate contract of a large
 * complex (复式) submission, which the accepted "submit a full 10x7 selection
 * without IC0522" change must NOT alter.
 *
 * The request intentionally changes how a large complex bet is submitted (the
 * backend records a bounded aggregate instead of expanding note-by-note, and
 * the frontend submit path may become multi-message). These tests therefore do
 * NOT pin the single-message submit shape or the per-note expansion. They pin
 * what the user observes: the ticket count and total cost are the cartesian
 * product at 1 Lucky per ticket, and a successful submission reports the full
 * count and cost as one charge.
 */
describe("BetForm large complex-bet aggregate characterization", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("reports the full ticket count and cost as one charge on a large submission", async () => {
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

    // Positions 1-3: all ten digits; positions 4-7: one digit each.
    // 10 x 10 x 10 x 1 x 1 x 1 x 1 = 1,000 tickets at 1 Lucky each.
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
    expect(screen.getByTestId("bet.total_cost")).toHaveTextContent(
      "1,000 Lucky",
    );

    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() =>
      expect(actor.placeBetSelections).toHaveBeenCalledTimes(1),
    );
    // One charge of the full product, reported to the user as such.
    expect(toast.success).toHaveBeenCalledWith(
      "已提交 1,000 注，扣除 1,000 Lucky",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the selection and reports the error when the backend rejects a large submission", async () => {
    const actor = createFakeActor({
      placeBetSelections: vi.fn(async () => ({
        __kind__: "rateLimited" as const,
        rateLimited: { remainingMs: 2500n },
      })),
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

    for (let position = 1; position <= 3; position += 1) {
      for (let digit = 0; digit <= 9; digit += 1) {
        await user.click(screen.getByTestId(`bet.digit.${position}.${digit}`));
      }
    }
    await user.click(screen.getByTestId("bet.digit.4.1"));
    await user.click(screen.getByTestId("bet.digit.5.2"));
    await user.click(screen.getByTestId("bet.digit.6.3"));
    await user.click(screen.getByTestId("bet.digit.7.4"));

    await user.click(screen.getByTestId("bet.submit_button"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // The selection is preserved so the user can retry after the cooldown.
    expect(screen.getByTestId("bet.ticket_count")).toHaveTextContent("1,000");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
