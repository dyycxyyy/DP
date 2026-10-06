import type {
  Account,
  AdminPoolBalances,
  AdminResetOutcome,
  AdminRoleChangeOutcome,
  AdminStatus,
  AdminUserEntry,
  AdminUserListOutcome,
  AdminWithdrawOutcome,
  BetHistoryPage,
  BetNumber,
  BetRecord,
  BlockPage,
  DailyStats,
  DailyStatsEntry,
  DailyStatsOutcome,
  DepositAddress,
  Digit,
  DrawResult,
  ExchangePoolState,
  GameError,
  GameState,
  GuideText,
  LedgerBalance,
  Lucky,
  MintOutcome,
  MintResult,
  PlayerProfile,
  Position,
  RoundHistoryEntry,
  TokenInfo,
  TokenMetadata,
  TopBetNumber,
  Transaction,
  TransferError,
  TransferResult,
  WalletBalances,
  WalletTransferRecord,
  WinHistoryPage,
  WinRecord,
} from "@/backend";
import {
  AdminPool,
  Phase,
  PlayerIdentity,
  TransactionKind,
  TransferAsset,
  TransferDirection,
  TransferStatus,
  UserRole,
} from "@/backend";
import type { GameApi } from "@/lib/api";
import { Principal } from "@icp-sdk/core/principal";
import { vi } from "vitest";

/** A 7-digit bet number from a string like "1234567". */
export function betNumber(value: string): BetNumber {
  return value.split("").map((d) => BigInt(d));
}

export function ok(): GameError {
  return { __kind__: "ok", ok: null };
}

export function phaseClosed(current: Phase, required: Phase): GameError {
  return { __kind__: "phaseClosed", phaseClosed: { current, required } };
}

export function rateLimited(remainingMs: bigint): GameError {
  return { __kind__: "rateLimited", rateLimited: { remainingMs } };
}

export function insufficientBalance(
  required: bigint,
  available: bigint,
): GameError {
  return {
    __kind__: "insufficientBalance",
    insufficientBalance: { required, available },
  };
}

export function poolInsufficient(token: string, available: bigint): GameError {
  return {
    __kind__: "poolInsufficient",
    poolInsufficient: { token, available },
  };
}

/** A crowdfund position with all ten digits at zero unless overridden. */
export function positionCrowdfund(
  position: number,
  overrides: {
    amounts?: Record<number, bigint>;
    leadingDigit?: number;
    lockedDigit?: number;
  } = {},
): GameState["positions"][number] {
  const amounts = overrides.amounts ?? {};
  return {
    position: BigInt(position),
    leadingDigit: BigInt(overrides.leadingDigit ?? 0),
    lockedDigit:
      overrides.lockedDigit === undefined
        ? undefined
        : BigInt(overrides.lockedDigit),
    digits: Array.from({ length: 10 }, (_, digit) => ({
      digit: BigInt(digit),
      amount: amounts[digit] ?? 0n,
      thresholdReached: (amounts[digit] ?? 0n) >= 100_000n,
      reachedAt: undefined,
    })),
  };
}

export function gameState(overrides: Partial<GameState> = {}): GameState {
  return {
    round: 1n,
    phase: Phase.betting,
    phaseDeadline: BigInt(Date.now() + 300_000) * 1_000_000n,
    bettingDeadline: BigInt(Date.now() + 300_000) * 1_000_000n,
    crowdfundingDeadline: BigInt(Date.now() + 480_000) * 1_000_000n,
    totalPrizePool: 0n,
    crowdfundTotal: 0n,
    treasuryBalance: 0n,
    exchangePoolIcp: 0n,
    exchangePoolLucky: 0n,
    roundStopped: false,
    winningNumber: undefined,
    positions: [
      positionCrowdfund(1),
      positionCrowdfund(2),
      positionCrowdfund(3),
    ],
    ...overrides,
  };
}

