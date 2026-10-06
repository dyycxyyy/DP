/// Public API for the ICP <-> Lucky exchange pool and the DAO treasury.
import Common "../types/common";
import Exchange "../types/exchange";
import ExchangeLib "../lib/exchange";
import State "../types/state";

mixin (state : State.GameState) {
  /// Current exchange pool balances (ICP in e8s, Lucky).
  public query func getExchangePoolState() : async Exchange.ExchangePoolState {
    ExchangeLib.getExchangePoolState(state);
  };

  /// Current DAO treasury balance in Lucky.
  public query func getTreasuryBalance() : async Common.Lucky {
    ExchangeLib.getTreasuryBalance(state);
  };

  /// Exchange ICP (e8s) for Lucky at the fixed 1 ICP = 1000 Lucky rate.
  /// Minimum 0.1 ICP, must be a multiple of 0.1 ICP, max 10_000 ICP.
  public shared ({ caller }) func exchangeIcpToLucky(icpE8s : Common.IcpE8s) : async Common.GameError {
    ExchangeLib.exchangeIcpToLucky(state, caller, icpE8s);
  };

  /// Exchange Lucky for ICP at the fixed rate. Amount must be a positive
  /// multiple of 1000, max 10_000_000 Lucky, with a 3% Lucky fee.
  public shared ({ caller }) func exchangeLuckyToIcp(luckyAmount : Common.Lucky) : async Common.GameError {
    ExchangeLib.exchangeLuckyToIcp(state, caller, luckyAmount);
  };
};
