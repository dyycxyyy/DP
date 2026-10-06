import { UserRole, createActor } from "@/backend";
import type {
  Account,
  AdminPool,
  BlockPage,
  Digit,
  GameState,
  IcpE8s,
  LedgerBalance,
  Lucky,
  MintArg,
  MintOutcome,
  Position,
  TokenInfo,
  TransferArg,
  TransferResult,
} from "@/backend";
import { type GameApi, createGameApi } from "@/lib/api";
import { useActor, useInternetIdentity } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

export const gameKeys = {
  state: ["game", "state"] as const,
  topBets: ["game", "topBets"] as const,
  history: (limit: number) => ["game", "history", limit] as const,
  drawResult: (round: string) => ["game", "drawResult", round] as const,
  profile: ["game", "profile"] as const,
  betHistory: (offset: number, limit: number) =>
    ["game", "betHistory", offset, limit] as const,
  winHistory: (offset: number, limit: number) =>
    ["game", "winHistory", offset, limit] as const,
  exchangePool: ["game", "exchangePool"] as const,
  treasury: ["game", "treasury"] as const,
  callerRole: ["game", "callerRole"] as const,
  userList: ["game", "userList"] as const,
  walletBalances: ["game", "walletBalances"] as const,
  ledgerBalance: ["game", "ledgerBalance"] as const,
  depositAddress: ["game", "depositAddress"] as const,
  recentTransfers: ["game", "recentTransfers"] as const,
  adminStatus: ["game", "adminStatus"] as const,
  dailyStats: (fromDate: string, toDate: string) =>
    ["game", "dailyStats", fromDate, toDate] as const,
  guideText: ["game", "guideText"] as const,
  tokenInfo: ["game", "tokenInfo"] as const,
  ledgerBlocks: (start: bigint, length: bigint) =>
    ["game", "ledgerBlocks", start.toString(), length.toString()] as const,
};

/**
 * Adaptive polling cadence.
 *
 * A round runs ~10 minutes across four phases. Polling every 5s for the whole
 * round is wasteful during the long betting/crowdfunding stretches, yet the
 * moment a phase flips the UI must catch up quickly. The shell therefore polls
 * on a phase-aware interval: fast while a phase is about to end (so the flip is
 * seen within a second or two) and slow while a phase has plenty of time left.
 *
 * `phaseDeadline` is a backend nanosecond timestamp; `remainingMs` is derived
 * from it on each render. The interval is recomputed as the countdown shrinks,
 * so a single round naturally steps from slow to fast as it approaches a
 * transition without any extra backend calls.
 */
export const POLL_FAST_MS = 2000;
export const POLL_SLOW_MS = 15000;
/** Within this window of a phase deadline, poll at the fast cadence. */
export const POLL_NEAR_TRANSITION_MS = 20_000;

/** Pick the polling interval for a phase deadline (or a static fallback). */
export function adaptivePollInterval(
  phaseDeadline: bigint | undefined,
  fallbackMs: number = POLL_SLOW_MS,
): number {
  if (phaseDeadline === undefined) return fallbackMs;
  const remainingMs = Number(phaseDeadline / 1_000_000n) - Date.now();
  if (remainingMs <= POLL_NEAR_TRANSITION_MS) return POLL_FAST_MS;
  return POLL_SLOW_MS;
}

/**
 * Polling ownership.
 *
 * `useGameState` and `useMyProfile` are mounted once, globally, by `AppShell`.
 * Pages read the same query keys but pass `poll: false`, so they share the
 * cached value without each mounting its own `refetchInterval` — one interval
 * per key instead of one per mounted consumer.
 */
interface PollOptions {
  /** When false, the query reads the shared cache without its own interval. */
  poll?: boolean;
  /**
   * Override the polling interval in ms. The shell passes a phase-adaptive
   * interval here so the global state poll speeds up near a phase transition.
   */
  intervalMs?: number;
}

/** Resolve the generated actor into the stable UI-facing API surface. */
export function useGameApi(): { api: GameApi | null; isFetching: boolean } {
  const { actor, isFetching } = useActor(createActor);
  const api = useMemo(() => (actor ? createGameApi(actor) : null), [actor]);
  return { api, isFetching };
}

