import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { LogIn, ShieldAlert } from "lucide-react";

interface SignInPromptProps {
  /**
   * `banner` is the full-width inline hint used above a submit surface;
   * `inline` is the compact single-line variant for tight panels.
   */
  variant?: "banner" | "inline";
  /** Optional surface-specific hint, e.g. "Sign in to place a bet". */
  message?: string;
  className?: string;
}

/**
 * Reusable sign-in prompt for any submit surface (bet, crowdfund, exchange,
 * dev controls). It renders nothing once the visitor is authenticated, so a
 * surface can mount it unconditionally and let it decide.
 *
 * The inline sign-in action calls the shared Internet Identity `login()`; the
 * identity provider URL is injected by the deployment environment.
 */
export function SignInPrompt({
  variant = "banner",
  message,
  className,
}: SignInPromptProps) {
  const { isAuthenticated, login, isLoggingIn } = useInternetIdentity();
  const { t } = useTranslation();

  if (isAuthenticated) return null;

  const text = message ?? t("auth.signInToSubmit");

  if (variant === "inline") {
    return (
      <div
        data-ocid="auth.prompt"
        className={cn(
          "prompt-banner flex items-center justify-between gap-2 rounded-md border px-3 py-2",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
          <ShieldAlert
            className="size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="truncate">{text}</span>
        </span>
        <Button
          type="button"
          size="sm"
          data-ocid="auth.prompt_login_button"
          className="h-7 shrink-0 px-2.5 text-xs"
          onClick={() => login()}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? t("auth.loggingIn") : t("auth.signInAction")}
        </Button>
      </div>
    );
  }

  return (
    <output
      data-ocid="auth.prompt"
      className={cn(
        "prompt-banner animate-prompt-in flex items-center justify-between gap-3 rounded-md border px-3 py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <ShieldAlert className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {text}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {t("auth.signInHint")}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        data-ocid="auth.prompt_login_button"
        className="shrink-0"
        onClick={() => login()}
        disabled={isLoggingIn}
      >
        <LogIn className="size-4" aria-hidden="true" />
        {isLoggingIn ? t("auth.loggingIn") : t("auth.signInAction")}
      </Button>
    </output>
  );
}
