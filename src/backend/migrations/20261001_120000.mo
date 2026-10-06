import AccessControl "mo:caffeineai-authorization/access-control";
import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

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

  type PositionBasis = {
    position : Position;
    winningDigit : Digit;
    winningAmount : Lucky;
    locked : Bool;
    digitAmounts : [Lucky];
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

  type TopBets = {
    var counts : Map.Map<BetNumber, Nat>;
    var order : List.List<BetNumber>;
  };

  /// Wallet transfer record (new in this migration).
  type TransferDirection = { #outgoing; #incoming };
  type TransferStatus = { #completed; #pending; #failed };
  type TransferAsset = { #icp; #lucky };

  type WalletTransferRecord = {
    id : Nat;
    asset : TransferAsset;
    direction : TransferDirection;
    amount : Nat;
    fee : Nat;
    counterparty : Principal;
    status : TransferStatus;
    createdAt : Timestamp;
  };

  /// Previous game state: no wallet transfer storage.
  type OldGameState = {
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

  /// New game state: adds the wallet transfer records and id counter.
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
    var walletTransfers : Map.Map<Principal, List.List<WalletTransferRecord>>;
    var nextTransferId : Nat;
  };

  // ---- Migration ---------------------------------------------------------

  public type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    gameState : OldGameState;
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    gameState : GameState;
  };

  /// Carry the existing game state forward, adding empty wallet transfer
  /// storage. All balances, histories, draws, tally, top-K and round history
  /// are preserved unchanged.
  public func migration(old : OldActor) : NewActor {
    let oldState = old.gameState;
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
        var complexBets = oldState.complexBets;
        var topBets = oldState.topBets;
        var draws = oldState.draws;
        var history = oldState.history;
        var players = oldState.players;
        var walletTransfers = Map.empty();
        var nextTransferId = 0;
      };
    };
  };
};