/**
 * Live round state: phase, deadlines, pools, crowdfund positions.
 *
 * This is the app's heartbeat query and the one the shell mounts globally. Its
 * interval is phase-adaptive: it polls fast as the current phase nears its
 * deadline (so a phase flip surfaces within a second or two) and slow during
 * long phases (so a 10-minute round does not cost a call every 5 seconds).
 * `intervalMs` overrides the cadence when a caller needs a fixed rate.
 */
export function useGameState({ poll = true, intervalMs }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  const queryClient = useQueryClient();
  const [interval, setInterval] = useState(POLL_SLOW_MS);

  // Re-evaluate the cadence once a second against the cached phase deadline.
  // Reading the cache (not the query result) keeps this independent of the
  // query's own render cycle, so there is no circular dependency.
  useEffect(() => {
    if (!poll || intervalMs !== undefined) return;
    const update = () => {
      const cached = queryClient.getQueryData<GameState>(gameKeys.state);
      setInterval(adaptivePollInterval(cached?.phaseDeadline));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [poll, intervalMs, queryClient]);

  return useQuery({
    queryKey: gameKeys.state,
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getGameState();
    },
    enabled: !!api && !isFetching,
    refetchInterval: poll ? (intervalMs ?? interval) : false,
  });
}

/** Top-10 most-bet numbers for the current round. */
export function useTopBetNumbers({ poll = true }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.topBets,
    queryFn: async () => {
      if (!api) return [];
      return api.getTopBetNumbers();
    },
    enabled: !!api && !isFetching,
    refetchInterval: poll ? 8000 : false,
  });
}

/** Recent completed rounds, newest first. */
export function useRoundHistory(limit = 20, { poll = true }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.history(limit),
    queryFn: async () => {
      if (!api) return [];
      return api.getRoundHistory(BigInt(limit));
    },
    enabled: !!api && !isFetching,
    // The backend advances rounds lazily on read, so poll history to surface
    // newly drawn rounds (winning number, basis, payouts) without user action.
    refetchInterval: poll ? 5000 : false,
  });
}

/** Draw result (basis + tier payouts) for a specific round. */
export function useDrawResult(
  round: bigint | null,
  { poll = true }: PollOptions = {},
) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.drawResult(round?.toString() ?? "none"),
    queryFn: async () => {
      if (!api || round === null) return null;
      return api.getDrawResult(round);
    },
    enabled: !!api && !isFetching && round !== null,
    // The backend advances rounds lazily on read, so poll the draw result too:
    // a newly completed draw must surface on its own without user interaction.
    refetchInterval: poll ? 5000 : false,
  });
}

/** The caller's own profile: balance, identity, cooldown, history counts. */
export function useMyProfile({ poll = true }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.profile,
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getMyProfile();
    },
    enabled: !!api && !isFetching,
    refetchInterval: poll ? 5000 : false,
  });
}

/**
 * One page of the caller's bet history, newest first.
 *
 * History is not live data, so this never polls: it fetches on mount and on
 * page change. `offset` is the page cursor returned as `nextOffset` by the
 * previous page; `limit` is capped by the backend at 50.
 */
export function useMyBetHistory(offset: number, limit: number) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.betHistory(offset, limit),
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getMyBetHistory(BigInt(offset), BigInt(limit));
    },
    enabled: !!api && !isFetching,
  });
}

/** One page of the caller's win history, newest first. Never polls. */
export function useMyWinHistory(offset: number, limit: number) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.winHistory(offset, limit),
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getMyWinHistory(BigInt(offset), BigInt(limit));
    },
    enabled: !!api && !isFetching,
  });
}

/** Exchange pool balances (Lucky + ICP). */
export function useExchangePool({ poll = true }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.exchangePool,
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getExchangePoolState();
    },
    enabled: !!api && !isFetching,
    refetchInterval: poll ? 8000 : false,
  });
}

/** DAO treasury balance in Lucky. */
export function useTreasuryBalance({ poll = true }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.treasury,
    queryFn: async () => {
      if (!api) return 0n;
      return api.getTreasuryBalance();
    },
    enabled: !!api && !isFetching,
    refetchInterval: poll ? 8000 : false,
  });
}

/**
 * Invalidate only the queries a write actually changes.
 *
 * A blanket `["game"]` invalidation refetched every mounted query at once,
 * producing a refetch storm after each action. Each mutation now names the
 * keys it affects; `state` and `profile` are always included because every
 * write moves the round pools and the caller's balance/cooldown.
 */
