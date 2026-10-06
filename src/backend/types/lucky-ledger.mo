/// Types for the Lucky ICRC-1 / ICRC-2 token ledger and admin minting.
///
/// Lucky is a real on-canister token ledger: ICRC-1 core (`icrc1_*`) plus the
/// ICRC-2 approval/transfer-from extension (`icrc2_*`), with an ICRC-3 block
/// log for transaction history. Supply is uncapped: `icrc1_total_supply` equals
/// the cumulative minted amount and there is no burn.
///
/// All amounts are integer `Lucky` (`Nat`, 0 decimals). The ledger fee is 0.
import List "mo:core/List";
import Map "mo:core/Map";
import Common "common";

module {
  public type Lucky = Common.Lucky;
  public type Timestamp = Common.Timestamp;

  /// Token metadata: name, symbol, decimals, fee and the embedded logo.
  public type TokenMetadata = {
    name : Text;
    symbol : Text;
    decimals : Nat8;
    fee : Lucky;
    /// The token icon as a `data:` URL, embedded in `icrc1:logo` metadata.
    logo : Text;
  };

  /// An ICRC-1 account: an owner principal plus an optional 32-byte subaccount.
  public type Account = {
    owner : Principal;
    subaccount : ?Blob;
  };

  /// A single ledger transaction as recorded in the ICRC-3 block log.
  public type Transaction = {
    /// Monotonic block index of this transaction.
    index : Nat;
    /// Ledger time of the transaction, nanoseconds since the Unix epoch.
    timestamp : Timestamp;
    /// Sender account (`null` for a mint).
    from : ?Account;
    /// Recipient account (`null` for a burn, which this ledger never emits).
    to : ?Account;
    /// Amount transferred, in integer Lucky.
    amount : Lucky;
    /// Fee paid, in integer Lucky (always 0).
    fee : Lucky;
    /// Optional caller-supplied memo.
    memo : ?Blob;
    /// The kind of ledger operation.
    kind : TransactionKind;
  };

  /// The kind of ledger operation recorded in a block.
  public type TransactionKind = {
    /// Tokens created by an admin mint.
    #mint;
    /// Tokens moved between two accounts.
    #transfer;
    /// An allowance was granted or updated.
    #approve;
    /// Tokens moved by a spender under an allowance.
    #transferFrom;
  };

  /// A page of the ICRC-3 block log.
  public type BlockPage = {
    /// The transactions in this page, oldest first.
    transactions : [Transaction];
    /// The index of the next block to request, or `null` when the log is
    /// exhausted.
    nextIndex : ?Nat;
  };

  /// A standard the ledger supports, as reported by `icrc1_supported_standards`.
  public type SupportedStandard = {
    name : Text;
    url : Text;
  };

  /// An ICRC-1 metadata entry: a text key paired with a typed value.
  public type MetadataValue = {
    #Nat : Nat;
    #Int : Int;
    #Text : Text;
    #Blob : Blob;
  };

  /// An ICRC-1 metadata entry.
  public type MetadataEntry = {
    key : Text;
    value : MetadataValue;
  };

  // ---- ICRC-1 transfer ---------------------------------------------------

  /// ICRC-1 transfer argument.
  public type TransferArg = {
    from_subaccount : ?Blob;
    to : Account;
    amount : Lucky;
    fee : ?Lucky;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  /// ICRC-1 transfer error variants.
  public type TransferError = {
    #BadFee : { expected_fee : Lucky };
    #BadBurn : { min_burn_amount : Lucky };
    #InsufficientFunds : { balance : Lucky };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  /// ICRC-1 transfer result.
  public type TransferResult = {
    #Ok : Nat;
    #Err : TransferError;
  };

  // ---- ICRC-2 approve / transfer_from ------------------------------------

  /// ICRC-2 approve argument.
  public type ApproveArg = {
    from_subaccount : ?Blob;
    spender : Account;
    amount : Lucky;
    expected_allowance : ?Lucky;
    expires_at : ?Nat64;
    fee : ?Lucky;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  /// ICRC-2 approve error variants.
  public type ApproveError = {
    #BadFee : { expected_fee : Lucky };
    #InsufficientFunds : { balance : Lucky };
    #AllowanceChanged : { current_allowance : Lucky };
    #Expired : { ledger_time : Nat64 };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  /// ICRC-2 approve result.
  public type ApproveResult = {
    #Ok : Nat;
    #Err : ApproveError;
  };

  /// ICRC-2 transfer-from argument.
  public type TransferFromArg = {
    spender_subaccount : ?Blob;
    from : Account;
    to : Account;
    amount : Lucky;
    fee : ?Lucky;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  /// ICRC-2 transfer-from error variants.
  public type TransferFromError = {
    #BadFee : { expected_fee : Lucky };
    #BadBurn : { min_burn_amount : Lucky };
    #InsufficientFunds : { balance : Lucky };
    #InsufficientAllowance : { allowance : Lucky };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  /// ICRC-2 transfer-from result.
  public type TransferFromResult = {
    #Ok : Nat;
    #Err : TransferFromError;
  };

  /// ICRC-2 allowance argument.
  public type AllowanceArg = {
    account : Account;
    spender : Account;
  };

  /// ICRC-2 allowance value.
  public type Allowance = {
    allowance : Lucky;
    expires_at : ?Nat64;
  };

  // ---- Admin minting -----------------------------------------------------

  /// Admin mint argument: create `amount` Lucky into `to`.
  public type MintArg = {
    to : Account;
    amount : Lucky;
    memo : ?Blob;
  };

  /// Result of a successful admin mint.
  public type MintResult = {
    /// Block index of the mint transaction.
    blockIndex : Nat;
    /// Cumulative total supply after the mint.
    totalSupply : Lucky;
    /// The account that received the minted tokens.
    to : Account;
    /// Amount minted.
    amount : Lucky;
  };

  /// Outcome of an admin mint: the mint details on success, or the shared
  /// error surface on failure (e.g. `#notRegistered` for a non-admin caller).
  public type MintOutcome = {
    #ok : MintResult;
    #err : Common.GameError;
  };

  /// Admin migration of an existing internal Lucky balance into the ledger.
  public type MigrateBalanceArg = {
    /// The player whose internal balance is migrated.
    owner : Principal;
    /// Optional subaccount to credit; `null` credits the owner's default
    /// account.
    subaccount : ?Blob;
  };

  /// Result of migrating one player's internal Lucky balance to the ledger.
  public type MigrateBalanceResult = {
    /// Block index of the mint transaction.
    blockIndex : Nat;
    /// The account credited.
    to : Account;
    /// Amount migrated.
    amount : Lucky;
    /// Cumulative total supply after the migration.
    totalSupply : Lucky;
  };

  /// Outcome of an internal-balance migration.
  public type MigrateBalanceOutcome = {
    #ok : MigrateBalanceResult;
    #err : Common.GameError;
  };

  // ---- Frontend read helpers --------------------------------------------

  /// Snapshot of the token for the admin token panel: metadata plus the current
  /// total supply.
  public type TokenInfo = {
    metadata : TokenMetadata;
    totalSupply : Lucky;
  };

  /// A caller's ledger view: its Lucky balance plus the ledger fee.
  public type LedgerBalance = {
    balance : Lucky;
    fee : Lucky;
  };

  // ---- Persistent ledger state ------------------------------------------

  /// An ICRC-2 allowance entry: the granted amount and its optional expiry.
  public type AllowanceEntry = {
    var amount : Lucky;
    var expiresAt : ?Nat64;
  };

  /// The persistent Lucky ledger state, held on `GameState.luckyLedger`.
  /// Balances and allowances are keyed by the canonical account text
  /// (`owner-subaccount-hex`); the block log is append-only.
  public type LedgerState = {
    /// Per-account balances keyed by canonical account text.
    var balances : Map.Map<Text, Lucky>;
    /// Per-account allowances keyed by `owner|spender` account-text pair.
    var allowances : Map.Map<Text, AllowanceEntry>;
    /// Append-only transaction log, oldest first.
    var blocks : List.List<Transaction>;
    /// Cumulative minted supply.
    var totalSupply : Lucky;
  };
};
