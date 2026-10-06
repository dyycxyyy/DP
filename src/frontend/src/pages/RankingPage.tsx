import { TopBetsPanel } from "@/components/TopBetsPanel";
import { useTopBetNumbers } from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { Trophy } from "lucide-react";
import { useEffect } from "react";

/** Ranking tab: the most-bet numbers for the current round. */
export function RankingPage() {
  const { t } = useTranslation();
  const topBets = useTopBetNumbers();

  useEffect(() => {
    document.title = `${t("nav.ranking")} · ${t("app.name")}`;
  }, [t]);

  return (
    <div data-ocid="ranking.page" className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-primary" aria-hidden="true" />
        <h1 className="font-display text-xl font-bold tracking-tight">
          {t("nav.ranking")}
        </h1>
      </div>

      <TopBetsPanel entries={topBets.data} isLoading={topBets.isLoading} />
    </div>
  );
}