function invalidateGameData(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: readonly (readonly unknown[])[],
) {
  for (const queryKey of keys) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/** Keys every write touches: round pools + the caller's balance/cooldown. */
const WRITE_BASE_KEYS = [gameKeys.state, gameKeys.profile] as const;

/**
 * Place a bet (single or complex 复式) — 1 Lucky per ticket.
 *
 * A complex selection is submitted as its per-position structure: one array of
 * selected digits per position plus the per-position counts. The backend
 * expands the cartesian product itself, so the client never materializes the
 * combination list — a full 10×7 selection (10,000,000 tickets) stays O(1) in
 * client memory. The whole submission is one game action: one summed deduction
 * and a single 3-second cooldown, exactly like the batch `placeBets` path.
 */
export function usePlaceBet() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      selections,
      counts,
    }: {
      selections: Digit[][];
      counts: bigint[];
    }) => {
      if (!api) throw new Error("Backend is not ready");
      if (selections.length === 0) return undefined;
      return api.placeBetSelections(selections, counts);
    },
    onSuccess: () => {
      // A bet moves the round pools, the caller's balance/cooldown, the
      // top-bet ranking and the caller's own bet history. History is
      // invalidated by prefix so every mounted page variant refreshes.
      invalidateGameData(queryClient, [
        ...WRITE_BASE_KEYS,
        gameKeys.topBets,
        ["game", "betHistory"],
      ]);
    },
  });
}

/**
 * Whether the connected caller is an administrator of this app.
 *
 * Admin identity is the platform's application-level role (`#admin`), not the
 * canister-controller identity. This hook is the single authoritative gate for
 * every admin-only surface (the admin console, the guide editor, the dev tools
 * and the admin nav entry); it resolves through the platform-role seam
 * (`useCallerRole` / `isCallerAdmin`) so the UI model matches the backend's
 * role model. It is deliberately strict:
 *
 * - The query is keyed by the caller's principal, so a different identity can
 *   never reuse another identity's cached role result.
 * - `staleTime` is 0 and the query refetches on mount, so a value cached for a
 *   previous identity is never served to the current one.
 * - `isController` is `true` only when the backend has actually resolved the
 *   caller's role as `#admin`. While the check is loading, disabled, errored or
 *   unresolved it is `false`, so callers that gate on it fail closed.
 *
 * The hook name and return shape are kept for existing consumers; the value is
 * now role-based rather than controller-based.
 */
export function useIsCallerController(): {
  isController: boolean;
  isLoading: boolean;
} {
  const { isAdmin, isLoading } = useCallerRole();
  return { isController: isAdmin, isLoading };
}

/**
 * The caller's own platform role (`#admin` / `#user` / `#guest`).
 *
 * Keyed by the caller's principal with `staleTime` 0 and a refetch on mount,
 * so a role cached for one identity is never served to another. `role` is
 * `null` while unresolved, errored or disabled, so callers that gate on it
 * fail closed. This is the authoritative platform-role seam that
 * `useIsCallerController` resolves through.
 */
export function useCallerRole(): {
  role: UserRole | null;
  isAdmin: boolean;
  isLoading: boolean;
} {
  const { api, isFetching } = useGameApi();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toText() ?? "anonymous";

  const query = useQuery({
    queryKey: [...gameKeys.callerRole, principal],
    queryFn: async () => {
      if (!api) return null;
      return api.getCallerRole();
    },
    enabled: !!api && !isFetching,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const role = query.isError ? null : (query.data ?? null);
  const isAdmin = role === UserRole.admin;
  const isLoading = isFetching || query.isPending;

  return { role, isAdmin, isLoading };
}

/**
 * Every registered user with their current role. Admin-only; the backend
 * rejects non-admin callers, so the query is only enabled for admins. Keyed by
 * the caller's principal so a list cached for one admin is never shown to
 * another identity.
 */
export function useAdminUserList(enabled: boolean) {
  const { api, isFetching } = useGameApi();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toText() ?? "anonymous";

  return useQuery({
    queryKey: [...gameKeys.userList, principal],
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.listUsers();
    },
    enabled: enabled && !!api && !isFetching,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

/** Promote a user to `#admin`; refreshes the shared user list on success. */
export function usePromoteToAdmin() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user: Principal) => {
      if (!api) throw new Error("Backend is not ready");
      return api.promoteToAdmin(user);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, [gameKeys.userList]);
    },
  });
}

