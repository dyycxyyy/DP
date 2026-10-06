/// Domain logic for platform-role-based admin authorization.
///
/// Replaces the old `Principal.isController(caller)` gate with the platform
/// application-level role system. Every admin-gated endpoint in the app calls
/// `isCallerAdmin` (or `requireAdmin`) instead of `caller.isController()`.
///
/// The canister controller is NOT locked out of recovery: `isCallerAdmin`
/// returns true for a controller as well as for a platform `#admin`, so the
/// controller can always restore the app even if every role assignment is lost.
import AccessControl "mo:caffeineai-authorization/access-control";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import AdminAuth "../types/admin-authorization";

module {
  /// True when `caller` holds the platform `#admin` role, or is a canister
  /// controller (recovery path). A non-controller anonymous caller is never an
  /// admin.
  ///
  /// The controller check MUST come before the anonymous check: the anonymous
  /// principal is a legitimate canister controller (it is the default install
  /// sender), and the recovery path must recognize it. Ordering the anonymous
  /// short-circuit first would lock that controller out of recovery.
  public func isCallerAdmin(
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Bool {
    if (caller.isController()) { return true };
    if (caller.isAnonymous()) { return false };
    switch (accessControlState.userRoles.get(caller)) {
      case (?role) { role == #admin };
      case null { false };
    };
  };

  /// The role the platform authorization system reports for `caller`.
  ///
  /// A canister controller that has never registered is reported as `#admin`
  /// so the recovery path is consistent with `isCallerAdmin`. An unregistered
  /// non-controller is reported as `#guest`. The controller check comes first
  /// for the same reason as in `isCallerAdmin`: the anonymous principal can be
  /// a controller.
  public func callerRole(
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : AdminAuth.UserRole {
    if (caller.isController()) { return #admin };
    if (caller.isAnonymous()) { return #guest };
    switch (accessControlState.userRoles.get(caller)) {
      case (?role) { role };
      case null { #guest };
    };
  };

  /// List every registered user with their current role. Admin only.
  public func listUsers(
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : AdminAuth.AdminUserListOutcome {
    if (not isCallerAdmin(accessControlState, caller)) {
      return #err(#notRegistered);
    };
    let entries = accessControlState.userRoles.entries().map(
      func((principal, role)) = { principal; role },
    ).toArray();
    #ok(entries);
  };

  /// Promote a user to `#admin`. Admin only.
  public func promoteToAdmin(
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    user : Principal,
  ) : AdminAuth.AdminRoleChangeOutcome {
    if (not isCallerAdmin(accessControlState, caller)) {
      return #err(#notRegistered);
    };
    if (user.isAnonymous()) { return #err(#invalidRecipient) };
    accessControlState.userRoles.add(user, #admin);
    #ok({ principal = user; role = #admin });
  };

  /// Demote a user to `#user`. Admin only.
  public func demoteToUser(
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    user : Principal,
  ) : AdminAuth.AdminRoleChangeOutcome {
    if (not isCallerAdmin(accessControlState, caller)) {
      return #err(#notRegistered);
    };
    if (user.isAnonymous()) { return #err(#invalidRecipient) };
    accessControlState.userRoles.add(user, #user);
    #ok({ principal = user; role = #user });
  };
};
