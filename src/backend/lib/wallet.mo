/// Domain logic for the production wallet: balances, deposit addresses,
/// outgoing ICP transfers (ICRC-1 ledger), Lucky transfers and recent transfer
/// records.
///
/// ICP is held by the canister on the ICP ledger under a per-user subaccount
/// derived deterministically from the caller principal. Lucky stays internal
/// accounting on the shared `GameState`. The wallet never moves cycles.
import Blob "mo:core/Blob";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat8 "mo:core/Nat8";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Common "../types/common";
import Wallet "../types/wallet";
import State "../types/state";

module {
  /// The ICP ledger canister this wallet transacts with (ICRC-1).
  func icpLedger() : Principal { Principal.fromText(Wallet.ICP_LEDGER_CANISTER_TEXT) };
  /// Ledger transfer fee in e8s (0.0001 ICP).
  let ICP_FEE_E8S : Common.IcpE8s = 10_000;
  /// Maximum number of transfer records kept per caller.
  let MAX_TRANSFERS : Nat = 20;

  /// ICRC-1 transfer argument record.
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

  /// Minimal ICRC-1 ledger interface used by this wallet.
  type Ledger = actor {
    icrc1_fee : () -> async Nat;
    icrc1_balance_of : ({ owner : Principal; subaccount : ?Blob }) -> async Nat;
    icrc1_transfer : (TransferArg) -> async { #Ok : Nat; #Err : TransferError };
  };

  /// Derive the caller's deterministic 32-byte ledger subaccount from its
  /// principal. The principal's raw bytes are hashed with a domain separator
  /// and zero-padded to the 32-byte subaccount width.
  public func subaccountFor(caller : Principal) : Blob {
    let raw = caller.toBlob().toArray();
    let seed : [Nat8] = [0x77, 0x61, 0x6c, 0x6c, 0x65, 0x74]; // "wallet"
    let digest = blobHash(seed.concat(raw).toBlob());
    let out = List.empty<Nat8>();
    var i = 0;
    while (i < 32) {
      out.add(if (i < digest.size()) { digest[i] } else { 0 : Nat8 });
      i += 1;
    };
    Blob.fromArray(out.toArray());
  };

  /// FNV-1a 64-bit hash of a blob, expanded to 32 bytes by re-hashing with a
  /// counter. Deterministic and dependency-free; not used for security.
  func blobHash(input : Blob) : [Nat8] {
    let bytes = input.toArray();
    let out = List.empty<Nat8>();
    let prime : Nat = 1099511628211;
    let modulus : Nat = 18446744073709551616; // 2^64
    var round = 0;
    while (round < 4) {
      var hash : Nat = 14695981039346656037;
      hash := (hash + round) % modulus;
      for (b in bytes.values()) {
        hash := ((hash * prime) % modulus + b.toNat()) % modulus;
      };
      var shift = 0;
      while (shift < 8) {
        out.add(((hash / pow2(shift * 8)) % 256).toNat8());
        shift += 1;
      };
      round += 1;
    };
    out.toArray();
  };

  /// 2^n as a `Nat`.
  func pow2(n : Nat) : Nat {
    var result = 1;
    var i = 0;
    while (i < n) {
      result *= 2;
      i += 1;
    };
    result;
  };

  /// Render an ICRC-1 account as `owner-subaccount-hex` (or just `owner` when
  /// the subaccount is absent).
  func accountText(owner : Principal, subaccount : ?Blob) : Text {
    switch (subaccount) {
      case null { owner.toText() };
      case (?sub) { owner.toText() # "-" # hex(sub) };
    };
  };

  /// Lowercase hex encoding of a blob.
  func hex(blob : Blob) : Text {
    let digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
    blob.toArray().values().map(func b = digits[b.toNat() / 16] # digits[b.toNat() % 16]).join("");
  };

  /// Look up a player account, creating a zero-balance one on first contact.
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

  /// Append a transfer record for the caller, keeping only the newest
  /// `MAX_TRANSFERS` entries.
  func recordTransfer(
    state : State.GameState,
    caller : Principal,
    asset : Wallet.TransferAsset,
    direction : Wallet.TransferDirection,
    amount : Nat,
    fee : Nat,
    counterparty : Principal,
    status : Wallet.TransferStatus,
  ) {
    let record : Wallet.WalletTransferRecord = {
      id = state.nextTransferId;
      asset;
      direction;
      amount;
      fee;
      counterparty;
      status;
      createdAt = Time.now();
    };
    state.nextTransferId += 1;
    let records = switch (state.walletTransfers.get(caller)) {
      case (?existing) { existing };
      case null {
        let fresh = List.empty<Wallet.WalletTransferRecord>();
        state.walletTransfers.add(caller, fresh);
        fresh;
      };
    };
    records.add(record);
    if (records.size() > MAX_TRANSFERS) {
      let kept = records.sliceToArray(1, records.size());
      records.clear();
      records.addAll(kept.values());
    };
  };

  /// Read the caller's wallet balances: Lucky plus the real ICP balance the
  /// canister holds for the caller on the ICP ledger, and the ledger fee.
  public func getWalletBalances(
    state : State.GameState,
    canister : Principal,
    caller : Principal,
  ) : async Wallet.WalletBalances {
    let account = getOrCreatePlayer(state, caller);
    let ledger : Ledger = actor (icpLedger().toText());
    let subaccount = subaccountFor(caller);
    let icpE8s = try {
      await ledger.icrc1_balance_of({ owner = canister; subaccount = ?subaccount });
    } catch (error) {
      ignore error;
      0;
    };
    {
      lucky = account.luckyBalance;
      icpE8s;
      icpFeeE8s = ICP_FEE_E8S;
    };
  };

  /// Return the caller's own ICP deposit address (canister principal plus a
  /// per-user subaccount derived from the caller principal).
  public func getDepositAddress(canister : Principal, caller : Principal) : Wallet.DepositAddress {
    let subaccount = subaccountFor(caller);
    {
      owner = canister;
      subaccount;
      accountText = accountText(canister, ?subaccount);
    };
  };

  /// Send ICP (e8s) from the caller's ledger balance to an arbitrary recipient
  /// principal, validating the balance and the ledger transfer fee.
  public func transferIcp(
    state : State.GameState,
    canister : Principal,
    caller : Principal,
    recipient : Principal,
    amount : Common.IcpE8s,
  ) : async Common.GameError {
    if (amount == 0) { return #invalidAmount({ step = 1 }) };
    if (amount <= ICP_FEE_E8S) { return #amountTooSmall({ min = ICP_FEE_E8S + 1 }) };
    if (recipient == canister) { return #invalidRecipient };

    let ledger : Ledger = actor (icpLedger().toText());
    let subaccount = subaccountFor(caller);
    let balance = try {
      await ledger.icrc1_balance_of({ owner = canister; subaccount = ?subaccount });
    } catch (error) {
      ignore error;
      return #ledgerUnavailable({ reason = "balance query failed" });
    };
    let required = amount + ICP_FEE_E8S;
    if (balance < required) {
      return #insufficientBalance({ required; available = balance });
    };

    let result = try {
      await ledger.icrc1_transfer({
        from_subaccount = ?subaccount;
        to = { owner = recipient; subaccount = null };
        amount;
        fee = ?ICP_FEE_E8S;
        memo = null;
        created_at_time = null;
      });
    } catch (error) {
      ignore error;
      return #ledgerUnavailable({ reason = "transfer call failed" });
    };

    switch (result) {
      case (#Ok(_blockIndex)) {
        recordTransfer(state, caller, #icp, #outgoing, amount, ICP_FEE_E8S, recipient, #completed);
        #ok;
      };
      case (#Err(err)) {
        switch (err) {
          case (#BadFee({ expected_fee })) {
            #invalidAmount({ step = expected_fee });
          };
          case (#InsufficientFunds({ balance })) {
            #insufficientBalance({ required; available = balance });
          };
          case (#TooOld) {
            #ledgerUnavailable({ reason = "transfer too old" });
          };
          case (#CreatedInFuture(_)) {
            #ledgerUnavailable({ reason = "created in future" });
          };
          case (#Duplicate(_)) {
            #ledgerUnavailable({ reason = "duplicate transfer" });
          };
          case (#TemporarilyUnavailable) {
            #ledgerUnavailable({ reason = "ledger temporarily unavailable" });
          };
          case (#GenericError({ message })) {
            #ledgerUnavailable({ reason = message });
          };
          case (#BadBurn(_)) {
            #ledgerUnavailable({ reason = "bad burn" });
          };
        };
      };
    };
  };

  /// Transfer Lucky from the caller's balance to another principal.
  public func transferLucky(
    state : State.GameState,
    caller : Principal,
    recipient : Principal,
    amount : Common.Lucky,
  ) : Common.GameError {
    if (amount == 0) { return #invalidAmount({ step = 1 }) };
    if (recipient == caller) { return #invalidRecipient };

    let sender = getOrCreatePlayer(state, caller);
    if (sender.luckyBalance < amount) {
      return #insufficientBalance({ required = amount; available = sender.luckyBalance });
    };
    let receiver = getOrCreatePlayer(state, recipient);
    sender.luckyBalance -= amount;
    receiver.luckyBalance += amount;
    recordTransfer(state, caller, #lucky, #outgoing, amount, 0, recipient, #completed);
    recordTransfer(state, recipient, #lucky, #incoming, amount, 0, caller, #completed);
    #ok;
  };

  /// Return a bounded list of the caller's most recent wallet transfer records,
  /// newest first.
  public func getRecentTransfers(state : State.GameState, caller : Principal) : [Wallet.WalletTransferRecord] {
    switch (state.walletTransfers.get(caller)) {
      case null { [] };
      case (?records) {
        let total = records.size();
        let out = List.empty<Wallet.WalletTransferRecord>();
        var i = 0;
        while (i < total) {
          switch (records.get(total - 1 - i)) {
            case (?record) { out.add(record) };
            case null {};
          };
          i += 1;
        };
        out.toArray();
      };
    };
  };
};
