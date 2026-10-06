/// Public API for the production wallet: balances, deposit address, outgoing
/// ICP transfers, Lucky transfers and recent transfer records.
import Common "../types/common";
import Wallet "../types/wallet";
import WalletLib "../lib/wallet";
import State "../types/state";

mixin (state : State.GameState, canisterPrincipal : Principal) {
  /// Caller's wallet balances: Lucky plus the real ICP balance held by the
  /// canister on the ICP ledger, and the ledger transfer fee.
  public shared ({ caller }) func getWalletBalances() : async Wallet.WalletBalances {
    await WalletLib.getWalletBalances(state, canisterPrincipal, caller);
  };

  /// Caller's own ICP deposit address (canister principal + per-user
  /// subaccount) so the user can receive ICP.
  public query ({ caller }) func getDepositAddress() : async Wallet.DepositAddress {
    WalletLib.getDepositAddress(canisterPrincipal, caller);
  };

  /// Send ICP (e8s) from the caller's balance to an arbitrary recipient
  /// principal, validating the balance and the ledger transfer fee.
  public shared ({ caller }) func transferIcp(
    recipient : Principal,
    amount : Common.IcpE8s,
  ) : async Common.GameError {
    await WalletLib.transferIcp(state, canisterPrincipal, caller, recipient, amount);
  };

  /// Transfer Lucky from the caller's balance to another principal.
  public shared ({ caller }) func transferLucky(
    recipient : Principal,
    amount : Common.Lucky,
  ) : async Common.GameError {
    WalletLib.transferLucky(state, caller, recipient, amount);
  };

  /// Caller's most recent wallet transfer records, newest first (bounded list).
  public query ({ caller }) func getRecentTransfers() : async [Wallet.WalletTransferRecord] {
    WalletLib.getRecentTransfers(state, caller);
  };
};
