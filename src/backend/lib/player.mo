/// Domain logic for player accounts, identity and history.
///
/// Performance contract: the profile read is bounded. `getMyProfile` returns
/// only the summary plus total history counts; the full histories are read
/// through the paginated `getMyBetHistory` / `getMyWinHistory` functions, which
/// slice the stored lists newest-first without materialising the whole array.
import List "mo:core/List";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Game "../types/game";
import Player "../types/player";
import State "../types/state";

module {
  /// Minimum interval between two game actions by the same caller: 3 seconds.
  let COOLDOWN_NS : Int = 3_000_000_000;
  /// Maximum number of history records returned in one page.
  let MAX_PAGE : Nat = 50;

  /// Read the caller's own bounded profile: balance, identity, cooldown and
  /// total history counts. A caller with no account sees a zero profile.
  public func getMyProfile(state : State.GameState, caller : Principal) : Player.PlayerProfile {
    switch (state.players.get(caller)) {
      case (?account) {
        let now = Time.now();
        let elapsed = now - account.lastActionAt;
        let actionCooldownMs = if (elapsed >= COOLDOWN_NS) {
          0;
        } else {
          ((COOLDOWN_NS - elapsed + 999_999) / 1_000_000).toNat();
        };
        {
          luckyBalance = account.luckyBalance;
          identity = account.identity;
          lastActionAt = account.lastActionAt;
          actionCooldownMs;
          betCount = account.betHistory.size();
          winCount = account.winHistory.size();
        };
      };
      case null {
        {
          luckyBalance = 0;
          identity = #player;
          lastActionAt = 0;
          actionCooldownMs = 0;
          betCount = 0;
          winCount = 0;
        };
      };
    };
  };

  /// Read one page of the caller's bet history, newest first. `offset` is the
  /// number of newest records to skip; `limit` is capped at `MAX_PAGE`.
  public func getMyBetHistory(state : State.GameState, caller : Principal, offset : Nat, limit : Nat) : Player.BetHistoryPage {
    switch (state.players.get(caller)) {
      case (?account) {
        let total = account.betHistory.size();
        let capped = if (limit > MAX_PAGE) { MAX_PAGE } else { limit };
        let items = List.empty<Game.BetRecord>();
        var i = 0;
        while (i < capped and offset + i < total) {
          // Stored oldest-first; read from the tail for newest-first.
          let index = total - 1 - (offset + i);
          switch (account.betHistory.get(index)) {
            case (?record) { items.add(record) };
            case null {};
          };
          i += 1;
        };
        let next = offset + capped;
        {
          items = items.toArray();
          total;
          nextOffset = if (capped > 0 and next < total) { ?next } else { null };
        };
      };
      case null {
        { items = []; total = 0; nextOffset = null };
      };
    };
  };

  /// Read one page of the caller's win history, newest first. `offset` is the
  /// number of newest records to skip; `limit` is capped at `MAX_PAGE`.
  public func getMyWinHistory(state : State.GameState, caller : Principal, offset : Nat, limit : Nat) : Player.WinHistoryPage {
    switch (state.players.get(caller)) {
      case (?account) {
        let total = account.winHistory.size();
        let capped = if (limit > MAX_PAGE) { MAX_PAGE } else { limit };
        let items = List.empty<Game.WinRecord>();
        var i = 0;
        while (i < capped and offset + i < total) {
          let index = total - 1 - (offset + i);
          switch (account.winHistory.get(index)) {
            case (?record) { items.add(record) };
            case null {};
          };
          i += 1;
        };
        let next = offset + capped;
        {
          items = items.toArray();
          total;
          nextOffset = if (capped > 0 and next < total) { ?next } else { null };
        };
      };
      case null {
        { items = []; total = 0; nextOffset = null };
      };
    };
  };
};
