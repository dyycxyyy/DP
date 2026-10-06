import { CrowdfundAmountDialog } from "@/components/CrowdfundAmountDialog";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./render";

/**
 * Characterization baseline for the crowdfunding amount sheet.
 *
 * The accepted redesign replaces the per-position digit grids with one shared
 * set of digit buttons, but the amount sheet itself keeps its contract: a
 * 1..100,000 integer within the caller's Lucky balance, quick-amount shortcuts,
 * and a submit that reports the parsed amount to the parent. These tests render
 * the sheet directly so they are independent of the panel's digit-button layout.
 */
function renderSheet(
  overrides: {
    open?: boolean;
    position?: number;
    digit?: number;
    luckyBalance?: bigint;
    isPending?: boolean;
    onClose?: () => void;
    onSubmit?: (amount: bigint) => void;
  } = {},
) {
  const onClose = overrides.onClose ?? vi.fn();
  const onSubmit = overrides.onSubmit ?? vi.fn();
  const view = renderWithProviders(
    <CrowdfundAmountDialog
      open={overrides.open ?? true}
      position={overrides.position ?? 2}
      digit={overrides.digit ?? 5}
      luckyBalance={overrides.luckyBalance ?? 1_000_000n}
      isPending={overrides.isPending ?? false}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { ...view, onClose, onSubmit };
}

describe("CrowdfundAmountDialog characterization", () => {
  it("renders nothing while closed", () => {
    renderSheet({ open: false });
    expect(screen.queryByTestId("crowdfund.sheet")).not.toBeInTheDocument();
  });

  it("names the target position and digit in the sheet header", () => {
    renderSheet({ position: 3, digit: 7 });
    expect(screen.getByTestId("crowdfund.sheet")).toHaveTextContent(
      "第 3 位 · 数字 7",
    );
  });

  it("submits the parsed integer amount for the scoped target", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet({ position: 1, digit: 3 });

    await user.type(
      screen.getByTestId("crowdfund.sheet_amount_input"),
      "12345",
    );
    await user.click(screen.getByTestId("crowdfund.sheet_submit_button"));

    expect(onSubmit).toHaveBeenCalledWith(12_345n);
  });

  it("rejects an amount above the 100,000 per-call maximum", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();

    await user.type(
      screen.getByTestId("crowdfund.sheet_amount_input"),
      "100001",
    );

    expect(
      screen.getByTestId("crowdfund.sheet_amount_error"),
    ).toHaveTextContent("1 ~ 100,000");
    expect(screen.getByTestId("crowdfund.sheet_submit_button")).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a zero amount", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();

    await user.type(screen.getByTestId("crowdfund.sheet_amount_input"), "0");

    expect(
      screen.getByTestId("crowdfund.sheet_amount_error"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("crowdfund.sheet_submit_button")).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks an amount that exceeds the caller's Lucky balance", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet({ luckyBalance: 100n });

    await user.type(screen.getByTestId("crowdfund.sheet_amount_input"), "500");

    expect(
      screen.getByTestId("crowdfund.sheet_balance_error"),
    ).toHaveTextContent("余额不足");
    expect(screen.getByTestId("crowdfund.sheet_submit_button")).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("fills the amount from a quick-amount shortcut", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();

    await user.click(screen.getByTestId("crowdfund.sheet_quick.10000"));
    expect(screen.getByTestId("crowdfund.sheet_amount_input")).toHaveValue(
      "10000",
    );

    await user.click(screen.getByTestId("crowdfund.sheet_submit_button"));
    expect(onSubmit).toHaveBeenCalledWith(10_000n);
  });

  it("keeps the amount input as the entry point and strips non-digit characters", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();

    // The amount input remains the single amount entry point regardless of how
    // the surrounding digit controls are laid out.
    const input = screen.getByTestId("crowdfund.sheet_amount_input");
    await user.type(input, "1a2b3");
    expect(input).toHaveValue("123");

    await user.click(screen.getByTestId("crowdfund.sheet_submit_button"));
    expect(onSubmit).toHaveBeenCalledWith(123n);
  });

  it("closes without submitting when the close control is used", async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderSheet();

    await user.click(screen.getByTestId("crowdfund.sheet_close_button"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables submission while a contribution is pending", () => {
    renderSheet({ isPending: true });
    expect(screen.getByTestId("crowdfund.sheet_submit_button")).toBeDisabled();
  });
});