/** Demote an admin back to `#user`; refreshes the shared user list on success. */
export function useDemoteToUser() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user: Principal) => {
      if (!api) throw new Error("Backend is not ready");
      return api.demoteToUser(user);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, [gameKeys.userList]);
    },
  });
}

/** Credit the caller's own Lucky balance (admin only). */
export function useDevSeedBalance() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount: bigint) => {
      if (!api) throw new Error("Backend is not ready");
      return api.devSeedBalance(amount);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, WRITE_BASE_KEYS);
    },
  });
}

/** Fast-forward the current round to completion (admin only). */
export function useDevAdvanceRound() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.devAdvanceRound();
    },
    onSuccess: () => {
      // Advancing completes a round: the round state, the caller's balance,
      // the round history and the caller's win history all change. History is
      // invalidated by prefix so every mounted limit/page variant refreshes.
      invalidateGameData(queryClient, [
        ...WRITE_BASE_KEYS,
        ["game", "history"],
        ["game", "winHistory"],
      ]);
    },
  });
}

/** Set the current round's elapsed time in nanoseconds (admin only). */
export function useDevSetRoundElapsed() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (elapsedNs: bigint) => {
      if (!api) throw new Error("Backend is not ready");
      return api.devSetRoundElapsed(elapsedNs);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, WRITE_BASE_KEYS);
    },
  });
}

/** Contribute Lucky to a digit at a crowdfunding position (1-3). */
export function useContributeCrowdfund() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      position,
      digit,
      amount,
    }: {
      position: Position;
      digit: Digit;
      amount: Lucky;
    }) => {
      if (!api) throw new Error("Backend is not ready");
      return api.contributeCrowdfund(position, digit, amount);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, WRITE_BASE_KEYS);
    },
  });
}

/** Exchange ICP (e8s) for Lucky at the fixed 1 ICP = 1000 Lucky rate. */
export function useExchangeIcpToLucky() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (icpE8s: bigint) => {
      if (!api) throw new Error("Backend is not ready");
      return api.exchangeIcpToLucky(icpE8s);
    },
    onSuccess: () => {
      // An exchange moves the caller's balance and the shared exchange pool.
      invalidateGameData(queryClient, [
        ...WRITE_BASE_KEYS,
        gameKeys.exchangePool,
      ]);
    },
  });
}

/** Exchange Lucky for ICP at the fixed rate, with a 3% Lucky fee. */
export function useExchangeLuckyToIcp() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lucky: bigint) => {
      if (!api) throw new Error("Backend is not ready");
      return api.exchangeLuckyToIcp(lucky);
    },
    onSuccess: () => {
      // An exchange moves the caller's balance and the shared exchange pool.
      invalidateGameData(queryClient, [
        ...WRITE_BASE_KEYS,
        gameKeys.exchangePool,
      ]);
    },
  });
}

/** The caller's wallet balances: Lucky, real ICP (e8s) and the ledger fee. */
export function useWalletBalances({ poll = true }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.walletBalances,
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getWalletBalances();
    },
    enabled: !!api && !isFetching,
    refetchInterval: poll ? 8000 : false,
  });
}

/**
 * The caller's real Lucky ledger balance plus the ledger transfer fee.
 *
 * This reads the ICRC-1 ledger directly (`getLedgerBalance`), so the wallet
 * shows the same balance the ledger enforces on transfer — not the internal
 * game counter. It polls like the other wallet queries so an incoming transfer
 * surfaces without user action.
 */
export function useLedgerBalance({ poll = true }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.ledgerBalance,
    queryFn: async (): Promise<LedgerBalance> => {
      if (!api) throw new Error("Backend is not ready");
      return api.getLedgerBalance();
    },
    enabled: !!api && !isFetching,
    refetchInterval: poll ? 8000 : false,
  });
}

/** The caller's ICP deposit address (canister principal + per-user subaccount). */
export function useDepositAddress() {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.depositAddress,
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getDepositAddress();
    },
    enabled: !!api && !isFetching,
    staleTime: 60_000,
  });
}

