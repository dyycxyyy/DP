import { ExchangePanel } from "@/components/ExchangePanel";
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
  exchangePool,
  insufficientBalance,
  ok,
  poolInsufficient,
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
    exchangePool?: ReturnType<typeof exchangePool>;
    luckyBalance?: bigint;
  } = {},
) {
  return renderWithProviders(
    <ExchangePanel
      exchangePool={
        overrides.exchangePool ??
        exchangePool({ luckyBalance: 10_000_000n, icpBalance: 1_000_000_000n })
      }
      luckyBalance={overrides.luckyBalance ?? 10_000_000n}
    />,
  );
}

describe("ExchangePanel", () => {
  beforeEach(() => {
    resetCoreMock();
    // These tests exercise the signed-in exchange flow; the signed-out prompt is
    // covered separately in AuthDisabledSubmit.test.tsx.
    setAuthenticated(true);
  });

  it("previews 1 ICP as 1000 Lucky and submits the e8s amount", async () => {
    const actor = createFakeActor({
      exchangeIcpToLucky: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.type(screen.getByTestId("exchange.icp_input"), "1");
    expect(screen.getByTestId("exchange.icp_output")).toHaveTextContent(
      "1,000 Lucky",
    );

    await user.click(screen.getByTestId("exchange.icp_submit_button"));
    await waitFor(() =>
      expect(actor.exchangeIcpToLucky).toHaveBeenCalledWith(100_000_000n),
    );
  });

  it("rejects an ICP amount below 0.1 or not a multiple of 0.1", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.type(screen.getByTestId("exchange.icp_input"), "0.05");
    expect(screen.getByTestId("exchange.icp_error")).toHaveTextContent(
      "0.1 ~ 10,000",
    );
    expect(screen.getByTestId("exchange.icp_submit_button")).toBeDisabled();
    expect(actor.exchangeIcpToLucky).not.toHaveBeenCalled();
  });

  it("blocks ICP exchange when the pool's ICP is insufficient", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel({
      exchangePool: exchangePool({
        luckyBalance: 10_000_000n,
        icpBalance: 50_000_000n, // 0.5 ICP
      }),
    });

    await user.type(screen.getByTestId("exchange.icp_input"), "1");
    expect(screen.getByTestId("exchange.icp_pool_error")).toHaveTextContent(
      "兑换池 ICP 不足",
    );
    expect(screen.getByTestId("exchange.icp_submit_button")).toBeDisabled();
    expect(actor.exchangeIcpToLucky).not.toHaveBeenCalled();
  });

  it("previews the 3% fee and net output for Lucky -> ICP", async () => {
    const actor = createFakeActor({
      exchangeLuckyToIcp: vi.fn(async () => ok()),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByTestId("exchange.tab.lucky_to_icp"));
    await user.type(screen.getByTestId("exchange.lucky_input"), "1000");

    // 3% of 1000 = 30 Lucky fee; 970 Lucky net -> 0.97 ICP.
    expect(screen.getByTestId("exchange.lucky_output")).toHaveTextContent(
      "0.97 ICP",
    );

    await user.click(screen.getByTestId("exchange.lucky_submit_button"));
    await waitFor(() =>
      expect(actor.exchangeLuckyToIcp).toHaveBeenCalledWith(1000n),
    );
  });

  it("rejects a Lucky amount that is not a multiple of 1000", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByTestId("exchange.tab.lucky_to_icp"));
    await user.type(screen.getByTestId("exchange.lucky_input"), "1500");

    expect(screen.getByTestId("exchange.lucky_error")).toHaveTextContent(
      "1000 的整倍数",
    );
    expect(screen.getByTestId("exchange.lucky_submit_button")).toBeDisabled();
    expect(actor.exchangeLuckyToIcp).not.toHaveBeenCalled();
  });

  it("blocks Lucky -> ICP when the caller's balance is insufficient", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel({ luckyBalance: 500n });

    await user.click(screen.getByTestId("exchange.tab.lucky_to_icp"));
    await user.type(screen.getByTestId("exchange.lucky_input"), "1000");

    expect(
      screen.getByTestId("exchange.lucky_balance_error"),
    ).toHaveTextContent("余额不足");
    expect(screen.getByTestId("exchange.lucky_submit_button")).toBeDisabled();
    expect(actor.exchangeLuckyToIcp).not.toHaveBeenCalled();
  });

  it("blocks Lucky -> ICP when the pool's Lucky is insufficient", async () => {
    const actor = createFakeActor();
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel({
      exchangePool: exchangePool({
        luckyBalance: 100n,
        icpBalance: 1_000_000_000n,
      }),
    });

    await user.click(screen.getByTestId("exchange.tab.lucky_to_icp"));
    await user.type(screen.getByTestId("exchange.lucky_input"), "1000");

    expect(screen.getByTestId("exchange.lucky_pool_error")).toHaveTextContent(
      "兑换池 Lucky 不足",
    );
    expect(screen.getByTestId("exchange.lucky_submit_button")).toBeDisabled();
    expect(actor.exchangeLuckyToIcp).not.toHaveBeenCalled();
  });

  it("surfaces a backend poolInsufficient error", async () => {
    const actor = createFakeActor({
      exchangeIcpToLucky: vi.fn(async () => poolInsufficient("Lucky", 0n)),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.type(screen.getByTestId("exchange.icp_input"), "1");
    await user.click(screen.getByTestId("exchange.icp_submit_button"));

    await waitFor(() =>
      expect(actor.exchangeIcpToLucky).toHaveBeenCalledTimes(1),
    );
  });

  it("surfaces a backend insufficientBalance error on Lucky -> ICP", async () => {
    const actor = createFakeActor({
      exchangeLuckyToIcp: vi.fn(async () => insufficientBalance(1000n, 0n)),
    });
    setCoreActor(actor);
    const user = userEvent.setup();

    renderPanel();

    await user.click(screen.getByTestId("exchange.tab.lucky_to_icp"));
    await user.type(screen.getByTestId("exchange.lucky_input"), "1000");
    await user.click(screen.getByTestId("exchange.lucky_submit_button"));

    await waitFor(() =>
      expect(actor.exchangeLuckyToIcp).toHaveBeenCalledTimes(1),
    );
  });

  it("shows the exchange pool balances", () => {
    setCoreActor(createFakeActor());
    renderPanel({
      exchangePool: exchangePool({
        luckyBalance: 2_000_000n,
        icpBalance: 100_000_000n,
      }),
    });

    expect(screen.getByTestId("exchange.panel")).toHaveTextContent("2,000,000");
    expect(screen.getByTestId("exchange.panel")).toHaveTextContent("1 ICP");
  });
});
