import type {
  Account,
  AdminPool,
  AdminResetOutcome,
  AdminRoleChangeOutcome,
  AdminStatus,
  AdminUserListOutcome,
  AdminWithdrawOutcome,
  BetHistoryPage,
  BetNumber,
  BlockPage,
  DailyStatsOutcome,
  DepositAddress,
  Digit,
  DrawResult,
  ExchangePoolState,
  GameError,
  GameState,
  GuideText,
  IcpE8s,
  LedgerBalance,
  Lucky,
  MintArg,
  MintOutcome,
  PlayerProfile,
  Position,
  RoundHistoryEntry,
  TokenInfo,
  TopBetNumber,
  TransferArg,
  TransferResult,
  UserRole,
  WalletBalances,
  WalletTransferRecord,
  WinHistoryPage,
} from "@/backend";
import type { Principal } from "@icp-sdk/core/principal";

/**
 * The single seam between the UI and the generated backend actor.
 *
 * Every backend call the UI makes is declared here so that when the backend
 * implementation lands (or a method signature shifts), only this module needs
 * to be reconciled. Components and hooks never call `actor.*` directly.
 */
export interface GameApi {
  getGameState(): Promise<GameState>;
  getTopBetNumbers(): Promise<TopBetNumber[]>;
  getDrawResult(round: bigint): Promise<DrawResult | null>;
  getRoundHistory(limit: bigint): Promise<RoundHistoryEntry[]>;
  getExchangePoolState(): Promise<ExchangePoolState>;
  getTreasuryBalance(): Promise<Lucky>;
  getMyProfile(): Promise<PlayerProfile>;
  getMyBetHistory(offset: bigint, limit: bigint): Promise<BetHistoryPage>;
  getMyWinHistory(offset: bigint, limit: bigint): Promise<WinHistoryPage>;
  placeBet(number: BetNumber, count: bigint): Promise<GameError>;
  placeBets(numbers: BetNumber[], counts: bigint[]): Promise<GameError>;
  placeBetSelections(
    selections: Digit[][],
    counts: bigint[],
  ): Promise<GameError>;
  contributeCrowdfund(
    position: Position,
    digit: Digit,
    amount: Lucky,
  ): Promise<GameError>;
  exchangeIcpToLucky(icpE8s: bigint): Promise<GameError>;
  exchangeLuckyToIcp(lucky: Lucky): Promise<GameError>;
  getWalletBalances(): Promise<WalletBalances>;
  getDepositAddress(): Promise<DepositAddress>;
  getRecentTransfers(): Promise<WalletTransferRecord[]>;
  transferIcp(recipient: Principal, amount: IcpE8s): Promise<GameError>;
  transferLucky(recipient: Principal, amount: Lucky): Promise<GameError>;
  isCallerController(): Promise<boolean>;
  isCallerAdmin(): Promise<boolean>;
  getCallerRole(): Promise<UserRole>;
  listUsers(): Promise<AdminUserListOutcome>;
  promoteToAdmin(user: Principal): Promise<AdminRoleChangeOutcome>;
  demoteToUser(user: Principal): Promise<AdminRoleChangeOutcome>;
  getAdminStatus(): Promise<AdminStatus>;
  getDailyStats(fromDate: string, toDate: string): Promise<DailyStatsOutcome>;
  stopNextRound(): Promise<GameError>;
  resumeRound(): Promise<GameError>;
  withdrawFromPool(
    pool: AdminPool,
    amount: bigint,
    recipient: Principal,
  ): Promise<AdminWithdrawOutcome>;
  resetGameData(): Promise<AdminResetOutcome>;
  getGuideText(): Promise<GuideText>;
  setGuideText(text: string): Promise<GameError>;
  devSeedBalance(amount: bigint): Promise<GameError>;
  devAdvanceRound(): Promise<GameError>;
  devSetRoundElapsed(elapsedNs: bigint): Promise<GameError>;
  getTokenInfo(): Promise<TokenInfo>;
  mintLucky(arg: MintArg): Promise<MintOutcome>;
  getLedgerBalance(): Promise<LedgerBalance>;
  icrc1_transfer(arg: TransferArg): Promise<TransferResult>;
  icrc3_get_blocks(
    start: bigint,
    length: bigint,
    account: Account | null,
  ): Promise<BlockPage>;
}

