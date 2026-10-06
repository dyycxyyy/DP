/// Types for the ICP <-> Lucky exchange pool and the DAO treasury.
import Common "common";

module {
  public type Lucky = Common.Lucky;
  public type IcpE8s = Common.IcpE8s;

  /// Public snapshot of the exchange pool balances.
  public type ExchangePoolState = {
    icpBalance : IcpE8s;
    luckyBalance : Lucky;
  };

  /// Result of an ICP -> Lucky exchange.
  public type ExchangeToLuckyResult = {
    icpSpent : IcpE8s;
    luckyReceived : Lucky;
    poolIcp : IcpE8s;
    poolLucky : Lucky;
  };

  /// Result of a Lucky -> ICP exchange, including the 3% Lucky fee.
  public type ExchangeToIcpResult = {
    luckySpent : Lucky;
    feeLucky : Lucky;
    icpReceived : IcpE8s;
    poolIcp : IcpE8s;
    poolLucky : Lucky;
    treasuryBalance : Lucky;
  };
};
