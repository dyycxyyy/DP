import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Translator } from "@/i18n/translations";
import { useTranslation } from "@/i18n/useTranslation";
import { formatAmount, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type DrawResult,
  type RoundHistoryEntry,
  type TierResult,
  tierLabel,
} from "@/types/game";
import { Info, ScrollText } from "lucide-react";
import { memo, useMemo } from "react";

interface DrawBasisPanelProps {
  drawResult: DrawResult | null | undefined;
  isLoading: boolean;
  /** The drawn round whose basis is being displayed (history page selection). */
  roundEntry?: RoundHistoryEntry | null;
}

interface BasisRow {
  position: number;
  label: string;
  detail: string;
}

/**
 * Derive the public generation basis for each of the 7 positions.
 *
 * Positions 1-3 are read from the drawn round's own persisted `positions`
 * (from history), never from the live round state: the backend resets live
 * positions when the next round opens, so the published crowdfunding basis
 * must come from the same snapshot as the displayed winning number.
 * Positions 4-7 are derived from the drawn round's own pool/crowdfund totals.
 */
function basisForPosition(
  t: Translator,
  position: number,
  roundEntry: RoundHistoryEntry | null | undefined,
): { label: string; detail: string } {
  if (position <= 3) {
    const basis = roundEntry?.positions.find(
      (p) => Number(p.position) === position,
    );
    if (basis?.locked) {
      return {
        label: t("basis.crowdfundResult"),
        detail: t("basis.crowdfundLocked", {
          position,
          digit: basis.winningDigit.toString(),
        }),
      };
    }
    return {
      label: t("basis.crowdfundResult"),
      detail: t("basis.crowdfundLeading", {
        position,
        digit: basis?.winningDigit.toString() ?? "—",
      }),
    };
  }
  if (position <= 5) {
    const pool = roundEntry?.totalPrizePool ?? 0n;
    const lastTwo = pool % 100n;
    return {
      label: t("basis.poolLastTwo"),
      detail: t("basis.poolDetail", {
        pool: formatAmount(pool),
        lastTwo: lastTwo.toString().padStart(2, "0"),
      }),
    };
  }
  const total = roundEntry?.crowdfundTotal ?? 0n;
  const lastTwo = total % 100n;
  return {
    label: t("basis.crowdfundLastTwo"),
    detail: t("basis.crowdfundDetail", {
      total: formatAmount(total),
      lastTwo: lastTwo.toString().padStart(2, "0"),
    }),
  };
}

/** One position's basis row; memoized so unchanged rows skip re-rendering. */
const BasisItem = memo(function BasisItem({
  row,
  digit,
}: {
  row: BasisRow;
  digit: bigint | undefined;
}) {
  const { t } = useTranslation();

  return (
    <li
      data-ocid={`basis.item.${row.position}`}
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
    >
      <div className="min-w-0">
        <span className="text-xs font-semibold text-foreground">
          {t("draw.position", { position: row.position })}
        </span>
        <p className="truncate text-[10px] text-muted-foreground">
          {row.detail}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {row.label}
        </span>
        <span
          className={cn(
            "numeric-display text-xl font-bold",
            digit !== undefined ? "text-success" : "text-muted-foreground/40",
          )}
        >
          {digit !== undefined ? digit.toString() : "?"}
        </span>
      </div>
    </li>
  );
});

/** The tier payout table; memoized on the tiers array identity. */
const TierTable = memo(function TierTable({ tiers }: { tiers: TierResult[] }) {
  const { t } = useTranslation();

  if (tiers.length === 0) {
    return (
      <p
        data-ocid="basis.tiers_empty_state"
        className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground"
      >
        {t("basis.tiersEmpty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table data-ocid="basis.tiers_table" className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-1.5 text-left font-semibold">
              {t("basis.tier")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("basis.winningTickets")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("basis.payoutPerTicket")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("basis.distributed")}
            </th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, index) => (
            <tr
              key={tier.tier.toString()}
              data-ocid={`basis.tier_row.${index + 1}`}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-1.5 text-left font-medium text-foreground">
                {tierLabel(t, tier.tier)}
              </td>
              <td className="numeric py-1.5 text-right text-muted-foreground">
                {formatAmount(tier.winningTickets)}
              </td>
              <td className="numeric py-1.5 text-right text-primary">
                {formatAmount(tier.payoutPerTicket)}
              </td>
              <td className="numeric py-1.5 text-right font-semibold text-foreground">
                {formatAmount(tier.distributed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export function DrawBasisPanel({
  drawResult,
  isLoading,
  roundEntry,
}: DrawBasisPanelProps) {
  const { t } = useTranslation();
  const tiers = drawResult?.tiers ?? [];
  const winning = drawResult?.winningNumber ?? roundEntry?.winningNumber;
  // Derive all seven basis rows once per round snapshot instead of calling
  // basisForPosition seven times on every poll tick.
  const basisRows = useMemo<BasisRow[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const position = i + 1;
        const basis = basisForPosition(t, position, roundEntry);
        return { position, label: basis.label, detail: basis.detail };
      }),
    [t, roundEntry],
  );

  return (
    <Card
      data-ocid="basis.panel"
      className="gap-4 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Info className="size-4 text-primary" aria-hidden="true" />
          {t("basis.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("basis.description")}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        {isLoading ? (
          <div data-ocid="basis.loading_state" className="space-y-2">
            {Array.from({ length: 7 }, (_, i) => `basis-skeleton-${i}`).map(
              (id) => (
                <div
                  key={id}
                  className="h-9 animate-pulse rounded-md bg-muted/40"
                />
              ),
            )}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {basisRows.map((row) => (
              <BasisItem
                key={row.position}
                row={row}
                digit={winning?.[row.position - 1]}
              />
            ))}
          </ul>
        )}

        <div className="border-t border-border pt-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            <ScrollText className="size-3.5" aria-hidden="true" />
            {t("basis.tiers")}
          </h3>
          <TierTable tiers={tiers} />
        </div>

        {drawResult ? (
          <div className="grid grid-cols-2 gap-3 rounded-md border border-success/30 bg-success/5 p-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t("basis.myWinnings")}
              </span>
              <p
                data-ocid="basis.my_winnings"
                className="numeric-display mt-1 text-2xl font-bold text-success"
              >
                {formatAmount(drawResult.callerWinnings)}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t("basis.myTier")}
              </span>
              <p
                data-ocid="basis.my_tier"
                className="mt-1 font-display text-2xl font-bold text-foreground"
              >
                {drawResult.callerTier !== undefined
                  ? tierLabel(t, drawResult.callerTier)
                  : t("basis.noWin")}
              </p>
            </div>
          </div>
        ) : null}

        {winning ? (
          <p className="text-center text-xs text-muted-foreground">
            {t("basis.winningLine", {
              round: roundEntry ? formatAmount(roundEntry.round) : "",
            })}{" "}
            <span className="numeric font-bold tracking-[0.2em] text-success">
              {formatNumber(winning)}
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
