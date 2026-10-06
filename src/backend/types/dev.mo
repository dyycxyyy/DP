/// Types for the controller-gated development controls.
///
/// The dev controls exist so the project owner can exercise paths that are
/// otherwise unreachable in a fresh environment: funding a Lucky balance and
/// fast-forwarding the round clock. They are additive and change no existing
/// business type.
import Common "common";

module {
  public type GameError = Common.GameError;
  public type Timestamp = Common.Timestamp;
};
