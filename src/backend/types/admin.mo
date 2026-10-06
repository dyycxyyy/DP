/// Types for the super-admin control surface.
///
/// Every endpoint in this domain is gated on the platform application-level
/// `#admin` role (with canister-controller recovery), so ordinary users can
/// never stop a round, withdraw pool funds or reset game data. The types are
/// additive and change no existing business type.
import Common "common";

module {
  public type Lucky = Common.Lucky;
  public type IcpE8s = Common.IcpE8s;
  public type GameError = Common.GameError;

  /// A withdrawable pool of the game.
  public type AdminPool = {
    /// The total prize pool (Lucky).
    #prizePool;
    /// The DAO treasury (Lucky).
    #treasury;
    /// The exchange pool's Lucky balance.
    #exchangeLucky;
    /// The exchange pool's ICP balance (e8s).
    #exchangeIcp;
  };

  /// Current balances of every withdrawable pool, shown before a withdrawal.
  public type AdminPoolBalances = {
    prizePool : Lucky;
    treasury : Lucky;
    exchangeLucky : Lucky;
    exchangeIcp : IcpE8s;
  };

  /// Result of a successful admin withdrawal.
  public type AdminWithdrawResult = {
    /// The pool the tokens were taken from.
    pool : AdminPool;
    /// Amount withdrawn, in the pool's base unit (Lucky, or e8s for ICP).
    amount : Nat;
    /// Recipient principal that received the tokens.
    recipient : Principal;
    /// Remaining balance of the pool after the withdrawal.
    remaining : Nat;
  };

  /// Result of a successful game-data reset.
  public type AdminResetResult = {
    /// The round number the game restarted at.
    round : Nat;
    /// Number of player accounts cleared.
    playersCleared : Nat;
  };

  /// Outcome of an admin withdrawal: the withdrawal details on success, or the
  /// shared error surface on failure.
  public type AdminWithdrawOutcome = {
    #ok : AdminWithdrawResult;
    #err : GameError;
  };

  /// Outcome of an admin game-data reset: the reset details on success, or the
  /// shared error surface on failure.
  public type AdminResetOutcome = {
    #ok : AdminResetResult;
    #err : GameError;
  };

  /// Admin control snapshot: whether the next round is stopped and the current
  /// pool balances.
  public type AdminStatus = {
    /// True when the current/next round is stopped (no bets, no crowdfund).
    roundStopped : Bool;
    /// Current balances of every withdrawable pool.
    balances : AdminPoolBalances;
  };

  /// Per-UTC-day aggregate of game activity, keyed by `YYYY-MM-DD`.
  public type DailyStats = {
    /// Sum of all player ticket costs placed on that UTC day (Lucky).
    totalBets : Lucky;
    /// Sum of all payouts distributed on that UTC day (Lucky).
    totalPayouts : Lucky;
    /// Amount moved into the treasury from prize-pool cap overflow on that
    /// UTC day (Lucky).
    treasuryIncome : Lucky;
  };

  /// One day's aggregate paired with its `YYYY-MM-DD` key.
  public type DailyStatsEntry = {
    /// UTC day key, `YYYY-MM-DD`.
    date : Text;
    /// Aggregates for that day.
    stats : DailyStats;
  };

  /// Outcome of a daily-stats read: the requested days on success, or the
  /// shared error surface when the caller is not a controller.
  public type DailyStatsOutcome = {
    #ok : [DailyStatsEntry];
    #err : GameError;
  };
};
