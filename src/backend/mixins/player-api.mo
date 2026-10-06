/// Public API for the caller's own player profile and paginated history.
import Player "../types/player";
import PlayerLib "../lib/player";
import State "../types/state";

mixin (state : State.GameState) {
  /// The caller's own bounded profile: Lucky balance, identity, last action
  /// timestamp, action cooldown, and total bet/win counts. History is read
  /// through the paginated endpoints below.
  public query ({ caller }) func getMyProfile() : async Player.PlayerProfile {
    PlayerLib.getMyProfile(state, caller);
  };

  /// One page of the caller's bet history, newest first. `offset` skips that
  /// many newest records; `limit` is capped server-side.
  public query ({ caller }) func getMyBetHistory(offset : Nat, limit : Nat) : async Player.BetHistoryPage {
    PlayerLib.getMyBetHistory(state, caller, offset, limit);
  };

  /// One page of the caller's win history, newest first. `offset` skips that
  /// many newest records; `limit` is capped server-side.
  public query ({ caller }) func getMyWinHistory(offset : Nat, limit : Nat) : async Player.WinHistoryPage {
    PlayerLib.getMyWinHistory(state, caller, offset, limit);
  };
};
