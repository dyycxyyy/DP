/// Domain logic for the super-admin control surface.
///
/// Every function here is reachable only through the admin mixin, which gates
/// each endpoint on the platform `#admin` role (with canister-controller
/// recovery). The controls are additive: they stop the next round, withdraw
/// tokens from the prize pool, treasury and exchange pool, and reset game
/// data. They change no existing business rule, endpoint or type.
///
/// Withdrawals move tokens out of a pool to a recipient principal. The pools
/// are internal Lucky/ICP accounting balances, so a withdrawal debits the pool
/// and credits the recipient's player account (creating it on first contact),
/// which keeps the total supply conserved: the tokens are not destroyed, they
/// change owner. A withdrawal can never exceed the pool balance.
import AccessControl "mo:caffeineai-authorization/access-control";
import Blob "mo:core/Blob";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Common "../types/common";
import Admin "../types/admin";
import Game "../types/game";
import State "../types/state";
import Wallet "../types/wallet";
import WalletLib "wallet";
import AdminAuthLib "admin-authorization";

module {
  /// Ledger transfer fee in e8s (0.0001 ICP), matching the wallet domain.
  let ICP_FEE_E8S : Common.IcpE8s = 10_000;

  /// ICRC-1 transfer argument record (mirrors the wallet domain).
  type TransferArg = {
    from_subaccount : ?Blob;
    to : { owner : Principal; subaccount : ?Blob };
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  /// ICRC-1 transfer error variants returned by the ledger.
  type TransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  /// Minimal ICRC-1 ledger interface used for admin ICP withdrawals.
  type Ledger = actor {
    icrc1_transfer : (TransferArg) -> async { #Ok : Nat; #Err : TransferError };
  };

  /// The ICP ledger canister this canister transacts with (ICRC-1).
  func icpLedger() : Principal { Principal.fromText(Wallet.ICP_LEDGER_CANISTER_TEXT) };

  /// Deprecated alias: true when `caller` is an admin (platform `#admin` role
  /// or canister controller). Kept so existing callers keep compiling; new
  /// code should call `AdminAuthLib.isCallerAdmin` directly.
  public func isCallerController(
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Bool {
    AdminAuthLib.isCallerAdmin(accessControlState, caller);
  };

  /// Read the admin control snapshot: stopped flag and pool balances.
  public func getAdminStatus(state : State.GameState) : Admin.AdminStatus {
    {
      roundStopped = state.roundStopped;
      balances = {
        prizePool = state.totalPrizePool;
        treasury = state.treasuryBalance;
        exchangeLucky = state.exchangePoolLucky;
        exchangeIcp = state.exchangePoolIcp;
      };
    };
  };

  // ---- Daily statistics (UTC) -------------------------------------------

  /// Nanoseconds in one day.
  let DAY_NS : Int = 86_400_000_000_000;

  /// Zero-pad `value` to two digits.
  func pad2(value : Nat) : Text {
    if (value < 10) { "0" # value.toText() } else { value.toText() };
  };

  /// UTC day key `YYYY-MM-DD` for a nanosecond timestamp.
  func dayKeyOf(ns : Int) : Text {
    let days = ns / DAY_NS;
    let (year, month, day) = civilFromDays(days);
    year.toText() # "-" # pad2(month) # "-" # pad2(day);
  };

  /// Civil date (year, month, day) from days since 1970-01-01, using Howard
  /// Hinnant's `civil_from_days` algorithm.
  func civilFromDays(days : Int) : (Int, Nat, Nat) {
    let z = days + 719_468;
    let era = (if (z >= 0) { z } else { z - 146_096 }) / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if (mp < 10) { mp + 3 } else { mp - 9 };
    let year = if (m <= 2) { y + 1 } else { y };
    (year, m.toNat(), d.toNat());
  };

  /// Days since 1970-01-01 for a civil date, using Howard Hinnant's
  /// `days_from_civil` algorithm. The inverse of `civilFromDays`.
  func daysFromCivil(year : Int, month : Nat, day : Nat) : Int {
    let y = if (month <= 2) { year - 1 } else { year };
    let era = (if (y >= 0) { y } else { y - 399 }) / 400;
    let yoe = y - era * 400;
    let m = month.toInt();
    let d = day.toInt();
    let doy = (153 * (if (m > 2) { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468;
  };

  /// Parse a `YYYY-MM-DD` key into days since the Unix epoch. Returns null when
  /// the text is not a well-formed date.
  func parseDayKey(key : Text) : ?Int {
    let parts = key.split(#char '-').toArray();
    if (parts.size() != 3) { return null };
    let year = switch (parts[0].toInt()) { case (?y) { y }; case null { return null } };
    let month = switch (parts[1].toNat()) { case (?m) { m }; case null { return null } };
    let day = switch (parts[2].toNat()) { case (?d) { d }; case null { return null } };
    if (month < 1 or month > 12 or day < 1 or day > 31) { return null };
    ?daysFromCivil(year, month, day);
  };

  /// Read the per-UTC-day statistics for the inclusive range
  /// `fromDate..toDate` (`YYYY-MM-DD`). Controller only.
  ///
  /// Days with no recorded activity are returned with zero values rather than
  /// omitted, so the caller always receives one entry per day in the range.
  /// The range is capped at 366 days to bound the response. A malformed date or
  /// a reversed range is rejected with `#invalidAmount`.
  public func getDailyStats(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    fromDate : Text,
    toDate : Text,
  ) : Admin.DailyStatsOutcome {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #err(#notRegistered) };
    let fromDays = parseDayKey(fromDate) ?? return #err(#invalidAmount({ step = 1 }));
    let toDays = parseDayKey(toDate) ?? return #err(#invalidAmount({ step = 1 }));
    if (toDays < fromDays) { return #err(#invalidAmount({ step = 1 })) };
    let span = toDays - fromDays;
    if (span >= 366) { return #err(#amountTooLarge({ max = 366 })) };

    let result = List.empty<Admin.DailyStatsEntry>();
    var offset = 0;
    while (offset <= span) {
      let key = dayKeyOf((fromDays + offset) * DAY_NS);
      let stats = state.dailyStats.get(key) ?? ({ totalBets = 0; totalPayouts = 0; treasuryIncome = 0 });
      result.add({ date = key; stats });
      offset += 1;
    };
    #ok(result.toArray());
  };

  /// Stop the current/next round: no new bets and no crowdfund contributions
  /// until an admin resumes. Controller only.
  public func stopNextRound(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Common.GameError {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #notRegistered };
    state.roundStopped := true;
    #ok;
  };

  /// Resume a stopped round. Admin only.
  public func resumeRound(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Common.GameError {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #notRegistered };
    state.roundStopped := false;
    #ok;
  };

  /// Look up a player account, creating a zero-balance one on first contact.
  /// Used to credit a withdrawal recipient that has never played.
  func getOrCreatePlayer(state : State.GameState, caller : Principal) : State.PlayerAccount {
    switch (state.players.get(caller)) {
      case (?account) { account };
      case null {
        let account : State.PlayerAccount = {
          var luckyBalance = 0;
          var identity = #player;
          var lastActionAt = 0;
          var roundsPos1 = 0;
          var roundsPos2 = 0;
          var roundsPos3 = 0;
          var multiPositionRounds = 0;
          var lastCrowdfundRound = 0;
          var lastCrowdfundMask = 0;
          var betHistory = List.empty();
          var winHistory = List.empty();
          var roundBets = Map.empty();
          var roundWinnings = Map.empty();
        };
        state.players.add(caller, account);
        account;
      };
    };
  };

  /// Withdraw `amount` from `pool` to `recipient`. Controller only.
  ///
  /// The amount is in the pool's base unit: Lucky for `#prizePool`,
  /// `#treasury` and `#exchangeLucky`, e8s for `#exchangeIcp`. The pool is
  /// debited and the recipient credited in the SAME unit, so total supply is
  /// conserved. Lucky pools credit the recipient's internal Lucky balance; an
  /// ICP withdrawal moves ICP (e8s) from the canister's ledger holdings to the
  /// recipient's derived ledger subaccount, and only debits `exchangePoolIcp`
  /// once that transfer succeeds. Rejects a zero amount, an anonymous
  /// recipient, and any amount above the pool balance.
  public func withdrawFromPool(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    pool : Admin.AdminPool,
    amount : Nat,
    recipient : Principal,
  ) : async Admin.AdminWithdrawOutcome {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #err(#notRegistered) };
    if (amount == 0) { return #err(#invalidAmount({ step = 1 })) };
    if (recipient.isAnonymous()) { return #err(#invalidRecipient) };

    switch (pool) {
      case (#exchangeIcp) {
        // ICP is held on the ledger, not in an internal player balance. Move
        // the e8s to the recipient's derived subaccount first; only debit the
        // pool once the ledger confirms, so a failed transfer cannot destroy
        // supply.
        if (state.exchangePoolIcp < amount) {
          return #err(#poolInsufficient({ token = "exchangeIcp"; available = state.exchangePoolIcp }));
        };
        let ledger : Ledger = actor (icpLedger().toText());
        let result = try {
          await ledger.icrc1_transfer({
            from_subaccount = null;
            to = { owner = recipient; subaccount = ?WalletLib.subaccountFor(recipient) };
            amount;
            fee = ?ICP_FEE_E8S;
            memo = null;
            created_at_time = null;
          });
        } catch (error) {
          ignore error;
          return #err(#ledgerUnavailable({ reason = "transfer call failed" }));
        };
        switch (result) {
          case (#Ok(_blockIndex)) {};
          case (#Err(err)) {
            return #err(ledgerError(err));
          };
        };
        state.exchangePoolIcp -= amount;
        return #ok({
          pool;
          amount;
          recipient;
          remaining = state.exchangePoolIcp;
        });
      };
      case (_) {};
    };

    let remaining = switch (pool) {
      case (#prizePool) {
        if (state.totalPrizePool < amount) {
          return #err(#poolInsufficient({ token = "prizePool"; available = state.totalPrizePool }));
        };
        state.totalPrizePool -= amount;
        state.totalPrizePool;
      };
      case (#treasury) {
        if (state.treasuryBalance < amount) {
          return #err(#poolInsufficient({ token = "treasury"; available = state.treasuryBalance }));
        };
        state.treasuryBalance -= amount;
        state.treasuryBalance;
      };
      case (#exchangeLucky) {
        if (state.exchangePoolLucky < amount) {
          return #err(#poolInsufficient({ token = "exchangeLucky"; available = state.exchangePoolLucky }));
        };
        state.exchangePoolLucky -= amount;
        state.exchangePoolLucky;
      };
      case (#exchangeIcp) {
        // Handled above; unreachable.
        state.exchangePoolIcp;
      };
    };

    // Credit the recipient's Lucky balance so the withdrawn Lucky stays in
    // circulation. Same unit as the pool debit above.
    let account = getOrCreatePlayer(state, recipient);
    account.luckyBalance += amount;

    #ok({
      pool;
      amount;
      recipient;
      remaining;
    });
  };

  /// Map an ICRC-1 ledger transfer error onto the shared error surface.
  func ledgerError(err : TransferError) : Common.GameError {
    switch (err) {
      case (#BadFee({ expected_fee })) { #invalidAmount({ step = expected_fee }) };
      case (#InsufficientFunds({ balance })) {
        #insufficientBalance({ required = 0; available = balance });
      };
      case (#TooOld) { #ledgerUnavailable({ reason = "transfer too old" }) };
      case (#CreatedInFuture(_)) { #ledgerUnavailable({ reason = "created in future" }) };
      case (#Duplicate(_)) { #ledgerUnavailable({ reason = "duplicate transfer" }) };
      case (#TemporarilyUnavailable) { #ledgerUnavailable({ reason = "ledger temporarily unavailable" }) };
      case (#GenericError({ message })) { #ledgerUnavailable({ reason = message }) };
      case (#BadBurn(_)) { #ledgerUnavailable({ reason = "bad burn" }) };
    };
  };

  /// Reset all game data back to its initial state. Controller only.
  ///
  /// Clears the prize pool, treasury, exchange pools, player accounts, tally,
  /// complex bets, top-K, draws, round history and wallet transfers, and
  /// restarts the round counter at 1 with a fresh round start. The admin stop
  /// flag and the guide text are preserved (they are configuration, not game
  /// data). Returns the round the game restarted at and how many player
  /// accounts were cleared.
  public func resetGameData(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Admin.AdminResetOutcome {
    if (not AdminAuthLib.isCallerAdmin(accessControlState, caller)) { return #err(#notRegistered) };

    let playersCleared = state.players.size();

    state.round := 1;
    state.roundStart := 0;
    state.totalPrizePool := 0;
    state.crowdfundTotal := 0;
    state.treasuryBalance := 0;
    state.exchangePoolIcp := 0;
    state.exchangePoolLucky := 0;
    state.winningNumber := null;
    state.tally.clear();
    state.complexBets.clear();
    state.topBets.counts.clear();
    state.topBets.order.clear();
    state.draws.clear();
    state.history.clear();
    state.players.clear();
    state.walletTransfers.clear();
    state.nextTransferId := 0;
    for (position in state.positions.values()) {
      for (digit in position.digits.values()) {
        digit.amount := 0;
        digit.reachedAt := null;
      };
      position.lockedDigit := null;
    };

    #ok({ round = state.round; playersCleared });
  };
};
