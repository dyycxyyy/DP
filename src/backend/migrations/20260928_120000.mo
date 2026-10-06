import AccessControl "mo:caffeineai-authorization/access-control";
import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import VarArray "mo:core/VarArray";

module {
  // ---- Inlined state types (migrations must be self-contained) -----------

  type Lucky = Nat;
  type IcpE8s = Nat;
  type Timestamp = Int;
  type Digit = Nat;
  type BetNumber = [Digit];
  type Position = Nat;

  type PlayerIdentity = { #player; #manipulator; #conspirator };

  type DigitFund = {
    var amount : Lucky;
    var reachedAt : ?Timestamp;
  };

  type PositionFund = {
    var digits : [var DigitFund];
    var lockedDigit : ?Digit;
  };

  type BetRecord = {
    round : Nat;
    number : BetNumber;
    ticketCount : Nat;
    cost : Lucky;
    placedAt : Timestamp;
  };

  type WinRecord = {
    round : Nat;
    number : BetNumber;
    tier : Nat;
    payout : Lucky;
    claimedAt : Timestamp;
  };

  /// Per-round aggregate of one player's bets (new in this migration).
  type RoundBetAggregate = {
    ticketCount : Nat;
    numbers : [(BetNumber, Nat)];
  };

  /// Per-round payout credited to one player (new in this migration).
  type RoundWinnings = {
    amount : Lucky;
    tier : ?Nat;
  };

  type PlayerAccount = {
    var luckyBalance : Lucky;
    var identity : PlayerIdentity;
    var lastActionAt : Timestamp;
    var roundsPos1 : Nat;
    var roundsPos2 : Nat;
    var roundsPos3 : Nat;
    var multiPositionRounds : Nat;
    var lastCrowdfundRound : Nat;
    var lastCrowdfundMask : Nat;
    var betHistory : List.List<BetRecord>;
    var winHistory : List.List<WinRecord>;
    var roundBets : Map.Map<Nat, RoundBetAggregate>;
    var roundWinnings : Map.Map<Nat, RoundWinnings>;
  };

  type TierResult = {
    tier : Nat;
    winningTickets : Nat;
    payoutPerTicket : Lucky;
    distributed : Lucky;
  };

  type StoredDraw = {
    round : Nat;
    winningNumber : BetNumber;
    tiers : [TierResult];
    totalDistributed : Lucky;
    finishedAt : Timestamp;
  };

  type RoundHistoryEntry = {
    round : Nat;
    winningNumber : BetNumber;
    totalPrizePool : Lucky;
    crowdfundTotal : Lucky;
    totalDistributed : Lucky;
    finishedAt : Timestamp;
    positions : [PositionBasis];
  };

  type PositionBasis = {
    position : Position;
    winningDigit : Digit;
    winningAmount : Lucky;
    locked : Bool;
    digitAmounts : [Lucky];
  };

  /// Incrementally maintained top-K most-bet numbers (new in this migration).
  type TopBets = {
    var counts : Map.Map<BetNumber, Nat>;
    var order : List.List<BetNumber>;
  };

  type GameState = {
    var round : Nat;
    var roundStart : Timestamp;
    var totalPrizePool : Lucky;
    var crowdfundTotal : Lucky;
    var treasuryBalance : Lucky;
    var exchangePoolIcp : IcpE8s;
    var exchangePoolLucky : Lucky;
    var winningNumber : ?BetNumber;
    var positions : [var PositionFund];
    var tally : Map.Map<BetNumber, Nat>;
    var topBets : TopBets;
    var draws : Map.Map<Nat, StoredDraw>;
    var history : List.List<RoundHistoryEntry>;
    var players : Map.Map<Principal, PlayerAccount>;
  };

  // ---- Migration ---------------------------------------------------------

  /// Previous actor shape: the same state without `topBets` and without the
  /// per-round player aggregates. Declared so the migration chain can read the
  /// old stable state and carry it forward.
  public type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    gameState : {
      var round : Nat;
      var roundStart : Timestamp;
      var totalPrizePool : Lucky;
      var crowdfundTotal : Lucky;
      var treasuryBalance : Lucky;
      var exchangePoolIcp : IcpE8s;
      var exchangePoolLucky : Lucky;
      var winningNumber : ?BetNumber;
      var positions : [var PositionFund];
      var tally : Map.Map<BetNumber, Nat>;
      var draws : Map.Map<Nat, StoredDraw>;
      var history : List.List<RoundHistoryEntry>;
      var players : Map.Map<Principal, OldPlayerAccount>;
    };
  };

  /// The previous `PlayerAccount`, before the per-round aggregates were added.
  type OldPlayerAccount = {
    var luckyBalance : Lucky;
    var identity : PlayerIdentity;
    var lastActionAt : Timestamp;
    var roundsPos1 : Nat;
    var roundsPos2 : Nat;
    var roundsPos3 : Nat;
    var multiPositionRounds : Nat;
    var lastCrowdfundRound : Nat;
    var lastCrowdfundMask : Nat;
    var betHistory : List.List<BetRecord>;
    var winHistory : List.List<WinRecord>;
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    gameState : GameState;
  };

  /// Fresh crowdfunding state: three positions, ten digits each.
  ///
  /// Each element MUST be built independently. `VarArray.repeat` evaluates its
  /// element argument once and fills every slot with that same reference, so
  /// repeating a mutable record literal would alias one `PositionFund` (and its
  /// `digits` array and `lockedDigit`) across all three positions — a
  /// contribution to one position would then mutate every position.
  /// `VarArray.tabulate` calls the builder once per index, giving each element
  /// its own record and its own `freshDigits()` array.
  func freshPositions() : [var PositionFund] {
    VarArray.tabulate(
      3,
      func(_) { { var digits = freshDigits(); var lockedDigit = null : ?Digit } },
    );
  };

  /// Ten independent per-digit accumulators for one position. Built with
  /// `VarArray.tabulate` so each digit gets its own `amount`/`reachedAt`
  /// record; `VarArray.repeat` would alias a single record across all ten.
  func freshDigits() : [var DigitFund] {
    VarArray.tabulate(
      10,
      func(_) { { var amount = 0; var reachedAt = null : ?Timestamp } },
    );
  };

  /// Initial shared game state. The prize pool and both exchange-pool balances
  /// start non-zero so drawing, payout and exchange work from the first round.
  func initGameState() : GameState {
    {
      var round = 1;
      var roundStart = 0;
      var totalPrizePool = 1_000_000;
      var crowdfundTotal = 0;
      var treasuryBalance = 0;
      var exchangePoolIcp = 1_000_000_000_000;
      var exchangePoolLucky = 1_000_000_000;
      var winningNumber = null : ?BetNumber;
      var positions = freshPositions();
      var tally = Map.empty();
      var topBets = { var counts = Map.empty(); var order = List.empty() };
      var draws = Map.empty();
      var history = List.empty();
      var players = Map.empty();
    };
  };

  /// Carry the existing game state forward, adding the new top-K structure and
  /// the per-round player aggregates. Existing balances, histories, draws and
  /// round history are preserved unchanged.
  public func migration(old : OldActor) : NewActor {
    let oldState = old.gameState;
    let players = Map.empty<Principal, PlayerAccount>();
    for ((principal, account) in oldState.players.entries()) {
      players.add(
        principal,
        {
          var luckyBalance = account.luckyBalance;
          var identity = account.identity;
          var lastActionAt = account.lastActionAt;
          var roundsPos1 = account.roundsPos1;
          var roundsPos2 = account.roundsPos2;
          var roundsPos3 = account.roundsPos3;
          var multiPositionRounds = account.multiPositionRounds;
          var lastCrowdfundRound = account.lastCrowdfundRound;
          var lastCrowdfundMask = account.lastCrowdfundMask;
          var betHistory = account.betHistory;
          var winHistory = account.winHistory;
          var roundBets = Map.empty<Nat, RoundBetAggregate>();
          var roundWinnings = Map.empty<Nat, RoundWinnings>();
        },
      );
    };
    {
      accessControlState = old.accessControlState;
      gameState = {
        var round = oldState.round;
        var roundStart = oldState.roundStart;
        var totalPrizePool = oldState.totalPrizePool;
        var crowdfundTotal = oldState.crowdfundTotal;
        var treasuryBalance = oldState.treasuryBalance;
        var exchangePoolIcp = oldState.exchangePoolIcp;
        var exchangePoolLucky = oldState.exchangePoolLucky;
        var winningNumber = oldState.winningNumber;
        var positions = oldState.positions;
        var tally = oldState.tally;
        var topBets = { var counts = Map.empty(); var order = List.empty() };
        var draws = oldState.draws;
        var history = oldState.history;
        var players = players;
      };
    };
  };
};
