/// Domain logic for the ICP <-> Lucky exchange pool and the DAO treasury.
/// Fixed rate: 1 ICP = 1000 Lucky. ICP is accounted in e8s
/// (1 ICP = 100_000_000 e8s). The exchange module runs around the clock and is
/// independent of the round timeline and the 3-second game-action cooldown.
import List "mo:core/List";
import Map "mo:core/Map";
import Common "../types/common";
import Exchange "../types/exchange";
import Game "../types/game";
import State "../types/state";

module {
  /// 1 ICP expressed in e8s.
  let ICP_E8S : Nat = 100_000_000;
  /// Lucky received per whole ICP.
  let LUCKY_PER_ICP : Nat = 1000;
  /// Minimum ICP accepted in one exchange: 0.1 ICP.
  let MIN_ICP_E8S : Nat = 10_000_000;
  /// Maximum ICP accepted in one exchange: 10_000 ICP.
  let MAX_ICP_E8S : Nat = 1_000_000_000_000;
  /// Lucky -> ICP input must be a positive multiple of this step.
  let LUCKY_STEP : Nat = 1000;
  /// Maximum Lucky accepted in one reverse exchange: 10_000_000.
  let MAX_LUCKY : Nat = 10_000_000;
  /// Reverse-exchange fee in percent of the input, paid in Lucky.
  let FEE_PERCENT : Nat = 3;

  /// Read the current exchange pool balances.
  public func getExchangePoolState(state : State.GameState) : Exchange.ExchangePoolState {
    {
      icpBalance = state.exchangePoolIcp;
      luckyBalance = state.exchangePoolLucky;
    };
  };

  /// Read the current DAO treasury balance.
  public func getTreasuryBalance(state : State.GameState) : Common.Lucky {
    state.treasuryBalance;
  };

  /// Exchange ICP (e8s) for Lucky at the fixed 1 ICP = 1000 Lucky rate.
  /// No fee. The ICP joins the pool and the pool pays out the Lucky.
  public func exchangeIcpToLucky(
    state : State.GameState,
    caller : Principal,
    icpE8s : Common.IcpE8s,
  ) : Common.GameError {
    if (icpE8s < MIN_ICP_E8S) { return #amountTooSmall({ min = MIN_ICP_E8S }) };
    if (icpE8s > MAX_ICP_E8S) { return #amountTooLarge({ max = MAX_ICP_E8S }) };
    if (icpE8s % MIN_ICP_E8S != 0) { return #invalidAmount({ step = MIN_ICP_E8S }) };

    let luckyOut = icpE8s * LUCKY_PER_ICP / ICP_E8S;
    if (state.exchangePoolLucky < luckyOut) {
      return #poolInsufficient({ token = "Lucky"; available = state.exchangePoolLucky });
    };

    let account = getOrCreatePlayer(state, caller);
    state.exchangePoolIcp += icpE8s;
    state.exchangePoolLucky -= luckyOut;
    account.luckyBalance += luckyOut;
    #ok;
  };

  /// Exchange Lucky for ICP at the fixed rate, charging a 3% Lucky fee that
  /// flows to the treasury. The input must be a positive multiple of 1000.
  public func exchangeLuckyToIcp(
    state : State.GameState,
    caller : Principal,
    luckyAmount : Common.Lucky,
  ) : Common.GameError {
    if (luckyAmount < LUCKY_STEP) { return #amountTooSmall({ min = LUCKY_STEP }) };
    if (luckyAmount > MAX_LUCKY) { return #amountTooLarge({ max = MAX_LUCKY }) };
    if (luckyAmount % LUCKY_STEP != 0) { return #invalidAmount({ step = LUCKY_STEP }) };

    let account = getOrCreatePlayer(state, caller);
    if (account.luckyBalance < luckyAmount) {
      return #insufficientBalance({ required = luckyAmount; available = account.luckyBalance });
    };

    let fee = luckyAmount * FEE_PERCENT / 100;
    let actualLucky = luckyAmount - fee;
    // ICP is paid in e8s: 1 Lucky = 1/1000 ICP = 100_000 e8s.
    let icpOut = actualLucky * ICP_E8S / LUCKY_PER_ICP;
    if (state.exchangePoolIcp < icpOut) {
      return #poolInsufficient({ token = "ICP"; available = state.exchangePoolIcp });
    };

    account.luckyBalance -= luckyAmount;
    state.treasuryBalance += fee;
    state.exchangePoolLucky += actualLucky;
    state.exchangePoolIcp -= icpOut;
    #ok;
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
};
