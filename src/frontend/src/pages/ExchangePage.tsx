import { ExchangePanel } from "@/components/ExchangePanel";
import { SignInPrompt } from "@/components/SignInPrompt";
import {
  useExchangePool,
  useMyProfile,
  useTreasuryBalance,
} from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Repeat } from "lucide-react";
import { useEffect } from "react";

/**
 * Dedicated token-exchange page (代币兑换).
 *
 * It hosts the existing `ExchangePanel` unchanged — the same ICP→Lucky and
 * Lucky→ICP directions, validation rules and fee preview. Signed-out visitors
 * see the shared sign-in prompt; the panel itself also renders its own inline
 * prompt, matching how the other gated surfaces behave.
 */
export function ExchangePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useInternetIdentity();
  // `profile` is polled globally by AppShell; read the shared cache without
  // mounting a second interval.
  const profile = useMyProfile({ poll: false });
  const exchangePool = useExchangePool();
  const treasury = useTreasuryBalance();

  useEffect(() => {
    document.title = `${t("exchange.title")} · ${t("app.name")}`;
  }, [t]);

  return (
    <div data-ocid="exchange.page" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Repeat className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold tracking-tight">
              {t("exchange.title")}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t("exchange.description")}
            </p>
          </div>
        </div>
        <Link
          to="/"
          data-ocid="exchange.back_link"
          className="tap-target flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-semibold text-muted-foreground transition-smooth hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t("personalCenter.back")}
        </Link>
      </div>

      {!isAuthenticated ? (
        <SignInPrompt message={t("auth.signInToExchange")} />
      ) : null}

      <ExchangePanel
        exchangePool={exchangePool.data}
        treasury={treasury.data}
        luckyBalance={profile.data?.luckyBalance}
      />
    </div>
  );
}
