import { AdminPool, TransactionKind, UserRole } from "@/backend";
import type { Account, Transaction } from "@/backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdminStatus,
  useAdminUserList,
  useDailyStats,
  useDemoteToUser,
  useIsCallerController,
  useLedgerBlocks,
  useMintLucky,
  usePromoteToAdmin,
  useResetGameData,
  useResumeRound,
  useStopNextRound,
  useTokenInfo,
  useWithdrawFromPool,
} from "@/hooks/useGame";
import { useTranslation } from "@/i18n/useTranslation";
import { gameErrorMessage, toErrorMessage } from "@/lib/errors";
import {
  formatAmount,
  formatIcp,
  formatTimestamp,
  parseIcpToE8s,
  parseInteger,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CalendarRange,
  Coins,
  Play,
  RotateCcw,
  ShieldCheck,
  UserCog,
  Wallet,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/** One pool row: label, current balance and a withdraw action. */
function PoolRow({
  pool,
  label,
  balance,
  unit,
  decimals = false,
  onWithdraw,
  isPending,
}: {
  pool: AdminPool;
  label: string;
  balance: bigint;
  unit: string;
  /** When true the pool is denominated in ICP (e8s) and accepts decimal input. */
  decimals?: boolean;
  onWithdraw: (pool: AdminPool, amount: bigint, recipient: Principal) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  const parsedAmount = decimals ? parseIcpToE8s(amount) : parseInteger(amount);
  const parsedRecipient = (() => {
    if (recipient.trim() === "") return null;
    try {
      return Principal.fromText(recipient.trim());
    } catch {
      return null;
    }
  })();
  const canSubmit =
    parsedAmount !== null &&
    parsedAmount > 0n &&
    parsedAmount <= balance &&
    parsedRecipient !== null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || parsedAmount === null || parsedRecipient === null) return;
    onWithdraw(pool, parsedAmount, parsedRecipient);
    setAmount("");
  };

  return (
    <form
      data-ocid={`admin.pool.${pool}`}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border bg-background/40 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Coins className="size-4 text-primary" aria-hidden="true" />
          {label}
        </span>
        <span
          data-ocid={`admin.pool.${pool}.balance`}
          className="numeric text-sm font-bold text-primary"
        >
          {decimals ? formatIcp(balance) : formatAmount(balance)} {unit}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`admin.amount.${pool}`} className="text-xs">
            {t("admin.withdraw.amountLabel")}
          </Label>
          <Input
            id={`admin.amount.${pool}`}
            data-ocid={`admin.amount.${pool}`}
            inputMode={decimals ? "decimal" : "numeric"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("admin.withdraw.amountPlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`admin.recipient.${pool}`} className="text-xs">
            {t("admin.withdraw.recipientLabel")}
          </Label>
          <Input
            id={`admin.recipient.${pool}`}
            data-ocid={`admin.recipient.${pool}`}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={t("admin.withdraw.recipientPlaceholder")}
          />
        </div>
      </div>
      <Button
        type="submit"
        data-ocid={`admin.withdraw_button.${pool}`}
        disabled={!canSubmit || isPending}
        className="w-full rounded-md"
      >
        {isPending
          ? t("admin.withdraw.submitting")
          : t("admin.withdraw.submit")}
      </Button>
    </form>
  );
}

/** ISO `YYYY-MM-DD` for a date offset by `days` from today (UTC). */
function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily statistics section: a controller-only, date-ranged table of per-UTC-day
 * bets, payouts and treasury income. The backend zero-fills days with no
 * activity, so every day in the range renders a numeric row.
 */
function DailyStatsSection() {
  const { t } = useTranslation();
  const [fromDate, setFromDate] = useState(() => isoDay(-6));
  const [toDate, setToDate] = useState(() => isoDay(0));
  // The committed range drives the query; the inputs stay editable drafts.
  const [range, setRange] = useState(() => ({
    from: isoDay(-6),
    to: isoDay(0),
  }));

  const rangeValid = fromDate !== "" && toDate !== "" && fromDate <= toDate;
  const stats = useDailyStats(range.from, range.to, true);

  const entries = useMemo(() => {
    const outcome = stats.data;
    if (!outcome || outcome.__kind__ !== "ok") return [];
    return [...outcome.ok].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [stats.data]);

  const outcomeError =
    stats.data && stats.data.__kind__ === "err" ? stats.data.err : null;

  const applyRange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    setRange({ from, to });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!rangeValid) return;
    setRange({ from: fromDate, to: toDate });
  };

  return (
    <Card
      data-ocid="admin.stats.section"
      className="gap-3 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <BarChart3 className="size-4 text-accent" aria-hidden="true" />
          {t("admin.stats.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <p className="text-xs text-muted-foreground">
          {t("admin.stats.description")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="admin.stats.from" className="text-xs">
                {t("admin.stats.fromLabel")}
              </Label>
              <Input
                id="admin.stats.from"
                data-ocid="admin.stats.from_input"
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin.stats.to" className="text-xs">
                {t("admin.stats.toLabel")}
              </Label>
              <Input
                id="admin.stats.to"
                data-ocid="admin.stats.to_input"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              data-ocid="admin.stats.apply_button"
              disabled={!rangeValid || stats.isFetching}
              className="rounded-md"
            >
              <CalendarRange className="size-4" aria-hidden="true" />
              {t("admin.stats.apply")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-ocid="admin.stats.preset7_button"
              onClick={() => applyRange(isoDay(-6), isoDay(0))}
              className="rounded-md"
            >
              {t("admin.stats.preset7")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-ocid="admin.stats.preset30_button"
              onClick={() => applyRange(isoDay(-29), isoDay(0))}
              className="rounded-md"
            >
              {t("admin.stats.preset30")}
            </Button>
          </div>

          {!rangeValid ? (
            <p
              data-ocid="admin.stats.range_error"
              className="text-xs font-semibold text-destructive"
            >
              {t("admin.stats.rangeError")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("admin.stats.rangeHint")}
            </p>
          )}
        </form>

        {stats.isPending ? (
          <p
            data-ocid="admin.stats.loading_state"
            className="py-6 text-center text-sm text-muted-foreground"
          >
            {t("admin.stats.loading")}
          </p>
        ) : outcomeError ? (
          <div
            data-ocid="admin.stats.error_state"
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <p className="text-sm text-destructive">{t("admin.stats.error")}</p>
            <Button
              type="button"
              variant="secondary"
              data-ocid="admin.stats.retry_button"
              onClick={() => void stats.refetch()}
              className="rounded-md"
            >
              {t("admin.stats.retry")}
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div
            data-ocid="admin.stats.empty_state"
            className="flex flex-col items-center gap-1 py-6 text-center"
          >
            <p className="text-sm font-semibold">{t("admin.stats.empty")}</p>
            <p className="text-xs text-muted-foreground">
              {t("admin.stats.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("admin.stats.dayCount", { count: entries.length })}
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table
                data-ocid="admin.stats.table"
                className="w-full border-collapse text-sm"
              >
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      {t("admin.stats.date")}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      {t("admin.stats.totalBets")}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      {t("admin.stats.totalPayouts")}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      {t("admin.stats.treasuryIncome")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr
                      key={entry.date}
                      data-ocid={`admin.stats.row.${index + 1}`}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <td className="numeric px-3 py-2 text-left font-mono text-xs text-muted-foreground">
                        {entry.date}
                      </td>
                      <td className="numeric px-3 py-2 text-right font-semibold text-primary">
                        {formatAmount(entry.stats.totalBets)}
                      </td>
                      <td className="numeric px-3 py-2 text-right font-semibold text-foreground">
                        {formatAmount(entry.stats.totalPayouts)}
                      </td>
                      <td className="numeric px-3 py-2 text-right font-semibold text-accent">
                        {formatAmount(entry.stats.treasuryIncome)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * User management section: an admin-only table of every registered user with
 * their role and a short identity label, plus a promote/demote action per row.
 * A failed role change surfaces as an inline error on the affected row.
 */
function UserManagementSection() {
  const { t } = useTranslation();
  const { identity } = useInternetIdentity();
  const callerPrincipal = identity?.getPrincipal().toText() ?? null;
  const users = useAdminUserList(true);
  const promote = usePromoteToAdmin();
  const demote = useDemoteToUser();
  const [rowError, setRowError] = useState<{
    id: string;
    message: string;
  } | null>(null);

  const entries = useMemo(() => {
    const outcome = users.data;
    if (!outcome || outcome.__kind__ !== "ok") return [];
    return [...outcome.ok].sort((a, b) =>
      a.principal.toText() < b.principal.toText() ? -1 : 1,
    );
  }, [users.data]);

  const outcomeError =
    users.data && users.data.__kind__ === "err" ? users.data.err : null;

  const roleLabel = (role: UserRole): string => {
    if (role === UserRole.admin) return t("admin.users.roleAdmin");
    if (role === UserRole.user) return t("admin.users.roleUser");
    return t("admin.users.roleGuest");
  };

  const handleChange = (
    principal: Principal,
    id: string,
    next: "promote" | "demote",
  ) => {
    setRowError(null);
    const mutation = next === "promote" ? promote : demote;
    mutation.mutate(principal, {
      onSuccess: (result) => {
        if (result.__kind__ === "err") {
          setRowError({ id, message: gameErrorMessage(t, result.err) });
          return;
        }
        toast.success(
          next === "promote"
            ? t("admin.users.promoteSuccess")
            : t("admin.users.demoteSuccess"),
        );
      },
      onError: (error) => {
        setRowError({ id, message: toErrorMessage(t, error) });
      },
    });
  };

  return (
    <Card
      data-ocid="admin.users.section"
      className="gap-3 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <UserCog className="size-4 text-accent" aria-hidden="true" />
          {t("admin.users.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <p className="text-xs text-muted-foreground">
          {t("admin.users.description")}
        </p>

        {users.isPending ? (
          <p
            data-ocid="admin.users.loading_state"
            className="py-6 text-center text-sm text-muted-foreground"
          >
            {t("admin.users.loading")}
          </p>
        ) : outcomeError ? (
          <div
            data-ocid="admin.users.error_state"
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <p className="text-sm text-destructive">{t("admin.users.error")}</p>
            <Button
              type="button"
              variant="secondary"
              data-ocid="admin.users.retry_button"
              onClick={() => void users.refetch()}
              className="rounded-md"
            >
              {t("admin.users.retry")}
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div
            data-ocid="admin.users.empty_state"
            className="flex flex-col items-center gap-1 py-6 text-center"
          >
            <p className="text-sm font-semibold">{t("admin.users.empty")}</p>
            <p className="text-xs text-muted-foreground">
              {t("admin.users.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("admin.users.count", { count: entries.length })}
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table
                data-ocid="admin.users.table"
                className="w-full border-collapse text-sm"
              >
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      {t("admin.users.identity")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      {t("admin.users.role")}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      {t("admin.users.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const id = entry.principal.toText();
                    const isSelf = callerPrincipal === id;
                    const isAdmin = entry.role === UserRole.admin;
                    const isPending = promote.isPending || demote.isPending;
                    const error = rowError?.id === id ? rowError.message : null;
                    return (
                      <tr
                        key={id}
                        data-ocid={`admin.users.row.${index + 1}`}
                        className="border-b border-border/60 last:border-b-0"
                      >
                        <td className="px-3 py-2 text-left">
                          <span
                            data-ocid={`admin.users.identity.${index + 1}`}
                            className="numeric block max-w-[12rem] truncate font-mono text-xs text-muted-foreground"
                            title={id}
                          >
                            {id}
                          </span>
                          {isSelf ? (
                            <span className="text-[10px] text-accent">
                              {t("admin.users.you")}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-left">
                          <span
                            data-ocid={`admin.users.role.${index + 1}`}
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                              isAdmin
                                ? "border-primary/40 bg-primary/15 text-primary"
                                : "border-border bg-muted/40 text-muted-foreground",
                            )}
                          >
                            {roleLabel(entry.role)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              type="button"
                              variant={isAdmin ? "secondary" : "default"}
                              size="sm"
                              data-ocid={`admin.users.${
                                isAdmin ? "demote" : "promote"
                              }_button.${index + 1}`}
                              disabled={isPending}
                              onClick={() =>
                                handleChange(
                                  entry.principal,
                                  id,
                                  isAdmin ? "demote" : "promote",
                                )
                              }
                              className="rounded-md"
                            >
                              {isAdmin
                                ? demote.isPending
                                  ? t("admin.users.demoting")
                                  : t("admin.users.demote")
                                : promote.isPending
                                  ? t("admin.users.promoting")
                                  : t("admin.users.promote")}
                            </Button>
                            {error ? (
                              <p
                                data-ocid={`admin.users.row_error.${index + 1}`}
                                className="max-w-[14rem] text-right text-xs font-semibold text-destructive"
                              >
                                {error}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Lucky token panel: the token's metadata and total supply, a mint form, and a
 * recent ledger-transactions list. Admin-only — the parent renders this only
 * inside the admin-gated branch, and every query is additionally enabled only
 * for admins.
 */
function TokenPanelSection() {
  const { t } = useTranslation();
  const tokenInfo = useTokenInfo(true);
  const mint = useMintLucky();
  const [owner, setOwner] = useState("");
  const [subaccount, setSubaccount] = useState("");
  const [amount, setAmount] = useState("");

  const parsedOwner = (() => {
    if (owner.trim() === "") return null;
    try {
      return Principal.fromText(owner.trim());
    } catch {
      return null;
    }
  })();

  const parsedSubaccount = (() => {
    const trimmed = subaccount.trim();
    if (trimmed === "") return { ok: true as const, value: undefined };
    if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return { ok: false as const };
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      bytes[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return { ok: true as const, value: bytes };
  })();

  const parsedAmount = parseInteger(amount);
  const ownerValid = parsedOwner !== null;
  const subaccountValid = parsedSubaccount.ok;
  const amountValid = parsedAmount !== null && parsedAmount > 0n;
  const canSubmit = ownerValid && subaccountValid && amountValid;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (
      !canSubmit ||
      parsedOwner === null ||
      parsedAmount === null ||
      !parsedSubaccount.ok
    ) {
      return;
    }
    const to: Account = {
      owner: parsedOwner,
      subaccount: parsedSubaccount.value,
    };
    const capturedAmount = parsedAmount;
    setAmount("");
    mint.mutate(
      { to, amount: capturedAmount, memo: undefined },
      {
        onSuccess: (outcome) => {
          if (outcome.__kind__ === "err") {
            toast.error(gameErrorMessage(t, outcome.err));
            return;
          }
          toast.success(
            t("admin.token.mintSuccess", {
              amount: formatAmount(outcome.ok.amount),
              blockIndex: outcome.ok.blockIndex.toString(),
              totalSupply: formatAmount(outcome.ok.totalSupply),
            }),
          );
        },
        onError: (error) => {
          toast.error(toErrorMessage(t, error));
        },
      },
    );
  };

  const info = tokenInfo.data;
  const metadata = info?.metadata;

  return (
    <Card
      data-ocid="admin.token.section"
      className="gap-3 rounded-lg border-border py-4 shadow-none"
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Coins className="size-4 text-accent" aria-hidden="true" />
          {t("admin.token.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        <p className="text-xs text-muted-foreground">
          {t("admin.token.description")}
        </p>

        {tokenInfo.isPending ? (
          <p
            data-ocid="admin.token.loading_state"
            className="py-6 text-center text-sm text-muted-foreground"
          >
            {t("admin.token.loading")}
          </p>
        ) : tokenInfo.isError || !info || !metadata ? (
          <div
            data-ocid="admin.token.error_state"
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <p className="text-sm text-destructive">{t("admin.token.error")}</p>
            <Button
              type="button"
              variant="secondary"
              data-ocid="admin.token.retry_button"
              onClick={() => void tokenInfo.refetch()}
              className="rounded-md"
            >
              {t("admin.token.retry")}
            </Button>
          </div>
        ) : (
          <div
            data-ocid="admin.token.info"
            className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-background/40 p-3"
          >
            {metadata.logo ? (
              <img
                data-ocid="admin.token.logo"
                src={metadata.logo}
                alt={t("admin.token.logoAlt", { symbol: metadata.symbol })}
                className="size-14 shrink-0 rounded-full border border-border bg-muted/40 object-contain p-1"
              />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
                <Coins className="size-6" aria-hidden="true" />
              </span>
            )}
            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("admin.token.name")}
                </dt>
                <dd
                  data-ocid="admin.token.name"
                  className="truncate text-sm font-semibold"
                >
                  {metadata.name}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("admin.token.symbol")}
                </dt>
                <dd
                  data-ocid="admin.token.symbol"
                  className="numeric truncate font-mono text-sm font-semibold text-primary"
                >
                  {metadata.symbol}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("admin.token.decimals")}
                </dt>
                <dd
                  data-ocid="admin.token.decimals"
                  className="numeric text-sm font-semibold"
                >
                  {metadata.decimals}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("admin.token.totalSupply")}
                </dt>
                <dd
                  data-ocid="admin.token.total_supply"
                  className="numeric truncate text-sm font-bold text-accent"
                >
                  {formatAmount(info.totalSupply)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("admin.token.fee")}
                </dt>
                <dd
                  data-ocid="admin.token.fee"
                  className="numeric text-sm font-semibold"
                >
                  {formatAmount(metadata.fee)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <form
          data-ocid="admin.token.mint_form"
          onSubmit={handleSubmit}
          className="space-y-3 rounded-lg border border-border bg-background/40 p-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.token.mintTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("admin.token.mintHint")}
          </p>
          <div className="space-y-1">
            <Label htmlFor="admin.token.owner" className="text-xs">
              {t("admin.token.ownerLabel")}
            </Label>
            <Input
              id="admin.token.owner"
              data-ocid="admin.token.owner_input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder={t("admin.token.ownerPlaceholder")}
            />
            {owner.trim() !== "" && !ownerValid ? (
              <p
                data-ocid="admin.token.owner_error"
                className="text-xs font-semibold text-destructive"
              >
                {t("admin.token.ownerError")}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="admin.token.subaccount" className="text-xs">
                {t("admin.token.subaccountLabel")}
              </Label>
              <Input
                id="admin.token.subaccount"
                data-ocid="admin.token.subaccount_input"
                value={subaccount}
                onChange={(e) => setSubaccount(e.target.value)}
                placeholder={t("admin.token.subaccountPlaceholder")}
                className="font-mono text-xs"
              />
              {!subaccountValid ? (
                <p
                  data-ocid="admin.token.subaccount_error"
                  className="text-xs font-semibold text-destructive"
                >
                  {t("admin.token.subaccountError")}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin.token.amount" className="text-xs">
                {t("admin.token.amountLabel")}
              </Label>
              <Input
                id="admin.token.amount"
                data-ocid="admin.token.amount_input"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t("admin.token.amountPlaceholder")}
              />
              {amount.trim() !== "" && !amountValid ? (
                <p
                  data-ocid="admin.token.amount_error"
                  className="text-xs font-semibold text-destructive"
                >
                  {t("admin.token.amountError")}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            type="submit"
            data-ocid="admin.token.mint_button"
            disabled={!canSubmit || mint.isPending}
            className="w-full rounded-md"
          >
            {mint.isPending ? t("admin.token.minting") : t("admin.token.mint")}
          </Button>
        </form>

        <LedgerTransactions />
      </CardContent>
    </Card>
  );
}

/** The number of most-recent ledger transactions shown in the token panel. */
const LEDGER_PAGE_SIZE = 10n;

/** A short, human-readable label for a ledger account (or the system). */
function accountLabel(
  account: Account | undefined,
  systemLabel: string,
): string {
  if (!account) return systemLabel;
  const owner = account.owner.toText();
  return account.subaccount
    ? `${owner.slice(0, 8)}…${owner.slice(-4)}`
    : `${owner.slice(0, 8)}…${owner.slice(-4)}`;
}

/**
 * Recent ledger transactions, newest first. The backend returns blocks in
 * ascending index order, so the list is reversed for display. This is a fixed
 * recent window, not a paginated browser.
 */
function LedgerTransactions() {
  const { t } = useTranslation();
  const blocks = useLedgerBlocks(0n, LEDGER_PAGE_SIZE, true);

  const transactions = useMemo<Transaction[]>(() => {
    const page = blocks.data;
    if (!page) return [];
    return [...page.transactions].sort((a, b) => (a.index < b.index ? 1 : -1));
  }, [blocks.data]);

  const kindLabel = (kind: TransactionKind): string => {
    if (kind === TransactionKind.mint) return t("admin.token.kindMint");
    if (kind === TransactionKind.transfer) return t("admin.token.kindTransfer");
    if (kind === TransactionKind.transferFrom)
      return t("admin.token.kindTransferFrom");
    return t("admin.token.kindApprove");
  };

  return (
    <div data-ocid="admin.token.ledger" className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.token.ledgerTitle")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("admin.token.ledgerDescription", {
          count: Number(LEDGER_PAGE_SIZE),
        })}
      </p>

      {blocks.isPending ? (
        <p
          data-ocid="admin.token.ledger_loading_state"
          className="py-6 text-center text-sm text-muted-foreground"
        >
          {t("admin.token.ledgerLoading")}
        </p>
      ) : blocks.isError ? (
        <div
          data-ocid="admin.token.ledger_error_state"
          className="flex flex-col items-center gap-2 py-6 text-center"
        >
          <p className="text-sm text-destructive">
            {t("admin.token.ledgerError")}
          </p>
          <Button
            type="button"
            variant="secondary"
            data-ocid="admin.token.ledger_retry_button"
            onClick={() => void blocks.refetch()}
            className="rounded-md"
          >
            {t("admin.token.ledgerRetry")}
          </Button>
        </div>
      ) : transactions.length === 0 ? (
        <div
          data-ocid="admin.token.ledger_empty_state"
          className="flex flex-col items-center gap-1 py-6 text-center"
        >
          <p className="text-sm font-semibold">
            {t("admin.token.ledgerEmpty")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("admin.token.ledgerEmptyHint")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table
            data-ocid="admin.token.ledger_table"
            className="w-full border-collapse text-sm"
          >
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("admin.token.colIndex")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("admin.token.colKind")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("admin.token.colFrom")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("admin.token.colTo")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("admin.token.colAmount")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("admin.token.colTime")}
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <tr
                  key={tx.index.toString()}
                  data-ocid={`admin.token.ledger_row.${index + 1}`}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="numeric px-3 py-2 text-left font-mono text-xs text-muted-foreground">
                    #{tx.index.toString()}
                  </td>
                  <td className="px-3 py-2 text-left">
                    <span className="inline-flex rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold">
                      {kindLabel(tx.kind)}
                    </span>
                  </td>
                  <td className="numeric max-w-[10rem] truncate px-3 py-2 text-left font-mono text-xs text-muted-foreground">
                    {accountLabel(tx.from, t("admin.token.systemAccount"))}
                  </td>
                  <td className="numeric max-w-[10rem] truncate px-3 py-2 text-left font-mono text-xs text-muted-foreground">
                    {accountLabel(tx.to, t("admin.token.systemAccount"))}
                  </td>
                  <td className="numeric px-3 py-2 text-right font-semibold text-primary">
                    {formatAmount(tx.amount)}
                  </td>
                  <td className="numeric px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {formatTimestamp(tx.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Super-admin console. Admin-role-only: callers without the platform admin
 * role see a no-permission state and no controls. Every action reports success
 * or failure through a toast.
 */
export function AdminPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useInternetIdentity();
  const { isController: isAdmin, isLoading: isAdminLoading } =
    useIsCallerController();
  const adminStatus = useAdminStatus(isAdmin);
  const stopRound = useStopNextRound();
  const resumeRound = useResumeRound();
  const withdraw = useWithdrawFromPool();
  const resetGame = useResetGameData();
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    document.title = `${t("admin.title")} · ${t("app.name")}`;
  }, [t]);

  const report = (error: unknown) => {
    if (error && typeof error === "object" && "__kind__" in error) {
      toast.error(gameErrorMessage(t, error as never));
      return;
    }
    toast.error(toErrorMessage(t, error));
  };

  if (isAdminLoading) {
    return (
      <div
        data-ocid="admin.loading_state"
        className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"
      >
        {t("app.loading")}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        data-ocid="admin.no_permission"
        className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full border border-destructive/40 bg-destructive/15 text-destructive">
          <Ban className="size-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-lg font-bold">{t("admin.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {isAuthenticated
            ? t("admin.noPermission")
            : t("admin.signInRequired")}
        </p>
      </div>
    );
  }

  const balances = adminStatus.data?.balances;
  const roundStopped = adminStatus.data?.roundStopped ?? false;

  return (
    <div data-ocid="admin.page" className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">
            {t("admin.title")}
          </h1>
          <p className="text-xs text-muted-foreground">{t("admin.subtitle")}</p>
        </div>
      </header>

      <Card className="gap-3 rounded-lg border-border py-4 shadow-none">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Ban className="size-4 text-primary" aria-hidden="true" />
            {t("admin.round.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          <p
            data-ocid="admin.round.status"
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-semibold",
              roundStopped
                ? "border-destructive/40 bg-destructive/15 text-destructive"
                : "border-success/40 bg-success/15 text-success",
            )}
          >
            {roundStopped ? t("admin.round.stopped") : t("admin.round.running")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              data-ocid="admin.stop_button"
              disabled={roundStopped || stopRound.isPending}
              onClick={() =>
                stopRound.mutate(undefined, {
                  onSuccess: (result) => {
                    if (
                      result &&
                      "__kind__" in result &&
                      result.__kind__ !== "ok"
                    ) {
                      report(result);
                      return;
                    }
                    toast.success(t("admin.round.stopSuccess"));
                  },
                  onError: report,
                })
              }
              className="rounded-md"
            >
              <Ban className="size-4" aria-hidden="true" />
              {t("admin.round.stop")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-ocid="admin.resume_button"
              disabled={!roundStopped || resumeRound.isPending}
              onClick={() =>
                resumeRound.mutate(undefined, {
                  onSuccess: (result) => {
                    if (
                      result &&
                      "__kind__" in result &&
                      result.__kind__ !== "ok"
                    ) {
                      report(result);
                      return;
                    }
                    toast.success(t("admin.round.resumeSuccess"));
                  },
                  onError: report,
                })
              }
              className="rounded-md"
            >
              <Play className="size-4" aria-hidden="true" />
              {t("admin.round.resume")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-3 rounded-lg border-border py-4 shadow-none">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Wallet className="size-4 text-primary" aria-hidden="true" />
            {t("admin.withdraw.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {balances ? (
            <>
              <PoolRow
                pool={AdminPool.prizePool}
                label={t("admin.pool.prizePool")}
                balance={balances.prizePool}
                unit={t("common.lucky")}
                isPending={withdraw.isPending}
                onWithdraw={(pool, amount, recipient) =>
                  withdraw.mutate(
                    { pool, amount, recipient },
                    {
                      onSuccess: (result) => {
                        if (result.__kind__ === "err") {
                          report(result.err);
                          return;
                        }
                        toast.success(
                          t("admin.withdraw.success", {
                            amount: formatAmount(result.ok.amount),
                          }),
                        );
                      },
                      onError: report,
                    },
                  )
                }
              />
              <PoolRow
                pool={AdminPool.treasury}
                label={t("admin.pool.treasury")}
                balance={balances.treasury}
                unit={t("common.lucky")}
                isPending={withdraw.isPending}
                onWithdraw={(pool, amount, recipient) =>
                  withdraw.mutate(
                    { pool, amount, recipient },
                    {
                      onSuccess: (result) => {
                        if (result.__kind__ === "err") {
                          report(result.err);
                          return;
                        }
                        toast.success(
                          t("admin.withdraw.success", {
                            amount: formatAmount(result.ok.amount),
                          }),
                        );
                      },
                      onError: report,
                    },
                  )
                }
              />
              <PoolRow
                pool={AdminPool.exchangeLucky}
                label={t("admin.pool.exchangeLucky")}
                balance={balances.exchangeLucky}
                unit={t("common.lucky")}
                isPending={withdraw.isPending}
                onWithdraw={(pool, amount, recipient) =>
                  withdraw.mutate(
                    { pool, amount, recipient },
                    {
                      onSuccess: (result) => {
                        if (result.__kind__ === "err") {
                          report(result.err);
                          return;
                        }
                        toast.success(
                          t("admin.withdraw.success", {
                            amount: formatAmount(result.ok.amount),
                          }),
                        );
                      },
                      onError: report,
                    },
                  )
                }
              />
              <PoolRow
                pool={AdminPool.exchangeIcp}
                label={t("admin.pool.exchangeIcp")}
                balance={balances.exchangeIcp}
                unit={t("common.icp")}
                decimals
                isPending={withdraw.isPending}
                onWithdraw={(pool, amount, recipient) =>
                  withdraw.mutate(
                    { pool, amount, recipient },
                    {
                      onSuccess: (result) => {
                        if (result.__kind__ === "err") {
                          report(result.err);
                          return;
                        }
                        toast.success(
                          t("admin.withdraw.success", {
                            amount: formatAmount(result.ok.amount),
                          }),
                        );
                      },
                      onError: report,
                    },
                  )
                }
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
          )}
        </CardContent>
      </Card>

      <TokenPanelSection />

      <Card className="gap-3 rounded-lg border-destructive/40 py-4 shadow-none">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {t("admin.reset.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.reset.description")}
          </p>
          {confirmReset ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                data-ocid="admin.reset_confirm_button"
                disabled={resetGame.isPending}
                onClick={() =>
                  resetGame.mutate(undefined, {
                    onSuccess: (result) => {
                      if (result.__kind__ === "err") {
                        report(result.err);
                        return;
                      }
                      setConfirmReset(false);
                      toast.success(t("admin.reset.success"));
                    },
                    onError: report,
                  })
                }
                className="rounded-md"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {t("admin.reset.confirm")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-ocid="admin.reset_cancel_button"
                onClick={() => setConfirmReset(false)}
                className="rounded-md"
              >
                {t("admin.reset.cancel")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              data-ocid="admin.reset_button"
              onClick={() => setConfirmReset(true)}
              className="rounded-md"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {t("admin.reset.action")}
            </Button>
          )}
        </CardContent>
      </Card>

      <UserManagementSection />

      <DailyStatsSection />
    </div>
  );
}
