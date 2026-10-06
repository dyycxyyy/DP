import { useCountdown } from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { formatAmount, formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type GameState, PHASE_META, PHASE_ORDER } from "@/types/game";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Link } from "@tanstack/react-router";
import { LogIn, Radio, UserRound } from "lucide-react";

interface TerminalHeaderProps {
  state: GameState | undefined;
  luckyBalance: bigint | undefined;
}

/**
 * Sticky terminal status strip.
 *
 * Mobile-first: a single compact band that keeps the live round, the active
 * phase, the phase countdown and the caller's Lucky balance readable at 375px,
 * with the auth control pinned to the right. On wide screens the phase rail
 * expands into a full four-step progression. The 中/EN language switch lives in
 * the personal center, not here.
 */
export function TerminalHeader({ state, luckyBalance }: TerminalHeaderProps) {
  const { t } = useTranslation();
  const { isAuthenticated, login, isLoggingIn } = useInternetIdentity();
  const remaining = useCountdown(state?.phaseDeadline);
  const activePhase = state?.phase ?? "betting";
  const meta = PHASE_META[activePhase];
  const phaseToken = meta?.token ?? "phase-bet";

  return (
    <header
      data-ocid="shell.status_strip"
      className="statusbar sticky top-0 z-30 border-b border-border bg-card bg-grid"
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
        <Link
          to="/"
          data-ocid="nav.arena_link"
          className="flex min-w-0 shrink items-center gap-2 transition-smooth hover:opacity-80"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground">
            <Radio className="size-4" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-display text-sm font-bold tracking-tight">
              {t("app.name")}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <span
                className="size-1.5 animate-pulse-live rounded-full bg-success"
                aria-hidden="true"
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("app.live")}
              </span>
            </span>
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("header.round")}
            </span>
            <span
              data-ocid="header.round"
              className="numeric-display text-lg font-bold text-primary"
            >
              {state ? formatAmount(state.round) : t("common.placeholder")}
            </span>
          </div>

          <div className="flex flex-col items-end leading-none">
            <span className="max-w-[5.5rem] truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {meta ? t(meta.labelKey) : t("header.phase")}
            </span>
            <span
              data-ocid="header.countdown"
              className="numeric-display animate-countdown-tick text-lg font-bold"
              style={{ color: `oklch(var(--${phaseToken}))` }}
            >
              {state ? formatCountdown(remaining) : "--:--"}
            </span>
          </div>

          <div className="hidden flex-col items-end leading-none sm:flex">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("header.balance")}
            </span>
            <span
              data-ocid="header.balance"
              className="numeric text-lg font-bold text-primary"
            >
              {luckyBalance === undefined
                ? t("common.placeholder")
                : formatAmount(luckyBalance)}
            </span>
          </div>

          {isAuthenticated ? (
            <Link
              to="/account"
              data-ocid="header.account_button"
              aria-label={t("personalCenter.title")}
              className="tap-target flex shrink-0 items-center justify-center rounded-md bg-primary px-2 text-primary-foreground transition-smooth hover:opacity-90"
            >
              <UserRound className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              data-ocid="header.login_button"
              aria-label={t("auth.login")}
              onClick={() => login()}
              disabled={isLoggingIn}
              className="tap-target flex shrink-0 items-center justify-center rounded-md bg-primary px-2 text-primary-foreground transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              <LogIn className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/40">
        <div className="rail-x mx-auto flex max-w-[1600px] items-center gap-1.5 px-3 py-1.5 sm:px-4">
          {PHASE_ORDER.map((phase) => {
            const isActive = phase === activePhase;
            const phaseMeta = PHASE_META[phase];
            return (
              <div
                key={phase}
                data-ocid={`header.phase.${phase}`}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-smooth sm:text-xs",
                  isActive
                    ? "border-transparent text-background"
                    : "border-border bg-background text-muted-foreground",
                )}
                style={
                  isActive
                    ? { backgroundColor: `oklch(var(--${phaseMeta.token}))` }
                    : undefined
                }
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isActive
                      ? "animate-pulse-live bg-background"
                      : "bg-muted-foreground/50",
                  )}
                  aria-hidden="true"
                />
                {t(phaseMeta.shortKey)}
              </div>
            );
          })}
          <span className="ml-auto hidden shrink-0 text-[10px] text-muted-foreground lg:inline">
            {meta ? t(meta.descKey) : null}
          </span>
        </div>
      </div>
    </header>
  );
}
