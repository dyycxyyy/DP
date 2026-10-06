/// Shared mutable actor state for the game, exchange and player domains.
/// Declared once in `main.mo` and passed by reference into every mixin so all
/// domains read and write the same values.
///
/// Performance contract additions:
/// - `GameState.topBets` is an incrementally maintained top-K structure so
///   `getTopBetNumbers` never sorts the whole tally map.
/// - `PlayerAccount.roundBets` / `roundWinnings` are per-round aggregates so
///   the draw and `getDrawResult` are O(players), not O(players x bets).
import Map "mo:core/Map";
import List "mo:core/List";
import Common "common";
import Admin "admin";
import Game "game";
import Wallet "wallet";
import LuckyLedger "lucky-ledger";

module {
  public type Lucky = Common.Lucky;
  public type Timestamp = Common.Timestamp;
  public type Digit = Common.Digit;
  public type BetNumber = Common.BetNumber;
  public type Position = Common.Position;
  public type PlayerIdentity = Common.PlayerIdentity;
  public type RoundHistoryEntry = Game.RoundHistoryEntry;

  /// Per-digit crowdfunding accumulator for one position of the current round.
  public type DigitFund = {
    var amount : Lucky;
    var reachedAt : ?Timestamp;
  };

  /// Crowdfunding accumulator for one position (1-3) of the current round.
  public type PositionFund = {
    var digits : [var DigitFund];
    var lockedDigit : ?Digit;
  };

  /// A player's account: balance, behaviour counters and history.
  public type PlayerAccount = {
    var luckyBalance : Lucky;
    var identity : PlayerIdentity;
    var lastActionAt : Timestamp;
    /// Rounds in which the player contributed to position 1.
    var roundsPos1 : Nat;
    /// Rounds in which the player contributed to position 2.
    var roundsPos2 : Nat;
    /// Rounds in which the player contributed to position 3.
    var roundsPos3 : Nat;
    /// Rounds in which the player contributed to more than one position.
    var multiPositionRounds : Nat;
    /// Last round in which the player contributed (to dedupe per-round counters).
    var lastCrowdfundRound : Nat;
    /// Positions contributed to in `lastCrowdfundRound` (bitmask 1..7).
    var lastCrowdfundMask : Nat;
    var betHistory : List.List<Game.BetRecord>;
    var winHistory : List.List<Game.WinRecord>;
    /// Per-round bet aggregate for the current round, keyed by round number.
    /// Replaced (not appended) when the player bets in a new round, so it holds
    /// at most one entry. Read by the draw to count winning tickets.
    var roundBets : Map.Map<Nat, Game.RoundBetAggregate>;
    /// Per-round payout credited to the player, keyed by round number. Bounded
    /// by a retention window; read by `getDrawResult` in O(1).
    var roundWinnings : Map.Map<Nat, Game.RoundWinnings>;
  };

  /// Stored draw result of a finished round.
  public type StoredDraw = {
    round : Nat;
    winningNumber : BetNumber;
    tiers : [Game.TierResult];
    totalDistributed : Lucky;
    finishedAt : Timestamp;
  };

  /// Incrementally maintained top-K most-bet numbers for the current round.
  /// `counts` mirrors the tally for the tracked candidates only; `order` is the
  /// current ranking (descending ticket count, ties by numeric value ascending).
  /// Updated on every bet so `getTopBetNumbers` is O(K) instead of sorting the
  /// whole tally.
  public type TopBets = {
    /// Ticket count per tracked candidate number.
    var counts : Map.Map<BetNumber, Nat>;
    /// Ranked candidates, best first, at most `TOP_K` entries.
    var order : List.List<BetNumber>;
  };

  /// The whole game state shared by every domain.
  public type GameState = {
    var round : Nat;
    var roundStart : Timestamp;
    var totalPrizePool : Lucky;
    var crowdfundTotal : Lucky;
    var treasuryBalance : Lucky;
    var exchangePoolIcp : Common.IcpE8s;
    var exchangePoolLucky : Lucky;
    var winningNumber : ?BetNumber;
    var positions : [var PositionFund];
    /// Per-number ticket tally for the current round, covering simple/batch
    /// bets only. Complex (复式) submissions are kept in `complexBets` and
    /// combined with this tally on the read path, so the tally never has to
    /// materialize a cartesian product.
    var tally : Map.Map<BetNumber, Nat>;
    /// Complex (复式) submissions placed in the current round, each stored as
    /// its bounded selection structure. Reset when the next round opens.
    var complexBets : List.List<Game.ComplexBet>;
    /// Incrementally maintained top-K most-bet numbers for the current round,
    /// covering simple/batch bets only; complex contributions are merged in on
    /// the read path.
    var topBets : TopBets;
    /// Draw results keyed by round number.
    var draws : Map.Map<Nat, StoredDraw>;
    /// Finished-round summaries, newest first.
    var history : List.List<RoundHistoryEntry>;
    /// Player accounts keyed by principal.
    var players : Map.Map<Principal, PlayerAccount>;
    /// Wallet transfer records keyed by principal, oldest-first per caller.
    /// Bounded on write; read newest-first by `getRecentTransfers`.
    var walletTransfers : Map.Map<Principal, List.List<Wallet.WalletTransferRecord>>;
    /// Monotonic id assigned to each wallet transfer record.
    var nextTransferId : Nat;
    /// True when an admin has stopped the current/next round. While set, no
    /// new bets and no crowdfund contributions are accepted.
    var roundStopped : Bool;
    /// Admin-editable guide text shown on the guide page. Empty until an admin
    /// saves one.
    var guideText : Text;
  /// Per-UTC-day aggregates keyed by `YYYY-MM-DD`: total bets placed, total
  /// payouts distributed and treasury income from prize-pool cap overflow.
  /// Updated at the mutation points (bet placement and draw/payout) so the
  /// totals are exact without scanning history. Preserved across
  /// `resetGameData` as historical records.
  var dailyStats : Map.Map<Text, Admin.DailyStats>;
  /// The Lucky ICRC-1 / ICRC-2 token ledger: per-account balances, ICRC-2
  /// allowances and the append-only ICRC-3 block log. Supply is uncapped and
  /// there is no burn.
  var luckyLedger : LuckyLedger.LedgerState;
};
};
