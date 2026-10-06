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

  /// Previous per-round aggregate: simple/batch numbers only.
  type OldRoundBetAggregate = {
    ticketCount : Nat;
    numbers : [(BetNumber, Nat)];
  };

  /// New per-round aggregate: adds the bounded complex submissions.
  type ComplexBet = {
    selections : [[Digit]];
    counts : [Nat];
    ticketCount : Nat;
  };

  type RoundBetAggregate = {
    ticketCount : Nat;
    numbers : [(BetNumber, Nat)];
    complexBets : [ComplexBet];
  };

  type RoundWinnings = {
    amount : Lucky;
    tier : ?Nat;
  };

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
    var roundBets : Map.Map<Nat, OldRoundBetAggregate>;
    var roundWinnings : Map.Map<Nat, RoundWinnings>;
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
    var complexBets : List.List<ComplexBet>;
    var topBets : TopBets;
    var draws : Map.Map<Nat, StoredDraw>;
    var history : List.List<RoundHistoryEntry>;
    var players : Map.Map<Principal, PlayerAccount>;
  };

  // ---- Migration ---------------------------------------------------------

  /// Previous actor shape: the same state with the pre-complex per-round
  /// aggregate (no `complexBets`) and no per-round complex submission list.
  /// Declared so the migration chain can read the old stable state and carry it
  /// forward.
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
      var topBets : TopBets;
      var draws : Map.Map<Nat, StoredDraw>;
      var history : List.List<RoundHistoryEntry>;
      var players : Map.Map<Principal, OldPlayerAccount>;
    };
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    gameState : GameState;
  };

  /// Carry the existing game state forward, adding an empty `complexBets` list
  /// to every player's per-round aggregate and an empty per-round complex
  /// submission list to the game state. Existing balances, histories, draws,
  /// tally, top-K and round history are preserved unchanged.
  public func migration(old : OldActor) : NewActor {
    let oldState = old.gameState;
    let players = Map.empty<Principal, PlayerAccount>();
    for ((principal, account) in oldState.players.entries()) {
      let roundBets = Map.empty<Nat, RoundBetAggregate>();
      for ((round, aggregate) in account.roundBets.entries()) {
        roundBets.add(
          round,
          {
            ticketCount = aggregate.ticketCount;
            numbers = aggregate.numbers;
            complexBets = [];
          },
        );
      };
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
          var roundBets = roundBets;
          var roundWinnings = account.roundWinnings;
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
        var complexBets = List.empty();
        var topBets = oldState.topBets;
        var draws = oldState.draws;
        var history = oldState.history;
        var players = players;
      };
    };
  };
};
