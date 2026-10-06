/// Types for the platform-role-based admin authorization surface.
///
/// Admin authority is the platform application-level role system
/// (`caffeineai-authorization`): `#admin` / `#user` / `#guest`. The canister
/// controller identity is no longer the admin gate. These types are additive
/// and change no existing business type.
import Common "common";

module {
  public type GameError = Common.GameError;

  /// A registered user paired with the role the platform authorization system
  /// currently reports for them. `principal` is the identity label the admin
  /// panel shows to tell same-named users apart.
  public type AdminUserEntry = {
    /// The user's principal, rendered as text for display.
    principal : Principal;
    /// The role currently assigned to the user.
    role : UserRole;
  };

  /// The platform authorization roles, re-exported so the frontend can consume
  /// them from the admin API without importing the authorization package.
  public type UserRole = {
    #admin;
    #user;
    #guest;
  };

  /// Outcome of a user-list read: the registered users on success, or the
  /// shared error surface when the caller is not an admin.
  public type AdminUserListOutcome = {
    #ok : [AdminUserEntry];
    #err : GameError;
  };

  /// Outcome of a role change: the updated entry on success, or the shared
  /// error surface when the caller is not an admin or the target is invalid.
  public type AdminRoleChangeOutcome = {
    #ok : AdminUserEntry;
    #err : GameError;
  };
};
