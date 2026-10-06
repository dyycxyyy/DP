import { LanguageToggle } from "@/components/LanguageToggle";
import { ProfilePanel } from "@/components/ProfilePanel";
import { SignInPrompt } from "@/components/SignInPrompt";
import { WalletPanel } from "@/components/WalletPanel";
import { Button } from "@/components/ui/button";
import { useMyProfile } from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Languages, LogOut, UserRound } from "lucide-react";
import { useEffect } from "react";

/**
 * Personal center (个人中心): the single destination behind the header auth
 * control. It consolidates the wallet summary, the personal bet/win panel and
 * the interface-language switch, and offers sign-out.
 *
 * Token exchange now lives on its own `/exchange` page, so it is deliberately
 * absent here. Signed-out visitors still reach this page (the header login
 * button signs them in first), so the page renders the shared sign-in prompt
 * and the panels degrade to their own inline prompts.
 */
export function AccountPage() {
  const { t } = useTranslation();
  const { isAuthenticated, clear } = useInternetIdentity();
  // `profile` is polled globally by AppShell; read the shared cache without
  // mounting a second interval.
  const profile = useMyProfile({ poll: false });

  useEffect(() => {
    document.title = `${t("personalCenter.title")} · ${t("app.name")}`;
  }, [t]);

  return (
    <div data-ocid="account.page" className="space-y-4">
      <section
        data-ocid="account.language_section"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Languages
            className="size-4 shrink-0 text-accent"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t("personalCenter.language")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t("personalCenter.languageHint")}
            </p>
          </div>
        </div>
        <LanguageToggle className="shrink-0 self-start sm:self-auto" />
      </section>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound
            className="size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold tracking-tight">
              {t("personalCenter.title")}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t("personalCenter.subtitle")}
            </p>
          </div>
        </div>
        <Link
          to="/"
          data-ocid="account.back_link"
          className="tap-target flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-semibold text-muted-foreground transition-smooth hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t("personalCenter.back")}
        </Link>
      </div>

      {!isAuthenticated ? <SignInPrompt /> : null}

      <WalletPanel profile={profile.data} isLoading={profile.isLoading} />
      <ProfilePanel profile={profile.data} isLoading={profile.isLoading} />

      {isAuthenticated ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t("personalCenter.signedInAs")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t("personalCenter.signOutHint")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            data-ocid="account.sign_out_button"
            onClick={() => clear()}
            className="shrink-0"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {t("personalCenter.signOut")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
