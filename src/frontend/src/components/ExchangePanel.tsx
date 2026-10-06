import { SignInPrompt } from "@/components/SignInPrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useExchangeIcpToLucky, useExchangeLuckyToIcp } from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { gameErrorMessage } from "@/lib/errors";
import {
  formatAmount,
  formatIcp,
  parseIcpToE8s,
  parseInteger,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExchangePoolState } from "@/types/game";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Repeat } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

interface ExchangePanelProps {
  exchangePool: ExchangePoolState | undefined;
  treasury?: bigint | undefined;
  luckyBalance: bigint | undefined;
}

type Direction = "icpToLucky" | "luckyToIcp";

const ICP_MIN_E8S = 10_000_000n; // 0.1 ICP
const ICP_MAX_E8S = 1_000_000_000_000n; // 10,000 ICP
const LUCKY_MAX = 10_000_000n;
const LUCKY_STEP = 1000n;

export const ExchangePanel = memo(function ExchangePanel({
  exchangePool,
  treasury,
  luckyBalance,
}: ExchangePanelProps) {
  const [direction, setDirection] = useState<Direction>("icpToLucky");
  const [icpInput, setIcpInput] = useState("");
  const [luckyInput, setLuckyInput] = useState("");
  const exchangeIcp = useExchangeIcpToLucky();
  const exchangeLucky = useExchangeLuckyToIcp();
  const { t } = useTranslation();
  const { isAuthenticated } = useInternetIdentity();

  const icpE8s = parseIcpToE8s(icpInput);
  const icpValid =
    icpE8s !== null &&
    icpE8s >= ICP_MIN_E8S &&
    icpE8s <= ICP_MAX_E8S &&
    icpE8s % ICP_MIN_E8S === 0n;
  const icpOutput = icpE8s !== null ? (icpE8s / 100_000_000n) * 1000n : 0n;
  const icpPoolOk =
    exchangePool !== undefined &&
    icpE8s !== null &&
    icpE8s <= exchangePool.icpBalance;

  const luckyAmount = parseInteger(luckyInput);
  const luckyValid =
    luckyAmount !== null &&
    luckyAmount > 0n &&
    luckyAmount <= LUCKY_MAX &&
    luckyAmount % LUCKY_STEP === 0n;
  const luckyFee = luckyAmount !== null ? (luckyAmount * 300n) / 10_000n : 0n;
  const luckyNet = luckyAmount !== null ? luckyAmount - luckyFee : 0n;
  // Convert Lucky → ICP e8s at 1 ICP = 1000 Lucky without integer truncation:
  // multiply by 1e8 first, then divide by 1000.
  const luckyOutputE8s = (luckyNet * 100_000_000n) / 1000n;
  const luckyPoolOk =
    exchangePool !== undefined &&
    luckyAmount !== null &&
    luckyAmount <= exchangePool.luckyBalance;
  const luckyBalanceOk =
    luckyBalance !== undefined &&
    luckyAmount !== null &&
    luckyAmount <= luckyBalance;

  const handleIcpExchange = () => {
    if (!isAuthenticated || !icpValid || !icpPoolOk || icpE8s === null) return;
    exchangeIcp.mutate(icpE8s, {
      onSuccess: (result) => {
        if (result && "poolInsufficient" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        if (result && "amountTooLarge" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        if (result && "amountTooSmall" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        if (result && "invalidAmount" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        toast.success(
          t("exchange.successIcp", {
            icp: formatIcp(icpE8s),
            lucky: formatAmount(icpOutput),
          }),
        );
        setIcpInput("");
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const handleLuckyExchange = () => {
    if (
      !isAuthenticated ||
      !luckyValid ||
      !luckyPoolOk ||
      !luckyBalanceOk ||
      luckyAmount === null
    )
      return;
    exchangeLucky.mutate(luckyAmount, {
      onSuccess: (result) => {
        if (result && "poolInsufficient" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        if (result && "insufficientBalance" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        if (result && "amountTooLarge" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        if (result && "invalidAmount" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        toast.success(
          t("exchange.successLucky", {
            lucky: formatAmount(luckyAmount),
            icp: formatIcp(luckyOutputE8s),
            fee: formatAmount(luckyFee),
          }),
        );
        setLuckyInput("");
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Card
      data-ocid="exchange.panel"
      className="gap-4 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Repeat className="size-4 text-accent" aria-hidden="true" />
          {t("exchange.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("exchange.description")}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        {!isAuthenticated ? (
          <SignInPrompt
            variant="inline"
            message={t("auth.signInToExchange")}
            className="mb-1"
          />
        ) : null}

        <section
          data-ocid="exchange.pool_section"
          className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
        >
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("exchange.poolTitle")}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t("exchange.poolLucky")}
              </span>
              <p
                data-ocid="exchange.pool_lucky"
                className="numeric-display mt-1 text-xl font-bold text-primary"
              >
                {exchangePool ? formatAmount(exchangePool.luckyBalance) : "—"}
              </p>
            </div>
            <div className="rounded-md border border-accent/30 bg-accent/5 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t("exchange.poolIcp")}
              </span>
              <p
                data-ocid="exchange.pool_icp"
                className="numeric-display mt-1 text-xl font-bold text-accent"
              >
                {exchangePool ? formatIcp(exchangePool.icpBalance) : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {t("exchange.treasury")}
            </span>
            <span
              data-ocid="exchange.treasury"
              className="numeric text-lg font-bold text-warning"
            >
              {treasury === undefined ? "—" : formatAmount(treasury)}
            </span>
          </div>
        </section>

        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          <button
            type="button"
            data-ocid="exchange.tab.icp_to_lucky"
            onClick={() => setDirection("icpToLucky")}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-xs font-semibold transition-smooth",
              direction === "icpToLucky"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("exchange.icpToLucky")}
          </button>
          <button
            type="button"
            data-ocid="exchange.tab.lucky_to_icp"
            onClick={() => setDirection("luckyToIcp")}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-xs font-semibold transition-smooth",
              direction === "luckyToIcp"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("exchange.luckyToIcp")}
          </button>
        </div>

        {direction === "icpToLucky" ? (
          <div className="space-y-2">
            <label
              htmlFor="exchange-icp-input"
              className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
            >
              {t("exchange.icpLabel")}
            </label>
            <Input
              id="exchange-icp-input"
              data-ocid="exchange.icp_input"
              inputMode="decimal"
              placeholder="0.0"
              value={icpInput}
              onChange={(e) =>
                setIcpInput(e.target.value.replace(/[^\d.]/g, ""))
              }
              className="numeric"
            />
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {t("exchange.expected")}
              </span>
              <span
                data-ocid="exchange.icp_output"
                className="numeric text-lg font-bold text-primary"
              >
                {formatAmount(icpOutput)} {t("common.lucky")}
              </span>
            </div>
            {icpInput !== "" && !icpValid ? (
              <p
                data-ocid="exchange.icp_error"
                className="text-xs text-destructive"
              >
                {t("exchange.icpError")}
              </p>
            ) : null}
            {icpValid && !icpPoolOk ? (
              <p
                data-ocid="exchange.icp_pool_error"
                className="text-xs text-destructive"
              >
                {t("exchange.icpPoolError", {
                  available: exchangePool
                    ? formatIcp(exchangePool.icpBalance)
                    : "—",
                })}
              </p>
            ) : null}
            <Button
              type="button"
              data-ocid="exchange.icp_submit_button"
              className="w-full"
              disabled={
                !isAuthenticated ||
                !icpValid ||
                !icpPoolOk ||
                exchangeIcp.isPending
              }
              onClick={handleIcpExchange}
            >
              {exchangeIcp.isPending
                ? t("exchange.submitting")
                : t("exchange.submitToLucky")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="exchange-lucky-input"
              className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
            >
              {t("exchange.luckyLabel")}
            </label>
            <Input
              id="exchange-lucky-input"
              data-ocid="exchange.lucky_input"
              inputMode="numeric"
              placeholder="0"
              value={luckyInput}
              onChange={(e) =>
                setLuckyInput(e.target.value.replace(/[^\d]/g, ""))
              }
              className="numeric"
            />
            <div className="space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("exchange.fee")}
                </span>
                <span className="numeric text-sm font-semibold text-warning">
                  {formatAmount(luckyFee)} {t("common.lucky")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("exchange.actual")}
                </span>
                <span className="numeric text-sm font-semibold text-foreground">
                  {formatAmount(luckyNet)} {t("common.lucky")}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1">
                <span className="text-xs text-muted-foreground">
                  {t("exchange.expected")}
                </span>
                <span
                  data-ocid="exchange.lucky_output"
                  className="numeric text-lg font-bold text-accent"
                >
                  {formatIcp(luckyOutputE8s)} {t("common.icp")}
                </span>
              </div>
            </div>
            {luckyInput !== "" && !luckyValid ? (
              <p
                data-ocid="exchange.lucky_error"
                className="text-xs text-destructive"
              >
                {t("exchange.luckyError")}
              </p>
            ) : null}
            {luckyValid && !luckyBalanceOk ? (
              <p
                data-ocid="exchange.lucky_balance_error"
                className="text-xs text-destructive"
              >
                {t("exchange.luckyBalanceError", {
                  available:
                    luckyBalance === undefined
                      ? "—"
                      : formatAmount(luckyBalance),
                })}
              </p>
            ) : null}
            {luckyValid && luckyBalanceOk && !luckyPoolOk ? (
              <p
                data-ocid="exchange.lucky_pool_error"
                className="text-xs text-destructive"
              >
                {t("exchange.luckyPoolError", {
                  available: exchangePool
                    ? formatAmount(exchangePool.luckyBalance)
                    : "—",
                })}
              </p>
            ) : null}
            <Button
              type="button"
              data-ocid="exchange.lucky_submit_button"
              className="w-full"
              disabled={
                !isAuthenticated ||
                !luckyValid ||
                !luckyPoolOk ||
                !luckyBalanceOk ||
                exchangeLucky.isPending
              }
              onClick={handleLuckyExchange}
            >
              {exchangeLucky.isPending
                ? t("exchange.submitting")
                : t("exchange.submitToIcp")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
