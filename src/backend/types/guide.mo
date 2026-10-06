/// Types for the admin-editable guide text.
///
/// The guide is a single plain-text document saved by a controller and read by
/// everyone. It is additive and changes no existing business type.
module {
  /// The saved guide document plus whether it has been set by an admin.
  public type GuideText = {
    /// The saved guide text; empty when no admin has saved one yet.
    text : Text;
    /// True once an admin has saved a non-empty guide.
    isSet : Bool;
  };
};
