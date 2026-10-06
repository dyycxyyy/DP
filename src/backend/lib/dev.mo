/// Domain logic for the admin-gated development controls.
///
/// Every function here is reachable only through the dev mixin, which gates
/// each endpoint on the platform `#admin` role (with canister-controller
/// recovery). The controls are additive: they mutate only the caller's Lucky
/// balance and the round clock (`state.roundStart`), and never change an
/// existing business rule, endpoint or type.
///
/// The round clock is derived from `state.roundStart` and the fixed window
/// lengths in `lib/game.mo`, so fast-forwarding needs no new stable field: it
/// shifts `roundStart` backwards to make the current round appear to have
/// elapsed further.
import AccessControl "mo:caffeineai-authorization/access-control";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Common "../types/common";
import State "../types/state";
import Game "../lib/game";
import AdminAuthLib "admin-authorization";

module {
  /// Deprecated alias: true when `caller` is an admin (platform `#admin` role
  /// or canister controller).
  public func isCallerController(
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Bool {
    AdminAuthLib.isCallerAdmin(accessControlState, caller);
  };

  /// Credit `amount` Lucky to the caller's account, creating it on first
  /// contact. Admin only.
  public func devSeedBalance(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    amount : Nat,
  ) : Common.GameError {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #notRegistered };
    if (amount == 0) { return #invalidAmount({ step = 1 }) };
    let account = Game.getOrCreatePlayer(state, caller);
    account.luckyBalance += amount;
    #ok;
  };

  /// Advance the round clock so the current round completes its full cycle
  /// (betting -> crowdfunding -> drawing -> payout -> next round). Admin only.
  public func devAdvanceRound(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Common.GameError {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #notRegistered };
    let now = Time.now();
    // Shift the round start far enough back that the whole cycle has elapsed,
    // then let the shared lazy advance run the draw, payout and next round.
    // Full cycle = crowdfunding close (480s) + drawing (30s) + payout (30s).
    state.roundStart := now - 540_000_000_001;
    Game.advance(state);
    #ok;
  };

  /// Set the current round's elapsed time to `elapsedNs` for deterministic
  /// testing. Admin only.
  public func devSetRoundElapsed(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    elapsedNs : Int,
  ) : Common.GameError {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #notRegistered };
    let now = Time.now();
    state.roundStart := now - elapsedNs;
    Game.advance(state);
    #ok;
  };
};
