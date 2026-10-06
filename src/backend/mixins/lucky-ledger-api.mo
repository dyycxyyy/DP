/// Public API for the Lucky ICRC-1 / ICRC-2 token ledger and admin minting.
///
/// Exposes the ICRC-1 core (`icrc1_*`), the ICRC-2 extension (`icrc2_*`), the
/// ICRC-3 block log (`icrc3_get_blocks`) and the admin minting surface. The
/// ledger state lives on the shared `GameState`; admin authorization reuses the
/// platform `#admin` role seam via `lib/admin-authorization`.
import AccessControl "mo:caffeineai-authorization/access-control";
import LuckyLedger "../types/lucky-ledger";
import LuckyLedgerLib "../lib/lucky-ledger";
import State "../types/state";

mixin (state : State.GameState, accessControlState : AccessControl.AccessControlState) {
  // ---- ICRC-1 core -----------------------------------------------------

  /// Token name (`Lucky`).
  public query func icrc1_name() : async Text {
    LuckyLedgerLib.tokenMetadata().name;
  };

  /// Token symbol (`LUCKY`).
  public query func icrc1_symbol() : async Text {
    LuckyLedgerLib.tokenMetadata().symbol;
  };

  /// Number of decimals (0).
  public query func icrc1_decimals() : async Nat8 {
    LuckyLedgerLib.tokenMetadata().decimals;
  };

  /// Ledger transfer fee (0).
  public query func icrc1_fee() : async LuckyLedger.Lucky {
    LuckyLedgerLib.tokenMetadata().fee;
  };

  /// Full ICRC-1 metadata map, including `icrc1:logo`.
  public query func icrc1_metadata() : async [LuckyLedger.MetadataEntry] {
    LuckyLedgerLib.metadata();
  };

  /// Cumulative minted supply (uncapped).
  public query func icrc1_total_supply() : async LuckyLedger.Lucky {
    LuckyLedgerLib.totalSupply(state);
  };

  /// Balance of one account.
  public query func icrc1_balance_of(account : LuckyLedger.Account) : async LuckyLedger.Lucky {
    LuckyLedgerLib.balanceOf(state, account);
  };

  /// Transfer Lucky from the caller's account to `arg.to`.
  public shared ({ caller }) func icrc1_transfer(
    arg : LuckyLedger.TransferArg,
  ) : async LuckyLedger.TransferResult {
    LuckyLedgerLib.transfer(state, caller, arg);
  };

  /// The standards this ledger supports (ICRC-1 and ICRC-2).
  public query func icrc1_supported_standards() : async [LuckyLedger.SupportedStandard] {
    LuckyLedgerLib.supportedStandards();
  };

  // ---- ICRC-2 extension ------------------------------------------------

  /// Grant `arg.spender` an allowance over the caller's account.
  public shared ({ caller }) func icrc2_approve(
    arg : LuckyLedger.ApproveArg,
  ) : async LuckyLedger.ApproveResult {
    LuckyLedgerLib.approve(state, caller, arg);
  };

  /// Move tokens from `arg.from` to `arg.to` under an allowance held by the
  /// caller as spender.
  public shared ({ caller }) func icrc2_transfer_from(
    arg : LuckyLedger.TransferFromArg,
  ) : async LuckyLedger.TransferFromResult {
    LuckyLedgerLib.transferFrom(state, caller, arg);
  };

  /// Allowance of `arg.spender` over `arg.account`.
  public query func icrc2_allowance(
    arg : LuckyLedger.AllowanceArg,
  ) : async LuckyLedger.Allowance {
    LuckyLedgerLib.allowance(state, arg);
  };

  // ---- ICRC-3 block log ------------------------------------------------

  /// A page of the ledger transaction log, optionally filtered to one account.
  public query func icrc3_get_blocks(
    start : Nat,
    length : Nat,
    account : ?LuckyLedger.Account,
  ) : async LuckyLedger.BlockPage {
    LuckyLedgerLib.getBlocks(state, start, length, account);
  };

  // ---- Admin minting ---------------------------------------------------

  /// Mint `arg.amount` Lucky into `arg.to`. Admin only; uncapped.
  public shared ({ caller }) func mintLucky(
    arg : LuckyLedger.MintArg,
  ) : async LuckyLedger.MintOutcome {
    LuckyLedgerLib.mint(state, accessControlState, caller, arg);
  };

  /// Migrate one player's internal Lucky balance into the ledger. Admin only.
  public shared ({ caller }) func migrateInternalLucky(
    arg : LuckyLedger.MigrateBalanceArg,
  ) : async LuckyLedger.MigrateBalanceOutcome {
    LuckyLedgerLib.migrateInternalBalance(state, accessControlState, caller, arg);
  };

  // ---- Frontend read helpers -------------------------------------------

  /// Token snapshot for the admin token panel: metadata plus total supply.
  public query func getTokenInfo() : async LuckyLedger.TokenInfo {
    LuckyLedgerLib.tokenInfo(state);
  };

  /// The caller's ledger balance plus the ledger fee.
  public query ({ caller }) func getLedgerBalance() : async LuckyLedger.LedgerBalance {
    LuckyLedgerLib.ledgerBalance(state, caller);
  };
};