/** The caller's most recent wallet transfers, newest first (bounded list). */
export function useRecentTransfers({ poll = true }: PollOptions = {}) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.recentTransfers,
    queryFn: async () => {
      if (!api) return [];
      return api.getRecentTransfers();
    },
    enabled: !!api && !isFetching,
    refetchInterval: poll ? 8000 : false,
  });
}

/** Keys a wallet transfer moves: balances, the transfer list and the profile. */
const WALLET_WRITE_KEYS = [
  gameKeys.walletBalances,
  gameKeys.ledgerBalance,
  gameKeys.recentTransfers,
  gameKeys.profile,
] as const;

/** Send ICP (e8s) to an arbitrary recipient principal. */
export function useTransferIcp() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recipient,
      amount,
    }: {
      recipient: Principal;
      amount: IcpE8s;
    }) => {
      if (!api) throw new Error("Backend is not ready");
      return api.transferIcp(recipient, amount);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, WALLET_WRITE_KEYS);
    },
  });
}

/** Send Lucky to another principal. */
export function useTransferLucky() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recipient,
      amount,
    }: {
      recipient: Principal;
      amount: Lucky;
    }) => {
      if (!api) throw new Error("Backend is not ready");
      return api.transferLucky(recipient, amount);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, WALLET_WRITE_KEYS);
    },
  });
}

/**
 * Transfer Lucky through the real ICRC-1 ledger.
 *
 * The caller's account is `{ owner: caller principal, subaccount: null }`, so
 * the transfer is signed by the connected identity and the ledger enforces the
 * balance. On success the returned block index is the ledger transaction that
 * records the transfer. The ledger balance, the wallet balances, the transfer
 * list and the profile all move, so every one is invalidated.
 */
export function useLedgerTransfer() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recipient,
      amount,
    }: {
      recipient: Principal;
      amount: Lucky;
    }): Promise<TransferResult> => {
      if (!api) throw new Error("Backend is not ready");
      const arg: TransferArg = {
        to: { owner: recipient },
        amount,
      };
      return api.icrc1_transfer(arg);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, WALLET_WRITE_KEYS);
    },
  });
}

/**
 * Admin console status: whether the next round is stopped and the current
 * balances of every withdrawable pool. Admin-only; the backend rejects
 * non-admin callers, so the query is only enabled for admins.
 */
export function useAdminStatus(enabled: boolean) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.adminStatus,
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getAdminStatus();
    },
    enabled: enabled && !!api && !isFetching,
    refetchInterval: enabled ? 10_000 : false,
  });
}

/**
 * Per-UTC-day statistics for the inclusive `fromDate..toDate` range
 * (`YYYY-MM-DD`): total bets, total payouts and treasury income. Admin only;
 * the backend rejects non-admin callers, so the query is only enabled for
 * admins. Days with no activity come back zero-filled, so the
 * UI never has to synthesize a missing day.
 */
export function useDailyStats(
  fromDate: string,
  toDate: string,
  enabled: boolean,
) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.dailyStats(fromDate, toDate),
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getDailyStats(fromDate, toDate);
    },
    enabled: enabled && !!api && !isFetching,
    staleTime: 30_000,
  });
}

/** Keys an admin write touches: round state, admin status and every pool. */
const ADMIN_WRITE_KEYS = [
  gameKeys.state,
  gameKeys.adminStatus,
  gameKeys.exchangePool,
  gameKeys.treasury,
  gameKeys.profile,
] as const;

/** Mark the current/next round as stopped so it accepts no bets or crowdfunds. */
export function useStopNextRound() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.stopNextRound();
    },
    onSuccess: () => {
      invalidateGameData(queryClient, ADMIN_WRITE_KEYS);
    },
  });
}

/** Resume a stopped round so betting and crowdfunding reopen. */
export function useResumeRound() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.resumeRound();
    },
    onSuccess: () => {
      invalidateGameData(queryClient, ADMIN_WRITE_KEYS);
    },
  });
}

/** Withdraw tokens from a pool to a recipient principal (admin only). */
export function useWithdrawFromPool() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pool,
      amount,
      recipient,
    }: {
      pool: AdminPool;
      amount: bigint;
      recipient: Principal;
    }) => {
      if (!api) throw new Error("Backend is not ready");
      return api.withdrawFromPool(pool, amount, recipient);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, ADMIN_WRITE_KEYS);
    },
  });
}

