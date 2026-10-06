/// Domain logic for the Lucky ICRC-1 / ICRC-2 token ledger and admin minting.
///
/// The ledger keeps per-account balances, ICRC-2 allowances and an append-only
/// ICRC-3 block log. Supply is uncapped: every mint increases
/// `icrc1_total_supply`; there is no burn. The ledger fee is 0.
///
/// Accounts are keyed by canonical account text (`owner` or
/// `owner-subaccount-hex`); allowances are keyed by `owner|spender` account
/// text. The block log is a `List` appended oldest-first, so a block's index is
/// its position in the list.
import Blob "mo:core/Blob";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat8 "mo:core/Nat8";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Time "mo:core/Time";
import AdminAuth "admin-authorization";
import AccessControl "mo:caffeineai-authorization/access-control";
import LuckyLedger "../types/lucky-ledger";
import State "../types/state";

module {
  /// Token name.
  let NAME : Text = "Lucky";
  /// Token symbol.
  let SYMBOL : Text = "LUCKY";
  /// Number of decimals (integer token).
  let DECIMALS : Nat8 = 0;
  /// Ledger transfer fee (0).
  let FEE : LuckyLedger.Lucky = 0;
  /// The four-leaf-clover icon, embedded as a `data:` URL in `icrc1:logo`.
  let LOGO : Text = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNNTAgNTVjLTEwLTEwLTIwLTE1LTI4LTE1LTEwIDAtMTYgOC0xNiAxOCAwIDEyIDEwIDIwIDI0IDIwIDYgMCAxMi0yIDE2LTV2MTBjMCAxMC02IDE2LTE2IDE2LTggMC0xNC00LTE2LTExaC0xMGMzIDExIDEyIDE4IDI2IDE4IDE2IDAgMjYtOSAyNi0yM1Y1MHoiLz48L3N2Zz4=";
  /// ICRC-1 standard URL.
  let ICRC1_URL : Text = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1";
  /// ICRC-2 standard URL.
  let ICRC2_URL : Text = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-2";
  /// Maximum number of blocks returned by one `icrc3_get_blocks` page.
  let MAX_PAGE : Nat = 100;

  /// Token metadata: name `Lucky`, symbol `LUCKY`, 0 decimals, 0 fee and the
  /// embedded four-leaf-clover logo as a `data:` URL.
  public func tokenMetadata() : LuckyLedger.TokenMetadata {
    { name = NAME; symbol = SYMBOL; decimals = DECIMALS; fee = FEE; logo = LOGO };
  };

  /// The standards this ledger supports (ICRC-1 and ICRC-2).
  public func supportedStandards() : [LuckyLedger.SupportedStandard] {
    [
      { name = "ICRC-1"; url = ICRC1_URL },
      { name = "ICRC-2"; url = ICRC2_URL },
    ];
  };

  /// The full ICRC-1 metadata map, including `icrc1:logo`.
  public func metadata() : [LuckyLedger.MetadataEntry] {
    [
      { key = "icrc1:name"; value = #Text(NAME) },
      { key = "icrc1:symbol"; value = #Text(SYMBOL) },
      { key = "icrc1:decimals"; value = #Nat(DECIMALS.toNat()) },
      { key = "icrc1:fee"; value = #Nat(FEE) },
      { key = "icrc1:logo"; value = #Text(LOGO) },
    ];
  };

  /// Cumulative minted supply.
  public func totalSupply(state : State.GameState) : LuckyLedger.Lucky {
    state.luckyLedger.totalSupply;
  };

  /// Balance of one account.
  public func balanceOf(state : State.GameState, account : LuckyLedger.Account) : LuckyLedger.Lucky {
    state.luckyLedger.balances.get(accountText(account)) ?? 0;
  };

  /// ICRC-1 transfer from the caller's account to `to`.
  public func transfer(
    state : State.GameState,
    caller : Principal,
    arg : LuckyLedger.TransferArg,
  ) : LuckyLedger.TransferResult {
    let from : LuckyLedger.Account = { owner = caller; subaccount = arg.from_subaccount };
    let fromKey = accountText(from);
    let toKey = accountText(arg.to);
    let balance = state.luckyLedger.balances.get(fromKey) ?? 0;

    if (arg.amount == 0) {
      return #Err(#GenericError({ error_code = 1; message = "amount must be positive" }));
    };
    if (balance < arg.amount) {
      return #Err(#InsufficientFunds({ balance }));
    };
    if (fromKey == toKey) {
      return #Err(#GenericError({ error_code = 2; message = "cannot transfer to self" }));
    };

    state.luckyLedger.balances.add(fromKey, balance - arg.amount);
    state.luckyLedger.balances.add(toKey, (state.luckyLedger.balances.get(toKey) ?? 0) + arg.amount);

    let index = appendBlock(state, {
      from = ?from;
      to = ?arg.to;
      amount = arg.amount;
      memo = arg.memo;
      kind = #transfer;
    });
    #Ok(index);
  };

  /// ICRC-2 approve: grant `spender` an allowance over the caller's account.
  public func approve(
    state : State.GameState,
    caller : Principal,
    arg : LuckyLedger.ApproveArg,
  ) : LuckyLedger.ApproveResult {
    let owner : LuckyLedger.Account = { owner = caller; subaccount = arg.from_subaccount };
    let key = allowanceKey(owner, arg.spender);
    let current = state.luckyLedger.allowances.get(key);

    // `expected_allowance` guards against a concurrent change: if the caller
    // declared what it expected and the stored value differs, reject.
    switch (arg.expected_allowance) {
      case (?expected) {
        let actual = switch (current) {
          case (?entry) { entry.amount };
          case null { 0 };
        };
        if (actual != expected) {
          return #Err(#AllowanceChanged({ current_allowance = actual }));
        };
      };
      case null {};
    };

    // An already-expired `expires_at` is rejected.
    switch (arg.expires_at) {
      case (?expiry) {
        if (expiry < nowNs()) {
          return #Err(#Expired({ ledger_time = nowNs() }));
        };
      };
      case null {};
    };

    switch (current) {
      case (?entry) {
        entry.amount := arg.amount;
        entry.expiresAt := arg.expires_at;
      };
      case null {
        state.luckyLedger.allowances.add(key, {
          var amount = arg.amount;
          var expiresAt = arg.expires_at;
        });
      };
    };

    let index = appendBlock(state, {
      from = ?owner;
      to = ?arg.spender;
      amount = arg.amount;
      memo = arg.memo;
      kind = #approve;
    });
    #Ok(index);
  };

  /// ICRC-2 transfer-from: move tokens from `from` to `to` under an allowance
  /// held by the caller as spender.
  public func transferFrom(
    state : State.GameState,
    caller : Principal,
    arg : LuckyLedger.TransferFromArg,
  ) : LuckyLedger.TransferFromResult {
    let spender : LuckyLedger.Account = { owner = caller; subaccount = arg.spender_subaccount };
    let key = allowanceKey(arg.from, spender);
    let fromKey = accountText(arg.from);
    let toKey = accountText(arg.to);
    let balance = state.luckyLedger.balances.get(fromKey) ?? 0;

    if (arg.amount == 0) {
      return #Err(#GenericError({ error_code = 1; message = "amount must be positive" }));
    };

    let entry = switch (state.luckyLedger.allowances.get(key)) {
      case (?e) { e };
      case null {
        return #Err(#InsufficientAllowance({ allowance = 0 }));
      };
    };

    // An expired allowance is treated as zero.
    let now = nowNs();
    switch (entry.expiresAt) {
      case (?expiry) {
        if (expiry < now) {
          return #Err(#InsufficientAllowance({ allowance = 0 }));
        };
      };
      case null {};
    };

    if (entry.amount < arg.amount) {
      return #Err(#InsufficientAllowance({ allowance = entry.amount }));
    };
    if (balance < arg.amount) {
      return #Err(#InsufficientFunds({ balance }));
    };

    entry.amount := entry.amount - arg.amount;
    state.luckyLedger.balances.add(fromKey, balance - arg.amount);
    state.luckyLedger.balances.add(toKey, (state.luckyLedger.balances.get(toKey) ?? 0) + arg.amount);

    let index = appendBlock(state, {
      from = ?arg.from;
      to = ?arg.to;
      amount = arg.amount;
      memo = arg.memo;
      kind = #transferFrom;
    });
    #Ok(index);
  };

  /// ICRC-2 allowance of `spender` over `account`.
  public func allowance(
    state : State.GameState,
    arg : LuckyLedger.AllowanceArg,
  ) : LuckyLedger.Allowance {
    let key = allowanceKey(arg.account, arg.spender);
    switch (state.luckyLedger.allowances.get(key)) {
      case (?entry) {
        // An expired allowance reads as zero with no expiry.
        switch (entry.expiresAt) {
          case (?expiry) {
            if (expiry < nowNs()) {
              return { allowance = 0; expires_at = null };
            };
          };
          case null {};
        };
        { allowance = entry.amount; expires_at = entry.expiresAt };
      };
      case null { { allowance = 0; expires_at = null } };
    };
  };

  /// A page of the ICRC-3 block log, optionally filtered to one account.
  public func getBlocks(
    state : State.GameState,
    start : Nat,
    length : Nat,
    account : ?LuckyLedger.Account,
  ) : LuckyLedger.BlockPage {
    let blocks = state.luckyLedger.blocks;
    let total = blocks.size();
    let pageSize = if (length > MAX_PAGE) { MAX_PAGE } else { length };
    let out = List.empty<LuckyLedger.Transaction>();
    var i = start;
    var scanned = 0;
    // Scan forward until the page is full or the log is exhausted. When an
    // account filter is set, non-matching blocks are skipped without counting
    // toward the page size.
    while (i < total and scanned < pageSize) {
      switch (blocks.get(i)) {
        case (?tx) {
          let matches = switch (account) {
            case null { true };
            case (?acc) {
              let key = accountText(acc);
              let fromMatch = switch (tx.from) {
                case (?f) { accountText(f) == key };
                case null { false };
              };
              let toMatch = switch (tx.to) {
                case (?t) { accountText(t) == key };
                case null { false };
              };
              fromMatch or toMatch;
            };
          };
          if (matches) {
            out.add(tx);
            scanned += 1;
          };
        };
        case null {};
      };
      i += 1;
    };
    let nextIndex = if (i >= total) { null } else { ?i };
    { transactions = out.toArray(); nextIndex };
  };

  /// Admin mint: create `amount` Lucky into `arg.to`. Uncapped.
  public func mint(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    arg : LuckyLedger.MintArg,
  ) : LuckyLedger.MintOutcome {
    if (not AdminAuth.isCallerAdmin(accessControlState, caller)) {
      return #err(#notRegistered);
    };
    if (arg.amount == 0) {
      return #err(#invalidAmount({ step = 1 }));
    };
    let toKey = accountText(arg.to);
    state.luckyLedger.balances.add(toKey, (state.luckyLedger.balances.get(toKey) ?? 0) + arg.amount);
    state.luckyLedger.totalSupply += arg.amount;
    let index = appendBlock(state, {
      from = null;
      to = ?arg.to;
      amount = arg.amount;
      memo = arg.memo;
      kind = #mint;
    });
    #ok({
      blockIndex = index;
      totalSupply = state.luckyLedger.totalSupply;
      to = arg.to;
      amount = arg.amount;
    });
  };

  /// Admin migration of one player's internal Lucky balance into the ledger.
  public func migrateInternalBalance(
    state : State.GameState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    arg : LuckyLedger.MigrateBalanceArg,
  ) : LuckyLedger.MigrateBalanceOutcome {
    if (not AdminAuth.isCallerAdmin(accessControlState, caller)) {
      return #err(#notRegistered);
    };
    let account : LuckyLedger.Account = { owner = arg.owner; subaccount = arg.subaccount };
    let amount = switch (state.players.get(arg.owner)) {
      case (?player) { player.luckyBalance };
      case null { 0 };
    };
    if (amount == 0) {
      return #err(#insufficientBalance({ required = 1; available = 0 }));
    };
    let toKey = accountText(account);
    state.luckyLedger.balances.add(toKey, (state.luckyLedger.balances.get(toKey) ?? 0) + amount);
    state.luckyLedger.totalSupply += amount;
    let index = appendBlock(state, {
      from = null;
      to = ?account;
      amount;
      memo = null;
      kind = #mint;
    });
    #ok({
      blockIndex = index;
      to = account;
      amount;
      totalSupply = state.luckyLedger.totalSupply;
    });
  };

  /// Token snapshot for the admin token panel.
  public func tokenInfo(state : State.GameState) : LuckyLedger.TokenInfo {
    { metadata = tokenMetadata(); totalSupply = state.luckyLedger.totalSupply };
  };

  /// The caller's ledger balance plus the ledger fee.
  public func ledgerBalance(
    state : State.GameState,
    caller : Principal,
  ) : LuckyLedger.LedgerBalance {
    {
      balance = state.luckyLedger.balances.get(caller.toText()) ?? 0;
      fee = FEE;
    };
  };

  // ---- Internal helpers --------------------------------------------------

  /// Current ledger time as nanoseconds since the Unix epoch. `Time.now()`
  /// returns an `Int`; ledger timestamps are `Nat64`.
  func nowNs() : Nat64 {
    Time.now().toNat().toNat64();
  };

  /// Append a block to the log and return its index. `timestamp` and `fee` are
  /// filled in here so every call site records a consistent block.
  func appendBlock(
    state : State.GameState,
    block : {
      from : ?LuckyLedger.Account;
      to : ?LuckyLedger.Account;
      amount : LuckyLedger.Lucky;
      memo : ?Blob;
      kind : LuckyLedger.TransactionKind;
    },
  ) : Nat {
    let index = state.luckyLedger.blocks.size();
    state.luckyLedger.blocks.add({
      index;
      timestamp = Time.now();
      from = block.from;
      to = block.to;
      amount = block.amount;
      fee = FEE;
      memo = block.memo;
      kind = block.kind;
    });
    index;
  };

  /// Canonical account text: `owner` when there is no subaccount, otherwise
  /// `owner-subaccount-hex`.
  func accountText(account : LuckyLedger.Account) : Text {
    switch (account.subaccount) {
      case null { account.owner.toText() };
      case (?sub) { account.owner.toText() # "-" # hex(sub) };
    };
  };

  /// Allowance key: `owner-account-text|spender-account-text`.
  func allowanceKey(owner : LuckyLedger.Account, spender : LuckyLedger.Account) : Text {
    accountText(owner) # "|" # accountText(spender);
  };

  /// Lowercase hex encoding of a blob.
  func hex(blob : Blob) : Text {
    let digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
    blob.toArray().values().map(func b = digits[b.toNat() / 16] # digits[b.toNat() % 16]).join("");
  };
};