export function playerProfile(
  overrides: Partial<PlayerProfile> = {},
): PlayerProfile {
  return {
    luckyBalance: 0n,
    identity: PlayerIdentity.player,
    lastActionAt: 0n,
    actionCooldownMs: 0n,
    betCount: 0n,
    winCount: 0n,
    ...overrides,
  };
}

export function exchangePool(
  overrides: Partial<ExchangePoolState> = {},
): ExchangePoolState {
  return {
    luckyBalance: 0n,
    icpBalance: 0n,
    ...overrides,
  };
}

/** The admin console's four pool balances, all zero unless overridden. */
export function adminPoolBalances(
  overrides: Partial<AdminPoolBalances> = {},
): AdminPoolBalances {
  return {
    prizePool: 0n,
    treasury: 0n,
    exchangeLucky: 0n,
    exchangeIcp: 0n,
    ...overrides,
  };
}

/** One day's aggregated statistics, all zero unless overridden. */
export function dailyStats(overrides: Partial<DailyStats> = {}): DailyStats {
  return { totalBets: 0n, totalPayouts: 0n, treasuryIncome: 0n, ...overrides };
}

/** One dated daily-statistics entry. */
export function dailyStatsEntry(
  date: string,
  overrides: Partial<DailyStats> = {},
): DailyStatsEntry {
  return { date, stats: dailyStats(overrides) };
}

/** A successful daily-statistics outcome for the given days. */
export function dailyStatsOk(
  entries: DailyStatsEntry[] = [],
): DailyStatsOutcome {
  return { __kind__: "ok", ok: entries };
}

/** A failed daily-statistics outcome carrying a backend error. */
export function dailyStatsErr(err: GameError): DailyStatsOutcome {
  return { __kind__: "err", err };
}

/** The admin status snapshot: round gate plus pool balances. */
export function adminStatus(overrides: Partial<AdminStatus> = {}): AdminStatus {
  return {
    roundStopped: false,
    balances: adminPoolBalances(),
    ...overrides,
  };
}

/** A successful pool withdrawal outcome. */
export function adminWithdrawOk(
  overrides: Partial<{
    pool: AdminPool;
    recipient: Principal;
    remaining: bigint;
    amount: bigint;
  }> = {},
): AdminWithdrawOutcome {
  return {
    __kind__: "ok",
    ok: {
      pool: overrides.pool ?? AdminPool.prizePool,
      recipient: overrides.recipient ?? Principal.fromText("aaaaa-aa"),
      remaining: overrides.remaining ?? 0n,
      amount: overrides.amount ?? 0n,
    },
  };
}

/** A successful game-data reset outcome. */
export function adminResetOk(
  overrides: Partial<{ playersCleared: bigint; round: bigint }> = {},
): AdminResetOutcome {
  return {
    __kind__: "ok",
    ok: {
      playersCleared: overrides.playersCleared ?? 0n,
      round: overrides.round ?? 1n,
    },
  };
}

/** The admin-authored guide document. */
export function guideText(overrides: Partial<GuideText> = {}): GuideText {
  return { text: "", isSet: false, ...overrides };
}

/** One registered user with their platform role, as `listUsers` returns it. */
export function adminUserEntry(
  principal: Principal,
  role: UserRole = UserRole.user,
): AdminUserEntry {
  return { principal, role };
}

/** A successful user-list outcome for the given entries. */
export function adminUserListOk(
  entries: AdminUserEntry[] = [],
): AdminUserListOutcome {
  return { __kind__: "ok", ok: entries };
}

/** A failed user-list outcome carrying a backend error. */
export function adminUserListErr(err: GameError): AdminUserListOutcome {
  return { __kind__: "err", err };
}

/** A successful role-change outcome for the given user and resulting role. */
export function adminRoleChangeOk(
  principal: Principal,
  role: UserRole,
): AdminRoleChangeOutcome {
  return { __kind__: "ok", ok: { principal, role } };
}

/** A failed role-change outcome carrying a backend error. */
export function adminRoleChangeErr(err: GameError): AdminRoleChangeOutcome {
  return { __kind__: "err", err };
}

