import { Phase } from "@/backend";
import { TerminalHeader } from "@/components/TerminalHeader";
import { ArenaPage } from "@/pages/ArenaPage";
import { screen } from "@testing-library/react";
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
  gameState,
  playerProfile,
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
  Toaster: () => null,
}));

// The header renders router `Link`s. Stub the router surface to plain anchors
// so the header can be exercised without standing up a router.
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
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/" } }),
}));

/**
 * Characterization baseline for the home page's core content and the header's
 * non-auth status strip.
 *
 * The accepted work removes the wallet, exchange and personal panels from the
 * home page and consolidates them into the personal center, and turns the
 * header auth control into a single control. These tests deliberately do NOT
 * assert the panel presence/absence or the shape of the auth control — those
 * are the behaviors intentionally changing. They pin the surrounding behavior
 * that must survive the change:
 *
 *  - the home page still renders its core betting content (draw panel, bet
 *    form, crowdfund panel, top-bets panel, draw-basis panel) without a blank
 *    screen;
 *  - the header still shows the live round, the four phases, the countdown and
 *    the Lucky balance regardless of which auth control is rendered.
 *
 * The actor is a local typed mock, so this proves the frontend's contract with
 * the actor, never the real canister's behavior.
 */
describe("home page core content", () => {
  beforeEach(() => {
    resetCoreMock();
    setAuthenticated(true);
    setCoreActor(
      createFakeActor({
        getGameState: vi.fn(async () =>
          gameState({ round: 42n, phase: Phase.betting }),
        ),
        getMyProfile: vi.fn(async () =>
          playerProfile({ luckyBalance: 12_345n }),
        ),
        getExchangePoolState: vi.fn(async () =>
          exchangePool({ luckyBalance: 2_000_000n, icpBalance: 100_000_000n }),
        ),
        getTreasuryBalance: vi.fn(async () => 500n),
      }),
    );
  });

  it("renders the core betting content without a blank screen", async () => {
    renderWithProviders(<ArenaPage />);

    expect(await screen.findByTestId("arena.page")).toBeInTheDocument();
    expect(screen.getByTestId("draw.panel")).toBeInTheDocument();
    expect(screen.getByTestId("bet.panel")).toBeInTheDocument();
    expect(screen.getByTestId("crowdfund.panel")).toBeInTheDocument();
    expect(screen.getByTestId("topbets.panel")).toBeInTheDocument();
    expect(screen.getByTestId("basis.panel")).toBeInTheDocument();
  });
});

describe("header status strip", () => {
  beforeEach(() => {
    resetCoreMock();
  });

  it("shows the live round, phases, countdown and balance when signed in", () => {
    setAuthenticated(true);
    renderWithProviders(
      <TerminalHeader
        state={gameState({
          round: 128n,
          phase: Phase.crowdfunding,
          phaseDeadline: BigInt(Date.now() + 125_000) * 1_000_000n,
        })}
        luckyBalance={12_345n}
      />,
    );

    expect(screen.getByTestId("header.round")).toHaveTextContent("128");
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
    expect(screen.getByTestId("header.balance")).toHaveTextContent("12,345");
  });

  it("keeps the status strip and a placeholder balance when signed out", () => {
    setAuthenticated(false);
    renderWithProviders(
      <TerminalHeader
        state={gameState({ round: 7n })}
        luckyBalance={undefined}
      />,
    );

    expect(screen.getByTestId("header.round")).toHaveTextContent("7");
    expect(screen.getByTestId("header.countdown")).toHaveTextContent(
      /^\d{2}:\d{2}$/,
    );
    expect(screen.getByTestId("header.balance")).toHaveTextContent("—");
  });
});
