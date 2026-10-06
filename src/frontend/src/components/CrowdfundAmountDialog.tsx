import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n/useTranslation";
import { formatAmount, parseInteger } from "@/lib/format";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/** Per-call crowdfund cap, mirrored from the backend contract. */
const MAX_AMOUNT = 100_000n;
const MIN_AMOUNT = 1n;
const QUICK_AMOUNTS = [100n, 1_000n, 10_000n, 100_000n] as const;

/** Even digits flank the amount input on the left, odd digits on the right. */
const EVEN_DIGITS = [0, 2, 4, 6, 8] as const;
const ODD_DIGITS = [1, 3, 5, 7, 9] as const;

export interface CrowdfundAmountDialogProps {
  /** Whether the sheet is mounted. */
  open: boolean;
  /** 1-based crowdfunding position the contribution targets. */
  position: number;
  /** The digit (0-9) the contribution targets. */
  digit: number;
  /** Caller's available Lucky balance, when known. */
  luckyBalance: bigint | undefined;
  /** True while the contribution mutation is in flight. */
  isPending: boolean;
  /** Close the sheet without submitting. */
  onClose: () => void;
  /** Submit a validated amount for the selected position and digit. */
  onSubmit: (amount: bigint) => void;
  /** Retarget the contribution to another digit without closing the sheet. */
  onDigitChange?: (digit: number) => void;
}

/**
 * Mobile-first bottom sheet for entering a crowdfunding amount.
 *
 * The user taps a digit cell in the crowdfund panel, which opens this sheet
 * pre-scoped to that position and digit. The amount is validated here
 * (1..100,000, integer, within the caller's Lucky balance) before the parent
 * submits it through the existing crowdfund mutation.
 */
export function CrowdfundAmountDialog({
  open,
  position,
  digit,
  luckyBalance,
  isPending,
  onClose,
  onSubmit,
  onDigitChange,
}: CrowdfundAmountDialogProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Reset the draft each time the sheet opens for a new target.
  useEffect(() => {
    if (open) {
      setAmount("");
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Drive the native modal dialog and keep body scroll locked while open.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // jsdom (tests) does not implement showModal; fall back to the `open`
      // attribute so the sheet still renders and is queryable.
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  // Escape dismisses the sheet.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const parsed = parseInteger(amount);
  const amountValid =
    parsed !== null && parsed >= MIN_AMOUNT && parsed <= MAX_AMOUNT;
  const affordable =
    parsed !== null && luckyBalance !== undefined && parsed <= luckyBalance;
  const canSubmit = amountValid && affordable && !isPending;

  const handleSubmit = () => {
    if (!canSubmit || parsed === null) return;
    onSubmit(parsed);
  };

  return (
    <dialog
      ref={dialogRef}
      data-ocid="crowdfund.sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center bg-transparent p-0 backdrop:bg-transparent"
    >
      <button
        type="button"
        aria-label={t("crowdfund.sheetClose")}
        data-ocid="crowdfund.sheet_scrim"
        className="sheet-scrim absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="sheet-panel animate-sheet-up relative w-full max-w-md border-t border-border bg-card px-4 pt-3 shadow-sheet-lift">
        <div
          className="sheet-handle mx-auto mb-3 h-1 w-10 rounded-full"
          aria-hidden="true"
        />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-base font-bold tracking-tight text-foreground"
            >
              {t("crowdfund.sheetTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("crowdfund.sheetTarget", { position, digit })}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            data-ocid="crowdfund.sheet_close_button"
            className="tap-target shrink-0"
            aria-label={t("crowdfund.sheetClose")}
            onClick={onClose}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mb-3 flex items-stretch gap-2">
          <div
            data-ocid="crowdfund.sheet_digit_pad_left"
            className="digit-column"
          >
            {EVEN_DIGITS.map((d) => (
              <button
                key={`sheet-digit-${d}`}
                type="button"
                data-ocid={`crowdfund.sheet_digit.${d}`}
                aria-pressed={d === digit}
                aria-label={t("crowdfund.digitAria", {
                  position,
                  digit: d,
                  amount: formatAmount(0n),
                })}
                onClick={() => onDigitChange?.(d)}
                className={cn(
                  "digit-cell numeric flex items-center justify-center rounded-sm border text-sm font-bold transition-snap",
                  d === digit
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-secondary text-secondary-foreground hover:border-accent/50",
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              ref={inputRef}
              data-ocid="crowdfund.sheet_amount_input"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("crowdfund.amountPlaceholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="numeric h-11 text-base"
            />
            <span className="shrink-0 text-sm text-muted-foreground">
              {t("common.lucky")}
            </span>
          </div>

          <div
            data-ocid="crowdfund.sheet_digit_pad_right"
            className="digit-column"
          >
            {ODD_DIGITS.map((d) => (
              <button
                key={`sheet-digit-${d}`}
                type="button"
                data-ocid={`crowdfund.sheet_digit.${d}`}
                aria-pressed={d === digit}
                aria-label={t("crowdfund.digitAria", {
                  position,
                  digit: d,
                  amount: formatAmount(0n),
                })}
                onClick={() => onDigitChange?.(d)}
                className={cn(
                  "digit-cell numeric flex items-center justify-center rounded-sm border text-sm font-bold transition-snap",
                  d === digit
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-secondary text-secondary-foreground hover:border-accent/50",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              key={quick.toString()}
              type="button"
              data-ocid={`crowdfund.sheet_quick.${quick.toString()}`}
              className={cn(
                "tap-target numeric rounded-full border px-3 text-xs font-semibold transition-snap",
                parsed === quick
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary text-secondary-foreground hover:border-primary/50",
              )}
              onClick={() => setAmount(quick.toString())}
            >
              {formatAmount(quick)}
            </button>
          ))}
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          {t("crowdfund.sheetBalance", {
            available:
              luckyBalance === undefined ? "—" : formatAmount(luckyBalance),
          })}
        </p>

        {amount !== "" && !amountValid ? (
          <p
            data-ocid="crowdfund.sheet_amount_error"
            className="mb-3 text-xs text-destructive"
          >
            {t("crowdfund.amountError")}
          </p>
        ) : null}
        {amountValid && !affordable ? (
          <p
            data-ocid="crowdfund.sheet_balance_error"
            className="mb-3 text-xs text-destructive"
          >
            {t("crowdfund.balanceError", {
              available:
                luckyBalance === undefined ? "—" : formatAmount(luckyBalance),
            })}
          </p>
        ) : null}

        <Button
          type="button"
          data-ocid="crowdfund.sheet_submit_button"
          className="tap-comfortable w-full"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {isPending
            ? t("crowdfund.sheetSubmitting")
            : t("crowdfund.sheetSubmit")}
        </Button>
      </div>
    </dialog>
  );
}
