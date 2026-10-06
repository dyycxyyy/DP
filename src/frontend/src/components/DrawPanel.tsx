import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n/useTranslation";
import { formatAmount, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type BetNumber, type GameState, POSITION_COUNT } from "@/types/game";
import { Check, Lock, Sparkles } from "lucide-react";
import { memo, useMemo } from "react";

interface DrawPanelProps {
  state: GameState | undefined;
  isLoading: boolean;
  /** Winning number of the most recently drawn round (backend clears the live one). */
  latestWinningNumber?: BetNumber | null;
  /** Round number the latest winning number belongs to. */
  latestRound?: bigint | null;
}

/**
 * The seven reveal cells. Split out and memoized so a poll tick that leaves the
 * locked digits and winning number unchanged does not rebuild the grid.
 */
const DrawGrid = memo(function DrawGrid({
  lockedByPosition,
  winning,
}: {
  lockedByPosition: Map<number, bigint>;
  winning: BetNumber | undefined;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {Array.from({ length: POSITION_COUNT }, (_, i) => i + 1).map(
        (position) => {
          const lockedDigit = lockedByPosition.get(position);
          const isLocked = lockedDigit !== undefined;
          const revealed = winning?.[position - 1];
          const display =
            revealed !== undefined
              ? revealed.toString()
              : isLocked
                ? lockedDigit.toString()
                : "?";
          return (
            <div
              key={position}
              className="flex min-w-0 flex-col items-center gap-1 sm:gap-1.5"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {position}
              </span>
              <div
                data-ocid={`draw.digit.${position}`}
                className={cn(
                  "flex aspect-[3/4] w-full items-center justify-center rounded-md border-2 bg-background transition-smooth",
                  revealed !== undefined
                    ? "animate-digit-lock border-success bg-success/10"
                    : isLocked
                      ? "border-accent bg-accent/10"
                      : "border-border",
                )}
              >
                <span
                  className={cn(
                    "numeric-display text-lg font-bold sm:text-3xl",
                    revealed !== undefined
                      ? "text-success"
                      : isLocked
                        ? "text-accent"
                        : "text-muted-foreground/40",
                  )}
                >
                  {display}
                </span>
              </div>
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[10px] font-semibold",
                  revealed !== undefined
                    ? "text-success"
                    : isLocked
                      ? "text-accent"
                      : "text-muted-foreground/50",
                )}
              >
                {revealed !== undefined ? (
                  <>
                    <Check className="size-3" aria-hidden="true" />
                    {t("draw.revealed")}
                  </>
                ) : isLocked ? (
                  <>
                    <Lock className="size-3" aria-hidden="true" />
                    {t("draw.locked")}
                  </>
                ) : (
                  t("draw.pending")
                )}
              </span>
            </div>
          );
        },
      )}
    </div>
  );
});

export function DrawPanel({
  state,
  isLoading,
  latestWinningNumber,
  latestRound,
}: DrawPanelProps) {
  const { t } = useTranslation();
  const winning = latestWinningNumber ?? undefined;
  // Rebuild the locked-digit index only when the round state changes, not on
  // every poll tick.
  const lockedByPosition = useMemo(() => {
    const map = new Map<number, bigint>();
    if (state) {
      for (const position of state.positions) {
        if (position.lockedDigit !== undefined) {
          map.set(Number(position.position), position.lockedDigit);
        }
      }
    }
    return map;
  }, [state]);

  return (
    <Card
      data-ocid="draw.panel"
      className="gap-4 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          {t("draw.title")}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {winning ? t("draw.drawn") : t("draw.locking")}
        </span>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        <DrawGrid lockedByPosition={lockedByPosition} winning={winning} />

        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 sm:gap-3">
          <div className="min-w-0 rounded-md border border-primary/30 bg-primary/5 p-2.5 sm:p-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("draw.totalPool")}
            </span>
            <p
              data-ocid="draw.prize_pool"
              className="numeric-display mt-1 truncate text-xl font-bold text-primary sm:text-2xl"
            >
              {isLoading || !state ? "—" : formatAmount(state.totalPrizePool)}
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-accent/30 bg-accent/5 p-2.5 sm:p-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("draw.crowdfundTotal")}
            </span>
            <p
              data-ocid="draw.crowdfund_total"
              className="numeric-display mt-1 truncate text-xl font-bold text-accent sm:text-2xl"
            >
              {isLoading || !state ? "—" : formatAmount(state.crowdfundTotal)}
            </p>
          </div>
        </div>

        {winning ? (
          <div className="rounded-md border border-success/40 bg-success/5 p-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("draw.winningNumber", {
                round:
                  latestRound !== null && latestRound !== undefined
                    ? formatAmount(latestRound)
                    : state
                      ? formatAmount(state.round)
                      : "",
              })}
            </span>
            <p
              data-ocid="draw.winning_number"
              className="numeric-display mt-1 text-3xl font-bold tracking-[0.3em] text-success"
            >
              {formatNumber(winning)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