export function drawResult(overrides: Partial<DrawResult> = {}): DrawResult {
  return {
    round: 1n,
    winningNumber: betNumber("1234567"),
    tiers: [],
    callerWinnings: 0n,
    callerTier: undefined,
    ...overrides,
  };
}

export function roundHistoryEntry(
  overrides: Partial<RoundHistoryEntry> = {},
): RoundHistoryEntry {
  return {
    round: 1n,
    winningNumber: betNumber("1234567"),
    totalPrizePool: 0n,
    crowdfundTotal: 0n,
    totalDistributed: 0n,
    finishedAt: 0n,
    positions: [],
    ...overrides,
  };
}

export function topBetNumber(value: string, ticketCount: bigint): TopBetNumber {
  return { number: betNumber(value), ticketCount };
}

/** One bet-history record as the paginated `getMyBetHistory` returns it. */
export function betRecord(overrides: Partial<BetRecord> = {}): BetRecord {
  return {
    number: betNumber("1234567"),
    round: 1n,
    cost: 1n,
    ticketCount: 1n,
    placedAt: 0n,
    ...overrides,
  };
}

/** One win-history record as the paginated `getMyWinHistory` returns it. */
export function winRecord(overrides: Partial<WinRecord> = {}): WinRecord {
  return {
    number: betNumber("1234567"),
    round: 1n,
    tier: 3n,
    payout: 500n,
    claimedAt: 0n,
    ...overrides,
  };
}

/** A page of bet history with an explicit cursor. */
export function betHistoryPage(
  overrides: Partial<BetHistoryPage> = {},
): BetHistoryPage {
  return { items: [], total: 0n, ...overrides };
}

/** A page of win history with an explicit cursor. */
export function winHistoryPage(
  overrides: Partial<WinHistoryPage> = {},
): WinHistoryPage {
  return { items: [], total: 0n, ...overrides };
}

/** The caller's wallet snapshot: Lucky, real ICP (e8s) and the ledger fee. */
export function walletBalances(
  overrides: Partial<WalletBalances> = {},
): WalletBalances {
  return { lucky: 0n, icpE8s: 0n, icpFeeE8s: 10_000n, ...overrides };
}

/** The caller's ICP deposit address (canister principal + per-user subaccount). */
export function depositAddress(
  overrides: Partial<DepositAddress> = {},
): DepositAddress {
  return {
    owner: Principal.fromText("aaaaa-aa"),
    subaccount: new Uint8Array(32),
    accountText:
      "aaaaa-aa-0000000000000000000000000000000000000000000000000000000000000000",
    ...overrides,
  };
}

/** One wallet transfer record as `getRecentTransfers` returns it. */
export function walletTransferRecord(
  overrides: Partial<WalletTransferRecord> = {},
): WalletTransferRecord {
  return {
    id: 1n,
    asset: TransferAsset.icp,
    direction: TransferDirection.outgoing,
    amount: 100_000_000n,
    fee: 10_000n,
    counterparty: Principal.fromText("aaaaa-aa"),
    status: TransferStatus.completed,
    createdAt: 0n,
    ...overrides,
  };
}

/** The Lucky token metadata as `getTokenInfo` returns it. */
export function tokenMetadata(
  overrides: Partial<TokenMetadata> = {},
): TokenMetadata {
  return {
    name: "Lucky",
    symbol: "LUCKY",
    decimals: 0,
    fee: 0n,
    logo: "data:image/svg+xml;base64,PHN2Zy8+",
    ...overrides,
  };
}

/** The admin token-panel snapshot: metadata plus the current total supply. */
export function tokenInfo(overrides: Partial<TokenInfo> = {}): TokenInfo {
  return { metadata: tokenMetadata(), totalSupply: 0n, ...overrides };
}

/** A successful admin mint outcome. */
export function mintOk(overrides: Partial<MintResult> = {}): MintOutcome {
  return {
    __kind__: "ok",
    ok: {
      blockIndex: overrides.blockIndex ?? 0n,
      totalSupply: overrides.totalSupply ?? 0n,
      to: overrides.to ?? { owner: Principal.fromText("aaaaa-aa") },
      amount: overrides.amount ?? 0n,
    },
  };
}

