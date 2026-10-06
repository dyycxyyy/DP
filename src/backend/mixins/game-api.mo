/// Public API for the game lobby, betting, crowdfunding and draw results.
import Common "../types/common";
import Game "../types/game";
import GameLib "../lib/game";
import State "../types/state";

mixin (state : State.GameState) {
  /// Current round state: round number, phase, deadlines, prize pool,
  /// crowdfund total, treasury, exchange pool and per-position crowdfund data.
  public query func getGameState() : async Game.GameState {
    GameLib.getGameState(state);
  };

  /// The top-10 most-bet numbers with their ticket counts.
  public query func getTopBetNumbers() : async [Game.TopBetNumber] {
    GameLib.getTopBetNumbers(state);
  };

  /// Draw result of a round: winning number, per-tier counts and payouts,
  /// and the caller's own winnings.
  public query ({ caller }) func getDrawResult(round : Nat) : async ?Game.DrawResult {
    GameLib.getDrawResult(state, caller, round);
  };

  /// Recent completed rounds, newest first.
  public query func getRoundHistory(limit : Nat) : async [Game.RoundHistoryEntry] {
    GameLib.getRoundHistory(state, limit);
  };

  /// Place `count` tickets on a 7-digit number. 1 Lucky per ticket, betting
  /// phase only.
  public shared ({ caller }) func placeBet(number : Common.BetNumber, count : Nat) : async Common.GameError {
    GameLib.placeBet(state, caller, number, count);
  };

  /// Place several distinct 7-digit numbers in one call, each with its own
  /// ticket count. A complex (复式) submission is sent here as a single game
  /// action: one 3-second cooldown, one summed deduction into the prize pool.
  /// `numbers` and `counts` must be the same length; each count must be >= 1.
  public shared ({ caller }) func placeBets(numbers : [Common.BetNumber], counts : [Nat]) : async Common.GameError {
    GameLib.placeBets(state, caller, numbers, counts);
  };

  /// Place a complex (复式) bet from a per-position selection structure.
  /// `selections` holds one array of selected digits per position (7 positions)
  /// and `counts` the number of selected digits per position; the total ticket
  /// count is the product of the per-position counts. The backend expands the
  /// cartesian product itself, so the frontend never materializes it. One
  /// 3-second cooldown and one summed deduction, exactly like `placeBets`.
  public shared ({ caller }) func placeBetSelections(selections : [[Common.Digit]], counts : [Nat]) : async Common.GameError {
    GameLib.placeBetSelections(state, caller, selections, counts);
  };

  /// Contribute `amount` Lucky to `digit` at `position` (1-3). Crowdfunding
  /// phase only, positive integer multiple of 1, max 100_000 per call.
  public shared ({ caller }) func contributeCrowdfund(position : Common.Position, digit : Common.Digit, amount : Common.Lucky) : async Common.GameError {
    GameLib.contributeCrowdfund(state, caller, position, digit, amount);
  };
};
