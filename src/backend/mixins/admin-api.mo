/// Public API for the super-admin control surface.
///
/// Every endpoint here is gated on the platform `#admin` role (with
/// canister-controller recovery) so ordinary users can never stop a round,
/// withdraw pool funds or reset game data. `isCallerController` is kept as a
/// deprecated alias that now returns the admin-role answer.
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Admin "../types/admin";
import AdminLib "../lib/admin";
import State "../types/state";
import Principal "mo:core/Principal";

mixin (state : State.GameState, accessControlState : AccessControl.AccessControlState) {
  /// Deprecated alias: whether the caller is an admin (platform `#admin` role
  /// or canister controller). The frontend should prefer the package's
  /// `isCallerAdmin`.
  public query ({ caller }) func isCallerController() : async Bool {
    AdminLib.isCallerController(accessControlState, caller);
  };

  /// Admin control snapshot: stopped flag and current pool balances.
  public query func getAdminStatus() : async Admin.AdminStatus {
    AdminLib.getAdminStatus(state);
  };

  /// Per-UTC-day statistics for the inclusive range `fromDate..toDate`
  /// (`YYYY-MM-DD`): total bets placed, total payouts distributed and treasury
  /// income from prize-pool cap overflow. Days with no activity are returned
  /// with zero values. Admin only; non-admins receive `#err`.
  public query ({ caller }) func getDailyStats(
    fromDate : Text,
    toDate : Text,
  ) : async Admin.DailyStatsOutcome {
    AdminLib.getDailyStats(state, accessControlState, caller, fromDate, toDate);
  };

  /// Stop the current/next round: no new bets and no crowdfund contributions
  /// until an admin resumes. Admin only.
  public shared ({ caller }) func stopNextRound() : async Common.GameError {
    AdminLib.stopNextRound(state, accessControlState, caller);
  };

  /// Resume a stopped round. Admin only.
  public shared ({ caller }) func resumeRound() : async Common.GameError {
    AdminLib.resumeRound(state, accessControlState, caller);
  };

  /// Withdraw `amount` from `pool` to `recipient`. Admin only.
  public shared ({ caller }) func withdrawFromPool(
    pool : Admin.AdminPool,
    amount : Nat,
    recipient : Principal,
  ) : async Admin.AdminWithdrawOutcome {
    await AdminLib.withdrawFromPool(state, accessControlState, caller, pool, amount, recipient);
  };

  /// Reset all game data back to its initial state. Admin only.
  public shared ({ caller }) func resetGameData() : async Admin.AdminResetOutcome {
    AdminLib.resetGameData(state, accessControlState, caller);
  };
};
