import { CrowdfundAmountDialog } from "@/components/CrowdfundAmountDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContributeCrowdfund } from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { gameErrorMessage } from "@/lib/errors";
import { formatAmount, thresholdPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CROWDFUND_POSITION_COUNT,
  CROWDFUND_THRESHOLD,
  type GameState,
  type PositionCrowdfund,
} from "@/types/game";
import { AlertTriangle, Check, Coins, Lock, TrendingUp } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

interface CrowdfundPanelProps {
  state: GameState | undefined;
  isLoading: boolean;
  /**
   * Accepted for API compatibility with the pages that render this panel.
   * Digit taps are gated on `cooldownRemaining` alone so a signed-out tap can
   * still surface the global sign-in prompt.
   */
  canAct: boolean;
  cooldownRemaining: number;
  luckyBalance: bigint | undefined;
  /** Whether the visitor is signed in; drives the sign-in prompt on tap. */
  isAuthenticated: boolean;
  /** When true the admin has stopped the round: crowdfunding is blocked. */
  roundStopped: boolean;
}

interface SheetTarget {
  position: number;
  digit: number;
}

/**
 * Row-major render order for the two-column digit pad. The pad is a
 * `grid-cols-2` container, so consecutive entries pair into one row: with the
 * natural 0-9 order each row is (even, odd), which places even digits
 * (0,2,4,6,8) in the left column and odd digits (1,3,5,7,9) in the right.
 */
const DIGIT_PAD_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The largest amount any single digit of a position has accumulated. */
function peakAmount(position: PositionCrowdfund): bigint {
  return position.digits.reduce(
    (max, d) => (d.amount > max ? d.amount : max),
    0n,
  );
}

/**
 * One selectable position in the shared digit pad's selector.
 *
 * Rendered as a radio inside a fieldset so the group is keyboard-navigable and
 * announces which position the shared digit pad currently targets. Each tab
 * keeps the position's original leading/locked badge and peak amount.
 */
const PositionTab = memo(function PositionTab({
  position,
  selected,
  onSelect,
}: {
  position: PositionCrowdfund;
  selected: boolean;
  onSelect: (position: number) => void;
}) {
  const { t } = useTranslation();
  const positionNumber = Number(position.position);
  const isLocked = position.lockedDigit !== undefined;
  const peak = useMemo(() => peakAmount(position), [position]);

  return (
    <label
      data-ocid={`crowdfund.position.${positionNumber}`}
      className={cn(
        "relative flex min-w-0 flex-1 cursor-pointer flex-col gap-1 rounded-md border px-2 py-2 transition-snap focus-within:ring-2 focus-within:ring-accent",
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-background hover:border-accent/50",
      )}
    >
      <input
        type="radio"
        name="crowdfund-position"
        value={positionNumber}
        checked={selected}
        onChange={() => onSelect(positionNumber)}
        className="sr-only"
        aria-label={t("crowdfund.positionTabAria", {
          position: positionNumber,
        })}
      />
      <span className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "font-display text-xs font-bold",
            selected ? "text-accent" : "text-foreground",
          )}
        >
          {t("draw.position", { position: positionNumber })}
        </span>
        {selected ? (
          <Check className="size-3 shrink-0 text-accent" aria-hidden="true" />
        ) : null}
      </span>
      {isLocked ? (
        <span
          data-ocid={`crowdfund.locked.${positionNumber}`}
          className="inline-flex w-fit max-w-full items-center gap-1 truncate rounded-sm border border-success/40 bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success"
        >
          <Lock className="size-3 shrink-0" aria-hidden="true" />
          {t("crowdfund.locked", {
            digit: position.lockedDigit?.toString() ?? "",
          })}
        </span>
      ) : (
        <span className="inline-flex w-fit max-w-full items-center gap-1 truncate rounded-sm border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
          <TrendingUp className="size-3 shrink-0" aria-hidden="true" />
          {t("crowdfund.leading", {
            digit: position.leadingDigit.toString(),
          })}
        </span>
      )}
      <span className="numeric truncate text-[10px] text-muted-foreground">
        {t("crowdfund.peak", { amount: formatAmount(peak) })}
      </span>
    </label>
  );
});

/**
 * The single shared set of ten digit buttons. It always renders the currently
 * selected position's per-digit progress bars, so switching positions re-homes
 * the same pad without duplicating the controls.
 */