/** A failed admin mint outcome carrying a backend error. */
export function mintErr(err: GameError): MintOutcome {
  return { __kind__: "err", err };
}

/** The caller's ledger view: Lucky balance plus the ledger fee. */
export function ledgerBalance(
  overrides: Partial<LedgerBalance> = {},
): LedgerBalance {
  return { balance: 0n, fee: 0n, ...overrides };
}

/** One ledger transaction as `icrc3_get_blocks` returns it. */
export function ledgerTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    index: 0n,
    timestamp: 0n,
    from: undefined,
    to: { owner: Principal.fromText("aaaaa-aa") },
    amount: 0n,
    fee: 0n,
    memo: undefined,
    kind: TransactionKind.mint,
    ...overrides,
  };
}

/** A page of the ICRC-3 block log. */
export function blockPage(overrides: Partial<BlockPage> = {}): BlockPage {
  return { transactions: [], nextIndex: undefined, ...overrides };
}

/** A successful ICRC-1 transfer result carrying the new block index. */
export function transferOk(blockIndex = 0n): TransferResult {
  return { __kind__: "Ok", Ok: blockIndex };
}

/** A failed ICRC-1 transfer result. */
export function transferErr(err: TransferError): TransferResult {
  return { __kind__: "Err", Err: err };
}

/** An ICRC-1 account with no subaccount unless overridden. */
export function account(overrides: Partial<Account> = {}): Account {
  return { owner: Principal.fromText("aaaaa-aa"), ...overrides };
}

/**
 * A fully typed in-memory fake of the backend actor surface the UI consumes.
 *
 * Every method is a `vi.fn` so tests can assert on the exact calls the UI made
 * and override return values per test. This is a local mock: it proves the
 * frontend's contract with the actor, never the real canister's behavior.
 */
export interface FakeActor extends GameApi {
  getGameState: ReturnType<typeof vi.fn>;
  getTopBetNumbers: ReturnType<typeof vi.fn>;
  getDrawResult: ReturnType<typeof vi.fn>;
  getRoundHistory: ReturnType<typeof vi.fn>;
  getExchangePoolState: ReturnType<typeof vi.fn>;
  getTreasuryBalance: ReturnType<typeof vi.fn>;
  getMyProfile: ReturnType<typeof vi.fn>;
  getMyBetHistory: ReturnType<typeof vi.fn>;
  getMyWinHistory: ReturnType<typeof vi.fn>;
  placeBet: ReturnType<typeof vi.fn>;
  placeBets: ReturnType<typeof vi.fn>;
  placeBetSelections: ReturnType<typeof vi.fn>;
  contributeCrowdfund: ReturnType<typeof vi.fn>;
  exchangeIcpToLucky: ReturnType<typeof vi.fn>;
  exchangeLuckyToIcp: ReturnType<typeof vi.fn>;
  getWalletBalances: ReturnType<typeof vi.fn>;
  getDepositAddress: ReturnType<typeof vi.fn>;
  getRecentTransfers: ReturnType<typeof vi.fn>;
  transferIcp: ReturnType<typeof vi.fn>;
  transferLucky: ReturnType<typeof vi.fn>;
  isCallerController: ReturnType<typeof vi.fn>;
  isCallerAdmin: ReturnType<typeof vi.fn>;
  getCallerRole: ReturnType<typeof vi.fn>;
  listUsers: ReturnType<typeof vi.fn>;
  promoteToAdmin: ReturnType<typeof vi.fn>;
  demoteToUser: ReturnType<typeof vi.fn>;
  getAdminStatus: ReturnType<typeof vi.fn>;
  getDailyStats: ReturnType<typeof vi.fn>;
  stopNextRound: ReturnType<typeof vi.fn>;
  resumeRound: ReturnType<typeof vi.fn>;
  withdrawFromPool: ReturnType<typeof vi.fn>;
  resetGameData: ReturnType<typeof vi.fn>;
  getGuideText: ReturnType<typeof vi.fn>;
  setGuideText: ReturnType<typeof vi.fn>;
  devSeedBalance: ReturnType<typeof vi.fn>;
  devAdvanceRound: ReturnType<typeof vi.fn>;
  devSetRoundElapsed: ReturnType<typeof vi.fn>;
  getTokenInfo: ReturnType<typeof vi.fn>;
  mintLucky: ReturnType<typeof vi.fn>;
  getLedgerBalance: ReturnType<typeof vi.fn>;
  icrc1_transfer: ReturnType<typeof vi.fn>;
  icrc3_get_blocks: ReturnType<typeof vi.fn>;
}

