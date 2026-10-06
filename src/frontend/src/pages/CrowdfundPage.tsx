import { CrowdfundPanel } from "@/components/CrowdfundPanel";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useActionCooldown, useGameState, useMyProfile } from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Coins } from "lucide-react";
import { useEffect } from "react";

/** Crowdfund tab: the crowdfunding surface on its own, mobile-first. */
export function CrowdfundPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useInternetIdentity();
  // Both are polled globally by AppShell; read the shared cache without
  // mounting a second interval.
  const gameState = useGameState({ poll: false });
  const profile = useMyProfile({ poll: false });
  const cooldownRemaining = useActionCooldown(
    profile.data?.lastActionAt,
    profile.data?.actionCooldownMs,
  );
  const canAct = isAuthenticated && cooldownRemaining <= 0;

  useEffect(() => {
    document.title = `${t("nav.crowdfund")} · ${t("app.name")}`;
  }, [t]);

  return (
    <div data-ocid="crowdfund.page" className="space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="size-5 text-accent" aria-hidden="true" />
        <h1 className="font-display text-xl font-bold tracking-tight">
          {t("nav.crowdfund")}
        </h1>
      </div>

      {!isAuthenticated ? <SignInPrompt /> : null}

      <CrowdfundPanel
        state={gameState.data}
        isLoading={gameState.isLoading}
        canAct={canAct}
        cooldownRemaining={cooldownRemaining}
        luckyBalance={profile.data?.luckyBalance}
        isAuthenticated={isAuthenticated}
        roundStopped={gameState.data?.roundStopped ?? false}
      />
    </div>
  );
}
