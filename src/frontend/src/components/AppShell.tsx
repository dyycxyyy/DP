import { TerminalHeader } from "@/components/TerminalHeader";
import {
  useGameState,
  useIsCallerController,
  useMyProfile,
} from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ICP_TO_LUCKY_RATE } from "@/types/game";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Coins,
  type LucideIcon,
  Radio,
  Repeat,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { type ReactNode, memo } from "react";

interface TabDef {
  to: string;
  labelKey:
    | "nav.arena"
    | "nav.crowdfund"
    | "nav.ranking"
    | "nav.exchange"
    | "nav.guide"
    | "nav.admin";
  icon: LucideIcon;
  ocid: string;
  /** When true the tab is only rendered for an admin-role caller. */
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { to: "/", labelKey: "nav.arena", icon: Radio, ocid: "tab.arena" },
  {
    to: "/crowdfund",
    labelKey: "nav.crowdfund",
    icon: Coins,
    ocid: "tab.crowdfund",
  },
  {
    to: "/ranking",
    labelKey: "nav.ranking",
    icon: Trophy,
    ocid: "tab.ranking",
  },
  {
    to: "/exchange",
    labelKey: "nav.exchange",
    icon: Repeat,
    ocid: "tab.exchange",
  },
  {
    to: "/guide",
    labelKey: "nav.guide",
    icon: BookOpen,
    ocid: "tab.guide",
  },
  {
    to: "/admin",
    labelKey: "nav.admin",
    icon: ShieldCheck,
    ocid: "tab.admin",
    adminOnly: true,
  },
];

/**
 * Fixed bottom tab bar with safe-area padding. The active tab is derived from
 * the router location so it stays correct on deep links. The admin tab is only
 * rendered when the caller holds the platform admin role.
 */
const TabBar = memo(function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <nav
      data-ocid="shell.tab_bar"
      aria-label={t("nav.primary")}
      className="tabbar fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card shadow-tabbar-lift"
    >
      <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-[1600px] items-stretch">
        {tabs.map((tab) => {
          const isActive =
            tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
          const Icon = tab.icon;
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                data-ocid={tab.ocid}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "tap-comfortable flex h-full flex-col items-center justify-center gap-0.5 transition-snap",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-[10px] font-semibold tracking-wide">
                  {t(tab.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

/**
 * Terminal footer: fixed exchange rate, round schedule and attribution.
 *
 * Sits above the fixed tab bar and uses a distinct surface from the content
 * area. Every string comes from the i18n dictionary so the language toggle
 * switches it along with the rest of the interface.
 */
const TerminalFooter = memo(function TerminalFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer
      data-ocid="shell.footer"
      className="footerbar border-t border-border bg-card"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-3 py-3 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-foreground">
            {t("footer.rate")}
          </span>
          <span className="numeric">
            1 ICP = {formatAmount(ICP_TO_LUCKY_RATE)} Lucky
          </span>
        </p>
        <p className="min-w-0">{t("footer.schedule")}</p>
        <p className="shrink-0">{t("footer.builtWith", { year })}</p>
      </div>
    </footer>
  );
});

/**
 * Mobile-first terminal shell: sticky status strip, scrollable content area
 * that clears the fixed tab bar, and the bottom tab bar itself.
 *
 * The shell is the single owner of the two global polls (`useGameState` and
 * `useMyProfile`). Pages read the same query keys with `poll: false`, so the
 * app runs one interval per key instead of one per mounted consumer. The shell
 * is memoized and its children are the router's stable element, so a poll tick
 * re-renders only the header — not the page subtree.
 */
export const AppShell = memo(function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  // The shell owns the global state poll. `useGameState` applies a
  // phase-adaptive interval internally: it speeds up as the current phase nears
  // its deadline so a phase flip is seen promptly, and slows down during long
  // phases to cut repeated calls.
  const gameState = useGameState();
  const profile = useMyProfile();
  const { isController: isAdmin } = useIsCallerController();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TerminalHeader
        state={gameState.data}
        luckyBalance={profile.data?.luckyBalance}
      />
      <main className="terminal-shell flex-1">
        <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4">
          {children}
        </div>
      </main>
      <TerminalFooter />
      <TabBar isAdmin={isAdmin} />
    </div>
  );
});