export function createFakeActor(overrides: Partial<GameApi> = {}): FakeActor {
  const actor = {
    getGameState: vi.fn(async () => gameState()),
    getTopBetNumbers: vi.fn(async () => [] as TopBetNumber[]),
    getDrawResult: vi.fn(async () => null as DrawResult | null),
    getRoundHistory: vi.fn(async () => [] as RoundHistoryEntry[]),
    getExchangePoolState: vi.fn(async () => exchangePool()),
    getTreasuryBalance: vi.fn(async () => 0n as Lucky),
    getMyProfile: vi.fn(async () => playerProfile()),
    getMyBetHistory: vi.fn(
      async () => ({ total: 0n, items: [] }) as BetHistoryPage,
    ),
    getMyWinHistory: vi.fn(
      async () => ({ total: 0n, items: [] }) as WinHistoryPage,
    ),
    placeBet: vi.fn(async () => ok()),
    placeBets: vi.fn(async () => ok()),
    placeBetSelections: vi.fn(async () => ok()),
    contributeCrowdfund: vi.fn(async () => ok()),
    exchangeIcpToLucky: vi.fn(async () => ok()),
    exchangeLuckyToIcp: vi.fn(async () => ok()),
    getWalletBalances: vi.fn(async () => walletBalances()),
    getDepositAddress: vi.fn(async () => depositAddress()),
    getRecentTransfers: vi.fn(async () => [] as WalletTransferRecord[]),
    transferIcp: vi.fn(async () => ok()),
    transferLucky: vi.fn(async () => ok()),
    isCallerController: vi.fn(async () => false),
    isCallerAdmin: vi.fn(async () => false),
    getCallerRole: vi.fn(async () => UserRole.guest),
    listUsers: vi.fn(async () => adminUserListOk()),
    promoteToAdmin: vi.fn(async (user: Principal) =>
      adminRoleChangeOk(user, UserRole.admin),
    ),
    demoteToUser: vi.fn(async (user: Principal) =>
      adminRoleChangeOk(user, UserRole.user),
    ),
    getAdminStatus: vi.fn(async () => adminStatus()),
    getDailyStats: vi.fn(async () => dailyStatsOk()),
    stopNextRound: vi.fn(async () => ok()),
    resumeRound: vi.fn(async () => ok()),
    withdrawFromPool: vi.fn(async () => adminWithdrawOk()),
    resetGameData: vi.fn(async () => adminResetOk()),
    getGuideText: vi.fn(async () => guideText()),
    setGuideText: vi.fn(async () => ok()),
    devSeedBalance: vi.fn(async () => ok()),
    devAdvanceRound: vi.fn(async () => ok()),
    devSetRoundElapsed: vi.fn(async () => ok()),
    getTokenInfo: vi.fn(async () => tokenInfo()),
    mintLucky: vi.fn(async () => mintOk()),
    getLedgerBalance: vi.fn(async () => ledgerBalance()),
    icrc1_transfer: vi.fn(async () => transferOk()),
    icrc3_get_blocks: vi.fn(async () => blockPage()),
    ...overrides,
  };
  return actor as unknown as FakeActor;
}

export type { BetNumber, Digit, Position };