/**
 * Reset all game data (pools, player balances, history). Destructive and
 * irreversible; the caller must confirm before invoking.
 */
export function useResetGameData() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.resetGameData();
    },
    onSuccess: () => {
      // A reset clears every game-owned query, so invalidate the whole prefix.
      void queryClient.invalidateQueries({ queryKey: ["game"] });
    },
  });
}

/**
 * The admin-authored guide text. Read-only data, so it is fetched through a
 * query and never polls: it changes only when an admin saves it.
 */
export function useGuideText() {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.guideText,
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getGuideText();
    },
    enabled: !!api && !isFetching,
    staleTime: 60_000,
  });
}

/** Save the guide text (admin only); refreshes the shared guide query. */
export function useSetGuideText() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      if (!api) throw new Error("Backend is not ready");
      return api.setGuideText(text);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, [gameKeys.guideText]);
    },
  });
}

/**
 * The Lucky token snapshot for the admin token panel: metadata (name, symbol,
 * decimals, fee, logo data URL) plus the current total supply. Admin-only; the
 * backend rejects non-admin callers, so the query is only enabled for admins.
 */
export function useTokenInfo(enabled: boolean) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.tokenInfo,
    queryFn: async () => {
      if (!api) throw new Error("Backend is not ready");
      return api.getTokenInfo();
    },
    enabled: enabled && !!api && !isFetching,
    staleTime: 30_000,
  });
}

/**
 * A page of the ledger transaction log, newest first. Admin-only; the backend
 * rejects non-admin callers, so the query is only enabled for admins. The
 * backend returns blocks in ascending index order, so the caller reverses them
 * for a "recent transactions" view.
 */
export function useLedgerBlocks(
  start: bigint,
  length: bigint,
  enabled: boolean,
) {
  const { api, isFetching } = useGameApi();
  return useQuery({
    queryKey: gameKeys.ledgerBlocks(start, length),
    queryFn: async (): Promise<BlockPage> => {
      if (!api) throw new Error("Backend is not ready");
      return api.icrc3_get_blocks(start, length, null);
    },
    enabled: enabled && !!api && !isFetching,
    staleTime: 30_000,
  });
}

/**
 * Mint Lucky into a target account (admin only). On success the token snapshot
 * and the ledger transaction list both change, so both are invalidated.
 */
export function useMintLucky() {
  const { api } = useGameApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: MintArg): Promise<MintOutcome> => {
      if (!api) throw new Error("Backend is not ready");
      return api.mintLucky(arg);
    },
    onSuccess: () => {
      invalidateGameData(queryClient, [
        gameKeys.tokenInfo,
        ["game", "ledgerBlocks"],
      ]);
    },
  });
}

/**
 * Ticks once per second and returns the remaining milliseconds until `deadline`
 * (a backend nanosecond timestamp). Returns 0 once the deadline has passed.
 */
export function useCountdown(deadline: bigint | undefined): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (deadline === undefined) {
      setRemaining(0);
      return;
    }
    const targetMs = Number(deadline / 1_000_000n);
    const update = () => setRemaining(Math.max(0, targetMs - Date.now()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  return remaining;
}

/**
 * Tracks the 3-second inter-action cooldown from the profile's `lastActionAt`
 * and `actionCooldownMs`. Returns the remaining cooldown in milliseconds.
 *
 * `actionCooldownMs` is the cooldown still remaining at query time, not the
 * full duration, so it is anchored to the moment the profile was fetched
 * rather than added on top of `lastActionAt`.
 */
export function useActionCooldown(
  lastActionAt: bigint | undefined,
  cooldownMs: bigint | undefined,
): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (lastActionAt === undefined || cooldownMs === undefined) {
      setRemaining(0);
      return;
    }
    const durationMs = Number(cooldownMs);
    if (durationMs <= 0) {
      setRemaining(0);
      return;
    }
    const anchorMs = Date.now();
    const update = () =>
      setRemaining(Math.max(0, anchorMs + durationMs - Date.now()));
    update();
    const id = window.setInterval(update, 200);
    return () => window.clearInterval(id);
  }, [lastActionAt, cooldownMs]);

  return remaining;
}
