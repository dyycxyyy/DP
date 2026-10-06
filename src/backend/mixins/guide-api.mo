/// Public API for the admin-editable guide text.
///
/// The read is a pure query available to everyone; the save is gated on the
/// platform `#admin` role (with canister-controller recovery).
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Guide "../types/guide";
import GuideLib "../lib/guide";
import State "../types/state";

mixin (state : State.GameState, accessControlState : AccessControl.AccessControlState) {
  /// The saved guide text plus whether an admin has set one. Pure read.
  public query func getGuideText() : async Guide.GuideText {
    GuideLib.getGuideText(state);
  };

  /// Save the guide text. Admin only.
  public shared ({ caller }) func setGuideText(text : Text) : async Common.GameError {
    GuideLib.setGuideText(state, accessControlState, caller, text);
  };
};
