import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/i18n/useTranslation";
import { formatAmount, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TopBetNumber } from "@/types/game";
import { Trophy } from "lucide-react";
import { memo } from "react";

interface TopBetsPanelProps {
  entries: TopBetNumber[] | undefined;
  isLoading: boolean;
}

export const TopBetsPanel = memo(function TopBetsPanel({
  entries,
  isLoading,
}: TopBetsPanelProps) {
  const { t } = useTranslation();
  const rows = entries ?? [];

  return (
    <Card
      data-ocid="topbets.panel"
      className="gap-4 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Trophy className="size-4 text-primary" aria-hidden="true" />
          {t("topbets.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {isLoading ? (
          <div data-ocid="topbets.loading_state" className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => `topbets-skeleton-${i}`).map(
              (id) => (
                <Skeleton key={id} className="h-9 w-full rounded-md" />
              ),
            )}
          </div>
        ) : rows.length === 0 ? (
          <div
            data-ocid="topbets.empty_state"
            className="rounded-md border border-dashed border-border px-3 py-8 text-center"
          >
            <p className="text-sm font-medium text-foreground">
              {t("topbets.empty")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("topbets.emptyHint")}
            </p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {rows.map((entry, index) => (
              <li
                key={formatNumber(entry.number)}
                data-ocid={`topbets.item.${index + 1}`}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-smooth",
                  index === 0
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "numeric flex size-6 shrink-0 items-center justify-center rounded-sm text-xs font-bold",
                      index === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="numeric truncate text-base font-bold tracking-[0.15em] text-foreground">
                    {formatNumber(entry.number)}
                  </span>
                </div>
                <span className="numeric shrink-0 text-sm font-semibold text-primary">
                  {formatAmount(entry.ticketCount)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {t("topbets.tickets")}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
});
