import { TransferAsset } from "@/backend";
import type {
  TransferDirection,
  TransferError,
  TransferStatus,
  WalletTransferRecord,
} from "@/backend";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useDepositAddress,
  useLedgerBalance,
  useLedgerTransfer,
  useRecentTransfers,
  useTransferIcp,
  useWalletBalances,
} from "@/hooks/useGame";
import type { Translator } from "@/i18n/translations";
import { useTranslation } from "@/i18n/useTranslation";
import { gameErrorMessage } from "@/lib/errors";
import {
  formatAmount,
  formatIcp,
  formatTimestamp,
  parseIcpToE8s,
  parseInteger,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type ExchangePoolState,
  IDENTITY_META,
  type PlayerProfile,
} from "@/types/game";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Landmark,
  Send,
  Wallet,
} from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

interface WalletPanelProps {
  profile: PlayerProfile | undefined;
  /** Retained for call-site compatibility; pool balances live on /exchange. */
  exchangePool?: ExchangePoolState | undefined;
  /** Retained for call-site compatibility; the treasury lives on /exchange. */
  treasury?: bigint | undefined;
  isLoading: boolean;
}

/** Parse a user-entered principal, returning null when it is not valid. */
function parsePrincipal(input: string): Principal | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  try {
    return Principal.fromText(trimmed);
  } catch {
    return null;
  }
}

/** Truncate a principal for compact display while keeping both ends. */
function truncatePrincipal(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/** Turn an ICRC-1 `TransferError` variant into a localized user-facing reason. */
function ledgerErrorMessage(t: Translator, error: TransferError): string {
  switch (error.__kind__) {
    case "InsufficientFunds":
      return t("wallet.luckyLedgerInsufficient", {
        available: formatAmount(error.InsufficientFunds.balance),
      });
    case "BadFee":
      return t("error.invalidAmount", {
        step: formatAmount(error.BadFee.expected_fee),
      });
    case "TemporarilyUnavailable":
      return t("error.ledgerUnavailable");
    case "GenericError":
      return error.GenericError.message;
    default:
      return t("error.generic");
  }
}

/** The receive surface: the caller's ICP deposit address plus a copy action. */
function ReceiveSection() {
  const { t } = useTranslation();
  const deposit = useDepositAddress();
  const [copied, setCopied] = useState(false);

  const address = deposit.data?.accountText;

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(t("wallet.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("wallet.copyFailed"));
    }
  };

  return (
    <section
      data-ocid="wallet.receive_section"
      className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center gap-2">
        <ArrowDownLeft className="size-4 text-accent" aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {t("wallet.receiveTitle")}
        </h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t("wallet.receiveHint")}
      </p>
      <div className="flex items-center gap-2">
        <code
          data-ocid="wallet.deposit_address"
          className="numeric min-w-0 flex-1 truncate rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground"
        >
          {address ?? "—"}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-ocid="wallet.copy_address_button"
          onClick={handleCopy}
          disabled={!address}
          aria-label={t("wallet.copyAddress")}
          className="shrink-0"
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {t("wallet.copyAddress")}
        </Button>
      </div>
    </section>
  );
}

