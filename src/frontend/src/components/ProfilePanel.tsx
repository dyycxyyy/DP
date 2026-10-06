import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyBetHistory, useMyWinHistory } from "@/hooks/useGame";
import { LANGUAGE_TAGS } from "@/i18n/translations";
import { useTranslation } from "@/i18n/useTranslation";
import { formatAmount, formatNumber, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IDENTITY_META, type PlayerProfile, tierLabel } from "@/types/game";
import { Loader2, ScrollText, UserRound } from "lucide-react";
import { useState } from "react";

interface ProfilePanelProps {
  profile: PlayerProfile | undefined;
  isLoading: boolean;
}

type Tab = "bets" | "wins";

/** Page size for the paginated history reads (backend caps at 50). */
const PAGE_SIZE = 20;

export function ProfilePanel({ profile, isLoading }: ProfilePanelProps) {
  const { t, language } = useTranslation();
  const [tab, setTab] = useState<Tab>("bets");
  const identity = profile ? IDENTITY_META[profile.identity] : undefined;
  const locale = LANGUAGE_TAGS[language];

  const betCount = profile ? Number(profile.betCount) : 0;
  const winCount = profile ? Number(profile.winCount) : 0;

  return (
    <Card
      data-ocid="profile.panel"
      className="gap-4 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <UserRound className="size-4 text-primary" aria-hidden="true" />
          {t("profile.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {t("profile.identityLabel")}
          </span>
          {identity ? (
            <Badge
              data-ocid="profile.identity_badge"
              variant="outline"
              className={cn(
                "rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                identity.className,
              )}
            >
              {t(identity.labelKey)}
            </Badge>
          ) : (
            <span className="numeric text-sm text-muted-foreground">—</span>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          <button
            type="button"
            data-ocid="profile.tab.bets"
            onClick={() => setTab("bets")}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-xs font-semibold transition-smooth",
              tab === "bets"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("profile.tab.bets", { count: formatAmount(betCount) })}
          </button>
          <button
            type="button"
            data-ocid="profile.tab.wins"
            onClick={() => setTab("wins")}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-xs font-semibold transition-smooth",
              tab === "wins"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("profile.tab.wins", { count: formatAmount(winCount) })}
          </button>
        </div>

        {isLoading ? (
          <div data-ocid="profile.loading_state" className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => `profile-skeleton-${i}`).map(
              (id) => (
                <div
                  key={id}
                  className="h-10 animate-pulse rounded-md bg-muted/40"
                />
              ),
            )}
          </div>
        ) : tab === "bets" ? (
          <BetHistoryList locale={locale} />
        ) : (
          <WinHistoryList locale={locale} />
        )}
      </CardContent>
    </Card>
  );
}

interface HistoryListProps {
  locale: string;
}

function BetHistoryList({ locale }: HistoryListProps) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const query = useMyBetHistory(offset, PAGE_SIZE);
  const items = query.data?.items ?? [];
  const nextOffset = query.data?.nextOffset;

  if (query.isLoading) return <HistorySkeleton />;

  if (items.length === 0) {
    return (
      <div
        data-ocid="profile.bets_empty_state"
        className="rounded-md border border-dashed border-border px-3 py-6 text-center"
      >
        <ScrollText
          className="mx-auto size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {t("profile.betsEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {items.map((bet, index) => (
          <li
            key={`${bet.round}-${formatNumber(bet.number)}-${bet.placedAt}`}
            data-ocid={`profile.bet_item.${index + 1}`}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
          >
            <div className="min-w-0">
              <span className="numeric text-sm font-bold tracking-[0.15em] text-foreground">
                {formatNumber(bet.number)}
              </span>
              <p className="text-[10px] text-muted-foreground">
                {t("profile.betMeta", {
                  round: formatAmount(bet.round),
                  time: formatTimestamp(bet.placedAt, locale),
                })}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="numeric text-sm font-semibold text-primary">
                {formatAmount(bet.cost)}
              </span>
              <p className="numeric text-[10px] text-muted-foreground">
                {t("profile.tickets", {
                  count: formatAmount(bet.ticketCount),
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {nextOffset !== undefined ? (
        <LoadMoreButton
          ocid="profile.bets_load_more"
          isFetching={query.isFetching}
          onClick={() => setOffset(Number(nextOffset))}
        />
      ) : null}
    </div>
  );
}

function WinHistoryList({ locale }: HistoryListProps) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const query = useMyWinHistory(offset, PAGE_SIZE);
  const items = query.data?.items ?? [];
  const nextOffset = query.data?.nextOffset;

  if (query.isLoading) return <HistorySkeleton />;

  if (items.length === 0) {
    return (
      <div
        data-ocid="profile.wins_empty_state"
        className="rounded-md border border-dashed border-border px-3 py-6 text-center"
      >
        <ScrollText
          className="mx-auto size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {t("profile.winsEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {items.map((win, index) => (
          <li
            key={`${win.round}-${formatNumber(win.number)}-${win.claimedAt}`}
            data-ocid={`profile.win_item.${index + 1}`}
            className="flex items-center justify-between gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2"
          >
            <div className="min-w-0">
              <span className="numeric text-sm font-bold tracking-[0.15em] text-foreground">
                {formatNumber(win.number)}
              </span>
              <p className="text-[10px] text-muted-foreground">
                {t("profile.winMeta", {
                  round: formatAmount(win.round),
                  tier: tierLabel(t, win.tier),
                  time: formatTimestamp(win.claimedAt, locale),
                })}
              </p>
            </div>
            <span className="numeric shrink-0 text-sm font-bold text-success">
              +{formatAmount(win.payout)}
            </span>
          </li>
        ))}
      </ul>
      {nextOffset !== undefined ? (
        <LoadMoreButton
          ocid="profile.wins_load_more"
          isFetching={query.isFetching}
          onClick={() => setOffset(Number(nextOffset))}
        />
      ) : null}
    </div>
  );
}

interface LoadMoreButtonProps {
  ocid: string;
  isFetching: boolean;
  onClick: () => void;
}

function LoadMoreButton({ ocid, isFetching, onClick }: LoadMoreButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-ocid={ocid}
      onClick={onClick}
      disabled={isFetching}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground disabled:opacity-60"
    >
      {isFetching ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : null}
      {t("profile.loadMore")}
    </button>
  );
}

function HistorySkeleton() {
  return (
    <div data-ocid="profile.history_loading_state" className="space-y-2">
      {Array.from({ length: 3 }, (_, i) => `profile-history-skeleton-${i}`).map(
        (id) => (
          <div key={id} className="h-10 animate-pulse rounded-md bg-muted/40" />
        ),
      )}
    </div>
  );
}
