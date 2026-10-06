/// Public API for the admin-gated development controls.
///
/// Every endpoint here is gated on the platform `#admin` role (with
/// canister-controller recovery) so ordinary users can never mint Lucky or
/// manipulate round timing.
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import DevLib "../lib/dev";
import State "../types/state";

mixin (state : State.GameState, accessControlState : AccessControl.AccessControlState) {
  /// Credit `amount` Lucky to the caller's own balance. Admin only.
  public shared ({ caller }) func devSeedBalance(amount : Nat) : async Common.GameError {
    DevLib.devSeedBalance(state, accessControlState, caller, amount);
  };

  /// Fast-forward the round clock so the current round completes its full
  /// cycle. Admin only.
  public shared ({ caller }) func devAdvanceRound() : async Common.GameError {
    DevLib.devAdvanceRound(state, accessControlState, caller);
  };

  /// Set the current round's elapsed time to `elapsedNs` for deterministic
  /// testing. Admin only.
  public shared ({ caller }) func devSetRoundElapsed(elapsedNs : Int) : async Common.GameError {
    DevLib.devSetRoundElapsed(state, accessControlState, caller, elapsedNs);
  };
};
