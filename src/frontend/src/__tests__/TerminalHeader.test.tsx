import { Phase } from "@/backend";
import { TerminalHeader } from "@/components/TerminalHeader";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coreMock,
  internetIdentityContext,
  resetCoreMock,
  setAuthenticated,
} from "./core-mock";
import { gameState } from "./helpers";
import { renderWithProviders } from "./render";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: coreMock.actor, isFetching: coreMock.isFetching }),
  useInternetIdentity: () => internetIdentityContext(),
  InternetIdentityProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// TerminalHeader renders a router `Link`; stub it to a plain anchor so the
// header can be exercised without standing up a router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe("TerminalHeader", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("shows the round number, all four phases and a mm:ss countdown", () => {
    renderWithProviders(
      <TerminalHeader
        state={gameState({
          round: 128n,
          phase: Phase.crowdfunding,
          phaseDeadline: BigInt(Date.now() + 125_000) * 1_000_000n,
        })}
        luckyBalance={undefined}
      />,
    );

    expect(screen.getByTestId("header.round")).toHaveTextContent("128");
    // The phase rail renders the compact short labels.
    expect(screen.getByTestId("header.phase.betting")).toHaveTextContent(
      "投注",
    );
    expect(screen.getByTestId("header.phase.crowdfunding")).toHaveTextContent(
      "众筹",
    );
    expect(screen.getByTestId("header.phase.drawing")).toHaveTextContent(
      "开奖",
    );
    expect(screen.getByTestId("header.phase.payout")).toHaveTextContent("派奖");
    expect(screen.getByTestId("header.countdown")).toHaveTextContent(
      /^\d{2}:\d{2}$/,
    );
  });

  it("renders a placeholder round and countdown before state loads", () => {
    renderWithProviders(
      <TerminalHeader state={undefined} luckyBalance={undefined} />,
    );

    expect(screen.getByTestId("header.round")).toHaveTextContent("—");
    expect(screen.getByTestId("header.countdown")).toHaveTextContent("--:--");
    expect(screen.getByTestId("header.balance")).toHaveTextContent("—");
  });

  it("shows the login button and no balance for an unauthenticated visitor", () => {
    setAuthenticated(false);
    renderWithProviders(
      <TerminalHeader state={gameState()} luckyBalance={undefined} />,
    );

    expect(screen.getByTestId("header.login_button")).toBeInTheDocument();
    expect(
      screen.queryByTestId("header.account_button"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("header.balance")).toHaveTextContent("—");
  });

  it("shows the personal-center entry and the Lucky balance when authenticated", () => {
    setAuthenticated(true);
    renderWithProviders(
      <TerminalHeader state={gameState()} luckyBalance={12_345n} />,
    );

    // The single auth control is the personal-center entry, not a logout button.
    expect(screen.getByTestId("header.account_button")).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByTestId("header.balance")).toHaveTextContent("12,345");
  });
});