/** A single transfer form, shared by the ICP and Lucky send surfaces. */
function TransferForm({
  asset,
  balance,
  feeE8s,
}: {
  asset: TransferAsset;
  balance: bigint | undefined;
  feeE8s: bigint | undefined;
}) {
  const { t } = useTranslation();
  const { identity } = useInternetIdentity();
  const transferIcp = useTransferIcp();
  const transferLucky = useLedgerTransfer();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const isIcp = asset === TransferAsset.icp;
  const isPending = isIcp ? transferIcp.isPending : transferLucky.isPending;
  const parsedRecipient = parsePrincipal(recipient);
  const recipientValid = parsedRecipient !== null;
  const selfTransfer =
    parsedRecipient !== null &&
    identity !== undefined &&
    parsedRecipient.toText() === identity.getPrincipal().toText();

  const parsedAmount = isIcp ? parseIcpToE8s(amount) : parseInteger(amount);
  const amountPositive = parsedAmount !== null && parsedAmount > 0n;
  const fee = isIcp ? (feeE8s ?? 0n) : 0n;
  const required = parsedAmount !== null ? parsedAmount + fee : 0n;
  const balanceOk =
    balance !== undefined && parsedAmount !== null && required <= balance;
  const amountValid = amountPositive && balanceOk;

  const canSubmit =
    recipientValid && !selfTransfer && amountValid && !isPending;

  const handleSubmit = () => {
    if (!canSubmit || parsedRecipient === null || parsedAmount === null) return;
    const capturedRecipient = parsedRecipient;
    const capturedAmount = parsedAmount;
    const capturedInput = amount;
    setAmount("");

    if (isIcp) {
      transferIcp.mutate(
        { recipient: capturedRecipient, amount: capturedAmount },
        {
          onSuccess: (result) => {
            if (result && result.__kind__ !== "ok") {
              toast.error(gameErrorMessage(t, result));
              setAmount((current) =>
                current === "" ? capturedInput : current,
              );
              return;
            }
            toast.success(
              t("wallet.icpSuccess", {
                amount: formatIcp(capturedAmount),
              }),
            );
            setRecipient("");
          },
          onError: (error) => {
            toast.error(error.message);
            setAmount((current) => (current === "" ? capturedInput : current));
          },
        },
      );
      return;
    }

    transferLucky.mutate(
      { recipient: capturedRecipient, amount: capturedAmount },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Err") {
            toast.error(
              t("wallet.luckyLedgerError", {
                reason: ledgerErrorMessage(t, result.Err),
              }),
            );
            setAmount((current) => (current === "" ? capturedInput : current));
            return;
          }
          toast.success(
            t("wallet.luckyLedgerSuccess", {
              amount: formatAmount(capturedAmount),
              blockIndex: result.Ok.toString(),
            }),
          );
          setRecipient("");
        },
        onError: (error) => {
          toast.error(error.message);
          setAmount((current) => (current === "" ? capturedInput : current));
        },
      },
    );
  };

  const amountError = !isIcp
    ? t("wallet.luckyAmountError")
    : t("wallet.icpAmountError");

  return (
    <section
      data-ocid={
        isIcp ? "wallet.send_icp_section" : "wallet.send_lucky_section"
      }
      className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center gap-2">
        <Send
          className={cn("size-4", isIcp ? "text-accent" : "text-primary")}
          aria-hidden="true"
        />
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {isIcp ? t("wallet.sendIcpTitle") : t("wallet.sendLuckyTitle")}
        </h3>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`wallet-${asset}-recipient`}
          className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
        >
          {t("wallet.recipientLabel")}
        </label>
        <Input
          id={`wallet-${asset}-recipient`}
          data-ocid={`wallet.${asset}_recipient_input`}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={t("wallet.recipientPlaceholder")}
          className="numeric text-xs"
          autoComplete="off"
          spellCheck={false}
        />
        {recipient !== "" && !recipientValid ? (
          <p
            data-ocid={`wallet.${asset}_recipient_error`}
            className="text-xs text-destructive"
          >
            {t("wallet.recipientError")}
          </p>
        ) : null}
        {recipientValid && selfTransfer ? (
          <p
            data-ocid={`wallet.${asset}_self_error`}
            className="text-xs text-destructive"
          >
            {t("wallet.selfTransferError")}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`wallet-${asset}-amount`}
          className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
        >
          {isIcp ? t("wallet.icpAmountLabel") : t("wallet.luckyAmountLabel")}
        </label>
        <Input
          id={`wallet-${asset}-amount`}
          data-ocid={`wallet.${asset}_amount_input`}
          inputMode={isIcp ? "decimal" : "numeric"}
          value={amount}
          onChange={(e) =>
            setAmount(
              isIcp
                ? e.target.value.replace(/[^\d.]/g, "")
                : e.target.value.replace(/[^\d]/g, ""),
            )
          }
          placeholder={
            isIcp
              ? t("wallet.icpAmountPlaceholder")
              : t("wallet.luckyAmountPlaceholder")
          }
          className="numeric"
        />
        {isIcp && feeE8s !== undefined ? (
          <p className="text-[11px] text-muted-foreground">
            {t("wallet.icpFeeNote", { fee: formatIcp(feeE8s) })}
          </p>
        ) : null}
        {amount !== "" && !amountValid ? (
          <p
            data-ocid={`wallet.${asset}_amount_error`}
            className="text-xs text-destructive"
          >
            {amountError}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        data-ocid={`wallet.${asset}_submit_button`}
        className="w-full"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {isPending
          ? t("wallet.sending")
          : isIcp
            ? t("wallet.sendIcp")
            : t("wallet.sendLucky")}
      </Button>
    </section>
  );
}

const DIRECTION_META: Record<
  TransferDirection,
  { key: "wallet.directionIn" | "wallet.directionOut"; className: string }
> = {
  incoming: { key: "wallet.directionIn", className: "text-accent" },
  outgoing: { key: "wallet.directionOut", className: "text-primary" },
};

const STATUS_META: Record<
  TransferStatus,
  {
    key:
      | "wallet.statusPending"
      | "wallet.statusCompleted"
      | "wallet.statusFailed";
    className: string;
  }
> = {
  pending: { key: "wallet.statusPending", className: "text-warning" },
  completed: { key: "wallet.statusCompleted", className: "text-accent" },
  failed: { key: "wallet.statusFailed", className: "text-destructive" },
};

/** The bounded recent-transfers list (no pagination or filtering). */
function TransfersList() {
  const { t, language } = useTranslation();
  const transfers = useRecentTransfers();
  const items = transfers.data ?? [];
  const locale = language === "zh" ? "zh-CN" : "en-US";

  return (
    <section data-ocid="wallet.transfers_section" className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {t("wallet.transfersTitle")}
      </h3>
      {transfers.isLoading ? (
        <p
          data-ocid="wallet.transfers_loading_state"
          className="text-xs text-muted-foreground"
        >
          {t("app.loading")}
        </p>
      ) : items.length === 0 ? (
        <div
          data-ocid="wallet.transfers_empty_state"
          className="rounded-md border border-dashed border-border px-3 py-4 text-center"
        >
          <p className="text-xs font-medium text-foreground">
            {t("wallet.transfersEmpty")}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("wallet.transfersEmptyHint")}
          </p>
        </div>
      ) : (
        <ul data-ocid="wallet.transfers_list" className="space-y-1.5">
          {items.map((record: WalletTransferRecord, index: number) => {
            const direction = DIRECTION_META[record.direction];
            const status = STATUS_META[record.status];
            const isIcp = record.asset === "icp";
            const amountText = isIcp
              ? `${formatIcp(record.amount)} ${t("common.icp")}`
              : `${formatAmount(record.amount)} ${t("common.lucky")}`;
            return (
              <li
                key={record.id.toString()}
                data-ocid={`wallet.transfer_item.${index + 1}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {record.direction === "incoming" ? (
                    <ArrowDownLeft
                      className="size-3.5 shrink-0 text-accent"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowUpRight
                      className="size-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      <span className={direction.className}>
                        {t(direction.key)}
                      </span>{" "}
                      <span className="numeric">{amountText}</span>
                    </p>
                    <p className="numeric truncate text-[11px] text-muted-foreground">
                      {truncatePrincipal(record.counterparty.toText())} ·{" "}
                      {formatTimestamp(record.createdAt, locale)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-semibold uppercase tracking-wider",
                    status.className,
                  )}
                >
                  {t(status.key)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export const WalletPanel = memo(function WalletPanel({
  profile,
  isLoading,
}: WalletPanelProps) {
  const identity = profile ? IDENTITY_META[profile.identity] : undefined;
  const { t } = useTranslation();
  const { isAuthenticated } = useInternetIdentity();
  const balances = useWalletBalances();
  const ledger = useLedgerBalance();

  // The Lucky balance is the real ICRC-1 ledger balance. The profile's internal
  // counter is only a fallback while the ledger query is still resolving, so a
  // stale game counter can never mask the authoritative ledger value.
  const luckyBalance = ledger.data?.balance ?? profile?.luckyBalance;
  const icpBalance = balances.data?.icpE8s;
  const icpFee = balances.data?.icpFeeE8s;

  return (
    <Card
      data-ocid="wallet.panel"
      className="gap-4 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          {t("wallet.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {!isAuthenticated ? (
          <SignInPrompt
            variant="inline"
            message={t("auth.signInToViewWallet")}
            className="mb-1"
          />
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("wallet.luckyBalance")}
            </span>
            <p
              data-ocid="wallet.lucky_balance"
              className="numeric-display mt-1 text-2xl font-bold text-primary"
            >
              {isLoading || !isAuthenticated || luckyBalance === undefined
                ? "—"
                : formatAmount(luckyBalance)}
            </p>
            <p
              data-ocid="wallet.lucky_ledger_source"
              className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {t("wallet.ledgerBalanceLabel")}
            </p>
          </div>
          <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("wallet.icpBalance")}
            </span>
            <p
              data-ocid="wallet.icp_balance"
              className="numeric-display mt-1 text-2xl font-bold text-accent"
            >
              {!isAuthenticated || icpBalance === undefined
                ? "—"
                : formatIcp(icpBalance)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {t("wallet.identity")}
          </span>
          {identity ? (
            <Badge
              data-ocid="wallet.identity_badge"
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
        {identity ? (
          <p className="text-xs text-muted-foreground">{t(identity.descKey)}</p>
        ) : null}

        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <Landmark
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-xs text-muted-foreground">
            {t("wallet.rate")}{" "}
            <span className="numeric font-semibold text-foreground">
              1 ICP = 1000 Lucky
            </span>
          </p>
        </div>

        {isAuthenticated ? (
          <>
            <ReceiveSection />
            <TransferForm
              asset={TransferAsset.icp}
              balance={icpBalance}
              feeE8s={icpFee}
            />
            <TransferForm
              asset={TransferAsset.lucky}
              balance={luckyBalance}
              feeE8s={undefined}
            />
            <TransfersList />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
});
