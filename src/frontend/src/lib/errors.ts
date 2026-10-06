import type { GameError } from "@/backend";
import type { Translator } from "@/i18n/translations";
import { formatAmount, formatCooldownSeconds } from "@/lib/format";
import { phaseLabel } from "@/types/game";

/** Turn a backend GameError variant into a localized user-facing message. */
export function gameErrorMessage(t: Translator, error: GameError): string {
  switch (error.__kind__) {
    case "insufficientBalance":
      return t("error.insufficientBalance", {
        required: formatAmount(error.insufficientBalance.required),
        available: formatAmount(error.insufficientBalance.available),
      });
    case "invalidPosition":
      return t("error.invalidPosition");
    case "poolInsufficient":
      return t("error.poolInsufficient", {
        token: error.poolInsufficient.token,
        available: formatAmount(error.poolInsufficient.available),
      });
    case "invalidBetNumber":
      return t("error.invalidBetNumber");
    case "amountTooLarge":
      return t("error.amountTooLarge", {
        max: formatAmount(error.amountTooLarge.max),
      });
    case "amountTooSmall":
      return t("error.amountTooSmall", {
        min: formatAmount(error.amountTooSmall.min),
      });
    case "rateLimited":
      return t("error.rateLimited", {
        seconds: formatCooldownSeconds(Number(error.rateLimited.remainingMs)),
      });
    case "phaseClosed":
      return t("error.phaseClosed", {
        current: phaseLabel(t, error.phaseClosed.current),
        required: phaseLabel(t, error.phaseClosed.required),
      });
    case "invalidAmount":
      return t("error.invalidAmount", {
        step: formatAmount(error.invalidAmount.step),
      });
    case "roundNotFound":
      return t("error.roundNotFound", {
        round: formatAmount(error.roundNotFound.round),
      });
    case "ledgerUnavailable":
      return t("error.ledgerUnavailable");
    case "invalidRecipient":
      return t("error.invalidRecipient");
    case "notRegistered":
      return t("error.notRegistered");
    case "roundStopped":
      return t("error.roundStopped");
    default:
      return t("error.generic");
  }
}

/** Normalize an unknown thrown value into a localized user-facing message. */
export function toErrorMessage(t: Translator, error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return t("error.generic");
}
