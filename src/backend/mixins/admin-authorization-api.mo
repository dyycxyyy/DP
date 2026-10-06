/// Public API for platform-role-based admin authorization and user management.
///
/// The user-management endpoints are admin-only; non-admins receive `#err`.
/// The package's `MixinAuthorization` already exports `isCallerAdmin`, so this
/// mixin deliberately does not redeclare it (that would be an M0051 duplicate).
import AccessControl "mo:caffeineai-authorization/access-control";
import AdminAuth "../types/admin-authorization";
import AdminAuthLib "../lib/admin-authorization";
import Principal "mo:core/Principal";

mixin (accessControlState : AccessControl.AccessControlState) {
  /// The caller's own platform role.
  public query ({ caller }) func getCallerRole() : async AdminAuth.UserRole {
    AdminAuthLib.callerRole(accessControlState, caller);
  };

  /// List every registered user with their current role. Admin only.
  public query ({ caller }) func listUsers() : async AdminAuth.AdminUserListOutcome {
    AdminAuthLib.listUsers(accessControlState, caller);
  };

  /// Promote a user to `#admin`. Admin only.
  public shared ({ caller }) func promoteToAdmin(user : Principal) : async AdminAuth.AdminRoleChangeOutcome {
    AdminAuthLib.promoteToAdmin(accessControlState, caller, user);
  };

  /// Demote a user to `#user`. Admin only.
  public shared ({ caller }) func demoteToUser(user : Principal) : async AdminAuth.AdminRoleChangeOutcome {
    AdminAuthLib.demoteToUser(accessControlState, caller, user);
  };
};