/** The subset of the generated `Backend` actor that the game UI depends on. */
export type GameActor = GameApi;

/** Wrap a generated actor in the stable UI-facing API surface. */
export function createGameApi(actor: GameActor): GameApi {
  return {
    getGameState: () => actor.getGameState(),
    getTopBetNumbers: () => actor.getTopBetNumbers(),
    getDrawResult: (round) => actor.getDrawResult(round),
    getRoundHistory: (limit) => actor.getRoundHistory(limit),
    getExchangePoolState: () => actor.getExchangePoolState(),
    getTreasuryBalance: () => actor.getTreasuryBalance(),
    getMyProfile: () => actor.getMyProfile(),
    getMyBetHistory: (offset, limit) => actor.getMyBetHistory(offset, limit),
    getMyWinHistory: (offset, limit) => actor.getMyWinHistory(offset, limit),
    placeBet: (number, count) => actor.placeBet(number, count),
    placeBets: (numbers, counts) => actor.placeBets(numbers, counts),
    placeBetSelections: (selections, counts) =>
      actor.placeBetSelections(selections, counts),
    contributeCrowdfund: (position, digit, amount) =>
      actor.contributeCrowdfund(position, digit, amount),
    exchangeIcpToLucky: (icpE8s) => actor.exchangeIcpToLucky(icpE8s),
    exchangeLuckyToIcp: (lucky) => actor.exchangeLuckyToIcp(lucky),
    getWalletBalances: () => actor.getWalletBalances(),
    getDepositAddress: () => actor.getDepositAddress(),
    getRecentTransfers: () => actor.getRecentTransfers(),
    transferIcp: (recipient, amount) => actor.transferIcp(recipient, amount),
    transferLucky: (recipient, amount) =>
      actor.transferLucky(recipient, amount),
    isCallerController: () => actor.isCallerController(),
    isCallerAdmin: () => actor.isCallerAdmin(),
    getCallerRole: () => actor.getCallerRole(),
    listUsers: () => actor.listUsers(),
    promoteToAdmin: (user) => actor.promoteToAdmin(user),
    demoteToUser: (user) => actor.demoteToUser(user),
    getAdminStatus: () => actor.getAdminStatus(),
    getDailyStats: (fromDate, toDate) => actor.getDailyStats(fromDate, toDate),
    stopNextRound: () => actor.stopNextRound(),
    resumeRound: () => actor.resumeRound(),
    withdrawFromPool: (pool, amount, recipient) =>
      actor.withdrawFromPool(pool, amount, recipient),
    resetGameData: () => actor.resetGameData(),
    getGuideText: () => actor.getGuideText(),
    setGuideText: (text) => actor.setGuideText(text),
    devSeedBalance: (amount) => actor.devSeedBalance(amount),
    devAdvanceRound: () => actor.devAdvanceRound(),
    devSetRoundElapsed: (elapsedNs) => actor.devSetRoundElapsed(elapsedNs),
    getTokenInfo: () => actor.getTokenInfo(),
    mintLucky: (arg) => actor.mintLucky(arg),
    getLedgerBalance: () => actor.getLedgerBalance(),
    icrc1_transfer: (arg) => actor.icrc1_transfer(arg),
    icrc3_get_blocks: (start, length, account) =>
      actor.icrc3_get_blocks(start, length, account),
  };
}

/** True when the backend reported success (GameError is only returned on failure). */
export function isGameError(value: unknown): value is GameError {
  return (
    typeof value === "object" &&
    value !== null &&
    "__kind__" in value &&
    typeof (value as { __kind__: unknown }).__kind__ === "string"
  );
}
