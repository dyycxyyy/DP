/// Types for a player's account, identity and history.
///
/// Performance contract: the profile read is bounded. `PlayerProfile` carries
/// only the summary (balances, identity, cooldown) plus total history counts;
/// the unbounded `betHistory`/`winHistory` arrays are gone. Full history is
/// read through the paginated `getMyBetHistory` / `getMyWinHistory` endpoints.
import Common "common";
import Game "game";

module {
  public type Lucky = Common.Lucky;
  public type Timestamp = Common.Timestamp;
  public type PlayerIdentity = Common.PlayerIdentity;

  /// Public view of the caller's own profile. Bounded: no history arrays.
  public type PlayerProfile = {
    luckyBalance : Lucky;
    identity : PlayerIdentity;
    /// Timestamp of the caller's last mutating action (0 when none).
    lastActionAt : Timestamp;
    /// Milliseconds remaining before the caller may act again (0 when ready).
    actionCooldownMs : Nat;
    /// Total number of bet records the caller has ever placed.
    betCount : Nat;
    /// Total number of win records the caller has ever earned.
    winCount : Nat;
  };

  /// One page of the caller's bet history, newest first.
  public type BetHistoryPage = {
    /// Records in this page, newest first.
    items : [Game.BetRecord];
    /// Total number of bet records the caller has (all pages).
    total : Nat;
    /// Offset of the next page, or null when this is the last page.
    nextOffset : ?Nat;
  };

  /// One page of the caller's win history, newest first.
  public type WinHistoryPage = {
    /// Records in this page, newest first.
    items : [Game.WinRecord];
    /// Total number of win records the caller has (all pages).
    total : Nat;
    /// Offset of the next page, or null when this is the last page.
    nextOffset : ?Nat;
  };
};
