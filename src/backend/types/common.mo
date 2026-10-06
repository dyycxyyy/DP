/// Cross-cutting primitive types shared by every game domain.
/// All monetary amounts are integers: Lucky as `Nat`, ICP as e8s `Nat`.
module {
  /// Lucky token amount (integer, no decimals).
  public type Lucky = Nat;

  /// ICP amount expressed in e8s (1 ICP = 100_000_000 e8s).
  public type IcpE8s = Nat;

  /// Nanoseconds since the Unix epoch (IC time).
  public type Timestamp = Int;

  /// A single decimal digit 0-9.
  public type Digit = Nat;

  /// A 7-digit betting number, each element 0-9 (leading zeros allowed).
  public type BetNumber = [Digit];

  /// Position of a digit inside the 7-digit winning number (1-7).
  public type Position = Nat;

  /// Lifecycle phase of a round.
  public type Phase = {
    #betting;
    #crowdfunding;
    #drawing;
    #payout;
  };

  /// Player identity derived from behaviour.
  public type PlayerIdentity = {
    #player;
    #manipulator;
    #conspirator;
  };

  /// Shared result surface for every mutating endpoint, so the frontend can
  /// render a precise Chinese message per case. `#ok` signals success; every
  /// other tag is a failure the caller can branch on.
  public type GameError = {
    /// The action succeeded.
    #ok;
    /// The requested action is not allowed in the current phase.
    #phaseClosed : { current : Phase; required : Phase };
    /// Caller's Lucky balance is too low.
    #insufficientBalance : { required : Lucky; available : Lucky };
    /// Amount is not a positive integer multiple of the required step.
    #invalidAmount : { step : Nat };
    /// Amount exceeds the per-call cap.
    #amountTooLarge : { max : Nat };
    /// Amount is below the per-call minimum.
    #amountTooSmall : { min : Nat };
    /// The 3-second per-caller action interval has not elapsed.
    #rateLimited : { remainingMs : Nat };
    /// The exchange pool lacks enough of the target token.
    #poolInsufficient : { token : Text; available : Nat };
    /// The bet number is malformed (not 7 digits 0-9).
    #invalidBetNumber;
    /// The crowdfund position is outside 1-3 or the digit outside 0-9.
    #invalidPosition;
    /// No round data is available for the requested round.
    #roundNotFound : { round : Nat };
    /// Caller is not registered / has no profile yet.
    #notRegistered;
    /// The ICP ledger could not be reached or rejected the transfer for an
    /// infrastructure reason (temporarily unavailable, generic ledger error).
    #ledgerUnavailable : { reason : Text };
    /// The recipient principal is not a valid transfer target.
    #invalidRecipient;
    /// An admin has stopped the current/next round: no new bets and no
    /// crowdfund contributions are accepted until it is resumed.
    #roundStopped;
  };
};
