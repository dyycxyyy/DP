/// Domain logic for the admin-editable guide text.
///
/// The guide is a single plain-text document stored on the shared game state.
/// Reads are pure; the save is gated on the platform `#admin` role (with
/// canister-controller recovery).
import AccessControl "mo:caffeineai-authorization/access-control";
import Principal "mo:core/Principal";
import Common "../types/common";
import Guide "../types/guide";
import State "../types/state";
import AdminAuthLib "admin-authorization";

module {
  /// Maximum accepted guide length, in characters. Bounds the stable state a
  /// single save can write.
  let MAX_GUIDE_LENGTH : Nat = 20_000;

  /// Read the saved guide text. Pure read, safe for everyone.
  public func getGuideText(state : State.GameState) : Guide.GuideText {
    {
      text = state.guideText;
      isSet = state.guideText.size() > 0;
    };
  };

  /// Save the guide text. Admin only.
  public func setGuideText(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    text : Text,
  ) : Common.GameError {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #notRegistered };
    if (text.size() > MAX_GUIDE_LENGTH) {
      return #amountTooLarge({ max = MAX_GUIDE_LENGTH });
    };
    state.guideText := text;
    #ok;
  };
};
