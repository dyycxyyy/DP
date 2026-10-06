import { BetForm } from "@/components/BetForm";
import { CrowdfundPanel } from "@/components/CrowdfundPanel";
import { DevControlPanel } from "@/components/DevControlPanel";
import { DrawBasisPanel } from "@/components/DrawBasisPanel";
import { DrawPanel } from "@/components/DrawPanel";
import { TopBetsPanel } from "@/components/TopBetsPanel";
import {
  useActionCooldown,
  useDrawResult,
  useGameState,
  useIsCallerController,
  useMyProfile,
  useRoundHistory,
  useTopBetNumbers,
} from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useEffect } from "react";

/**
 * Home page (route '/'): the core betting surface only.
 *
 * Wallet, token exchange and the personal panel live in the personal center
 * (/account) behind the header auth control, so the arena keeps just the draw,
 * the bet form, the crowdfund panel, the top-bet board and the draw-basis
 * disclosure. The layout is a single centered column on mobile and a
 * two-column split on wide screens, with no empty placeholder columns.
 */
export function ArenaPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useInternetIdentity();
  // `state` and `profile` are polled globally by AppShell; read the shared
  // cache here without mounting a second interval.
  const gameState = useGameState({ poll: false });
  const topBets = useTopBetNumbers();
  const profile = useMyProfile({ poll: false });
  const history = useRoundHistory(1);
  const { isController: isAdmin } = useIsCallerController();

  const state = gameState.data;
  const cooldownRemaining = useActionCooldown(
    profile.data?.lastActionAt,
    profile.data?.actionCooldownMs,
  );
  const canAct = isAuthenticated && cooldownRemaining <= 0;
  // The backend clears `winningNumber` as soon as it opens the next round, so
  // the latest drawn round is read from history instead of live state.
  const latestRound = history.data?.[0] ?? null;
  const drawResult = useDrawResult(latestRound?.round ?? null);

  useEffect(() => {
    document.title = t("app.name");
  }, [t]);

  return (
    <div
      data-ocid="arena.page"
      className="mx-auto w-full max-w-[1600px] overflow-x-hidden"
    >
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 sm:space-y-4 lg:col-span-8">
          <DrawPanel
            state={state}
            isLoading={gameState.isLoading}
            latestWinningNumber={latestRound?.winningNumber ?? null}
            latestRound={latestRound?.round ?? null}
          />
          <BetForm
            canAct={canAct}
            cooldownRemaining={cooldownRemaining}
            luckyBalance={profile.data?.luckyBalance}
            phase={state?.phase ?? "betting"}
            roundStopped={state?.roundStopped ?? false}
          />
          <CrowdfundPanel
            state={state}
            isLoading={gameState.isLoading}
            canAct={canAct}
            cooldownRemaining={cooldownRemaining}
            luckyBalance={profile.data?.luckyBalance}
            isAuthenticated={isAuthenticated}
            roundStopped={state?.roundStopped ?? false}
          />
        </div>

        <div className="min-w-0 space-y-3 sm:space-y-4 lg:col-span-4">
          <TopBetsPanel entries={topBets.data} isLoading={topBets.isLoading} />
          <DrawBasisPanel
            drawResult={drawResult.data}
            isLoading={gameState.isLoading}
            roundEntry={latestRound}
          />
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-3 min-w-0 sm:mt-4">
          <DevControlPanel />
        </div>
      ) : null}
    </div>
  );
}
