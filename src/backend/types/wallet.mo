/// Types for the production wallet: real ICP held by the canister on the ICP
/// ledger (ICRC-1, inter-canister calls), Lucky balances, deposit addresses and
/// the caller's recent transfer records.
///
/// ICP is always accounted in e8s (`IcpE8s`, 1 ICP = 100_000_000 e8s); Lucky is
/// an integer `Nat`. The wallet never moves cycles — ICP moves only through the
/// ledger's `icrc1_transfer`.
import Common "common";

module {
  public type Lucky = Common.Lucky;
  public type IcpE8s = Common.IcpE8s;
  public type Timestamp = Common.Timestamp;

  /// The ICP ledger canister this wallet transacts with (ICRC-1).
  public let ICP_LEDGER_CANISTER_TEXT : Text = "ryjl3-tyaaa-aaaaa-aaaba-cai";

  /// Direction of a wallet transfer relative to the caller.
  public type TransferDirection = {
    /// Funds left the caller's account.
    #outgoing;
    /// Funds arrived at the caller's account.
    #incoming;
  };

  /// Lifecycle status of a wallet transfer record.
  public type TransferStatus = {
    /// Submitted and confirmed by the ledger / applied to the Lucky balance.
    #completed;
    /// Submitted but not yet confirmed (e.g. awaiting ledger finality).
    #pending;
    /// Rejected by the ledger or by validation; no funds moved.
    #failed;
  };

  /// Which asset a transfer record refers to.
  public type TransferAsset = {
    #icp;
    #lucky;
  };

  /// One wallet transfer record shown in the caller's recent-activity list.
  /// `counterparty` is the other principal: the recipient for outgoing
  /// transfers, the sender for incoming ones.
  public type WalletTransferRecord = {
    id : Nat;
    asset : TransferAsset;
    direction : TransferDirection;
    /// Amount in the asset's base unit: e8s for ICP, integer Lucky otherwise.
    amount : Nat;
    /// Ledger fee paid, in the asset's base unit (0 for Lucky transfers).
    fee : Nat;
    counterparty : Principal;
    status : TransferStatus;
    createdAt : Timestamp;
  };

  /// The caller's wallet snapshot: Lucky balance plus the real ICP balance the
  /// canister holds for the caller on the ICP ledger.
  public type WalletBalances = {
    lucky : Lucky;
    icpE8s : IcpE8s;
    /// Ledger transfer fee in e8s, so the frontend can show the net amount.
    icpFeeE8s : IcpE8s;
  };

  /// The caller's own ICP deposit address: the canister principal plus the
  /// per-user subaccount derived from the caller principal. Funds sent to this
  /// address are credited to the caller after ledger confirmation.
  public type DepositAddress = {
    owner : Principal;
    subaccount : Blob;
    /// Canonical ICRC-1 account text (`owner-subaccount-hex`) for display/copy.
    accountText : Text;
  };

  /// Result of an outgoing ICP transfer to an arbitrary recipient principal.
  public type IcpTransferResult = {
    /// Ledger block index of the confirmed transfer.
    blockIndex : Nat;
    amount : IcpE8s;
    fee : IcpE8s;
    recipient : Principal;
    /// Caller's remaining ICP balance after the transfer, in e8s.
    remainingIcpE8s : IcpE8s;
  };

  /// Result of a Lucky transfer between accounts.
  public type LuckyTransferResult = {
    amount : Lucky;
    recipient : Principal;
    /// Caller's remaining Lucky balance after the transfer.
    remainingLucky : Lucky;
  };
};
