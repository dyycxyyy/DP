import { DrawBasisPanel } from "@/components/DrawBasisPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDrawResult, useRoundHistory } from "@/hooks/useGame";
import { LANGUAGE_TAGS } from "@/i18n/translations";
import { useTranslation } from "@/i18n/useTranslation";
import { formatAmount, formatNumber, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronRight, History } from "lucide-react";
import { useEffect, useState } from "react";

export function HistoryPage() {
  const { t, language } = useTranslation();
  const history = useRoundHistory(20);
  const [selectedRound, setSelectedRound] = useState<bigint | null>(null);

  const entries = history.data ?? [];
  const activeRound = selectedRound ?? entries[0]?.round ?? null;
  const activeEntry =
    entries.find((entry) => entry.round === activeRound) ?? null;
  const drawResult = useDrawResult(activeRound);

  useEffect(() => {
    document.title = `${t("app.name")} · ${t("history.title")}`;
  }, [t]);

  return (
    <div
      data-ocid="history.page"
      className="mx-auto w-full max-w-[1600px] overflow-x-hidden"
    >
      <div className="mb-3 flex items-center gap-2 sm:mb-4">
        <History className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {t("history.title")}
        </h1>
        <span className="text-xs text-muted-foreground sm:text-sm">
          {t("history.recent")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <Card
            data-ocid="history.panel"
            className="gap-4 rounded-lg border-border py-4 shadow-none"
          >
            <CardHeader className="px-4">
              <CardTitle className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("history.list")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              {history.isLoading ? (
                <div data-ocid="history.loading_state" className="space-y-2">
                  {Array.from(
                    { length: 6 },
                    (_, i) => `history-skeleton-${i}`,
                  ).map((id) => (
                    <div
                      key={id}
                      className="h-16 animate-pulse rounded-md bg-muted/40"
                    />
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div
                  data-ocid="history.empty_state"
                  className="rounded-md border border-dashed border-border px-3 py-10 text-center"
                >
                  <p className="text-sm font-medium text-foreground">
                    {t("history.empty")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("history.emptyHint")}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map((entry, index) => {
                    const isActive = entry.round === activeRound;
                    return (
                      <li key={entry.round.toString()}>
                        <button
                          type="button"
                          data-ocid={`history.item.${index + 1}`}
                          onClick={() => setSelectedRound(entry.round)}
                          className={cn(
                            "tap-comfortable flex w-full flex-col gap-2 rounded-md border px-3 py-2.5 text-left transition-smooth sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                            isActive
                              ? "border-primary/50 bg-primary/5"
                              : "border-border bg-background hover:border-primary/30",
                          )}
                        >
                          <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {t("history.round", {
                                    round: formatAmount(entry.round),
                                  })}
                                </span>
                                <span className="numeric text-base font-bold tracking-[0.2em] text-foreground">
                                  {formatNumber(entry.winningNumber)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {formatTimestamp(
                                  entry.finishedAt,
                                  LANGUAGE_TAGS[language],
                                )}
                              </p>
                            </div>
                            <ChevronRight
                              className={cn(
                                "size-4 shrink-0 transition-smooth sm:hidden",
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                              aria-hidden="true"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-2 sm:flex sm:shrink-0 sm:items-center sm:gap-4 sm:border-0 sm:pt-0">
                            <div className="min-w-0 text-left sm:text-right">
                              <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                                {t("history.totalPool")}
                              </span>
                              <p className="numeric truncate text-sm font-semibold text-primary">
                                {formatAmount(entry.totalPrizePool)}
                              </p>
                            </div>
                            <div className="min-w-0 text-left sm:text-right">
                              <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                                {t("history.crowdfundTotal")}
                              </span>
                              <p className="numeric truncate text-sm font-semibold text-accent">
                                {formatAmount(entry.crowdfundTotal)}
                              </p>
                            </div>
                            <div className="min-w-0 text-left sm:text-right">
                              <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                                {t("history.distributed")}
                              </span>
                              <p className="numeric truncate text-sm font-semibold text-success">
                                {formatAmount(entry.totalDistributed)}
                              </p>
                            </div>
                            <ChevronRight
                              className={cn(
                                "hidden size-4 shrink-0 transition-smooth sm:block",
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                              aria-hidden="true"
                            />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-5">
          {activeRound !== null ? (
            <DrawBasisPanel
              drawResult={drawResult.data}
              isLoading={drawResult.isLoading}
              roundEntry={activeEntry}
            />
          ) : (
            <Card className="rounded-lg border-border py-10 shadow-none">
              <CardContent className="px-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("history.selectHint")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="tap-target mt-3"
                  data-ocid="history.back_button"
                  onClick={() => setSelectedRound(null)}
                >
                  {t("history.back")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