const DigitPad = memo(function DigitPad({
  position,
  cooldownActive,
  onSelectDigit,
}: {
  position: PositionCrowdfund;
  cooldownActive: boolean;
  onSelectDigit: (digit: number) => void;
}) {
  const { t } = useTranslation();
  const positionNumber = Number(position.position);
  // Index the position's digits once per position change instead of scanning
  // the array for every one of the ten buttons on every render.
  const amountByDigit = useMemo(() => {
    const map = new Map<number, bigint>();
    for (const entry of position.digits) {
      map.set(Number(entry.digit), entry.amount);
    }
    return map;
  }, [position]);

  return (
    <div data-ocid="crowdfund.digit_pad" className="digit-pad">
      {DIGIT_PAD_ORDER.map((digit) => {
        const digitAmount = amountByDigit.get(digit) ?? 0n;
        const percent = thresholdPercent(digitAmount, CROWDFUND_THRESHOLD);
        const isLeading = Number(position.leadingDigit) === digit;
        const isLockedDigit =
          position.lockedDigit !== undefined &&
          Number(position.lockedDigit) === digit;
        return (
          <button
            key={`digit-${digit}`}
            type="button"
            data-ocid={`crowdfund.digit.${positionNumber}.${digit}`}
            aria-label={t("crowdfund.digitAria", {
              position: positionNumber,
              digit,
              amount: formatAmount(digitAmount),
            })}
            disabled={cooldownActive}
            onClick={() => onSelectDigit(digit)}
            className={cn(
              "digit-cell flex w-full items-center gap-2 rounded-sm px-1 text-left transition-snap",
              cooldownActive
                ? "cursor-not-allowed opacity-60"
                : "hover:bg-secondary/60 active:scale-[0.99]",
            )}
          >
            <span
              className={cn(
                "numeric w-4 shrink-0 text-center text-xs font-bold",
                isLockedDigit
                  ? "text-success"
                  : isLeading
                    ? "text-accent"
                    : "text-muted-foreground",
              )}
            >
              {digit}
            </span>
            <span className="relative h-5 flex-1 overflow-hidden rounded-sm border border-border bg-muted/40">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 transition-smooth",
                  isLockedDigit
                    ? "bg-success/40"
                    : isLeading
                      ? "bg-accent/40"
                      : "bg-primary/20",
                )}
                style={{ width: `${percent}%` }}
              />
              <span className="numeric absolute inset-0 flex items-center justify-end pr-1.5 text-[11px] font-semibold text-foreground">
                {formatAmount(digitAmount)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

export function CrowdfundPanel({
  state,
  isLoading,
  cooldownRemaining,
  luckyBalance,
  isAuthenticated,
  roundStopped,
}: CrowdfundPanelProps) {
  const { t } = useTranslation();
  const contribute = useContributeCrowdfund();
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [selectedPosition, setSelectedPosition] = useState(1);
  const positions = state?.positions ?? [];
  // Sorting and the active-position lookup only depend on the round state, not
  // on the cooldown/balance props that change on every poll tick.
  const sortedPositions = useMemo(
    () => positions.slice().sort((a, b) => Number(a.position - b.position)),
    [positions],
  );
  const activePosition = useMemo(
    () =>
      sortedPositions.find((p) => Number(p.position) === selectedPosition) ??
      sortedPositions[0],
    [sortedPositions, selectedPosition],
  );
  // The digit pad stays tappable while signed out so the tap can surface the
  // global sign-in prompt; an active cooldown or a stopped round makes it inert.
  const cooldownActive = cooldownRemaining > 0;
  const padDisabled = cooldownActive || roundStopped;

  const handleSelectPosition = useCallback((position: number) => {
    setSelectedPosition(position);
  }, []);

  const handleSelectDigit = useCallback(
    (digit: number) => {
      if (roundStopped) {
        toast.error(t("bet.roundStopped"));
        return;
      }
      if (!isAuthenticated) {
        toast.error(t("auth.signInToSubmit"));
        return;
      }
      if (!activePosition) return;
      setTarget({ position: Number(activePosition.position), digit });
    },
    [roundStopped, isAuthenticated, t, activePosition],
  );

  const handleDigitChange = useCallback((digit: number) => {
    setTarget((current) => (current ? { ...current, digit } : current));
  }, []);

  const handleSubmit = (amount: bigint) => {
    if (!target) return;
    const { position, digit } = target;
    contribute.mutate(
      { position: BigInt(position), digit: BigInt(digit), amount },
      {
        onSuccess: (result) => {
          if (result && result.__kind__ !== "ok") {
            toast.error(gameErrorMessage(t, result));
            return;
          }
          toast.success(
            t("crowdfund.success", {
              position,
              digit,
              amount: formatAmount(amount),
            }),
          );
          setTarget(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      <Card
        data-ocid="crowdfund.panel"
        className="gap-4 rounded-lg border-border py-4 shadow-none"
      >
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Coins className="size-4 text-accent" aria-hidden="true" />
            {t("crowdfund.title")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("crowdfund.description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {roundStopped ? (
            <div
              data-ocid="crowdfund.round_stopped"
              className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {t("bet.roundStopped")}
            </div>
          ) : null}

          {isLoading || sortedPositions.length === 0 ? (
            <div data-ocid="crowdfund.loading_state" className="space-y-3">
              {Array.from(
                { length: CROWDFUND_POSITION_COUNT },
                (_, i) => `crowdfund-skeleton-${i}`,
              ).map((id) => (
                <div
                  key={id}
                  className="h-40 animate-pulse rounded-md bg-muted/40"
                />
              ))}
            </div>
          ) : (
            <>
              <fieldset className="flex gap-2">
                <legend className="sr-only">
                  {t("crowdfund.selectPosition")}
                </legend>
                {sortedPositions.map((position) => (
                  <PositionTab
                    key={position.position.toString()}
                    position={position}
                    selected={
                      Number(position.position) ===
                      Number(activePosition?.position)
                    }
                    onSelect={handleSelectPosition}
                  />
                ))}
              </fieldset>

              {activePosition ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t("crowdfund.digitPadHint", {
                      position: Number(activePosition.position),
                    })}
                  </p>
                  <DigitPad
                    position={activePosition}
                    cooldownActive={padDisabled}
                    onSelectDigit={handleSelectDigit}
                  />
                </>
              ) : null}

              {cooldownActive ? (
                <p className="text-xs text-warning">
                  {t("bet.cooldown", {
                    seconds: (cooldownRemaining / 1000).toFixed(1),
                  })}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <CrowdfundAmountDialog
        open={target !== null}
        position={target?.position ?? 1}
        digit={target?.digit ?? 0}
        luckyBalance={luckyBalance}
        isPending={contribute.isPending}
        onClose={() => setTarget(null)}
        onSubmit={handleSubmit}
        onDigitChange={handleDigitChange}
      />
    </>
  );
}
