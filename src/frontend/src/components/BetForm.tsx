import { SignInPrompt } from "@/components/SignInPrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlaceBet } from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { isGameError } from "@/lib/api";
import { gameErrorMessage, toErrorMessage } from "@/lib/errors";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DIGIT_COUNT, type Digit, POSITION_COUNT } from "@/types/game";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { AlertTriangle, Dices, Loader2, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface BetFormProps {
  canAct: boolean;
  cooldownRemaining: number;
  luckyBalance: bigint | undefined;
  phase: string;
  /** When true the admin has stopped the round: betting is blocked. */
  roundStopped: boolean;
}

function emptySelections(): Set<number>[] {
  return Array.from({ length: POSITION_COUNT }, () => new Set<number>());
}

/**
 * Cheap combination count: the product of the per-position selection sizes.
 * Computed on every toggle without materializing any combination. There is no
 * artificial cap — the true cartesian product is the ticket count.
 */
function countCombinations(selections: Set<number>[]): number {
  let total = 1;
  for (const set of selections) {
    total *= set.size;
  }
  return total;
}

export function BetForm({
  canAct,
  cooldownRemaining,
  luckyBalance,
  phase,
  roundStopped,
}: BetFormProps) {
  const [selections, setSelections] = useState<Set<number>[]>(emptySelections);
  const placeBet = usePlaceBet();
  const { t } = useTranslation();
  const { isAuthenticated } = useInternetIdentity();

  // Live display uses the cheap product; the full list is only materialized
  // for submission.
  const ticketCount = useMemo(
    () => countCombinations(selections),
    [selections],
  );
  const totalCost = BigInt(ticketCount);
  const allPositionsFilled = selections.every((set) => set.size > 0);
  const affordable = luckyBalance !== undefined && totalCost <= luckyBalance;
  const bettingOpen = phase === "betting";
  const canSubmit =
    isAuthenticated &&
    canAct &&
    bettingOpen &&
    !roundStopped &&
    allPositionsFilled &&
    affordable &&
    ticketCount > 0 &&
    !placeBet.isPending;

  const toggleDigit = (positionIndex: number, digit: number) => {
    setSelections((prev) => {
      const next = prev.map((set) => new Set(set));
      const target = next[positionIndex];
      if (target.has(digit)) {
        target.delete(digit);
      } else {
        target.add(digit);
      }
      return next;
    });
  };

  const reset = () => {
    setSelections(emptySelections());
  };

  const submit = () => {
    if (!canSubmit) return;
    // Submit the per-position selection structure — the backend expands the
    // cartesian product itself, so the client never materializes the
    // combination list (a full 10×7 selection is 10,000,000 tickets).
    const selectionsByPosition: Digit[][] = selections.map((set) =>
      Array.from(set)
        .sort((a, b) => a - b)
        .map((d) => BigInt(d)),
    );
    const counts = selectionsByPosition.map((digits) => BigInt(digits.length));
    const count = BigInt(ticketCount);
    placeBet.mutate(
      { selections: selectionsByPosition, counts },
      {
        onSuccess: (result) => {
          // The backend returns a GameError variant on failure and `undefined`
          // (or the `ok` variant) on success. Route every failure variant —
          // insufficient balance, phase closed, rate limited, invalid input,
          // pool/amount limits — through the shared localizer so the message
          // matches the single/complex bet paths.
          if (isGameError(result) && result.__kind__ !== "ok") {
            toast.error(gameErrorMessage(t, result));
            return;
          }
          toast.success(
            t("bet.success", {
              count: formatAmount(count),
              cost: formatAmount(count),
            }),
          );
          reset();
        },
        onError: (error) => toast.error(toErrorMessage(t, error)),
      },
    );
  };

  return (
    <Card
      data-ocid="bet.panel"
      className="gap-4 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Dices className="size-4 text-primary" aria-hidden="true" />
          {t("bet.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        {!isAuthenticated ? (
          <SignInPrompt
            variant="inline"
            message={t("auth.signInToBet")}
            className="mb-1"
          />
        ) : null}

        {roundStopped ? (
          <div
            data-ocid="bet.round_stopped"
            className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t("bet.roundStopped")}
          </div>
        ) : null}

        {!bettingOpen ? (
          <div
            data-ocid="bet.phase_closed"
            className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t("bet.phaseClosed")}
          </div>
        ) : null}

        <div className="space-y-2">
          {Array.from(
            { length: POSITION_COUNT },
            (_, i) => `position-${i + 1}`,
          ).map((positionId) => {
            const positionIndex =
              Number(positionId.slice("position-".length)) - 1;
            return (
              <div
                key={positionId}
                className="flex items-center gap-1.5 sm:gap-2"
              >
                <span className="w-9 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-12">
                  {t("draw.position", { position: positionIndex + 1 })}
                </span>
                <div className="flex min-w-0 flex-1 gap-0.5 sm:gap-1">
                  {Array.from(
                    { length: DIGIT_COUNT },
                    (_, d) => `digit-${d}`,
                  ).map((digitId) => {
                    const digit = Number(digitId.slice("digit-".length));
                    const selected = selections[positionIndex].has(digit);
                    return (
                      <button
                        key={digitId}
                        type="button"
                        data-ocid={`bet.digit.${positionIndex + 1}.${digit}`}
                        aria-pressed={selected}
                        onClick={() => toggleDigit(positionIndex, digit)}
                        className={cn(
                          "numeric flex h-8 min-w-0 flex-1 items-center justify-center rounded-sm border text-xs font-bold transition-smooth sm:text-sm",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {digit}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 sm:gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t("bet.ticketCount")}
              </span>
              <p
                data-ocid="bet.ticket_count"
                className="numeric truncate text-lg font-bold text-foreground"
              >
                {formatAmount(ticketCount)}
              </p>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t("bet.totalCost")}
              </span>
              <p
                data-ocid="bet.total_cost"
                className="numeric truncate text-lg font-bold text-primary"
              >
                {formatAmount(totalCost)} {t("common.lucky")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-ocid="bet.clear_button"
              aria-label={t("bet.clear")}
              className="size-8"
              onClick={reset}
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-ocid="bet.fill_button"
              aria-label={t("bet.fill")}
              className="size-8"
              onClick={() =>
                setSelections(
                  Array.from(
                    { length: POSITION_COUNT },
                    () =>
                      new Set(Array.from({ length: DIGIT_COUNT }, (_, d) => d)),
                  ),
                )
              }
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {!allPositionsFilled && ticketCount > 0 ? (
          <p
            data-ocid="bet.validation_error"
            className="text-xs text-destructive"
          >
            {t("bet.validation")}
          </p>
        ) : null}
        {allPositionsFilled && !affordable ? (
          <p data-ocid="bet.balance_error" className="text-xs text-destructive">
            {t("bet.balanceError", {
              required: formatAmount(totalCost),
              available:
                luckyBalance === undefined ? "—" : formatAmount(luckyBalance),
            })}
          </p>
        ) : null}
        {!canAct && cooldownRemaining > 0 ? (
          <p className="text-xs text-warning">
            {t("bet.cooldown", {
              seconds: (cooldownRemaining / 1000).toFixed(1),
            })}
          </p>
        ) : null}

        <Button
          type="button"
          data-ocid="bet.submit_button"
          className="w-full"
          disabled={!canSubmit}
          aria-busy={placeBet.isPending}
          onClick={submit}
        >
          {placeBet.isPending ? (
            <span
              data-ocid="bet.submitting_state"
              className="flex items-center gap-2"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("bet.submitting")}
            </span>
          ) : (
            t("bet.submit", { cost: formatAmount(totalCost) })
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
