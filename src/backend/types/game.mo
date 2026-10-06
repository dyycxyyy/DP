/// Types for the round lifecycle, betting, crowdfunding, drawing and payout.
import Common "common";

module {
  public type Lucky = Common.Lucky;
  public type Timestamp = Common.Timestamp;
  public type Digit = Common.Digit;
  public type BetNumber = Common.BetNumber;
  public type Position = Common.Position;
  public type Phase = Common.Phase;

  /// Crowdfunding state for one digit of one position (1-3).
  public type DigitCrowdfund = {
    digit : Digit;
    amount : Lucky;
    /// True once this digit reached the 100_000 threshold first.
    thresholdReached : Bool;
    /// Timestamp at which the threshold was reached, when it was.
    reachedAt : ?Timestamp;
  };

  /// Crowdfunding state for one position (1-3): all ten digits plus the
  /// currently leading digit and the locked winning digit when decided.
  public type PositionCrowdfund = {
    position : Position;
    digits : [DigitCrowdfund];
    /// Digit with the highest amount so far (tie -> larger digit).
    leadingDigit : Digit;
    /// Winning digit once locked by threshold or by end-of-window rule.
    lockedDigit : ?Digit;
  };

  /// A number in the top-10 most-bet list.
  public type TopBetNumber = {
    number : BetNumber;
    ticketCount : Nat;
  };

  /// Public snapshot of the current round, safe to expose to everyone.
  public type GameState = {
    round : Nat;
    phase : Phase;
    /// Deadline of the current phase (nanoseconds since epoch).
    phaseDeadline : Timestamp;
    /// Deadline of the betting window.
    bettingDeadline : Timestamp;
    /// Deadline of the crowdfunding window.
    crowdfundingDeadline : Timestamp;
    totalPrizePool : Lucky;
    crowdfundTotal : Lucky;
    treasuryBalance : Lucky;
    exchangePoolIcp : Common.IcpE8s;
    exchangePoolLucky : Lucky;
    /// The 7-digit winning number, present once drawing has completed.
    winningNumber : ?BetNumber;
    /// True when an admin has stopped the current/next round: no new bets and
    /// no crowdfund contributions are accepted until it is resumed.
    roundStopped : Bool;
    /// Crowdfunding detail for positions 1, 2 and 3.
    positions : [PositionCrowdfund];
  };

  /// Per-tier payout summary for a completed round.
  public type TierResult = {
    tier : Nat;
    winningTickets : Nat;
    payoutPerTicket : Lucky;
    /// Total amount distributed for this tier.
    distributed : Lucky;
  };

  /// Draw result of a round, including the caller's own winnings.
  public type DrawResult = {
    round : Nat;
    winningNumber : BetNumber;
    tiers : [TierResult];
    /// Amount the caller won in this round (0 when none).
    callerWinnings : Lucky;
    /// The caller's matched tier, when they won.
    callerTier : ?Nat;
  };

  /// Crowdfunding basis of one position (1-3) at draw time, persisted with the
  /// finished round so the published basis always matches the winning number.
  public type PositionBasis = {
    position : Position;
    /// Winning digit of this position (locked digit, else leading digit).
    winningDigit : Digit;
    /// Final amount contributed to `winningDigit`.
    winningAmount : Lucky;
    /// True when the winning digit was locked by reaching the threshold.
    locked : Bool;
    /// Final amount of every digit 0-9 at draw time, indexed by digit.
    digitAmounts : [Lucky];
  };

  /// Compact summary of a past round for the history list.
  public type RoundHistoryEntry = {
    round : Nat;
    winningNumber : BetNumber;
    totalPrizePool : Lucky;
    crowdfundTotal : Lucky;
    totalDistributed : Lucky;
    finishedAt : Timestamp;
    /// Crowdfunding basis for positions 1-3, same source as the winning number.
    positions : [PositionBasis];
  };

  /// A single bet record belonging to a player.
  public type BetRecord = {
    round : Nat;
    number : BetNumber;
    ticketCount : Nat;
    cost : Lucky;
    placedAt : Timestamp;
  };

  /// A single win record belonging to a player.
  public type WinRecord = {
    round : Nat;
    number : BetNumber;
    tier : Nat;
    payout : Lucky;
    claimedAt : Timestamp;
  };

  /// One complex (复式) submission stored as its per-position selection
  /// structure plus the ticket count it expands to. `selections` holds the
  /// selected digits per position (7 positions) and `counts` the number of
  /// selected digits per position; the ticket count is the product of `counts`.
  /// Bounded at 7 positions x 10 digits regardless of ticket count, so a
  /// 10,000,000-ticket submission is stored in constant space.
  public type ComplexBet = {
    selections : [[Digit]];
    counts : [Nat];
    ticketCount : Nat;
  };

  /// Per-round aggregate of one player's bets, keyed by round in
  /// `PlayerAccount.roundBets`. Lets the draw count winning tickets and credit
  /// winners in O(players) instead of scanning every bet ever placed.
  ///
  /// `numbers` holds the simple/batch bets (one entry per distinct number) and
  /// `complexBets` the complex submissions, each stored as its selection
  /// structure rather than an expanded list of every combination. Both stay
  /// bounded: `numbers` by the number of distinct simple bets, `complexBets` by
  /// the number of complex submissions.
  public type RoundBetAggregate = {
    /// Total tickets the player placed this round.
    ticketCount : Nat;
    /// Distinct numbers the player bet this round, with their ticket counts.
    numbers : [(BetNumber, Nat)];
    /// Complex submissions the player made this round, each bounded in size.
    complexBets : [ComplexBet];
  };

  /// Per-round payout credited to one player, keyed by round in
  /// `PlayerAccount.roundWinnings`. Lets `getDrawResult` read the caller's
  /// winnings for a round in O(1) instead of scanning their whole win history.
  public type RoundWinnings = {
    /// Total amount the player won in this round.
    amount : Lucky;
    /// The player's best (lowest-numbered) matched tier, when they won.
    tier : ?Nat;
  };
};
