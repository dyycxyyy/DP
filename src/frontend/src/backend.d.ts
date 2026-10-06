import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Account {
    owner: Principal;
    subaccount?: Uint8Array;
}
export interface AdminPoolBalances {
    exchangeIcp: IcpE8s;
    prizePool: Lucky;
    treasury: Lucky;
    exchangeLucky: Lucky;
}
export type AdminResetOutcome = {
    __kind__: "ok";
    ok: AdminResetResult;
} | {
    __kind__: "err";
    err: GameError;
};
export interface AdminResetResult {
    playersCleared: bigint;
    round: bigint;
}
export type AdminRoleChangeOutcome = {
    __kind__: "ok";
    ok: AdminUserEntry;
} | {
    __kind__: "err";
    err: GameError;
};
export interface AdminStatus {
    roundStopped: boolean;
    balances: AdminPoolBalances;
}
export interface AdminUserEntry {
    principal: Principal;
    role: UserRole;
}
export type AdminUserListOutcome = {
    __kind__: "ok";
    ok: Array<AdminUserEntry>;
} | {
    __kind__: "err";
    err: GameError;
};
export type AdminWithdrawOutcome = {
    __kind__: "ok";
    ok: AdminWithdrawResult;
} | {
    __kind__: "err";
    err: GameError;
};
export interface AdminWithdrawResult {
    pool: AdminPool;
    recipient: Principal;
    remaining: bigint;
    amount: bigint;
}
export interface Allowance {
    allowance: Lucky;
    expires_at?: bigint;
}
export interface AllowanceArg {
    account: Account;
    spender: Account;
}
export interface ApproveArg {
    fee?: Lucky;
    memo?: Uint8Array;
    from_subaccount?: Uint8Array;
    created_at_time?: bigint;
    amount: Lucky;
    expected_allowance?: Lucky;
    expires_at?: bigint;
    spender: Account;
}
export type ApproveError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: Lucky;
    };
} | {
    __kind__: "AllowanceChanged";
    AllowanceChanged: {
        current_allowance: Lucky;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: bigint;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "Expired";
    Expired: {
        ledger_time: bigint;
    };
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: Lucky;
    };
};
export type ApproveResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: ApproveError;
};
export interface BetHistoryPage {
    total: bigint;
    nextOffset?: bigint;
    items: Array<BetRecord>;
}
export type BetNumber = Array<Digit>;
export interface BetRecord {
    cost: Lucky;
    ticketCount: bigint;
    placedAt: Timestamp;
    number: BetNumber;
    round: bigint;
}
export interface BlockPage {
    nextIndex?: bigint;
    transactions: Array<Transaction>;
}
export interface Cell {
    value: Value;
    name: string;
}
export interface DailyStats {
    totalBets: Lucky;
    totalPayouts: Lucky;
    treasuryIncome: Lucky;
}
export interface DailyStatsEntry {
    date: string;
    stats: DailyStats;
}
export type DailyStatsOutcome = {
    __kind__: "ok";
    ok: Array<DailyStatsEntry>;
} | {
    __kind__: "err";
    err: GameError;
};
export interface DepositAddress {
    owner: Principal;
    subaccount: Uint8Array;
    accountText: string;
}
export type Digit = bigint;
export interface DigitCrowdfund {
    thresholdReached: boolean;
    amount: Lucky;
    digit: Digit;
    reachedAt?: Timestamp;
}
export interface DrawResult {
    winningNumber: BetNumber;
    tiers: Array<TierResult>;
    callerTier?: bigint;
    callerWinnings: Lucky;
    round: bigint;
}
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export interface ExchangePoolState {
    luckyBalance: Lucky;
    icpBalance: IcpE8s;
}
export type GameError = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "insufficientBalance";
    insufficientBalance: {
        available: Lucky;
        required: Lucky;
    };
} | {
    __kind__: "ledgerUnavailable";
    ledgerUnavailable: {
        reason: string;
    };
} | {
    __kind__: "roundStopped";
    roundStopped: null;
} | {
    __kind__: "invalidPosition";
    invalidPosition: null;
} | {
    __kind__: "poolInsufficient";
    poolInsufficient: {
        token: string;
        available: bigint;
    };
} | {
    __kind__: "invalidBetNumber";
    invalidBetNumber: null;
} | {
    __kind__: "amountTooLarge";
    amountTooLarge: {
        max: bigint;
    };
} | {
    __kind__: "amountTooSmall";
    amountTooSmall: {
        min: bigint;
    };
} | {
    __kind__: "invalidRecipient";
    invalidRecipient: null;
} | {
    __kind__: "rateLimited";
    rateLimited: {
        remainingMs: bigint;
    };
} | {
    __kind__: "phaseClosed";
    phaseClosed: {
        required: Phase;
        current: Phase;
    };
} | {
    __kind__: "notRegistered";
    notRegistered: null;
} | {
    __kind__: "invalidAmount";
    invalidAmount: {
        step: bigint;
    };
} | {
    __kind__: "roundNotFound";
    roundNotFound: {
        round: bigint;
    };
};
export interface GameState {
    winningNumber?: BetNumber;
    crowdfundingDeadline: Timestamp;
    roundStopped: boolean;
    exchangePoolLucky: Lucky;
    exchangePoolIcp: IcpE8s;
    treasuryBalance: Lucky;
    crowdfundTotal: Lucky;
    phase: Phase;
    totalPrizePool: Lucky;
    positions: Array<PositionCrowdfund>;
    bettingDeadline: Timestamp;
    phaseDeadline: Timestamp;
    round: bigint;
}
export interface GuideText {
    text: string;
    isSet: boolean;
}
export type IcpE8s = bigint;
export interface LedgerBalance {
    fee: Lucky;
    balance: Lucky;
}
export type Lucky = bigint;
export interface MetadataEntry {
    key: string;
    value: MetadataValue;
}
export type MetadataValue = {
    __kind__: "Int";
    Int: bigint;
} | {
    __kind__: "Nat";
    Nat: bigint;
} | {
    __kind__: "Blob";
    Blob: Uint8Array;
} | {
    __kind__: "Text";
    Text: string;
};
export interface MigrateBalanceArg {
    owner: Principal;
    subaccount?: Uint8Array;
}
export type MigrateBalanceOutcome = {
    __kind__: "ok";
    ok: MigrateBalanceResult;
} | {
    __kind__: "err";
    err: GameError;
};
export interface MigrateBalanceResult {
    to: Account;
    totalSupply: Lucky;
    blockIndex: bigint;
    amount: Lucky;
}
export interface MintArg {
    to: Account;
    memo?: Uint8Array;
    amount: Lucky;
}
export type MintOutcome = {
    __kind__: "ok";
    ok: MintResult;
} | {
    __kind__: "err";
    err: GameError;
};
export interface MintResult {
    to: Account;
    totalSupply: Lucky;
    blockIndex: bigint;
    amount: Lucky;
}
export interface PlayerProfile {
    actionCooldownMs: bigint;
    luckyBalance: Lucky;
    lastActionAt: Timestamp;
    winCount: bigint;
    betCount: bigint;
    identity: PlayerIdentity;
}
export type Position = bigint;
export interface PositionBasis {
    winningAmount: Lucky;
    locked: boolean;
    winningDigit: Digit;
    digitAmounts: Array<Lucky>;
    position: Position;
}
export interface PositionCrowdfund {
    lockedDigit?: Digit;
    digits: Array<DigitCrowdfund>;
    leadingDigit: Digit;
    position: Position;
}
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type Result__1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export interface RoundHistoryEntry {
    winningNumber: BetNumber;
    totalDistributed: Lucky;
    crowdfundTotal: Lucky;
    totalPrizePool: Lucky;
    positions: Array<PositionBasis>;
    finishedAt: Timestamp;
    round: bigint;
}
export interface SupportedStandard {
    url: string;
    name: string;
}
export interface TierResult {
    distributed: Lucky;
    winningTickets: bigint;
    tier: bigint;
    payoutPerTicket: Lucky;
}
export type Timestamp = bigint;
export interface TokenInfo {
    metadata: TokenMetadata;
    totalSupply: Lucky;
}
export interface TokenMetadata {
    fee: Lucky;
    decimals: number;
    logo: string;
    name: string;
    symbol: string;
}
export interface TopBetNumber {
    ticketCount: bigint;
    number: BetNumber;
}
export interface Transaction {
    to?: Account;
    fee: Lucky;
    from?: Account;
    kind: TransactionKind;
    memo?: Uint8Array;
    timestamp: Timestamp;
    index: bigint;
    amount: Lucky;
}
export interface TransferArg {
    to: Account;
    fee?: Lucky;
    memo?: Uint8Array;
    from_subaccount?: Uint8Array;
    created_at_time?: bigint;
    amount: Lucky;
}
export type TransferError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "BadBurn";
    BadBurn: {
        min_burn_amount: Lucky;
    };
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: Lucky;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: bigint;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: Lucky;
    };
};
export interface TransferFromArg {
    to: Account;
    fee?: Lucky;
    spender_subaccount?: Uint8Array;
    from: Account;
    memo?: Uint8Array;
    created_at_time?: bigint;
    amount: Lucky;
}
export type TransferFromError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "InsufficientAllowance";
    InsufficientAllowance: {
        allowance: Lucky;
    };
} | {
    __kind__: "BadBurn";
    BadBurn: {
        min_burn_amount: Lucky;
    };
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: Lucky;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: bigint;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: Lucky;
    };
};
export type TransferFromResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TransferFromError;
};
export type TransferResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TransferError;
};
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export interface WalletBalances {
    icpFeeE8s: IcpE8s;
    icpE8s: IcpE8s;
    lucky: Lucky;
}
export interface WalletTransferRecord {
    id: bigint;
    fee: bigint;
    status: TransferStatus;
    direction: TransferDirection;
    asset: TransferAsset;
    createdAt: Timestamp;
    counterparty: Principal;
    amount: bigint;
}
export interface WinHistoryPage {
    total: bigint;
    nextOffset?: bigint;
    items: Array<WinRecord>;
}
export interface WinRecord {
    tier: bigint;
    claimedAt: Timestamp;
    number: BetNumber;
    round: bigint;
    payout: Lucky;
}
export enum AdminPool {
    exchangeIcp = "exchangeIcp",
    prizePool = "prizePool",
    treasury = "treasury",
    exchangeLucky = "exchangeLucky"
}
export enum Phase {
    betting = "betting",
    crowdfunding = "crowdfunding",
    payout = "payout",
    drawing = "drawing"
}
export enum PlayerIdentity {
    player = "player",
    manipulator = "manipulator",
    conspirator = "conspirator"
}
export enum TransactionKind {
    transferFrom = "transferFrom",
    mint = "mint",
    approve = "approve",
    transfer = "transfer"
}
export enum TransferAsset {
    icp = "icp",
    lucky = "lucky"
}
export enum TransferDirection {
    incoming = "incoming",
    outgoing = "outgoing"
}
export enum TransferStatus {
    pending = "pending",
    completed = "completed",
    failed = "failed"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    /**
     * / Contribute `amount` Lucky to `digit` at `position` (1-3). Crowdfunding
     * / phase only, positive integer multiple of 1, max 100_000 per call.
     */
    contributeCrowdfund(position: Position, digit: Digit, amount: Lucky): Promise<GameError>;
    /**
     * / Demote a user to `#user`. Admin only.
     */
    demoteToUser(user: Principal): Promise<AdminRoleChangeOutcome>;
    /**
     * / Fast-forward the round clock so the current round completes its full
     * / cycle. Admin only.
     */
    devAdvanceRound(): Promise<GameError>;
    /**
     * / Credit `amount` Lucky to the caller's own balance. Admin only.
     */
    devSeedBalance(amount: bigint): Promise<GameError>;
    /**
     * / Set the current round's elapsed time to `elapsedNs` for deterministic
     * / testing. Admin only.
     */
    devSetRoundElapsed(elapsedNs: bigint): Promise<GameError>;
    /**
     * / Exchange ICP (e8s) for Lucky at the fixed 1 ICP = 1000 Lucky rate.
     * / Minimum 0.1 ICP, must be a multiple of 0.1 ICP, max 10_000 ICP.
     */
    exchangeIcpToLucky(icpE8s: IcpE8s): Promise<GameError>;
    /**
     * / Exchange Lucky for ICP at the fixed rate. Amount must be a positive
     * / multiple of 1000, max 10_000_000 Lucky, with a 3% Lucky fee.
     */
    exchangeLuckyToIcp(luckyAmount: Lucky): Promise<GameError>;
    execute(qJson: string): Promise<Result>;
    /**
     * / Admin control snapshot: stopped flag and current pool balances.
     */
    getAdminStatus(): Promise<AdminStatus>;
    /**
     * / Markdown description of the public API: methods, authorization, units,
     * / round lifecycle, polling guidance, retry safety and error variants.
     */
    getApiDoc(): Promise<string>;
    /**
     * / The caller's own platform role.
     */
    getCallerRole(): Promise<UserRole>;
    getCallerUserRole(): Promise<UserRole>;
    /**
     * / Per-UTC-day statistics for the inclusive range `fromDate..toDate`
     * / (`YYYY-MM-DD`): total bets placed, total payouts distributed and treasury
     * / income from prize-pool cap overflow. Days with no activity are returned
     * / with zero values. Admin only; non-admins receive `#err`.
     */
    getDailyStats(fromDate: string, toDate: string): Promise<DailyStatsOutcome>;
    /**
     * / Caller's own ICP deposit address (canister principal + per-user
     * / subaccount) so the user can receive ICP.
     */
    getDepositAddress(): Promise<DepositAddress>;
    /**
     * / Draw result of a round: winning number, per-tier counts and payouts,
     * / and the caller's own winnings.
     */
    getDrawResult(round: bigint): Promise<DrawResult | null>;
    /**
     * / Current exchange pool balances (ICP in e8s, Lucky).
     */
    getExchangePoolState(): Promise<ExchangePoolState>;
    /**
     * / Current round state: round number, phase, deadlines, prize pool,
     * / crowdfund total, treasury, exchange pool and per-position crowdfund data.
     */
    getGameState(): Promise<GameState>;
    /**
     * / The saved guide text plus whether an admin has set one. Pure read.
     */
    getGuideText(): Promise<GuideText>;
    /**
     * / The caller's ledger balance plus the ledger fee.
     */
    getLedgerBalance(): Promise<LedgerBalance>;
    /**
     * / One page of the caller's bet history, newest first. `offset` skips that
     * / many newest records; `limit` is capped server-side.
     */
    getMyBetHistory(offset: bigint, limit: bigint): Promise<BetHistoryPage>;
    /**
     * / The caller's own bounded profile: Lucky balance, identity, last action
     * / timestamp, action cooldown, and total bet/win counts. History is read
     * / through the paginated endpoints below.
     */
    getMyProfile(): Promise<PlayerProfile>;
    /**
     * / One page of the caller's win history, newest first. `offset` skips that
     * / many newest records; `limit` is capped server-side.
     */
    getMyWinHistory(offset: bigint, limit: bigint): Promise<WinHistoryPage>;
    /**
     * / Caller's most recent wallet transfer records, newest first (bounded list).
     */
    getRecentTransfers(): Promise<Array<WalletTransferRecord>>;
    /**
     * / Recent completed rounds, newest first.
     */
    getRoundHistory(limit: bigint): Promise<Array<RoundHistoryEntry>>;
    /**
     * / Token snapshot for the admin token panel: metadata plus total supply.
     */
    getTokenInfo(): Promise<TokenInfo>;
    /**
     * / The top-10 most-bet numbers with their ticket counts.
     */
    getTopBetNumbers(): Promise<Array<TopBetNumber>>;
    /**
     * / Current DAO treasury balance in Lucky.
     */
    getTreasuryBalance(): Promise<Lucky>;
    /**
     * / Caller's wallet balances: Lucky plus the real ICP balance held by the
     * / canister on the ICP ledger, and the ledger transfer fee.
     */
    getWalletBalances(): Promise<WalletBalances>;
    /**
     * / Balance of one account.
     */
    icrc1_balance_of(account: Account): Promise<Lucky>;
    /**
     * / Number of decimals (0).
     */
    icrc1_decimals(): Promise<number>;
    /**
     * / Ledger transfer fee (0).
     */
    icrc1_fee(): Promise<Lucky>;
    /**
     * / Full ICRC-1 metadata map, including `icrc1:logo`.
     */
    icrc1_metadata(): Promise<Array<MetadataEntry>>;
    /**
     * / Token name (`Lucky`).
     */
    icrc1_name(): Promise<string>;
    /**
     * / The standards this ledger supports (ICRC-1 and ICRC-2).
     */
    icrc1_supported_standards(): Promise<Array<SupportedStandard>>;
    /**
     * / Token symbol (`LUCKY`).
     */
    icrc1_symbol(): Promise<string>;
    /**
     * / Cumulative minted supply (uncapped).
     */
    icrc1_total_supply(): Promise<Lucky>;
    /**
     * / Transfer Lucky from the caller's account to `arg.to`.
     */
    icrc1_transfer(arg: TransferArg): Promise<TransferResult>;
    /**
     * / Allowance of `arg.spender` over `arg.account`.
     */
    icrc2_allowance(arg: AllowanceArg): Promise<Allowance>;
    /**
     * / Grant `arg.spender` an allowance over the caller's account.
     */
    icrc2_approve(arg: ApproveArg): Promise<ApproveResult>;
    /**
     * / Move tokens from `arg.from` to `arg.to` under an allowance held by the
     * / caller as spender.
     */
    icrc2_transfer_from(arg: TransferFromArg): Promise<TransferFromResult>;
    /**
     * / A page of the ledger transaction log, optionally filtered to one account.
     */
    icrc3_get_blocks(start: bigint, length: bigint, account: Account | null): Promise<BlockPage>;
    isCallerAdmin(): Promise<boolean>;
    /**
     * / Deprecated alias: whether the caller is an admin (platform `#admin` role
     * / or canister controller). The frontend should prefer the package's
     * / `isCallerAdmin`.
     */
    isCallerController(): Promise<boolean>;
    /**
     * / List every registered user with their current role. Admin only.
     */
    listUsers(): Promise<AdminUserListOutcome>;
    /**
     * / Migrate one player's internal Lucky balance into the ledger. Admin only.
     */
    migrateInternalLucky(arg: MigrateBalanceArg): Promise<MigrateBalanceOutcome>;
    /**
     * / Mint `arg.amount` Lucky into `arg.to`. Admin only; uncapped.
     */
    mintLucky(arg: MintArg): Promise<MintOutcome>;
    /**
     * / Place `count` tickets on a 7-digit number. 1 Lucky per ticket, betting
     * / phase only.
     */
    placeBet(number_: BetNumber, count: bigint): Promise<GameError>;
    /**
     * / Place a complex (复式) bet from a per-position selection structure.
     * / `selections` holds one array of selected digits per position (7 positions)
     * / and `counts` the number of selected digits per position; the total ticket
     * / count is the product of the per-position counts. The backend expands the
     * / cartesian product itself, so the frontend never materializes it. One
     * / 3-second cooldown and one summed deduction, exactly like `placeBets`.
     */
    placeBetSelections(selections: Array<Array<Digit>>, counts: Array<bigint>): Promise<GameError>;
    /**
     * / Place several distinct 7-digit numbers in one call, each with its own
     * / ticket count. A complex (复式) submission is sent here as a single game
     * / action: one 3-second cooldown, one summed deduction into the prize pool.
     * / `numbers` and `counts` must be the same length; each count must be >= 1.
     */
    placeBets(numbers: Array<BetNumber>, counts: Array<bigint>): Promise<GameError>;
    /**
     * / Promote a user to `#admin`. Admin only.
     */
    promoteToAdmin(user: Principal): Promise<AdminRoleChangeOutcome>;
    /**
     * / Reset all game data back to its initial state. Admin only.
     */
    resetGameData(): Promise<AdminResetOutcome>;
    /**
     * / Resume a stopped round. Admin only.
     */
    resumeRound(): Promise<GameError>;
    schema(): Promise<string>;
    /**
     * / Save the guide text. Admin only.
     */
    setGuideText(text: string): Promise<GameError>;
    /**
     * / Stop the current/next round: no new bets and no crowdfund contributions
     * / until an admin resumes. Admin only.
     */
    stopNextRound(): Promise<GameError>;
    /**
     * / Send ICP (e8s) from the caller's balance to an arbitrary recipient
     * / principal, validating the balance and the ledger transfer fee.
     */
    transferIcp(recipient: Principal, amount: IcpE8s): Promise<GameError>;
    /**
     * / Transfer Lucky from the caller's balance to another principal.
     */
    transferLucky(recipient: Principal, amount: Lucky): Promise<GameError>;
    /**
     * / Withdraw `amount` from `pool` to `recipient`. Admin only.
     */
    withdrawFromPool(pool: AdminPool, amount: bigint, recipient: Principal): Promise<AdminWithdrawOutcome>;
}
