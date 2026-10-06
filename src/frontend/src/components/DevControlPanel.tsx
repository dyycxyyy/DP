import { SignInPrompt } from "@/components/SignInPrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useDevAdvanceRound,
  useDevSeedBalance,
  useDevSetRoundElapsed,
} from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { gameErrorMessage } from "@/lib/errors";
import { formatAmount, parseInteger } from "@/lib/format";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { FastForward, FlaskConical, Timer, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SEED_PRESETS = [100_000n, 1_000_000n] as const;
const ELAPSED_PRESETS = [
  { key: "dev.elapsedBetting", ns: 5n * 60n * 1_000_000_000n },
  { key: "dev.elapsedCrowdfund", ns: 8n * 60n * 1_000_000_000n },
  { key: "dev.elapsedFull", ns: 10n * 60n * 1_000_000_000n },
] as const;

/**
 * Admin-only test panel. It is rendered exclusively when the caller holds the
 * platform admin role, so ordinary visitors never see it. It exercises the
 * otherwise-unreachable paths: seeding a Lucky balance and fast-forwarding the
 * round clock.
 */
export function DevControlPanel() {
  const [seedAmount, setSeedAmount] = useState("");
  const seedBalance = useDevSeedBalance();
  const advanceRound = useDevAdvanceRound();
  const setRoundElapsed = useDevSetRoundElapsed();
  const { t } = useTranslation();
  const { isAuthenticated } = useInternetIdentity();

  const parsedSeed = parseInteger(seedAmount);
  const seedValid = parsedSeed !== null && parsedSeed > 0n;
  const busy =
    seedBalance.isPending ||
    advanceRound.isPending ||
    setRoundElapsed.isPending;

  const handleSeed = (amount: bigint) => {
    if (!isAuthenticated || amount <= 0n) return;
    seedBalance.mutate(amount, {
      onSuccess: (result) => {
        if (result && "amountTooLarge" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        if (result && "amountTooSmall" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        toast.success(t("dev.seedSuccess", { amount: formatAmount(amount) }));
        setSeedAmount("");
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const handleAdvance = () => {
    if (!isAuthenticated) return;
    advanceRound.mutate(undefined, {
      onSuccess: (result) => {
        if (result && "phaseClosed" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        toast.success(t("dev.advanceSuccess"));
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const handleElapsed = (elapsedNs: bigint, label: string) => {
    if (!isAuthenticated) return;
    setRoundElapsed.mutate(elapsedNs, {
      onSuccess: (result) => {
        if (result && "phaseClosed" in result) {
          toast.error(gameErrorMessage(t, result));
          return;
        }
        toast.success(t("dev.elapsedSuccess", { label }));
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Card
      data-ocid="dev.panel"
      className="gap-4 rounded-lg border-warning/40 bg-warning/5 py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-warning">
          <FlaskConical className="size-4" aria-hidden="true" />
          {t("dev.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("dev.description")}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {!isAuthenticated ? (
          <SignInPrompt
            variant="inline"
            message={t("auth.signInToDev")}
            className="mb-1"
          />
        ) : null}

        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Wallet className="size-3.5" aria-hidden="true" />
            {t("dev.seedTitle")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {SEED_PRESETS.map((preset) => (
              <Button
                key={preset.toString()}
                type="button"
                size="sm"
                variant="outline"
                data-ocid={`dev.seed_preset.${preset.toString()}`}
                disabled={busy || !isAuthenticated}
                onClick={() => handleSeed(preset)}
              >
                +{formatAmount(preset)}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              data-ocid="dev.seed_input"
              inputMode="numeric"
              placeholder={t("dev.seedPlaceholder")}
              value={seedAmount}
              onChange={(e) =>
                setSeedAmount(e.target.value.replace(/[^\d]/g, ""))
              }
              className="numeric h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              data-ocid="dev.seed_button"
              disabled={!seedValid || busy || !isAuthenticated}
              onClick={() => {
                if (parsedSeed !== null) handleSeed(parsedSeed);
              }}
            >
              {t("dev.seed")}
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Timer className="size-3.5" aria-hidden="true" />
            {t("dev.elapsedTitle")}
          </span>
          <div className="flex flex-wrap gap-2">
            {ELAPSED_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="outline"
                data-ocid={`dev.elapsed.${preset.ns.toString()}`}
                disabled={busy || !isAuthenticated}
                onClick={() => handleElapsed(preset.ns, t(preset.key))}
              >
                {t(preset.key)}
              </Button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <Button
            type="button"
            data-ocid="dev.advance_button"
            className="w-full"
            disabled={busy || !isAuthenticated}
            onClick={handleAdvance}
          >
            <FastForward className="size-4" aria-hidden="true" />
            {advanceRound.isPending ? t("dev.advancing") : t("dev.advance")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
